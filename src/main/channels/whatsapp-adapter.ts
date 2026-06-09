/**
 * WhatsApp adapter — wraps the Baileys-based src/main/whatsapp module
 * into the unified Channel interface.
 */

import type { Channel, ChannelStatus, InboundMessageHandler } from './types'
import { getWhatsAppStatus, connectWhatsApp, disconnectWhatsApp, pushToWhatsApp } from '../whatsapp'

export const whatsappChannel: Channel = {
  id: 'whatsapp',

  status(): ChannelStatus {
    const st = getWhatsAppStatus()
    return {
      id: 'whatsapp',
      connection: st.connection,
      lastError: st.lastError
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

  onMessage(_handler: InboundMessageHandler): void {
    // WhatsApp's message handling is wired internally via setMessageHandler → dispatch.
    // This is a no-op; the existing WhatsApp commands.ts handles routing.
  }
}
