/**
 * Telegram Bot API client — stateless HTTP calls to api.telegram.org.
 */

const TELEGRAM_API = 'https://api.telegram.org'

export interface TelegramConfig {
  botToken: string
  chatId: string
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name: string; username?: string }
    chat: { id: number; type: string }
    date: number
    text?: string
  }
}

interface GetUpdatesResponse {
  ok: boolean
  result: TelegramUpdate[]
  description?: string
}

interface SendMessageResponse {
  ok: boolean
  result?: { message_id: number }
  description?: string
}

/**
 * Long-poll for new messages.
 * Blocks up to `timeout` seconds waiting for updates.
 */
export async function getUpdates(
  config: TelegramConfig,
  offset: number,
  timeout = 30,
  signal?: AbortSignal
): Promise<TelegramUpdate[]> {
  const url = `${TELEGRAM_API}/bot${config.botToken}/getUpdates`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offset,
      timeout,
      allowed_updates: ['message']
    }),
    signal
  })

  if (!resp.ok) {
    throw new Error(`Telegram getUpdates failed: ${resp.status} ${resp.statusText}`)
  }

  const data = (await resp.json()) as GetUpdatesResponse
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || 'unknown'}`)
  }

  return data.result
}

/**
 * Send a text message to a chat.
 */
export async function sendMessage(
  config: TelegramConfig,
  text: string,
  parseMode: 'Markdown' | 'HTML' | '' = ''
): Promise<void> {
  const url = `${TELEGRAM_API}/bot${config.botToken}/sendMessage`
  const body: Record<string, unknown> = {
    chat_id: config.chatId,
    text
  }
  if (parseMode) body.parse_mode = parseMode

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!resp.ok) {
    const data = (await resp.json()) as SendMessageResponse
    throw new Error(`Telegram sendMessage failed: ${data.description || resp.statusText}`)
  }
}

/**
 * Validate a bot token by calling getMe.
 */
export async function validateToken(botToken: string): Promise<{ id: number; username: string }> {
  const url = `${TELEGRAM_API}/bot${botToken}/getMe`
  const resp = await fetch(url)

  if (!resp.ok) {
    throw new Error(`Invalid bot token: ${resp.status}`)
  }

  const data = await resp.json() as { ok: boolean; result?: { id: number; username: string }; description?: string }
  if (!data.ok || !data.result) {
    throw new Error(`Token validation failed: ${data.description || 'unknown'}`)
  }

  return data.result
}
