/**
 * Messages endpoint — Aide polls this to fetch buffered messages.
 *
 * GET /api/messages/{userId}
 *   Header: x-relay-token: <relayToken>
 *   Returns: { messages: [...] }
 *
 * Messages are deleted from the buffer after being returned.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { popMessages, isRegistered } from '../buffer'

// Simple token store (in production, use Azure Table Storage or similar)
// userId → relayToken mapping
const tokens = new Map<string, string>()

export function setToken(userId: string, token: string): void {
  tokens.set(userId, token)
}

export function getTokenStore(): Map<string, string> {
  return tokens
}

async function messages(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = req.params.userId
  if (!userId) {
    return { status: 400, jsonBody: { error: 'Missing userId' } }
  }

  // Authenticate — relay token must match
  const relayToken = req.headers.get('x-relay-token')
  const expectedToken = tokens.get(userId)

  if (!expectedToken || relayToken !== expectedToken) {
    return { status: 401, jsonBody: { error: 'Invalid or missing relay token' } }
  }

  if (!isRegistered(userId)) {
    return { status: 404, jsonBody: { error: 'User not registered' } }
  }

  const msgs = popMessages(userId)
  return {
    status: 200,
    jsonBody: { messages: msgs }
  }
}

app.http('messages', {
  route: 'messages/{userId}',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: messages
})
