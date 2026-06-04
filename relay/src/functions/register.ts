/**
 * Register endpoint — Aide registers its userId to start receiving webhooks.
 *
 * POST /api/register
 *   Body: { userId?: string }  (optional — generates one if not provided)
 *   Returns: { userId, relayToken, webhookUrl }
 *
 * The user then configures Meta Developer Portal with the returned webhookUrl.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { registerUser } from '../buffer'
import { setToken } from './messages'
import { randomUUID } from 'crypto'

async function register(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine
  }

  const userId = body.userId || randomUUID()
  const relayToken = randomUUID()

  // Register user in buffer and token store
  registerUser(userId)
  setToken(userId, relayToken)

  // Build the webhook URL that the user should set in Meta Developer Portal
  const host = req.headers.get('host') || 'localhost:7071'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const webhookUrl = `${protocol}://${host}/api/webhook/${userId}`

  context.log(`Registered user: ${userId}`)

  return {
    status: 200,
    jsonBody: {
      userId,
      relayToken,
      webhookUrl
    }
  }
}

app.http('register', {
  route: 'register',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: register
})
