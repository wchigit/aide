/**
 * Channel registry — provides a unified way to access any messaging channel.
 * Jobs/delivery can call `getChannel('telegram').send(summary)` without
 * knowing the channel internals.
 */

import type { Channel, ChannelId, ChannelStatus } from './types'
import { telegramChannel } from '../telegram'
import { discordChannel } from '../discord'
import { wechatChannel } from './wechat-adapter'

const channels = new Map<ChannelId, Channel>()

// Register built-in channels
channels.set('wechat', wechatChannel)
channels.set('telegram', telegramChannel)
channels.set('discord', discordChannel)

/**
 * Get a channel by ID.
 */
export function getChannel(id: ChannelId): Channel | undefined {
  return channels.get(id)
}

/**
 * List all registered channels and their statuses.
 */
export function listChannels(): ChannelStatus[] {
  return Array.from(channels.values()).map(ch => ch.status())
}

/**
 * Send a message through a specific channel.
 * Returns false if the channel doesn't exist or isn't connected.
 */
export async function deliverTo(channelId: ChannelId, text: string): Promise<boolean> {
  const ch = channels.get(channelId)
  if (!ch) return false

  const st = ch.status()
  if (st.connection !== 'connected') return false

  try {
    await ch.send(text)
    return true
  } catch (err) {
    console.error(`[Channels] Delivery to ${channelId} failed:`, err)
    return false
  }
}

/**
 * Broadcast a message to all connected channels.
 */
export async function broadcast(text: string): Promise<ChannelId[]> {
  const delivered: ChannelId[] = []
  for (const [id, ch] of channels) {
    if (ch.status().connection === 'connected') {
      try {
        await ch.send(text)
        delivered.push(id)
      } catch (err) {
        console.error(`[Channels] Broadcast to ${id} failed:`, err)
      }
    }
  }
  return delivered
}

export type { Channel, ChannelId, ChannelStatus } from './types'
