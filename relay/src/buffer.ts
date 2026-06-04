/**
 * In-memory message buffer.
 * In production, swap this for Azure Queue Storage for durability.
 * For a personal tool with low volume, in-memory is fine — messages
 * only live for seconds between webhook arrival and Aide polling.
 */

export interface BufferedMessage {
  id: string
  from: string
  text: string
  platform: 'whatsapp' | 'messenger' | 'instagram'
  timestamp: string
}

// userId → messages[]
const buffers = new Map<string, BufferedMessage[]>()

let counter = 0

export function pushMessage(userId: string, msg: Omit<BufferedMessage, 'id'>): void {
  if (!buffers.has(userId)) {
    buffers.set(userId, [])
  }
  buffers.get(userId)!.push({ ...msg, id: `msg_${++counter}` })
}

export function popMessages(userId: string): BufferedMessage[] {
  const msgs = buffers.get(userId) || []
  buffers.set(userId, [])
  return msgs
}

/**
 * Check if a userId is registered (exists in buffer map).
 */
export function isRegistered(userId: string): boolean {
  return buffers.has(userId)
}

/**
 * Register a new user (creates empty buffer).
 */
export function registerUser(userId: string): void {
  if (!buffers.has(userId)) {
    buffers.set(userId, [])
  }
}
