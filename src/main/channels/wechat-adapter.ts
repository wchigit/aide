/**
 * WeChat adapter — wraps the existing src/main/wechat module
 * into the unified Channel interface.
 */

import type { Channel, ChannelStatus, InboundMessageHandler } from './types'
import { getWeChatStatus, connectWeChat, disconnectWeChat, pushToWeChat } from '../wechat'

export const wechatChannel: Channel = {
  id: 'wechat',

  status(): ChannelStatus {
    const st = getWeChatStatus()
    return {
      id: 'wechat',
      connection: st.monitorActive ? 'connected' : st.connection,
      lastError: st.lastError
    }
  },

  async connect(): Promise<void> {
    await connectWeChat()
  },

  disconnect(): void {
    disconnectWeChat()
  },

  async send(text: string): Promise<void> {
    await pushToWeChat(text)
  },

  onMessage(_handler: InboundMessageHandler): void {
    // WeChat's message handling is wired internally via setMessageHandler → dispatch.
    // The channel registry doesn't override it — WeChat commands.ts handles routing.
    // This is a no-op; the existing WeChat message flow continues to work as-is.
  }
}
