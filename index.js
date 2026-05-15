require("dotenv").config();

// ─── FFMPEG ─────────────────────────────────────────────

const ffmpeg = require("ffmpeg-static");

if (!ffmpeg) {
  console.log("❌ FFmpeg not found");
  process.exit(1);
}

process.env.FFMPEG_PATH = ffmpeg;

// ─── IMPORTS ────────────────────────────────────────────

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
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
  leaveOnEmpty: true,
  leaveOnStop: true,
  leaveOnFinish: false,

  plugins: [
    new YouTubePlugin()
  ]
});

// ─── COMMANDS ───────────────────────────────────────────

async function registerCommands() {

  const commands = [

    new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play music")
      .addStringOption(option =>
        option
          .setName("song")
          .setDescription("Song name or URL")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("skip")
      .setDescription("Skip current song"),

    new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stop music"),

    new SlashCommandBuilder()
      .setName("queue")
      .setDescription("Show queue"),

    new SlashCommandBuilder()
      .setName("pause")
      .setDescription("Pause music"),

    new SlashCommandBuilder()
      .setName("resume")
      .setDescription("Resume music"),

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

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    {
      body: commands
    }
  );

  console.log("✅ Slash Commands Registered");
}

// ─── READY ──────────────────────────────────────────────

client.once("ready", async () => {

  console.log(`✅ Logged in as ${client.user.tag}`);

  await registerCommands();
});

// ─── INTERACTION ────────────────────────────────────────

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ─── PLAY ────────────────────────────────────────────

  if (commandName === "play") {

    const voiceChannel = interaction.member.voice.channel;

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

    const song = interaction.options.getString("song");

    await interaction.deferReply();

    try {

      await client.distube.play(
        voiceChannel,
        song,
        {
          member: interaction.member,
          textChannel: interaction.channel
        }
      );

      await interaction.editReply(
        `🎵 Playing: **${song}**`
      );

    } catch (err) {

      console.log(err);

      await interaction.editReply(
        `❌ ${err.message}`
      );
    }
  }

  // ─── SKIP ────────────────────────────────────────────

  else if (commandName === "skip") {

    const queue = client.distube.getQueue(interaction.guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    try {

      await queue.skip();

      interaction.reply("⏭ Skipped");

    } catch {

      queue.stop();

      interaction.reply("⏭ Queue Ended");
    }
  }

  // ─── STOP ────────────────────────────────────────────

  else if (commandName === "stop") {

    const queue = client.distube.getQueue(interaction.guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    await queue.stop();

    interaction.reply("⏹ Music stopped");
  }

  // ─── QUEUE ───────────────────────────────────────────

  else if (commandName === "queue") {

    const queue = client.distube.getQueue(interaction.guild.id);

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

  // ─── PAUSE ───────────────────────────────────────────

  else if (commandName === "pause") {

    const queue = client.distube.getQueue(interaction.guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    queue.pause();

    interaction.reply("⏸ Paused");
  }

  // ─── RESUME ──────────────────────────────────────────

  else if (commandName === "resume") {

    const queue = client.distube.getQueue(interaction.guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    queue.resume();

    interaction.reply("▶ Resumed");
  }

  // ─── VOLUME ──────────────────────────────────────────

  else if (commandName === "volume") {

    const queue = client.distube.getQueue(interaction.guild.id);

    if (!queue) {
      return interaction.reply("❌ Nothing playing");
    }

    const amount = interaction.options.getInteger("amount");

    if (amount < 1 || amount > 100) {
      return interaction.reply("❌ 1-100 dao");
    }

    queue.setVolume(amount);

    interaction.reply(
      `🔊 Volume set to ${amount}%`
    );
  }
});

// ─── EVENTS ─────────────────────────────────────────────

client.distube.on("playSong", (queue, song) => {

  queue.textChannel.send(
    `🎵 Playing: **${song.name}**`
  );
});

client.distube.on("addSong", (queue, song) => {

  queue.textChannel.send(
    `➕ Added: **${song.name}**`
  );
});

client.distube.on("finish", queue => {

  queue.textChannel.send(
    "✅ Queue Finished"
  );
});

client.distube.on("error", (error, queue) => {

  console.log(error);

  if (queue?.textChannel) {
    queue.textChannel.send(
      `❌ ${error.message}`
    );
  }
});

// ─── PROCESS ERRORS ─────────────────────────────────────

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ─── LOGIN ──────────────────────────────────────────────

client.login(process.env.TOKEN);
