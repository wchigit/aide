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

Available targets: `Desktop` (Aide chat), `WeChat`, `Telegram`, `Discord`
