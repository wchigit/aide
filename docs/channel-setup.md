# Channel Setup Guide

Channels let Aide reach you outside the desktop app — delivering job results and accepting remote commands. This guide covers how to set up each supported channel.

## Discord

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name (e.g. "Aide"), then **Create**
3. Go to **Bot** tab → click **Reset Token** → copy the token (you'll need it later)
4. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent** (required to read message text)

### 2. Invite the Bot to Your Server

1. Go to **OAuth2** → **URL Generator**
2. Select scopes: `bot`
3. Select permissions: `Send Messages`, `Read Message History`
4. Copy the generated URL, open it in your browser, and select your server

### 3. Get Your Channel ID

1. In Discord, go to **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click the channel you want Aide to use (e.g. `#general`)
3. Click **Copy Channel ID**

### 4. Configure in Aide

1. Open Aide → Settings → Channels → Discord
2. Paste the **Bot Token** and **Channel ID**
3. Click Connect

The bot will appear online in your server. Send `/help` (or `@Aide /help`) to verify.

---

## Telegram

### 1. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts (choose a name and username)
3. Copy the **bot token** BotFather gives you

### 2. Get Your Chat ID

1. Message your new bot in Telegram (send anything)
2. Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser
3. Find `"chat":{"id": 123456789}` in the response — that's your Chat ID

### 3. Configure in Aide

1. Open Aide → Settings → Channels → Telegram
2. Paste the **Bot Token** and **Chat ID**
3. Click Connect

Send `/help` to your bot to verify.

---

## Slack

### 1. Create a Slack App

1. Go to [Slack API](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it (e.g. "Aide") and select your workspace

### 2. Configure Bot Permissions

1. Go to **OAuth & Permissions** → **Bot Token Scopes**, add:
   - `chat:write`
   - `channels:history`
   - `channels:read`
2. Go to **Socket Mode** → enable it → create an **App-Level Token** with `connections:write` scope
3. Go to **Event Subscriptions** → enable → subscribe to `message.channels`
4. Install the app to your workspace

### 3. Get Your Channel ID

1. In Slack, right-click the channel → **View channel details**
2. Scroll to the bottom — the Channel ID is shown there (e.g. `C0123456789`)

### 4. Configure in Aide

1. Open Aide → Settings → Channels → Slack
2. Paste the **Bot Token** (starts with `xoxb-`), **App Token** (starts with `xapp-`), and **Channel ID**
3. Click Connect

---

## WeChat (微信)

WeChat uses houk's built-in integration. No external bot setup is required.

### Configure in Aide

1. Open Aide → Settings → Channels → WeChat
2. Click **Connect** — a QR code will appear
3. Scan the QR code with your WeChat mobile app
4. **Important**: Send any message to the bot first so it knows your user ID for delivery

---

## Delivery Targets

Once channels are connected, you can assign them as delivery targets on any Job:

1. Open a Job → Edit
2. Under **Delivery Targets**, select one or more channels
3. When the job completes, results are pushed to all selected channels

Available targets: `Desktop` (Aide chat), `WeChat`, `Telegram`, `Slack`, `Discord`
