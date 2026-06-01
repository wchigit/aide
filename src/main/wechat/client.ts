/**
 * iLink protocol client — types, constants, and HTTP transport.
 * Single-file protocol layer for the WeChat bot API.
 */

import crypto from 'node:crypto'

// ─── Protocol Constants ───────────────────────────────────────────────

export const CHANNEL_VERSION = '1.0.2'
export const BOT_AGENT = 'Aide/1.0.0'
export const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'

export const UploadMediaType = { IMAGE: 1, VIDEO: 2, FILE: 3, VOICE: 4 } as const
export const MessageType = { NONE: 0, USER: 1, BOT: 2 } as const
export const MessageItemType = { NONE: 0, TEXT: 1, IMAGE: 2, VOICE: 3, FILE: 4, VIDEO: 5 } as const
export const MessageState = { NEW: 0, GENERATING: 1, FINISH: 2 } as const
export const TypingStatus = { TYPING: 1, CANCEL: 2 } as const

// ─── Protocol Types ───────────────────────────────────────────────────

export interface BaseInfo {
  channel_version?: string
  bot_agent?: string
}

export interface TextItem {
  text?: string
  content?: string
}

export interface VoiceItem {
  text?: string
  playtime?: number
}

export interface FileItem {
  file_name?: string
  md5?: string
  len?: string
}

export interface MessageItem {
  type?: number
  create_time_ms?: number
  text_item?: TextItem
  voice_item?: VoiceItem
  file_item?: FileItem
}

export interface WeixinMessage {
  seq?: number
  message_id?: number
  from_user_id?: string
  to_user_id?: string
  client_id?: string
  create_time_ms?: number
  session_id?: string
  group_id?: string
  message_type?: number
  message_state?: number
  item_list?: MessageItem[]
  content?: MessageItem[]
  context_token?: string
}

export interface GetUpdatesResp {
  ret?: number
  errcode?: number
  errmsg?: string
  msgs?: WeixinMessage[]
  get_updates_buf?: string
  longpolling_timeout_ms?: number
}

export interface SendMessageReq {
  msg?: WeixinMessage
}

export interface SendTypingReq {
  ilink_user_id: string
  typing_ticket: string
  status: number
}

export interface GetConfigResp {
  typing_ticket?: string
}

// ─── Aide Domain Types ────────────────────────────────────────────────

export interface WeChatTokenData {
  token: string
  baseUrl: string
  accountId: string
  userId: string
  savedAt: string
}

export interface WeChatState {
  targetUserId: string
  contextToken: string
  lastMessageAt: string
}

export type WeChatConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WeChatStatus {
  connection: WeChatConnectionStatus
  accountId: string | null
  targetUser: string | null
  lastError: string | null
  monitorActive: boolean
}

// ─── HTTP Transport ───────────────────────────────────────────────────

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0)
  return Buffer.from(String(uint32), 'utf-8').toString('base64')
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    'X-WECHAT-UIN': randomWechatUin()
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function buildBaseInfo(): BaseInfo {
  return { channel_version: CHANNEL_VERSION, bot_agent: BOT_AGENT }
}

async function httpGet<T>(baseUrl: string, path: string, token?: string): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}/${path}`
  const res = await fetch(url, { headers: buildHeaders(token) })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
  return JSON.parse(text) as T
}

async function httpPost<T>(
  baseUrl: string,
  endpoint: string,
  body: Record<string, unknown>,
  token?: string,
  timeoutMs = 15_000
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}/${endpoint}`
  const payload = { ...body, base_info: buildBaseInfo() }
  const bodyStr = JSON.stringify(payload)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(token),
      body: bodyStr,
      signal: controller.signal
    })
    clearTimeout(timer)
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
    return JSON.parse(text) as T
  } catch (err) {
    clearTimeout(timer)
    if ((err as Error).name === 'AbortError') {
      return { ret: 0, msgs: [] } as T
    }
    throw err
  }
}

// ─── API Methods ──────────────────────────────────────────────────────

export async function getUpdates(params: {
  baseUrl: string
  token?: string
  get_updates_buf: string
  timeoutMs?: number
}): Promise<GetUpdatesResp> {
  return httpPost<GetUpdatesResp>(
    params.baseUrl,
    'ilink/bot/getupdates',
    { get_updates_buf: params.get_updates_buf },
    params.token,
    params.timeoutMs ?? 38_000
  )
}

export async function sendMessage(params: {
  baseUrl: string
  token?: string
  body: SendMessageReq
}): Promise<void> {
  await httpPost(
    params.baseUrl,
    'ilink/bot/sendmessage',
    params.body as unknown as Record<string, unknown>,
    params.token
  )
}

export async function getConfig(params: {
  baseUrl: string
  token?: string
  ilinkUserId: string
  contextToken?: string
}): Promise<GetConfigResp> {
  return httpPost<GetConfigResp>(
    params.baseUrl,
    'ilink/bot/getconfig',
    {
      ilink_user_id: params.ilinkUserId,
      ...(params.contextToken ? { context_token: params.contextToken } : {})
    },
    params.token,
    10_000
  )
}

export async function sendTyping(params: {
  baseUrl: string
  token?: string
  body: SendTypingReq
}): Promise<void> {
  await httpPost(
    params.baseUrl,
    'ilink/bot/sendtyping',
    params.body as unknown as Record<string, unknown>,
    params.token,
    10_000
  )
}

export async function getBotQrcode(params: {
  baseUrl: string
  botType?: string
}): Promise<{ qrcode: string; qrcode_img_content: string }> {
  return httpGet(
    params.baseUrl,
    `ilink/bot/get_bot_qrcode?bot_type=${params.botType ?? '3'}`
  )
}

export async function getQrcodeStatus(params: {
  baseUrl: string
  qrcode: string
}): Promise<{
  status: string
  bot_token?: string
  baseurl?: string
  ilink_bot_id?: string
  ilink_user_id?: string
}> {
  return httpGet(
    params.baseUrl,
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(params.qrcode)}`
  )
}

export async function notifyStart(params: {
  baseUrl: string
  token?: string
}): Promise<void> {
  await httpPost(params.baseUrl, 'ilink/bot/msg/notifystart', {}, params.token, 10_000)
}

export async function notifyStop(params: {
  baseUrl: string
  token?: string
}): Promise<void> {
  await httpPost(params.baseUrl, 'ilink/bot/msg/notifystop', {}, params.token, 10_000)
}
