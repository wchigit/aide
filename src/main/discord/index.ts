/**
 * Discord channel implementation.
 * Uses Discord REST API for sending and Gateway WebSocket for receiving.
 * No heavy discord.js library — just HTTP + WebSocket for what we need.
 */

import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { WebSocket } from 'ws'
import type { Channel, ChannelStatus, InboundMessageHandler } from '../channels/types'
import { dispatch as dispatchCommand } from './commands'
import { saveSecure, loadSecure, deleteSecure } from '../secure-store'

// ─── Configuration ───────────────────────────────────────────────────

const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json'
const MAX_CHUNK_SIZE = 1900 // Discord limit is 2000
const CHUNK_DELAY_MS = 150

const STATE_DIR = path.join(app.getPath('userData'), 'discord')
const CONFIG_FILE = path.join(STATE_DIR, 'config.json')

export interface DiscordConfig {
  botToken: string
  channelId: string
}

// ─── Module State ────────────────────────────────────────────────────

let config: DiscordConfig | null = null
let ws: WebSocket | null = null
let running = false
let messageHandler: InboundMessageHandler | null = dispatchCommand
let lastError: string | null = null
let botUsername: string | null = null
let botId: string | null = null
let guildName: string | null = null
let heartbeatInterval: ReturnType<typeof setInterval> | null = null
let lastSequence: number | null = null
let sessionId: string | null = null
let resumeGatewayUrl: string | null = null

// ─── Config Persistence ──────────────────────────────────────────────

function loadConfig(): DiscordConfig | null {
  const data = loadSecure<DiscordConfig>(CONFIG_FILE)
  if (data?.botToken && data?.channelId) return data
  return null
}

function saveConfig(cfg: DiscordConfig): void {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  saveSecure(CONFIG_FILE, cfg)
}

function clearSavedConfig(): void {
  deleteSecure(CONFIG_FILE)
}

// ─── Channel Interface ───────────────────────────────────────────────

export const discordChannel: Channel = {
  id: 'discord',

  status(): ChannelStatus {
    return {
      id: 'discord',
      connection: running ? 'connected' : config ? 'disconnected' : 'disconnected',
      lastError
    }
  },

  async connect(): Promise<void> {
    await connectDiscord()
  },

  disconnect(): void {
    disconnectDiscord()
  },

  async send(text: string): Promise<void> {
    await pushToDiscord(text)
  },

  onMessage(handler: InboundMessageHandler): void {
    messageHandler = handler
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export interface DiscordStatus {
  connection: 'disconnected' | 'connecting' | 'connected' | 'error'
  botUsername: string | null
  guildName: string | null
  channelId: string | null
  lastError: string | null
  monitorActive: boolean
}

export function getDiscordStatus(): DiscordStatus {
  const cfg = config || loadConfig()
  return {
    connection: running ? 'connected' : cfg ? 'disconnected' : 'disconnected',
    botUsername,
    guildName,
    channelId: cfg?.channelId || null,
    lastError,
    monitorActive: running
  }
}

/**
 * Validate token by fetching /users/@me
 */
async function validateToken(token: string): Promise<{ id: string; username: string }> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${token}` }
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Invalid bot token: ${res.status} ${body}`)
  }
  const data = await res.json()
  return { id: data.id, username: `${data.username}#${data.discriminator}` }
}

/**
 * Connect to Discord Gateway (WebSocket) for receiving messages.
 */
function connectGateway(): void {
  if (!config) return
  // Prevent duplicate connections
  if (ws) {
    ws.removeAllListeners()
    ws.close(1000)
    ws = null
  }

  const gatewayUrl = resumeGatewayUrl || DISCORD_GATEWAY
  const socket = new WebSocket(gatewayUrl)
  ws = socket

  socket.on('open', () => {
    console.log('[Discord] Gateway connected')
  })

  socket.on('message', (data: Buffer) => {
    try {
      const payload = JSON.parse(data.toString())
      handleGatewayMessage(payload)
    } catch (err) {
      console.error('[Discord] Failed to parse gateway message:', err)
    }
  })

  socket.on('close', (code) => {
    console.log(`[Discord] Gateway closed: ${code}`)
    running = false
    stopHeartbeat()

    // Only auto-reconnect on unexpected disconnects (not 1000=normal, not fatal 4xxx)
    const shouldReconnect = config && ws === socket && code !== 1000 && code !== 4004 && code !== 4010 && code !== 4011 && code !== 4014
    if (shouldReconnect) {
      setTimeout(() => {
        if (config && ws === socket) connectGateway()
      }, 5000)
    } else if (code === 4004) {
      lastError = 'Invalid bot token (closed by Discord)'
    }
  })

  socket.on('error', (err) => {
    console.error('[Discord] Gateway error:', err)
    lastError = err.message
  })
}

function handleGatewayMessage(payload: any): void {
  const { op, t, s, d } = payload

  if (s) lastSequence = s

  // Debug: log all non-heartbeat gateway events
  if (op !== 11) {
    console.log(`[Discord] GW op=${op} t=${t || '-'} s=${s || '-'}`)
  }

  switch (op) {
    case 10: // Hello — start heartbeat and identify
      startHeartbeat(d.heartbeat_interval)
      if (sessionId && lastSequence) {
        // Resume
        ws?.send(JSON.stringify({ op: 6, d: { token: config!.botToken, session_id: sessionId, seq: lastSequence } }))
      } else {
        // Identify
        ws?.send(JSON.stringify({
          op: 2,
          d: {
            token: config!.botToken,
            intents: (1 << 0) | (1 << 9) | (1 << 12) | (1 << 15), // GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT | DIRECT_MESSAGES
            properties: { os: process.platform, browser: 'aide', device: 'aide' }
          }
        }))
      }
      break

    case 11: // Heartbeat ACK
      break

    case 0: // Dispatch
      handleDispatch(t, d)
      break

    case 7: // Reconnect
      ws?.close()
      break

    case 9: // Invalid Session
      sessionId = null
      lastSequence = null
      setTimeout(() => {
        if (config) connectGateway()
      }, 3000)
      break
  }
}

function handleDispatch(event: string, data: any): void {
  switch (event) {
    case 'READY':
      sessionId = data.session_id
      resumeGatewayUrl = data.resume_gateway_url
      running = true
      lastError = null
      botId = data.user.id
      console.log(`[Discord] Ready as ${data.user.username} (id=${data.user.id})`)
      break

    case 'MESSAGE_CREATE': {
      console.log(`[Discord] MESSAGE_CREATE from=${data.author?.username} channel=${data.channel_id} (configured=${config?.channelId}) content="${data.content?.slice(0, 60)}"`)
      // Ignore bot's own messages
      if (data.author.id === botId) return
      // Only respond in configured channel
      if (data.channel_id !== config?.channelId) return

      // Strip any mention prefix: <@USER_ID>, <@!USER_ID>, <@&ROLE_ID>
      let text = (data.content || '').replace(/<@[!&]?\d+>\s*/g, '').trim()
      if (!text) return

      console.log(`[Discord] Received: ${text.slice(0, 50)}`)
      if (messageHandler) {
        messageHandler(text, data.author.id)
      }
      break
    }
  }
}

function startHeartbeat(intervalMs: number): void {
  stopHeartbeat()
  // Send first heartbeat immediately
  ws?.send(JSON.stringify({ op: 1, d: lastSequence }))
  heartbeatInterval = setInterval(() => {
    ws?.send(JSON.stringify({ op: 1, d: lastSequence }))
  }, intervalMs)
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

/**
 * Configure and connect the Discord bot.
 */
export async function connectDiscord(newConfig?: { botToken: string; channelId: string }): Promise<DiscordStatus> {
  try {
    if (newConfig) {
      const me = await validateToken(newConfig.botToken)
      botId = me.id
      botUsername = me.username
      config = { botToken: newConfig.botToken, channelId: newConfig.channelId }
      saveConfig(config)
    } else {
      config = loadConfig()
      if (!config) {
        lastError = 'No Discord configuration found. Set bot token and channel ID first.'
        return getDiscordStatus()
      }
      const me = await validateToken(config.botToken)
      botId = me.id
      botUsername = me.username
    }

    // Close existing connection
    if (ws) {
      ws.close()
      ws = null
    }
    sessionId = null
    lastSequence = null

    // Connect Gateway
    connectGateway()
    lastError = null
    return getDiscordStatus()
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    return getDiscordStatus()
  }
}

/**
 * Disconnect and optionally clear config.
 */
export function disconnectDiscord(clearConfig = false): DiscordStatus {
  stopHeartbeat()
  if (ws) {
    ws.close(1000)
    ws = null
  }
  running = false
  sessionId = null
  lastSequence = null
  if (clearConfig) {
    clearSavedConfig()
    config = null
    botUsername = null
    botId = null
    guildName = null
  }
  return getDiscordStatus()
}

/**
 * Send a message to the configured Discord channel via REST API.
 */
export async function pushToDiscord(text: string): Promise<void> {
  if (!config) {
    console.warn('[Discord] Not configured, cannot send message')
    return
  }

  const sendChunk = async (content: string) => {
    const res = await fetch(`${DISCORD_API}/channels/${config!.channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${config!.botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[Discord] Send failed: ${res.status} ${body}`)
    }
  }

  if (text.length <= MAX_CHUNK_SIZE) {
    await sendChunk(text)
  } else {
    const chunks: string[] = []
    let remaining = text
    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHUNK_SIZE) {
        chunks.push(remaining)
        break
      }
      let breakAt = remaining.lastIndexOf('\n', MAX_CHUNK_SIZE)
      if (breakAt < MAX_CHUNK_SIZE * 0.3) breakAt = MAX_CHUNK_SIZE
      chunks.push(remaining.slice(0, breakAt))
      remaining = remaining.slice(breakAt)
    }
    for (const chunk of chunks) {
      await sendChunk(chunk)
      if (chunks.length > 1) await sleep(CHUNK_DELAY_MS)
    }
  }
}

/**
 * Init: auto-connect if saved config exists.
 */
export async function initDiscord(): Promise<void> {
  const cfg = loadConfig()
  if (cfg) {
    config = cfg
    console.log('[Discord] Found saved config, auto-connecting...')
    await connectDiscord()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
