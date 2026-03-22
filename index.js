const {
  Client, GatewayIntentBits, EmbedBuilder,
  SlashCommandBuilder, PermissionFlagsBits, REST, Routes
} = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  CHECK_INTERVAL_MS: 3 * 60 * 1000,
};

const ROBLOX_VERSION_URL = 'https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer';
const ROBLOX_DOWNLOAD_BASE = 'https://setup.rbxcdn.com';
const BOT_VERSION = '2.0.0';
const EMBED_COLOR = 0xFFFFFF;

let lastKnownVersion = null;
let updateHistory = [];
let startTime = Date.now();
let totalUpdatesDetected = 0;
const guildSettings = {};

function downloadUrl(v) { return `${ROBLOX_DOWNLOAD_BASE}/${v}-RobloxApp.zip`; }
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

async function fetchRobloxVersion() {
  const res = await axios.get(ROBLOX_VERSION_URL, { timeout: 10000 });
  return { version: res.data.clientVersionUpload };
}

function updateEmbed(versionData, previousVersion) {
  const embed = new EmbedBuilder()
    .setTitle('⬡  Roblox Updated')
    .setDescription('A new version of Roblox has been deployed and is now live for all players.')
    .setColor(EMBED_COLOR)
    .addFields(
      { name: 'New Version', value: `\`${versionData.version}\``, inline: true },
      { name: 'Platform', value: '🪟 Windows', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Download', value: `[Click to Download](${downloadUrl(versionData.version)})`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: 'Cyclone X • Roblox Update Tracker' });
  if (previousVersion) {
    embed.addFields({ name: 'Previous Version', value: `\`${previousVersion}\``, inline: true });
  }
  return embed;
}

function historyEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('⬡  Update History')
    .setColor(EMBED_COLOR)
    .setFooter({ text: 'Cyclone X • Roblox Update Tracker' })
    .setTimestamp();
  if (updateHistory.length === 0) {
    embed.setDescription('No updates detected yet since the bot started.');
  } else {
    const lines = updateHistory.slice(-5).reverse().map((u, i) => {
      const time = `<t:${Math.floor(u.timestamp / 1000)}:R>`;
      return `**${i + 1}.** \`${u.version}\` — ${time}`;
    });
    embed.setDescription(lines.join('\n'));
    embed.addFields({ name: 'Total Updates Detected', value: `${totalUpdatesDetected}`, inline: true });
  }
  return embed;
}

function statusEmbed() {
  const uptime = formatUptime(Date.now() - startTime);
  const nextCheck = Math.floor((Date.now() + CONFIG.CHECK_INTERVAL_MS) / 1000);
  return new EmbedBuilder()
    .setTitle('⬡  Bot Status')
    .setColor(EMBED_COLOR)
    .addFields(
      { name: '🟢 Status', value: 'Online', inline: true },
      { name: '⏱ Uptime', value: uptime, inline: true },
      { name: '🔢 Version', value: `v${BOT_VERSION}`, inline: true },
      { name: '📦 Current Roblox Version', value: lastKnownVersion ? `\`${lastKnownVersion}\`` : 'Fetching...', inline: false },
      { name: '🔄 Next Check', value: `<t:${nextCheck}:R>`, inline: true },
      { name: '📊 Updates Detected', value: `${totalUpdatesDetected}`, inline: true },
    )
    .setFooter({ text: 'Cyclone X • Roblox Update Tracker' })
    .setTimestamp();
}

function setupEmbed(channelId, type) {
  return new EmbedBuilder()
    .setTitle('⬡  Setup Complete')
    .setColor(EMBED_COLOR)
    .setDescription('This server is now configured to receive Roblox update notifications.')
    .addFields(
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Notifications', value: type, inline: true },
    )
    .setFooter({ text: 'Cyclone X • Roblox Update Tracker' })
    .setTimestamp();
}

async function postUpdate(versionData, previousVersion) {
  const entry = { version: versionData.version, previous: previousVersion, timestamp: Date.now() };
  updateHistory.push(entry);
  if (updateHistory.length > 50) updateHistory.shift();
  totalUpdatesDetected++;

  for (const [guildId, settings] of Object.entries(guildSettings)) {
    if (!settings.channelId) continue;
    if (!settings.types.includes('updates') && !settings.types.includes('all')) continue;
    try {
      const channel = await client.channels.fetch(settings.channelId);
      if (!channel) continue;
      await channel.send({ content: '@everyone', embeds: [updateEmbed(versionData, previousVersion)] });
    } catch (e) {
      console.error(`Failed to post to guild ${guildId}:`, e.message);
    }
  }
}

async function checkForUpdates() {
  try {
    const data = await fetchRobloxVersion();
    const currentVersion = data.version;
    if (lastKnownVersion === null) {
      lastKnownVersion = currentVersion;
      console.log(`🔍 Watching for updates. Current: ${currentVersion}`);
      return;
    }
    if (currentVersion !== lastKnownVersion) {
      console.log(`🆕 New version: ${currentVersion}`);
      await postUpdate(data, lastKnownVersion);
      lastKnownVersion = currentVersion;
    } else {
      console.log(`🔄 No update [${new Date().toLocaleTimeString()}]`);
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('currentversion')
    .setDescription('Show the current live Roblox version'),
  new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show the last 5 Roblox updates detected by the bot'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show the bot status and uptime'),
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Roblox update notifications for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post notifications in')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('What to post in the channel')
        .setRequired(true)
        .addChoices(
          { name: 'All notifications', value: 'all' },
          { name: 'Updates only', value: 'updates' },
          { name: 'History only', value: 'history' },
          { name: 'Status only', value: 'status' },
        )),
].map(c => c.toJSON());

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  try {
    if (interaction.commandName === 'currentversion') {
      const data = await fetchRobloxVersion();
      const embed = new EmbedBuilder()
        .setTitle('⬡  Current Roblox Version')
        .setColor(EMBED_COLOR)
        .addFields(
          { name: 'Version', value: `\`${data.version}\``, inline: true },
          { name: 'Platform', value: '🪟 Windows', inline: true },
          { name: 'Download', value: `[Click to Download](${downloadUrl(data.version)})`, inline: false },
        )
        .setFooter({ text: 'Cyclone X • Roblox Update Tracker' })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
    else if (interaction.commandName === 'history') {
      await interaction.editReply({ embeds: [historyEmbed()] });
    }
    else if (interaction.commandName === 'status') {
      await interaction.editReply({ embeds: [statusEmbed()] });
    }
    else if (interaction.commandName === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const type = interaction.options.getString('type');
      guildSettings[interaction.guildId] = { channelId: channel.id, types: [type] };
      console.log(`⚙️ Guild ${interaction.guildId} → #${channel.name} → ${type}`);
      await interaction.editReply({ embeds: [setupEmbed(channel.id, type)] });
    }
  } catch (err) {
    console.error('Command error:', err);
    await interaction.editReply('❌ Something went wrong. Please try again.');
  }
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered');
  } catch (e) {
    console.error('Failed to register commands:', e.message);
  }
  await checkForUpdates();
  setInterval(checkForUpdates, CONFIG.CHECK_INTERVAL_MS);
});

client.login(CONFIG.TOKEN);
