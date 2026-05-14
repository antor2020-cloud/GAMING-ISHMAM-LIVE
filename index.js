require("dotenv").config();

// ─── FFMPEG ─────────────────────────────────────────────

const ffmpeg = require("ffmpeg-static");
process.env.FFMPEG_PATH = ffmpeg;

// ─── IMPORTS ────────────────────────────────────────────

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType
} = require("discord.js");

const { DisTube } = require("distube");
const { YouTubePlugin } = require("@distube/youtube");
const { YtDlpPlugin } = require("@distube/yt-dlp");

// ─── CLIENT ─────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ─── DISTUBE ────────────────────────────────────────────

client.distube = new DisTube(client, {
  emitNewSongOnly: true,

  leaveOnEmpty: false,
  leaveOnStop: false,
  leaveOnFinish: false,

  plugins: [
    new YouTubePlugin(),
    new YtDlpPlugin()
  ]
});

// ─── 24/7 STORAGE ───────────────────────────────────────

const stayChannels = new Map();

// ─── SLASH COMMANDS ─────────────────────────────────────

async function registerCommands() {

  const commands = [

    new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play music")
      .addStringOption(option =>
        option
          .setName("song")
          .setDescription("Song name or url")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("skip")
      .setDescription("Skip current song"),

    new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stop music"),

    new SlashCommandBuilder()
      .setName("pause")
      .setDescription("Pause music"),

    new SlashCommandBuilder()
      .setName("resume")
      .setDescription("Resume music"),

    new SlashCommandBuilder()
      .setName("queue")
      .setDescription("Show queue"),

    new SlashCommandBuilder()
      .setName("nowplaying")
      .setDescription("Current song"),

    new SlashCommandBuilder()
      .setName("volume")
      .setDescription("Set volume")
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("1 - 100")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("247")
      .setDescription("24/7 VC System")

      .addSubcommand(sub =>
        sub
          .setName("enable")
          .setDescription("Enable 24/7")
          .addChannelOption(option =>
            option
              .setName("channel")
              .setDescription("Voice channel")
              .setRequired(true)
          )
      )

      .addSubcommand(sub =>
        sub
          .setName("disable")
          .setDescription("Disable 24/7")
      )

  ].map(cmd => cmd.toJSON());

  const rest = new REST({
    version: "10"
  }).setToken(process.env.TOKEN);

  try {

    console.log("🔄 Registering Slash Commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      {
        body: commands
      }
    );

    console.log("✅ Slash Commands Registered");

  } catch (err) {

    console.log(err);
  }
}

// ─── READY ──────────────────────────────────────────────

client.once("ready", async () => {

  console.log(`✅ ${client.user.tag} Online`);

  client.user.setActivity("🎵 Music 24/7", {
    type: ActivityType.Listening
  });

  await registerCommands();
});

// ─── JOIN 24/7 ──────────────────────────────────────────

async function join247(guild) {

  try {

    const channelId = stayChannels.get(guild.id);

    if (!channelId) return;

    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isVoiceBased()) return;

    const botVoice = guild.members.me.voice.channel;

    if (botVoice && botVoice.id === channel.id) return;

    await client.distube.play(
      channel,
      "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      {
        member: guild.members.me,
        textChannel: guild.systemChannel || null
      }
    );

    const queue = client.distube.getQueue(guild.id);

    if (queue) {
      queue.pause();
    }

    console.log(`✅ 24/7 Connected in ${guild.name}`);

  } catch (err) {

    console.log("[24/7 ERROR]", err);
  }
}

// ─── INTERACTIONS ───────────────────────────────────────

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild, options } = interaction;

  // ─── PLAY ────────────────────────────────────────────

  if (commandName === "play") {

    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ VC te join hou",
        ephemeral: true
      });
    }

    const permissions = voiceChannel.permissionsFor(client.user);

    if (!permissions.has(PermissionFlagsBits.Connect)) {
      return interaction.reply({
        content: "❌ CONNECT permission nai",
        ephemeral: true
      });
    }

    if (!permissions.has(PermissionFlagsBits.Speak)) {
      return interaction.reply({
        content: "❌ SPEAK permission nai",
        ephemeral: true
      });
    }

    const song = options.getString("song");

    await interaction.deferReply();

    try {

      await client.distube.play(
        voiceChannel,
        song,
        {
          textChannel: interaction.channel,
          member: member
        }
      );

      await interaction.editReply(
        `🎵 Playing: **${song}**`
      );

    } catch (err) {

      console.log(err);

      interaction.editReply(
        `❌ ${err.message}`
      );
    }
  }

  // ─── SKIP ────────────────────────────────────────────

  else if (commandName === "skip") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    await queue.skip();

    interaction.reply("⏭ Skipped");
  }

  // ─── STOP ────────────────────────────────────────────

  else if (commandName === "stop") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    await queue.stop();

    interaction.reply("⏹ Stopped");
  }

  // ─── PAUSE ───────────────────────────────────────────

  else if (commandName === "pause") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    queue.pause();

    interaction.reply("⏸ Paused");
  }

  // ─── RESUME ──────────────────────────────────────────

  else if (commandName === "resume") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    queue.resume();

    interaction.reply("▶ Resumed");
  }

  // ─── QUEUE ───────────────────────────────────────────

  else if (commandName === "queue") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue || !queue.songs.length) {
      return interaction.reply("❌ Queue empty");
    }

    const songs = queue.songs
      .map((song, i) => `${i + 1}. ${song.name}`)
      .slice(0, 10)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎵 Queue")
      .setDescription(songs);

    interaction.reply({
      embeds: [embed]
    });
  }

  // ─── NOW PLAYING ─────────────────────────────────────

  else if (commandName === "nowplaying") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    const song = queue.songs[0];

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎵 Now Playing")
      .setDescription(`[${song.name}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields(
        {
          name: "Duration",
          value: song.formattedDuration,
          inline: true
        },
        {
          name: "Requested By",
          value: `<@${song.member.id}>`,
          inline: true
        }
      );

    interaction.reply({
      embeds: [embed]
    });
  }

  // ─── VOLUME ──────────────────────────────────────────

  else if (commandName === "volume") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    const amount = options.getInteger("amount");

    queue.setVolume(amount);

    interaction.reply(
      `🔊 Volume: ${amount}%`
    );
  }

  // ─── 24/7 ────────────────────────────────────────────

  else if (commandName === "247") {

    if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "❌ Manage Server permission lagbe",
        ephemeral: true
      });
    }

    const sub = options.getSubcommand();

    // ENABLE

    if (sub === "enable") {

      const channel = options.getChannel("channel");

      if (!channel.isVoiceBased()) {
        return interaction.reply("❌ Voice channel dao");
      }

      stayChannels.set(guild.id, channel.id);

      await join247(guild);

      interaction.reply(
        `✅ 24/7 Enabled in ${channel}`
      );
    }

    // DISABLE

    else if (sub === "disable") {

      stayChannels.delete(guild.id);

      const queue = client.distube.getQueue(guild.id);

      if (queue?.voice) {
        queue.voice.leave();
      }

      interaction.reply(
        "❌ 24/7 Disabled"
      );
    }
  }
});

// ─── EVENTS ─────────────────────────────────────────────

client.distube.on("playSong", (queue, song) => {

  const embed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle("🎵 Playing")
    .setDescription(`[${song.name}](${song.url})`)
    .setThumbnail(song.thumbnail);

  queue.textChannel.send({
    embeds: [embed]
  });
});

client.distube.on("addSong", (queue, song) => {

  queue.textChannel.send(
    `➕ Added: **${song.name}**`
  );
});

// ─── AUTO RECONNECT ────────────────────────────────────

client.on("voiceStateUpdate", async (oldState, newState) => {

  if (newState.member?.id !== client.user.id) return;

  if (oldState.channelId && !newState.channelId) {

    const guild = oldState.guild;

    if (!stayChannels.has(guild.id)) return;

    setTimeout(() => {
      join247(guild);
    }, 5000);
  }
});

// ─── ERRORS ─────────────────────────────────────────────

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.distube.on("error", (error, queue) => {

  console.log(error);

  queue?.textChannel?.send(
    `❌ Error: ${error.message}`
  );
});

// ─── LOGIN ──────────────────────────────────────────────

client.login(process.env.TOKEN);
