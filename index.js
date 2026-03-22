const {
  Client, GatewayIntentBits, EmbedBuilder,
  SlashCommandBuilder, PermissionFlagsBits, REST, Routes,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
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

function resolveColor(input) {
  if (!input) return EMBED_COLOR;
  const map = {
    red: 0xFF0000, blue: 0x0000FF, green: 0x00FF00,
    white: 0xFFFFFF, black: 0x111111, yellow: 0xFFFF00,
    purple: 0x9B59B6, orange: 0xFF7700, pink: 0xFF69B4,
    cyan: 0x00FFFF,
  };
  const lower = input.toLowerCase().trim();
  if (map[lower]) return map[lower];
  const hex = input.replace('#', '');
  const parsed = parseInt(hex, 16);
  return isNaN(parsed) ? EMBED_COLOR : parsed;
}

async function fetchRobloxVersion() {
  const res = await axios.get(ROBLOX_VERSION_URL, { timeout: 10000 });
  return { version: res.data.clientVersionUpload };
}

function getPingContent(settings) {
  if (!settings.ping) return '';
  if (settings.ping === 'everyone') return '@everyone';
  if (settings.ping === 'here') return '@here';
  if (settings.ping === 'role' && settings.roleId) return `<@&${settings.roleId}>`;
  return '';
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

function setupEmbed(channelId, types, ping, roleId) {
  let pingDisplay = 'None';
  if (ping === 'everyone') pingDisplay = '@everyone';
  else if (ping === 'here') pingDisplay = '@here';
  else if (ping === 'role' && roleId) pingDisplay = `<@&${roleId}>`;
  return new EmbedBuilder()
    .setTitle('⬡  Setup Complete')
    .setColor(EMBED_COLOR)
    .setDescription('Cyclone X is now configured for this server.')
    .addFields(
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Notifications', value: types.join(', '), inline: true },
      { name: 'Ping', value: pingDisplay, inline: true },
    )
    .setFooter({ text: 'Cyclone X • Roblox Update Tracker' })
    .setTimestamp();
}

function testEmbed(settings) {
  const types = settings ? settings.types : [];
  const hasUpdates = types.includes('updates') || types.includes('all');
  const hasHistory = types.includes('history') || types.includes('all');
  const hasStatus = types.includes('status') || types.includes('all');
  const statusLine = (active, label) =>
    `${active ? '🟢' : '🔴'} **${label}** — ${active ? 'Active' : 'Inactive'}`;
  return new EmbedBuilder()
    .setTitle('⬡  Cyclone X')
    .setDescription(
      `**Cyclone X Is activated with these statuses:**\n\n` +
      `${statusLine(hasUpdates, 'Update Notifications')}\n` +
      `${statusLine(hasHistory, 'History Tracking')}\n` +
      `${statusLine(hasStatus, 'Status Reports')}\n` +
      `${statusLine(!!settings, 'Server Setup')}`
    )
    .setColor(EMBED_COLOR)
    .addFields(
      { name: 'Channel', value: settings ? `<#${settings.channelId}>` : 'Not configured', inline: true },
      { name: 'Ping', value: settings ? (settings.ping === 'everyone' ? '@everyone' : settings.ping === 'here' ? '@here' : settings.roleId ? `<@&${settings.roleId}>` : 'None') : 'None', inline: true },
      { name: 'Uptime', value: formatUptime(Date.now() - startTime), inline: true },
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
      const ping = getPingContent(settings);
      await channel.send({ content: ping || undefined, embeds: [updateEmbed(versionData, previousVersion)] });
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
      console.log(`🔍 Watching. Current: ${currentVersion}`);
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
    .setName('test')
    .setDescription('Test the bot and show active statuses for this server'),

  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Roblox update notifications for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to post notifications in').setRequired(true))
    .addStringOption(opt =>
      opt.setName('type1').setDescription('First notification type').setRequired(true)
        .addChoices(
          { name: 'All notifications', value: 'all' },
          { name: 'Updates', value: 'updates' },
          { name: 'History', value: 'history' },
          { name: 'Status', value: 'status' },
        ))
    .addStringOption(opt =>
      opt.setName('type2').setDescription('Second notification type (optional)').setRequired(false)
        .addChoices(
          { name: 'Updates', value: 'updates' },
          { name: 'History', value: 'history' },
          { name: 'Status', value: 'status' },
        ))
    .addStringOption(opt =>
      opt.setName('type3').setDescription('Third notification type (optional)').setRequired(false)
        .addChoices(
          { name: 'Updates', value: 'updates' },
          { name: 'History', value: 'history' },
          { name: 'Status', value: 'status' },
        ))
    .addStringOption(opt =>
      opt.setName('ping').setDescription('Who to ping when an update is posted').setRequired(false)
        .addChoices(
          { name: '@everyone', value: 'everyone' },
          { name: '@here', value: 'here' },
          { name: 'A specific role', value: 'role' },
          { name: 'No ping', value: 'none' },
        ))
    .addRoleOption(opt =>
      opt.setName('role').setDescription('Role to ping (only if ping is set to role)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a custom embed to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send the embed to').setRequired(true))
    .addStringOption(opt =>
      opt.setName('title').setDescription('Embed title').setRequired(false))
    .addStringOption(opt =>
      opt.setName('description').setDescription('Embed description / main text').setRequired(false))
    .addStringOption(opt =>
      opt.setName('color').setDescription('Color (e.g. red, blue, #FF0000)').setRequired(false))
    .addStringOption(opt =>
      opt.setName('footer').setDescription('Footer text').setRequired(false))
    .addStringOption(opt =>
      opt.setName('image').setDescription('Image URL (large image at bottom)').setRequired(false))
    .addStringOption(opt =>
      opt.setName('thumbnail').setDescription('Thumbnail URL (small image top right)').setRequired(false))
    .addStringOption(opt =>
      opt.setName('field1').setDescription('Field 1 — format: Title | Value').setRequired(false))
    .addStringOption(opt =>
      opt.setName('field2').setDescription('Field 2 — format: Title | Value').setRequired(false))
    .addStringOption(opt =>
      opt.setName('field3').setDescription('Field 3 — format: Title | Value').setRequired(false))
    .addStringOption(opt =>
      opt.setName('button_label').setDescription('Link button label (e.g. "Visit Website")').setRequired(false))
    .addStringOption(opt =>
      opt.setName('button_url').setDescription('Link button URL').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setavatar')
    .setDescription('Change the bot\'s global avatar (bot owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('url').setDescription('Direct image URL for the new avatar').setRequired(true)),

].map(c => c.toJSON());

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: true });

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
      await interaction.editReply({ embeds: [embed], ephemeral: false });
    }

    else if (interaction.commandName === 'history') {
      await interaction.editReply({ embeds: [historyEmbed()], ephemeral: false });
    }

    else if (interaction.commandName === 'status') {
      await interaction.editReply({ embeds: [statusEmbed()], ephemeral: false });
    }

    else if (interaction.commandName === 'test') {
      const settings = guildSettings[interaction.guildId] || null;
      await interaction.editReply({ embeds: [testEmbed(settings)], ephemeral: false });
    }

    else if (interaction.commandName === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const type1 = interaction.options.getString('type1');
      const type2 = interaction.options.getString('type2');
      const type3 = interaction.options.getString('type3');
      const ping = interaction.options.getString('ping') || 'none';
      const role = interaction.options.getRole('role');
      const types = [...new Set([type1, type2, type3].filter(Boolean))];
      guildSettings[interaction.guildId] = { channelId: channel.id, types, ping, roleId: role ? role.id : null };
      await interaction.editReply({ embeds: [setupEmbed(channel.id, types, ping, role?.id)], ephemeral: false });
    }

    else if (interaction.commandName === 'send') {
      const channelRaw = interaction.options.getChannel('channel');
      const channel = await client.channels.fetch(channelRaw.id);
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');
      const footer = interaction.options.getString('footer');
      const image = interaction.options.getString('image');
      const thumbnail = interaction.options.getString('thumbnail');
      const field1 = interaction.options.getString('field1');
      const field2 = interaction.options.getString('field2');
      const field3 = interaction.options.getString('field3');
      const buttonLabel = interaction.options.getString('button_label');
      const buttonUrl = interaction.options.getString('button_url');

      if (!title && !description) {
        return await interaction.editReply({ content: '❌ You need at least a title or description!', ephemeral: true });
      }

      const embed = new EmbedBuilder().setColor(resolveColor(color));
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (footer) embed.setFooter({ text: footer });
      if (image) embed.setImage(image);
      if (thumbnail) embed.setThumbnail(thumbnail);
      embed.setTimestamp();

      for (const raw of [field1, field2, field3]) {
        if (!raw) continue;
        const [name, ...rest] = raw.split('|');
        const value = rest.join('|').trim() || '\u200b';
        if (name?.trim()) embed.addFields({ name: name.trim(), value, inline: true });
      }

      const components = [];
      if (buttonLabel && buttonUrl) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(buttonLabel)
            .setURL(buttonUrl)
            .setStyle(ButtonStyle.Link)
        );
        components.push(row);
      }

      await channel.send({ embeds: [embed], components });
      await interaction.editReply({ content: `✅ Embed sent to <#${channel.id}>!`, ephemeral: true });
    }

    else if (interaction.commandName === 'setavatar') {
      const url = interaction.options.getString('url');
      try {
        const imageRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        const buffer = Buffer.from(imageRes.data);
        await client.user.setAvatar(buffer);
        await interaction.editReply({ content: '✅ Bot avatar updated!', ephemeral: true });
      } catch (e) {
        await interaction.editReply({ content: `❌ Failed to update avatar. Make sure the URL is a direct image link.\n\`${e.message}\``, ephemeral: true });
      }
    }

  } catch (err) {
    console.error('Command error:', err);
    await interaction.editReply({ content: '❌ Something went wrong. Please try again.', ephemeral: true });
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
