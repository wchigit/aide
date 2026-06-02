/**
 * WeChat messaging — inbound long-poll and outbound send with chunking/retry.
 * Unified message I/O layer.
 */

import crypto from 'node:crypto'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  getUpdates,
  sendMessage as apiSendMessage,
  sendTyping,
  getConfig,
  notifyStart,
  notifyStop,
  MessageType,
  MessageState,
  MessageItemType,
  TypingStatus
} from './client'
import type { WeChatTokenData, WeChatState, WeixinMessage } from './client'

// ─── Outbound Configuration ──────────────────────────────────────────

const MAX_CHUNK_SIZE = 4000
const CHUNK_DELAY_MS = 150
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// ─── Inbound Configuration ───────────────────────────────────────────

const STATE_DIR = path.join(app.getPath('userData'), 'wechat')
const CURSOR_FILE = path.join(STATE_DIR, 'cursor.txt')
const MAX_CONSECUTIVE_ERRORS = 3
const ERROR_BACKOFF_MS = 30_000
const SESSION_EXPIRED_PAUSE_MS = 60 * 60 * 1000

// ─── Monitor State ───────────────────────────────────────────────────

export type MessageHandler = (msg: WeixinMessage) => void | Promise<void>

let running = false
let abortController: AbortController | null = null
let messageHandler: MessageHandler | null = null
let activeTokenData: WeChatTokenData | null = null

export function setMessageHandler(handler: MessageHandler): void {
  messageHandler = handler
}

export function isMonitorRunning(): boolean {
  return running
}

// ─── Inbound: Long-Poll Monitor ─────────────────────────────────────

export function startMonitor(tokenData: WeChatTokenData): void {
  if (running) return
  running = true
  activeTokenData = tokenData
  abortController = new AbortController()
  notifyStart({ baseUrl: tokenData.baseUrl, token: tokenData.token }).catch(() => {})
  pollLoop(tokenData, abortController.signal)
}

export function stopMonitor(): void {
  running = false
  abortController?.abort()
  abortController = null
  if (activeTokenData) {
    notifyStop({ baseUrl: activeTokenData.baseUrl, token: activeTokenData.token }).catch(() => {})
    activeTokenData = null
  }
}

function loadCursor(): string {
  try {
    if (fs.existsSync(CURSOR_FILE)) {
      return fs.readFileSync(CURSOR_FILE, 'utf-8').trim()
    }
  } catch { /* ignore */ }
  return ''
}

function saveCursor(cursor: string): void {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(CURSOR_FILE, cursor, 'utf-8')
}

async function pollLoop(tokenData: WeChatTokenData, signal: AbortSignal): Promise<void> {
  let cursor = loadCursor()
  let consecutiveErrors = 0

  while (running && !signal.aborted) {
    try {
      const resp = await getUpdates({
        baseUrl: tokenData.baseUrl,
        token: tokenData.token,
        get_updates_buf: cursor,
        timeoutMs: 38_000
      })
      console.log('[WeChat] getUpdates resp:', JSON.stringify({ ret: resp.ret, errcode: resp.errcode, msgCount: resp.msgs?.length ?? 0, hasBuf: !!resp.get_updates_buf }))

      if (resp.errcode === -14) {
        console.warn('[WeChat] Session expired, pausing 1hr')
        await sleepAbortable(SESSION_EXPIRED_PAUSE_MS, signal)
        continue
      }

      if (resp.get_updates_buf) {
        cursor = resp.get_updates_buf
        saveCursor(cursor)
      }

      if (resp.msgs && resp.msgs.length > 0) {
        console.log(`[WeChat] Received ${resp.msgs.length} message(s)`)
        for (const msg of resp.msgs) {
          console.log('[WeChat] raw msg:', JSON.stringify(msg).slice(0, 500))
          if (msg.from_user_id === tokenData.accountId) continue
          try {
            await messageHandler?.(msg)
          } catch (err) {
            console.error('[WeChat] Handler error:', err)
          }
        }
      }

      consecutiveErrors = 0
    } catch (err) {
      if (signal.aborted) break
      consecutiveErrors++
      console.warn(`[WeChat] Poll error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err)

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        await sleepAbortable(ERROR_BACKOFF_MS, signal)
        consecutiveErrors = 0
      } else {
        await sleepAbortable(3000, signal)
      }
    }
  }
}

// ─── Outbound: Send with Chunking ───────────────────────────────────

/**
 * Split text into chunks that fit within iLink's message limit.
 */
export function splitText(text: string, maxLen = MAX_CHUNK_SIZE): string[] {
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

/**
 * Send a text message to a user, handling chunking and typing indicator.
 */
export async function sendTextMessage(params: {
  tokenData: WeChatTokenData
  state: WeChatState
  text: string
}): Promise<void> {
  const { tokenData, state, text } = params
  const chunks = splitText(text)

  for (let i = 0; i < chunks.length; i++) {
    if (chunks.length > 1 && i > 0) {
      await trySendTyping(tokenData, state)
      await sleep(CHUNK_DELAY_MS)
    }

    await sendChunkWithRetry(tokenData, state, chunks[i])
  }
}

async function sendChunkWithRetry(
  tokenData: WeChatTokenData,
  state: WeChatState,
  text: string
): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const clientId = `aide-${crypto.randomUUID()}`
      await apiSendMessage({
        baseUrl: tokenData.baseUrl,
        token: tokenData.token,
        body: {
          msg: {
            to_user_id: state.targetUserId,
            client_id: clientId,
            message_type: MessageType.BOT,
            message_state: MessageState.FINISH,
            context_token: state.contextToken || undefined,
            item_list: [{
              type: MessageItemType.TEXT,
              text_item: { text }
            }]
          }
        }
      })
      return
    } catch (err) {
      lastError = err as Error
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
  }

  throw lastError!
}

async function trySendTyping(tokenData: WeChatTokenData, state: WeChatState): Promise<void> {
  try {
    const config = await getConfig({
      baseUrl: tokenData.baseUrl,
      token: tokenData.token,
      ilinkUserId: state.targetUserId,
      contextToken: state.contextToken
    })

    if (config.typing_ticket) {
      await sendTyping({
        baseUrl: tokenData.baseUrl,
        token: tokenData.token,
        body: {
          ilink_user_id: state.targetUserId,
          typing_ticket: config.typing_ticket,
          status: TypingStatus.TYPING
        }
      })
    }
  } catch {
    // Typing is best-effort
  }
}

// ─── Utilities ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}
