/**
 * Meta Webhook handler.
 * Receives incoming messages from WhatsApp/Messenger/Instagram and buffers them.
 *
 * Two routes:
 *   GET  /api/webhook/{userId} — Meta verification challenge
 *   POST /api/webhook/{userId} — Incoming message from Meta
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { pushMessage, isRegistered } from '../buffer'

/**
 * Meta webhook verification (GET).
 * Meta sends: ?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=yyy
 * We must return the challenge value if verify_token matches.
 */
function handleVerification(req: HttpRequest): HttpResponseInit {
  const mode = req.query.get('hub.mode')
  const token = req.query.get('hub.verify_token')
  const challenge = req.query.get('hub.challenge')

  const expectedToken = process.env.META_VERIFY_TOKEN
  if (!expectedToken) {
    return { status: 500, body: 'META_VERIFY_TOKEN not configured' }
  }

  if (mode === 'subscribe' && token === expectedToken) {
    return { status: 200, body: challenge || '' }
  }

  return { status: 403, body: 'Verification failed' }
}

/**
 * Parse incoming Meta webhook payload and extract text messages.
 */
function extractMessages(body: any, platform: 'whatsapp' | 'messenger' | 'instagram'): Array<{ from: string; text: string }> {
  const messages: Array<{ from: string; text: string }> = []

  if (platform === 'whatsapp') {
    // WhatsApp Cloud API payload structure
    const entries = body?.entry || []
    for (const entry of entries) {
      const changes = entry?.changes || []
      for (const change of changes) {
        const value = change?.value
        if (!value?.messages) continue
        for (const msg of value.messages) {
          if (msg.type === 'text' && msg.text?.body) {
            messages.push({ from: msg.from, text: msg.text.body })
          }
        }
      }
    }
  } else {
    // Messenger / Instagram payload structure
    const entries = body?.entry || []
    for (const entry of entries) {
      const messaging = entry?.messaging || []
      for (const event of messaging) {
        if (event.message?.text) {
          messages.push({ from: event.sender?.id || 'unknown', text: event.message.text })
        }
      }
    }
  }

  return messages
}

/**
 * Determine platform from the webhook payload.
 */
function detectPlatform(body: any): 'whatsapp' | 'messenger' | 'instagram' {
  if (body?.object === 'whatsapp_business_account') return 'whatsapp'
  if (body?.object === 'instagram') return 'instagram'
  return 'messenger' // 'page' object = messenger
}

/**
 * Main webhook handler.
 */
async function webhook(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = req.params.userId
  if (!userId) {
    return { status: 400, body: 'Missing userId in URL' }
  }

  // GET = Meta verification
  if (req.method === 'GET') {
    return handleVerification(req)
  }

  // POST = incoming message
  if (!isRegistered(userId)) {
    // Still return 200 to Meta so they don't retry — but we discard the message
    context.log(`Webhook received for unregistered userId: ${userId}`)
    return { status: 200, body: 'OK' }
  }

  try {
    const body = await req.json()
    const platform = detectPlatform(body)
    const messages = extractMessages(body, platform)

    for (const msg of messages) {
      pushMessage(userId, {
        from: msg.from,
        text: msg.text,
        platform,
        timestamp: new Date().toISOString()
      })
    }

    context.log(`Buffered ${messages.length} message(s) for ${userId} [${platform}]`)
    return { status: 200, body: 'OK' }
  } catch (err) {
    context.error('Webhook parse error:', err)
    return { status: 200, body: 'OK' } // Always 200 to prevent Meta retries
  }
}

app.http('webhook', {
  route: 'webhook/{userId}',
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: webhook
})
