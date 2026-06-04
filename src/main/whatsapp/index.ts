/**
 * WhatsApp channel implementation using Meta's official Cloud API.
 *
 * Architecture:
 *   - SENDING: Aide → Meta Graph API directly (access token stored locally)
 *   - RECEIVING: Meta → Relay webhook → buffer → Aide polls relay
 *
 * No secrets are stored on the relay server. The relay only buffers messages.
 */

import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { Channel, ChannelStatus, InboundMessageHandler } from '../channels/types'
import { dispatch as dispatchCommand } from './commands'
import { saveSecure, loadSecure, deleteSecure } from '../secure-store'

// ─── Constants ───────────────────────────────────────────────────────

const META_GRAPH_API = 'https://graph.facebook.com/v20.0'
const POLL_INTERVAL_MS = 5000

const STATE_DIR = path.join(app.getPath('userData'), 'whatsapp')
const CONFIG_FILE = path.join(STATE_DIR, 'config.json')

export interface WhatsAppConfig {
  /** Meta access token — stored locally only, never sent to relay */
  accessToken: string
  /** Phone Number ID from Meta Developer Portal */
  phoneNumberId: string
  /** The relay base URL (e.g. https://relay.azurewebsites.net/api) */
  relayUrl: string
  /** UUID assigned by relay for this user */
  relayUserId: string
  /** Token to authenticate with relay when polling */
  relayToken: string
}

// ─── Module State ────────────────────────────────────────────────────

let config: WhatsAppConfig | null = null
let running = false
let pollTimer: ReturnType<typeof setInterval> | null = null
let messageHandler: InboundMessageHandler | null = dispatchCommand
let lastError: string | null = null

// ─── Config Persistence ──────────────────────────────────────────────

function loadConfig(): WhatsAppConfig | null {
  const data = loadSecure<WhatsAppConfig>(CONFIG_FILE)
  if (data?.accessToken && data?.phoneNumberId && data?.relayUrl && data?.relayUserId && data?.relayToken) {
    return data
  }
  return null
}

function saveConfig(cfg: WhatsAppConfig): void {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  saveSecure(CONFIG_FILE, cfg)
}

function clearSavedConfig(): void {
  deleteSecure(CONFIG_FILE)
}

// ─── Channel Interface ───────────────────────────────────────────────

export const whatsappChannel: Channel = {
  id: 'whatsapp',

  status(): ChannelStatus {
    return {
      id: 'whatsapp',
      connection: running ? 'connected' : config ? 'disconnected' : 'disconnected',
      lastError
    }
  },

  async connect(): Promise<void> {
    await connectWhatsApp()
  },

  disconnect(): void {
    disconnectWhatsApp()
  },

  async send(text: string): Promise<void> {
    await pushToWhatsApp(text)
  },

  onMessage(handler: InboundMessageHandler): void {
    messageHandler = handler
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export interface WhatsAppStatus {
  connection: 'disconnected' | 'connecting' | 'connected' | 'error'
  phoneNumberId: string | null
  relayUrl: string | null
  lastError: string | null
  monitorActive: boolean
}

export function getWhatsAppStatus(): WhatsAppStatus {
  const cfg = config || loadConfig()
  return {
    connection: running ? 'connected' : cfg ? 'disconnected' : 'disconnected',
    phoneNumberId: cfg?.phoneNumberId || null,
    relayUrl: cfg?.relayUrl || null,
    lastError,
    monitorActive: running
  }
}

/**
 * Connect: validate token, register with relay if needed, start polling.
 */
export async function connectWhatsApp(newConfig?: Partial<WhatsAppConfig>): Promise<WhatsAppStatus> {
  try {
    // Load or merge config
    if (newConfig?.accessToken && newConfig?.phoneNumberId && newConfig?.relayUrl) {
      // New connection — register with relay
      const registration = await registerWithRelay(newConfig.relayUrl)
      config = {
        accessToken: newConfig.accessToken,
        phoneNumberId: newConfig.phoneNumberId,
        relayUrl: newConfig.relayUrl,
        relayUserId: registration.userId,
        relayToken: registration.relayToken
      }
      saveConfig(config)
    } else {
      config = loadConfig()
      if (!config) {
        lastError = 'No WhatsApp configuration found'
        return getWhatsAppStatus()
      }
    }

    // Validate Meta access token
    await validateAccessToken(config.accessToken, config.phoneNumberId)

    // Start polling relay for messages
    startPolling()
    running = true
    lastError = null
    console.log('[WhatsApp] Connected successfully')
  } catch (err: any) {
    lastError = err.message || 'Connection failed'
    running = false
    console.error('[WhatsApp] Connection failed:', err)
  }

  return getWhatsAppStatus()
}

/**
 * Disconnect and stop polling.
 */
export function disconnectWhatsApp(clearConfig = false): void {
  stopPolling()
  running = false
  if (clearConfig) {
    clearSavedConfig()
    config = null
  }
  console.log('[WhatsApp] Disconnected')
}

/**
 * Send a message to the user via Meta Graph API directly.
 * Target is the last user who sent us a message (stored in state).
 */
export async function pushToWhatsApp(text: string, recipientPhone?: string): Promise<void> {
  if (!config) throw new Error('WhatsApp not configured')

  const to = recipientPhone || lastSender
  if (!to) throw new Error('No recipient — no one has messaged yet')

  // Split long messages
  const chunks = splitMessage(text, 4096) // WhatsApp limit
  for (const chunk of chunks) {
    const res = await fetch(`${META_GRAPH_API}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: chunk }
      })
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Meta API error: ${res.status} ${body}`)
    }
  }
}

// ─── Internal ────────────────────────────────────────────────────────

let lastSender: string | null = null

/**
 * Register with the relay to get a userId and webhook URL.
 */
async function registerWithRelay(relayUrl: string): Promise<{ userId: string; relayToken: string; webhookUrl: string }> {
  const res = await fetch(`${relayUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })

  if (!res.ok) {
    throw new Error(`Relay registration failed: ${res.status}`)
  }

  return await res.json() as { userId: string; relayToken: string; webhookUrl: string }
}

/**
 * Validate the Meta access token by fetching phone number info.
 */
async function validateAccessToken(token: string, phoneNumberId: string): Promise<void> {
  const res = await fetch(`${META_GRAPH_API}/${phoneNumberId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Invalid Meta access token: ${res.status} ${body}`)
  }
}

/**
 * Poll the relay for buffered messages.
 */
function startPolling(): void {
  stopPolling()
  pollTimer = setInterval(pollMessages, POLL_INTERVAL_MS)
  // Also poll immediately
  pollMessages()
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function pollMessages(): Promise<void> {
  if (!config) return

  try {
    const res = await fetch(`${config.relayUrl}/messages/${config.relayUserId}`, {
      headers: { 'x-relay-token': config.relayToken }
    })

    if (!res.ok) return

    const data = await res.json() as { messages: Array<{ from: string; text: string; platform: string; timestamp: string }> }

    for (const msg of data.messages) {
      // Track last sender so we know who to reply to
      lastSender = msg.from
      // Dispatch to command handler
      if (messageHandler) {
        await messageHandler(msg.text, msg.from)
      }
    }
  } catch (err) {
    // Silent fail on poll errors — will retry next interval
    console.debug('[WhatsApp] Poll error:', err)
  }
}

/**
 * Split a long message into chunks.
 */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLen))
    remaining = remaining.slice(maxLen)
  }
  return chunks
}
