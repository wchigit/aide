/**
 * Channel abstraction — a unified interface for messaging channels (WeChat, Telegram, etc.).
 * Each channel can send/receive messages and be used as a delivery target for jobs.
 */

export type ChannelId = 'wechat' | 'whatsapp' | 'telegram' | 'discord'

export type ChannelConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ChannelStatus {
  id: ChannelId
  connection: ChannelConnectionStatus
  lastError: string | null
}

export interface Channel {
  readonly id: ChannelId

  /** Current connection status */
  status(): ChannelStatus

  /** Connect the channel (may involve token validation, QR login, etc.) */
  connect(): Promise<void>

  /** Disconnect and stop receiving messages */
  disconnect(): void

  /** Send a text message to the configured target */
  send(text: string): Promise<void>

  /** Register a handler for inbound messages from the user */
  onMessage(handler: InboundMessageHandler): void
}

export type InboundMessageHandler = (text: string, senderId: string) => void | Promise<void>
