require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const {
  joinVoiceChannel
} = require("@discordjs/voice");

const { DisTube } = require("distube");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

client.distube = new DisTube(client, {
  leaveOnEmpty: false,
  leaveOnFinish: false,
  leaveOnStop: false,
  emitNewSongOnly: true
});

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music")
    .addStringOption(option =>
      option
        .setName("song")
        .setDescription("Song name")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip current song"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music"),

  new SlashCommandBuilder()
    .setName("247")
    .setDescription("Enable 24/7 VC mode")
]
.map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("Slash commands deployed");
  } catch (err) {
    console.error(err);
  }
})();

client.once("ready", () => {
  console.log(`${client.user.tag} is online`);
});

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

client.login(process.env.TOKEN);
