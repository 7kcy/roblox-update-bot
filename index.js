const { Client, GatewayIntentBits, EmbedBuilder, WebhookClient } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,
  CHANNEL_ID: process.env.CHANNEL_ID,
  CHECK_INTERVAL_MS: 3 * 60 * 1000, // Check every 3 minutes
  ROLE_TO_PING: process.env.ROLE_ID || null, // Optional: role ID to ping on update
};
// ──────────────────────────────────────────────────────────────────────────────

const ROBLOX_VERSION_URL = 'https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer';
const ROBLOX_DOWNLOAD_BASE = 'https://setup.rbxcdn.com';

let lastKnownVersion = null;
let checkInterval = null;

// Fetch current Roblox version from their CDN API
async function fetchRobloxVersion() {
  const res = await axios.get(ROBLOX_VERSION_URL, { timeout: 10000 });
  return {
    version: res.data.clientVersionUpload,       // e.g. version-ae421f0582e54718
    bootstrapperVersion: res.data.bootstrapperVersion,
  };
}

// Build the update embed matching the style in your screenshots
function buildUpdateEmbed(versionData, previousVersion) {
  const downloadUrl = `${ROBLOX_DOWNLOAD_BASE}/${versionData.version}-RobloxApp.zip`;
  const now = new Date();

  const embed = new EmbedBuilder()
    .setTitle('Roblox has updated!')
    .setDescription('Roblox has just updated! This version is now released and is being used by players!')
    .setColor(0x00b0f4)
    .addFields(
      { name: 'Version', value: `\`${versionData.version}\``, inline: false },
      { name: 'Platform', value: 'Windows', inline: true },
      { name: 'Download Here', value: `[Download Link](${downloadUrl})`, inline: true },
    )
    .setTimestamp(now)
    .setFooter({ text: 'Roblox Update Tracker' });

  if (previousVersion) {
    embed.addFields({ name: 'Previous Version', value: `\`${previousVersion}\``, inline: false });
  }

  return embed;
}

// Post update to the configured channel
async function postUpdate(versionData, previousVersion) {
  const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
  if (!channel) return console.error('❌ Could not find channel:', CONFIG.CHANNEL_ID);

  const embed = buildUpdateEmbed(versionData, previousVersion);
  const pingContent = '@everyone';

  await channel.send({ content: pingContent || undefined, embeds: [embed] });
  console.log(`✅ Posted update: ${versionData.version}`);
}

// Main polling loop
async function checkForUpdates() {
  try {
    const data = await fetchRobloxVersion();
    const currentVersion = data.version;

    if (lastKnownVersion === null) {
      // First run — just store the version, don't announce
      lastKnownVersion = currentVersion;
      console.log(`🔍 Watching for updates. Current version: ${currentVersion}`);
      return;
    }

    if (currentVersion !== lastKnownVersion) {
      console.log(`🆕 New version detected: ${currentVersion} (was ${lastKnownVersion})`);
      await postUpdate(data, lastKnownVersion);
      lastKnownVersion = currentVersion;
    } else {
      console.log(`🔄 No update. Version: ${currentVersion} [${new Date().toLocaleTimeString()}]`);
    }
  } catch (err) {
    console.error('❌ Error checking for updates:', err.message);
  }
}

// ─── BOT READY ────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📡 Polling Roblox every ${CONFIG.CHECK_INTERVAL_MS / 1000}s...`);

  // Run immediately, then on interval
  await checkForUpdates();
  checkInterval = setInterval(checkForUpdates, CONFIG.CHECK_INTERVAL_MS);
});

// Slash command: /currentversion
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'currentversion') {
    await interaction.deferReply();
    try {
      const data = await fetchRobloxVersion();
      const embed = new EmbedBuilder()
        .setTitle('Current Roblox Version')
        .setColor(0x00b0f4)
        .addFields(
          { name: 'Version', value: `\`${data.version}\``, inline: false },
          { name: 'Platform', value: 'Windows', inline: true },
          { name: 'Download', value: `[Download Link](${ROBLOX_DOWNLOAD_BASE}/${data.version}-RobloxApp.zip)`, inline: true },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply('❌ Failed to fetch version info.');
    }
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
client.login(CONFIG.TOKEN);
