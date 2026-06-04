/**
 * Slack channel implementation.
 * Uses Socket Mode (WebSocket) for receiving and Web API for sending.
 * No public URL needed — works behind NAT/firewall.
 */

import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { SocketModeClient } from '@slack/socket-mode'
import { WebClient } from '@slack/web-api'
import type { Channel, ChannelStatus, InboundMessageHandler } from '../channels/types'
import { dispatch as dispatchCommand } from './commands'
import { saveSecure, loadSecure, deleteSecure } from '../secure-store'

// ─── Configuration ───────────────────────────────────────────────────

const STATE_DIR = path.join(app.getPath('userData'), 'slack')
const CONFIG_FILE = path.join(STATE_DIR, 'config.json')

export interface SlackConfig {
  botToken: string    // xoxb-...
  appToken: string    // xapp-...
  channelId: string   // DM channel ID (e.g. D0123ABC)
}

// ─── Module State ────────────────────────────────────────────────────

let config: SlackConfig | null = null
let socketClient: SocketModeClient | null = null
let webClient: WebClient | null = null
let running = false
let messageHandler: InboundMessageHandler | null = dispatchCommand
let lastError: string | null = null
let botUserId: string | null = null
let teamName: string | null = null

// ─── Config Persistence ──────────────────────────────────────────────

function loadConfig(): SlackConfig | null {
  const data = loadSecure<SlackConfig>(CONFIG_FILE)
  if (data?.botToken && data?.appToken && data?.channelId) return data
  return null
}

function saveConfig(cfg: SlackConfig): void {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  saveSecure(CONFIG_FILE, cfg)
}

function clearSavedConfig(): void {
  deleteSecure(CONFIG_FILE)
}

// ─── Channel Interface ───────────────────────────────────────────────

export const slackChannel: Channel = {
  id: 'slack',

  status(): ChannelStatus {
    return {
      id: 'slack',
      connection: running ? 'connected' : config ? 'disconnected' : 'disconnected',
      lastError
    }
  },

  async connect(): Promise<void> {
    await connectSlack()
  },

  disconnect(): void {
    disconnectSlack()
  },

  async send(text: string): Promise<void> {
    await pushToSlack(text)
  },

  onMessage(handler: InboundMessageHandler): void {
    messageHandler = handler
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export interface SlackStatus {
  connection: 'disconnected' | 'connecting' | 'connected' | 'error'
  teamName: string | null
  channelId: string | null
  lastError: string | null
  monitorActive: boolean
}

export function getSlackStatus(): SlackStatus {
  const cfg = config || loadConfig()
  return {
    connection: running ? 'connected' : cfg ? 'disconnected' : 'disconnected',
    teamName,
    channelId: cfg?.channelId || null,
    lastError,
    monitorActive: running
  }
}

/**
 * Connect to Slack via Socket Mode.
 */
export async function connectSlack(newConfig?: SlackConfig): Promise<SlackStatus> {
  try {
    if (newConfig) {
      config = newConfig
      saveConfig(config)
    } else {
      config = loadConfig()
      if (!config) {
        lastError = 'No Slack configuration found. Set bot token, app token, and channel ID first.'
        return getSlackStatus()
      }
    }

    // Validate token via auth.test
    webClient = new WebClient(config.botToken)
    const authResult = await webClient.auth.test()
    botUserId = authResult.user_id as string
    teamName = (authResult.team as string) || null

    // Start Socket Mode
    socketClient = new SocketModeClient({ appToken: config.appToken })

    socketClient.on('message', async ({ event, body, ack }) => {
      await ack()
      handleMessageEvent(event)
    })

    socketClient.on('slack_event', async ({ event, body, ack }) => {
      await ack()
      if (body.event?.type === 'message') {
        handleMessageEvent(body.event)
      }
    })

    await socketClient.start()
    running = true
    lastError = null

    return getSlackStatus()
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    running = false
    return getSlackStatus()
  }
}

/**
 * Disconnect from Slack.
 */
export function disconnectSlack(clearConfig = false): SlackStatus {
  if (socketClient) {
    socketClient.disconnect().catch(() => {})
    socketClient = null
  }
  webClient = null
  running = false

  if (clearConfig) {
    clearSavedConfig()
    config = null
    teamName = null
    botUserId = null
  }

  lastError = null
  return getSlackStatus()
}

/**
 * Send a message to the configured Slack channel.
 */
export async function pushToSlack(text: string): Promise<void> {
  const cfg = config || loadConfig()
  if (!cfg) throw new Error('Slack not configured')
  if (!webClient) {
    webClient = new WebClient(cfg.botToken)
  }

  // Slack supports up to 40k chars but chunk at 3000 for readability
  const chunks = splitText(text, 3000)
  for (const chunk of chunks) {
    await webClient.chat.postMessage({
      channel: cfg.channelId,
      text: chunk,
      mrkdwn: true
    })
  }
}

/**
 * Initialize Slack module on app start.
 */
export async function initSlack(autoConnect = false): Promise<void> {
  messageHandler = dispatchCommand

  if (autoConnect) {
    const saved = loadConfig()
    if (saved) {
      await connectSlack()
    }
  }
}

// ─── Internal ────────────────────────────────────────────────────────

function handleMessageEvent(event: any): void {
  // Ignore bot's own messages and message subtypes (edits, joins, etc.)
  if (!event || event.bot_id || event.subtype) return
  if (event.user === botUserId) return

  const text = event.text?.trim()
  if (!text) return

  // Only process DMs (im) or messages in the configured channel
  const cfg = config || loadConfig()
  if (cfg && event.channel !== cfg.channelId) return

  const senderId = event.user || 'unknown'
  console.log(`[Slack] Message from ${senderId}: ${text.slice(0, 100)}`)

  try {
    messageHandler?.(text, senderId)
  } catch (err) {
    console.error('[Slack] Handler error:', err)
  }
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    let splitAt = remaining.lastIndexOf('\n\n', maxLen)
    if (splitAt < maxLen * 0.3) {
      splitAt = remaining.lastIndexOf('\n', maxLen)
    }
    if (splitAt < maxLen * 0.3) {
      splitAt = remaining.lastIndexOf(' ', maxLen)
    }
    if (splitAt < maxLen * 0.3) {
      splitAt = maxLen
    }

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}
