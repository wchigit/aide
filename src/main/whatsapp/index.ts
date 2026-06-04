/**
 * WhatsApp module entry point (Baileys-based).
 * Provides QR-code auth, persistent session, send/receive via WhatsApp Web protocol.
 */

import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import type { WhatsAppStatus } from '@shared/types'
import { dispatch } from './commands'

function emitEvent(event: { type: string; [key: string]: unknown }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('aide:event', event)
  }
}

// Baileys imports — loaded dynamically to avoid blocking startup
let makeWASocket: typeof import('baileys').makeWASocket | undefined
let useMultiFileAuthState: typeof import('baileys').useMultiFileAuthState | undefined
let DisconnectReason: typeof import('baileys').DisconnectReason | undefined
let makeCacheableSignalKeyStore: typeof import('baileys').makeCacheableSignalKeyStore | undefined

const AUTH_DIR = path.join(app.getPath('userData'), 'whatsapp', 'auth')
const CONFIG_FILE = path.join(app.getPath('userData'), 'whatsapp', 'config.json')

interface WhatsAppConfig {
  targetJid: string | null // who to send reports to (usually self-chat)
}

let sock: ReturnType<typeof import('baileys').makeWASocket> | null = null
let connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastError: string | null = null
let currentQr: string | null = null
let currentQrDataUrl: string | null = null
let messageHandler: ((msg: { from: string; text: string; pushName?: string }) => Promise<void>) | null = null

function loadConfig(): WhatsAppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    }
  } catch { /* ignore */ }
  return { targetJid: null }
}

function saveConfig(config: WhatsAppConfig): void {
  const dir = path.dirname(CONFIG_FILE)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

async function ensureBaileys(): Promise<void> {
  if (makeWASocket) return
  const baileys = await import('baileys')
  makeWASocket = baileys.makeWASocket
  useMultiFileAuthState = baileys.useMultiFileAuthState
  DisconnectReason = baileys.DisconnectReason
  makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore
}

/**
 * Get current WhatsApp connection status.
 */
export function getWhatsAppStatus(): WhatsAppStatus {
  const config = loadConfig()
  return {
    connection: connectionState,
    phoneNumber: config.targetJid?.replace('@s.whatsapp.net', '') || null,
    qrCode: currentQrDataUrl,
    lastError,
    monitorActive: connectionState === 'connected'
  }
}

/**
 * Connect to WhatsApp via QR code scan.
 * Emits 'whatsapp:qrcode' events for the renderer to display.
 */
export async function connectWhatsApp(): Promise<WhatsAppStatus> {
  if (connectionState === 'connected' && sock) {
    return getWhatsAppStatus()
  }

  try {
    connectionState = 'connecting'
    lastError = null
    currentQr = null; currentQrDataUrl = null
    emitEvent({ type: 'whatsapp:status', status: getWhatsAppStatus() })

    await ensureBaileys()

    fs.mkdirSync(AUTH_DIR, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState!(AUTH_DIR)

    console.log('[WhatsApp] Creating socket...')
    sock = makeWASocket!({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore!(state.keys, undefined as any)
      },
      browser: ['Aide', 'Desktop', '1.0.0'],
      generateHighQualityLinkPreview: false
    })

    // Connection updates (QR code, connected, disconnected)
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log('[WhatsApp] QR received, length:', qr.length)
        currentQr = qr
        // Convert raw QR text to data URL for renderer display
        QRCode.toDataURL(qr, { width: 256, margin: 2 }).then((dataUrl) => {
          currentQrDataUrl = dataUrl
          emitEvent({ type: 'whatsapp:qrcode', qrCode: dataUrl })
        }).catch(err => console.warn('[WhatsApp] QR render failed:', err))
      }

      if (connection === 'close') {
        currentQr = null; currentQrDataUrl = null
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason!.loggedOut

        if (shouldReconnect) {
          console.log('[WhatsApp] Connection closed, reconnecting...')
          connectionState = 'connecting'
          emitEvent({ type: 'whatsapp:status', status: getWhatsAppStatus() })
          // Reconnect after short delay
          setTimeout(() => connectWhatsApp(), 3000)
        } else {
          console.log('[WhatsApp] Logged out, clearing session')
          connectionState = 'disconnected'
          sock = null
          // Clear auth on explicit logout
          fs.rmSync(AUTH_DIR, { recursive: true, force: true })
          emitEvent({ type: 'whatsapp:status', status: getWhatsAppStatus() })
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp] Connected')
        connectionState = 'connected'
        currentQr = null; currentQrDataUrl = null
        lastError = null

        // Auto-set target to self-chat if not configured
        const config = loadConfig()
        if (!config.targetJid && sock?.user?.id) {
          const selfJid = sock.user.id.replace(/:\d+@/, '@')
          config.targetJid = selfJid
          saveConfig(config)
        }

        emitEvent({ type: 'whatsapp:status', status: getWhatsAppStatus() })
      }
    })

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds)

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Only process 'notify' (new incoming messages from phone).
      // 'append' = our own outgoing messages echoed back — skip to avoid infinite loop.
      if (type !== 'notify') return

      const config = loadConfig()
      for (const msg of messages) {
        if (!msg.message) continue

        const text = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || ''

        if (!text) continue

        const from = msg.key.remoteJid || ''
        const pushName = msg.pushName || undefined

        console.log(`[WhatsApp] Message from ${from}: ${text.slice(0, 50)}...`)

        if (messageHandler) {
          await messageHandler({ from, text, pushName })
        }
      }
    })

    return getWhatsAppStatus()
  } catch (err) {
    connectionState = 'error'
    lastError = err instanceof Error ? err.message : String(err)
    emitEvent({ type: 'whatsapp:status', status: getWhatsAppStatus() })
    return getWhatsAppStatus()
  }
}

/**
 * Disconnect WhatsApp and optionally clear session.
 */
export function disconnectWhatsApp(clearSession = false): WhatsAppStatus {
  if (sock) {
    sock.end(undefined)
    sock = null
  }
  connectionState = 'disconnected'
  currentQr = null; currentQrDataUrl = null
  lastError = null

  if (clearSession) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
  }

  emitEvent({ type: 'whatsapp:status', status: getWhatsAppStatus() })
  return getWhatsAppStatus()
}

/**
 * Send a text message to the configured target (default: self-chat).
 */
export async function pushToWhatsApp(text: string): Promise<void> {
  if (!sock || connectionState !== 'connected') {
    throw new Error('WhatsApp not connected')
  }

  const config = loadConfig()
  const jid = config.targetJid

  if (!jid) {
    throw new Error('No target configured. Send a message to yourself first.')
  }

  await sock.sendMessage(jid, { text })
}

/**
 * Set the target JID for outbound messages.
 */
export function setTargetJid(jid: string): void {
  const config = loadConfig()
  config.targetJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
  saveConfig(config)
}

/**
 * Set message handler for incoming messages (used by commands module).
 */
export function setMessageHandler(handler: (msg: { from: string; text: string; pushName?: string }) => Promise<void>): void {
  messageHandler = handler
}

/**
 * Initialize WhatsApp module on app start.
 * Auto-reconnects if auth state exists.
 */
export async function initWhatsApp(autoConnect = false): Promise<void> {
  // Wire command dispatch as default message handler
  messageHandler = dispatch

  if (autoConnect && fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0) {
    await connectWhatsApp()
  }
}
