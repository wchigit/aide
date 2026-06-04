/**
 * Telegram channel implementation.
 * Handles connection, long-poll receive loop, command dispatch, and outbound send.
 */

import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getUpdates, sendMessage as apiSendMessage, validateToken } from './client'
import type { TelegramConfig, TelegramUpdate } from './client'
import type { Channel, ChannelStatus, InboundMessageHandler } from '../channels/types'
import { dispatch as dispatchCommand } from './commands'
import { saveSecure, loadSecure, deleteSecure } from '../secure-store'

// ─── Configuration ───────────────────────────────────────────────────

const MAX_CHUNK_SIZE = 4000
const CHUNK_DELAY_MS = 150
const MAX_CONSECUTIVE_ERRORS = 5
const ERROR_BACKOFF_MS = 15_000

const STATE_DIR = path.join(app.getPath('userData'), 'telegram')
const CONFIG_FILE = path.join(STATE_DIR, 'config.json')
const OFFSET_FILE = path.join(STATE_DIR, 'offset.txt')

// ─── Module State ────────────────────────────────────────────────────

let config: TelegramConfig | null = null
let running = false
let abortController: AbortController | null = null
let messageHandler: InboundMessageHandler | null = null
let lastError: string | null = null
let botUsername: string | null = null

// ─── Config Persistence ──────────────────────────────────────────────

function loadConfig(): TelegramConfig | null {
  const data = loadSecure<TelegramConfig>(CONFIG_FILE)
  if (data?.botToken && data?.chatId) return data
  return null
}

function saveConfig(cfg: TelegramConfig): void {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  saveSecure(CONFIG_FILE, cfg)
}

function clearConfig(): void {
  deleteSecure(CONFIG_FILE)
  try { fs.unlinkSync(OFFSET_FILE) } catch { /* ignore */ }
}

function loadOffset(): number {
  try {
    if (fs.existsSync(OFFSET_FILE)) {
      return parseInt(fs.readFileSync(OFFSET_FILE, 'utf-8').trim(), 10) || 0
    }
  } catch { /* ignore */ }
  return 0
}

function saveOffset(offset: number): void {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(OFFSET_FILE, String(offset), 'utf-8')
}

// ─── Channel Interface Implementation ────────────────────────────────

export const telegramChannel: Channel = {
  id: 'telegram',

  status(): ChannelStatus {
    return {
      id: 'telegram',
      connection: running ? 'connected' : config ? 'disconnected' : 'disconnected',
      lastError
    }
  },

  async connect(): Promise<void> {
    await connectTelegram()
  },

  disconnect(): void {
    disconnectTelegram()
  },

  async send(text: string): Promise<void> {
    await pushToTelegram(text)
  },

  onMessage(handler: InboundMessageHandler): void {
    messageHandler = handler
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export interface TelegramStatus {
  connection: 'disconnected' | 'connecting' | 'connected' | 'error'
  botUsername: string | null
  chatId: string | null
  lastError: string | null
  monitorActive: boolean
}

export function getTelegramStatus(): TelegramStatus {
  const cfg = config || loadConfig()
  return {
    connection: running ? 'connected' : cfg ? 'disconnected' : 'disconnected',
    botUsername: botUsername,
    chatId: cfg?.chatId || null,
    lastError,
    monitorActive: running
  }
}

/**
 * Configure and connect the Telegram bot.
 * Validates the token, saves config, and starts the poll loop.
 */
export async function connectTelegram(newConfig?: { botToken: string; chatId: string }): Promise<TelegramStatus> {
  try {
    if (newConfig) {
      // Validate the token
      const me = await validateToken(newConfig.botToken)
      botUsername = me.username
      config = { botToken: newConfig.botToken, chatId: newConfig.chatId }
      saveConfig(config)
    } else {
      config = loadConfig()
      if (!config) {
        lastError = 'No Telegram configuration found. Set bot token and chat ID first.'
        return getTelegramStatus()
      }
      // Validate saved token
      const me = await validateToken(config.botToken)
      botUsername = me.username
    }

    // Start long-poll loop
    startPollLoop()
    lastError = null
    return getTelegramStatus()
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    return getTelegramStatus()
  }
}

/**
 * Disconnect: stop polling and optionally clear config.
 */
export function disconnectTelegram(clearSavedConfig = false): TelegramStatus {
  stopPollLoop()
  if (clearSavedConfig) {
    clearConfig()
    config = null
    botUsername = null
  }
  lastError = null
  return getTelegramStatus()
}

/**
 * Send a message to the configured Telegram chat.
 */
export async function pushToTelegram(text: string): Promise<void> {
  const cfg = config || loadConfig()
  if (!cfg) throw new Error('Telegram not configured')

  const chunks = splitText(text, MAX_CHUNK_SIZE)
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(CHUNK_DELAY_MS)
    await apiSendMessage(cfg, chunks[i])
  }
}

/**
 * Initialize Telegram module on app start.
 * Auto-connects if config exists.
 */
export async function initTelegram(autoConnect = false): Promise<void> {
  // Wire the command dispatcher as the default message handler
  messageHandler = dispatchCommand

  if (autoConnect) {
    const saved = loadConfig()
    if (saved) {
      await connectTelegram()
    }
  }
}

// ─── Poll Loop ───────────────────────────────────────────────────────

function startPollLoop(): void {
  if (running) return
  running = true
  abortController = new AbortController()
  pollLoop(abortController.signal)
}

function stopPollLoop(): void {
  running = false
  abortController?.abort()
  abortController = null
}

async function pollLoop(signal: AbortSignal): Promise<void> {
  let offset = loadOffset()
  let consecutiveErrors = 0

  while (running && !signal.aborted) {
    try {
      const cfg = config || loadConfig()
      if (!cfg) break

      const updates = await getUpdates(cfg, offset, 30, signal)

      for (const update of updates) {
        offset = update.update_id + 1
        saveOffset(offset)
        await handleUpdate(update)
      }

      consecutiveErrors = 0
    } catch (err) {
      if (signal.aborted) break
      consecutiveErrors++
      console.warn(`[Telegram] Poll error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err)

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        lastError = `Too many errors: ${err instanceof Error ? err.message : String(err)}`
        await sleepAbortable(ERROR_BACKOFF_MS, signal)
        consecutiveErrors = 0
      } else {
        await sleepAbortable(3000, signal)
      }
    }
  }
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message
  if (!msg?.text) return

  const senderId = String(msg.from?.id || msg.chat.id)
  const text = msg.text.trim()

  // If the message is from our configured chat, process it
  if (String(msg.chat.id) !== config?.chatId) {
    // Auto-capture chat_id on first message if not configured
    if (config && !config.chatId) {
      config.chatId = String(msg.chat.id)
      saveConfig(config)
    } else {
      return // Ignore messages from unknown chats
    }
  }

  console.log(`[Telegram] Message from ${msg.from?.username || senderId}: ${text.slice(0, 100)}`)

  try {
    await messageHandler?.(text, senderId)
  } catch (err) {
    console.error('[Telegram] Handler error:', err)
  }
}

// ─── Utilities ───────────────────────────────────────────────────────

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}
