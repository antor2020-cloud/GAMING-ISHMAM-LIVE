require("dotenv").config();

require("@discordjs/voice");

// ─── FFMPEG ─────────────────────────────────────────────

const ffmpeg = require("ffmpeg-static");

if (!ffmpeg) {
  console.error("❌ FFmpeg not found");
}

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

  savePreviousSongs: true,

  plugins: [
    new YouTubePlugin()
  ]
});

// ─── REGISTER COMMANDS ─────────────────────────────────

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
          .setDescription("1-100")
          .setRequired(true)
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

  console.log(`✅ Logged in as ${client.user.tag}`);

  client.user.setActivity("🎵 Music", {
    type: ActivityType.Listening
  });

  await registerCommands();
});

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

      interaction.editReply(
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

    try {

      await queue.skip();

      interaction.reply("⏭ Song skipped");

    } catch {

      queue.stop();

      interaction.reply("⏭ Queue ended");
    }
  }

  // ─── STOP ────────────────────────────────────────────

  else if (commandName === "stop") {

    const queue = client.distube.getQueue(guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    await queue.stop();

    interaction.reply("⏹ Music stopped");
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
      .map((song, i) => {
        return `${i + 1}. ${song.name}`;
      })
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

    if (amount < 1 || amount > 100) {
      return interaction.reply("❌ 1-100 dao");
    }

    queue.setVolume(amount);

    interaction.reply(
      `🔊 Volume set to ${amount}%`
    );
  }
});

// ─── MUSIC EVENTS ───────────────────────────────────────

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

// ─── ERRORS ─────────────────────────────────────────────

client.distube.on("error", (error, queue) => {

  console.log(error);

  queue?.textChannel?.send(
    `❌ ${error.message}`
  );
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ─── LOGIN ──────────────────────────────────────────────

client.login(process.env.TOKEN);
