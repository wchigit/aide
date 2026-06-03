# Meta Channels Research (WhatsApp, Messenger, Instagram)

## Problem Statement

All three Meta platforms require a **publicly accessible webhook URL** to receive inbound messages. This is a fundamental mismatch with Aide's architecture as a desktop Electron app.

## Approaches Discovered

### 1. Baileys — TypeScript WhatsApp Web Library (RECOMMENDED)

**Project**: [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) (9.6k stars, 543k weekly npm downloads)

**How it works**:
- Pure TypeScript, WebSocket-based — NO external binary, NO Chromium, NO Selenium
- Authenticates via QR code scan or pairing code (phone number)
- Persistent auth via `useMultiFileAuthState()` — saves creds to local files
- Event-driven: `sock.ev.on('messages.upsert', ...)` for receiving messages
- Simple sending: `sock.sendMessage(jid, { text: 'hello' })`
- Sessions last weeks/months before re-auth needed
- 11 dependencies, MIT license, actively maintained (v7.0.0-rc13, June 2026)

**Install**: `npm i baileys`

**Architecture**:
```
Aide (Electron main process)
  └─ Baileys (TypeScript)
       └─ WebSocket ←→ WhatsApp servers
       └─ useMultiFileAuthState → userData/whatsapp/auth/
```

**Mapping to Aide's Channel interface**:
```typescript
// connect() → makeWASocket({ auth: state, printQRInTerminal: false })
// disconnect() → sock.end()
// send(text) → sock.sendMessage(targetJid, { text })
// onMessage() → sock.ev.on('messages.upsert', handler)
// status() → sock.ev.on('connection.update', ...)
```

**Pros**: Same language as Aide (TS), same pattern as Discord (WebSocket+events), same UX as WeChat (QR auth), no server needed, huge community, well-maintained
**Cons**: Unofficial API (risk of ban), WhatsApp ToS gray area, protocol breakage risk (but team ships fixes fast)

### 1b. whatsmeow (Go alternative — NOT recommended for Aide)

**Project**: [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) (5.7k stars)

Same approach but in Go. Requires CGO on Windows, adds Go build dependency. No advantage over Baileys for a TypeScript Electron app.

### 2. WhatsApp Business Cloud API (Official)

**Source**: [Meta Developer Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

**How it works**:
- Official API for sending/receiving WhatsApp messages
- **Sending**: REST API call to `graph.facebook.com` — works from anywhere
- **Receiving**: Requires webhook endpoint (Meta pushes events to your server)
- 24-hour customer service window for non-template messages
- Template messages can be sent anytime (pre-approved by Meta)

**Architecture**:
```
[Sending only - no webhook needed]
Aide → REST API → graph.facebook.com → WhatsApp user

[Receiving - needs webhook]
WhatsApp user → Meta servers → webhook → (relay server) → Aide
```

**Pros**: Official, reliable, no ban risk
**Cons**: Webhook required for receiving, business account needed, template approval process, 24h reply window

### 3. OWL Framework (CAMEL-AI) + WhatsApp MCP

**Project**: [camel-ai/owl](https://github.com/camel-ai/owl) (19.8k stars)

**How it works**:
- Uses MCP (Model Context Protocol) to standardize tool access
- WhatsApp integration via the same whatsmeow-based bridge (QR code auth)
- Multi-agent framework orchestrates the conversation
- Designed for cloud/server deployment (not desktop-specific)

### 4. Relay Server Pattern

For official API compliance:
```
Aide desktop ←WebSocket→ Relay server ←webhook← Meta platforms
```

- Small always-on server (e.g. Cloudflare Worker, Azure Function)
- Receives Meta webhooks, buffers messages
- Aide connects via WebSocket when online, pulls buffered messages
- Could serve all three Meta platforms with one relay

### 5. Tunnel (ngrok / Cloudflare Tunnel)

- Auto-start a tunnel on connect, register webhook URL with Meta
- Free tier: URLs rotate → need re-registration each time
- Paid tier: stable URLs
- Fragile, not suitable for production

## Messenger & Instagram

Both use the same underlying Meta Graph API:
- **Messenger**: Page-scoped, requires `pages_messaging` permission, webhook for inbound
- **Instagram**: Uses Instagram Messaging API, same webhook pattern
- Same 24h messaging window constraint
- Same webhook requirement for receiving messages

## Feasibility Assessment

| Approach | Sends? | Receives? | Official? | Language | Effort | Fit for Aide |
|----------|--------|-----------|-----------|----------|--------|-------------|
| **Baileys** (WA Web) | ✅ | ✅ (WebSocket) | ❌ unofficial | TypeScript | **Low** | **Perfect** |
| whatsmeow (WA Web) | ✅ | ✅ (WebSocket) | ❌ unofficial | Go | Medium | Poor (wrong lang) |
| Cloud API send-only | ✅ | ❌ | ✅ | Any | Low | Partial |
| Cloud API + relay | ✅ | ✅ | ✅ | Any + infra | High | Good but complex |
| Tunnel (ngrok) | ✅ | ✅ (fragile) | ✅ | Any | Medium | Fragile |

## Recommendation

### Phase 1: WhatsApp via Baileys (DO THIS NEXT)

**Why**: Lowest effort, highest impact. Pure TypeScript. Identical architecture to our existing Discord channel (WebSocket + events). Same QR auth UX as WeChat. 543k weekly downloads = battle-tested.

**Implementation plan** (~200 lines of code):
```
src/main/whatsapp/
  index.ts       — Channel interface (connect/disconnect/send/onMessage)
  commands.ts    — /tasks, /report, /done, /setup, /help
```

**UX flow**:
1. User clicks "Connect" in Settings
2. QR code appears in Aide window (Baileys emits `qr` event with data URL)
3. User scans with WhatsApp on phone
4. Connected. Messages flow both ways.
5. Session persists in `userData/whatsapp/auth/` (re-auth rarely needed)

**Config**: Just a target phone number (who to message). Or "self-chat" mode (message yourself).

### Phase 2: Send-only for Messenger/Instagram (OPTIONAL)

If users want job results delivered to Messenger/Instagram:
- Use Meta Graph API for outbound only (REST call, no webhook)
- User provides page access token + recipient ID
- No inbound messages (can't receive without webhook)
- Low effort, limited value

### Phase 3: Full bidirectional Meta platforms (FUTURE)

- Lightweight relay service (Cloudflare Worker or Azure Function)
- Receives Meta webhooks, buffers messages
- Aide connects via WebSocket when online
- One relay serves WhatsApp Cloud API + Messenger + Instagram
- Requires infrastructure commitment

## References

- https://github.com/WhiskeySockets/Baileys (TypeScript, 9.6k stars, 543k/week)
- https://www.npmjs.com/package/baileys
- https://baileys.wiki/ (official docs)
- https://github.com/lharries/whatsapp-mcp (Go alternative, reference architecture)
- https://github.com/tulir/whatsmeow (Go WhatsApp Web API library)
- https://github.com/camel-ai/owl
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- https://developers.facebook.com/docs/messenger-platform/getting-started
