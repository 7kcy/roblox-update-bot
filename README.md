# Roblox Update Bot

A Discord bot that automatically detects and announces Roblox updates, just like the screenshots you provided.

---

## 📋 What It Does

- Polls Roblox's CDN API every **3 minutes** for version changes
- Posts a clean embed in your channel when a new version drops
- Shows the **version hash**, **download link**, and **previous version**
- Optional: pings a role when an update is detected
- Slash command `/currentversion` to check the live version on demand

---

## 🛠️ Setup (Step by Step)

### 1. Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name (e.g. `Roblox Update Bot`)
3. Go to the **Bot** tab → click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it — this is your `DISCORD_TOKEN`
5. Copy your **Application ID** from the General Information tab — this is your `CLIENT_ID`
6. Under **Bot → Privileged Gateway Intents**, enable **Server Members Intent** (optional but safe to have)

### 2. Invite the Bot to Your Server

1. Go to **OAuth2 → URL Generator**
2. Check **bot** and **applications.commands** scopes
3. Under Bot Permissions, check:
   - Send Messages
   - Embed Links
   - Mention Everyone (only if you want role pings)
4. Copy the generated URL and open it in your browser to invite the bot

### 3. Get Your Channel ID

1. In Discord, go to **Settings → Advanced → Enable Developer Mode**
2. Right-click the channel where you want updates posted → **Copy Channel ID**
3. This is your `CHANNEL_ID`

### 4. Configure the Bot

Copy `.env.example` to `.env` and fill it in:

```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
CHANNEL_ID=your_channel_id_here

# Optional: uncomment and set to ping a role on update
# ROLE_ID=your_role_id_here
```

---

## 🚀 Running the Bot

### Option A — Run Locally (Node.js)

**Requirements:** Node.js 18+

```bash
# Install dependencies
npm install

# Register slash commands (run once)
npm run deploy

# Start the bot
npm start
```

### Option B — Run with Docker (Recommended for 24/7 hosting)

**Requirements:** Docker + Docker Compose

```bash
# Copy and fill in your .env file
cp .env.example .env
nano .env   # or edit with any text editor

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## ☁️ Free Hosting Options

| Platform | Notes |
|---|---|
| **Railway** | Easy, $5/mo free credit, just connect your GitHub repo |
| **Render** | Free tier available, may sleep on inactivity |
| **Oracle Cloud** | Free VPS forever, run with Docker |
| **Your own VPS** | Use Docker Compose, most reliable |

---

## ⚙️ Customization

Edit these values in `index.js`:

| Setting | Default | Description |
|---|---|---|
| `CHECK_INTERVAL_MS` | `3 * 60 * 1000` | How often to check (ms). 3 min = 180000 |
| `ROLE_TO_PING` | `null` | Set `ROLE_ID` in `.env` to ping a role |

To check more platforms (e.g. Mac), you can add more `fetchRobloxVersion` calls with different endpoints:
- Windows Player: `https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer`
- Mac Player: `https://clientsettingscdn.roblox.com/v2/client-version/MacPlayer`
- Windows Studio: `https://clientsettingscdn.roblox.com/v2/client-version/WindowsStudio64`

---

## 🔔 Slash Commands

| Command | Description |
|---|---|
| `/currentversion` | Shows the current live Roblox version |

---

## ❓ Troubleshooting

**Bot doesn't post updates:**
- Double-check `CHANNEL_ID` is correct
- Make sure the bot has **Send Messages** and **Embed Links** permissions in that channel

**Slash command not showing up:**
- Run `npm run deploy` and wait up to 1 hour for Discord to propagate it globally

**Bot crashes:**
- Check logs with `docker-compose logs -f` or look at the console output
- Make sure your `DISCORD_TOKEN` is valid and hasn't been reset
