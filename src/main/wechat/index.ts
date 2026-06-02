/**
 * WeChat module entry point.
 * Provides the public API consumed by IPC handlers.
 */

import { loadToken, clearToken, login, getBaseUrl } from './connection'
import { sendTextMessage, startMonitor, stopMonitor, isMonitorRunning, setMessageHandler } from './messaging'
import { dispatch, setCommandContext } from './commands'
import type { WeChatStatus, WeChatState, WeChatTokenData } from './client'

let currentState: WeChatState | null = null
let lastError: string | null = null

/**
 * Get current WeChat connection status.
 */
export function getWeChatStatus(): WeChatStatus {
  const tokenData = loadToken()
  const connected = !!tokenData
  const monitoring = isMonitorRunning()

  return {
    connection: monitoring ? 'connected' : connected ? 'disconnected' : 'disconnected',
    accountId: tokenData?.accountId || null,
    targetUser: currentState?.targetUserId || null,
    lastError,
    monitorActive: monitoring
  }
}

/**
 * Connect to WeChat via QR code login and start monitor.
 */
export async function connectWeChat(): Promise<WeChatStatus> {
  try {
    let tokenData = loadToken()

    if (!tokenData) {
      tokenData = await login()
      if (!tokenData) {
        lastError = 'Login cancelled or timed out'
        return getWeChatStatus()
      }
    }

    // Initialize state
    currentState = {
      targetUserId: tokenData.userId,
      contextToken: '',
      lastMessageAt: new Date().toISOString()
    }

    // Set up command context
    setCommandContext({ tokenData, state: currentState })

    // Wire message handler to command dispatcher
    setMessageHandler(dispatch)

    // Start long-poll monitor
    startMonitor(tokenData)
    lastError = null

    return getWeChatStatus()
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    return getWeChatStatus()
  }
}

/**
 * Disconnect: stop monitor and clear token.
 */
export function disconnectWeChat(): WeChatStatus {
  stopMonitor()
  clearToken()
  currentState = null
  lastError = null
  return getWeChatStatus()
}

/**
 * Send a report/text to the connected WeChat user.
 */
export async function pushToWeChat(text: string): Promise<void> {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('WeChat not connected')
  if (!currentState) {
    // Rebuild state from saved token
    currentState = {
      targetUserId: tokenData.userId,
      contextToken: '',
      lastMessageAt: new Date().toISOString()
    }
  }

  await sendTextMessage({
    tokenData,
    state: currentState,
    text
  })
}

/**
 * Set the target user for outbound messages.
 * The userId from auth is the bot's own ID; for pushing to a specific user
 * we need their ilink_user_id (obtained from first inbound message).
 */
export function setTargetUser(userId: string): void {
  if (!currentState) {
    const tokenData = loadToken()
    currentState = {
      targetUserId: userId,
      contextToken: '',
      lastMessageAt: new Date().toISOString()
    }
    if (tokenData) {
      setCommandContext({ tokenData, state: currentState })
    }
  } else {
    currentState.targetUserId = userId
  }
}

/**
 * Initialize WeChat module on app start.
 * Restores connection if token exists and auto-connect is desired.
 */
export async function initWeChat(autoConnect = false): Promise<void> {
  if (autoConnect) {
    const tokenData = loadToken()
    if (tokenData) {
      await connectWeChat()
    }
  }
}
