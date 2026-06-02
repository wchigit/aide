/**
 * WeChat connection lifecycle — QR login, token persistence, session management.
 */

import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { DEFAULT_BASE_URL, getBotQrcode, getQrcodeStatus } from './client'
import type { WeChatTokenData } from './client'

const TOKEN_DIR = path.join(app.getPath('userData'), 'wechat')
const TOKEN_FILE = path.join(TOKEN_DIR, 'token.json')
const CONFIG_FILE = path.join(TOKEN_DIR, 'config.json')
const POLL_INTERVAL = 1500
const LOGIN_TIMEOUT = 5 * 60 * 1000

export function getBaseUrl(): string {
  const saved = loadToken()
  if (saved?.baseUrl) return saved.baseUrl
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      if (cfg.baseUrl) return cfg.baseUrl
    }
  } catch { /* ignore */ }
  return DEFAULT_BASE_URL
}

export function setBaseUrl(url: string): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true })
  const cfg = fs.existsSync(CONFIG_FILE)
    ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    : {}
  cfg.baseUrl = url
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
}

export function loadToken(): WeChatTokenData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8')
    const data = JSON.parse(raw) as WeChatTokenData
    if (!data.token) return null
    return data
  } catch {
    return null
  }
}

export function saveToken(data: WeChatTokenData): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true })
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function clearToken(): void {
  try {
    fs.unlinkSync(TOKEN_FILE)
  } catch { /* ignore */ }
}

/**
 * Start QR code login flow.
 * Emits events to renderer for displaying QR code and progress.
 * Returns token data on success, null on timeout/cancel.
 */
export async function login(signal?: AbortSignal): Promise<WeChatTokenData | null> {
  const baseUrl = getBaseUrl()

  const qrResp = await getBotQrcode({ baseUrl })
  const qrcode = qrResp.qrcode

  const qrDataUrl = await QRCode.toDataURL(qrResp.qrcode_img_content, {
    width: 280,
    margin: 2
  })

  emitToRenderer('wechat:qrcode', { qrcode, imgContent: qrDataUrl })

  const deadline = Date.now() + LOGIN_TIMEOUT

  while (Date.now() < deadline) {
    if (signal?.aborted) return null

    await sleep(POLL_INTERVAL)

    try {
      const status = await getQrcodeStatus({ baseUrl, qrcode })

      switch (status.status) {
        case 'wait':
          break
        case 'scaned':
          emitToRenderer('wechat:login-progress', { stage: 'scanned' })
          break
        case 'confirmed': {
          if (!status.bot_token) throw new Error('No token in confirmed response')
          const tokenData: WeChatTokenData = {
            token: status.bot_token,
            baseUrl: status.baseurl || baseUrl,
            accountId: status.ilink_bot_id || '',
            userId: status.ilink_user_id || '',
            savedAt: new Date().toISOString()
          }
          saveToken(tokenData)
          emitToRenderer('wechat:login-progress', { stage: 'confirmed' })
          return tokenData
        }
        case 'expired':
          emitToRenderer('wechat:login-progress', { stage: 'expired' })
          return null
        default:
          break
      }
    } catch (err) {
      console.warn('[WeChat] QR poll error:', err)
    }
  }

  emitToRenderer('wechat:login-progress', { stage: 'timeout' })
  return null
}

function emitToRenderer(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('aide:event', { type: channel, ...data as object })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
