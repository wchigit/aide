# WeChat Integration Test Plan

## Unit Tests (automated)

### 1. `splitText()` — Message chunking

```typescript
import { splitText } from '../src/main/wechat/send'

describe('splitText', () => {
  it('returns single chunk for short text', () => {
    const result = splitText('Hello World')
    expect(result).toEqual(['Hello World'])
  })

  it('splits at paragraph boundary', () => {
    const text = 'A'.repeat(3000) + '\n\n' + 'B'.repeat(500)
    const result = splitText(text, 4000)
    expect(result.length).toBe(2)
    expect(result[0]).toBe('A'.repeat(3000))
    expect(result[1]).toBe('B'.repeat(500))
  })

  it('falls back to newline split', () => {
    const text = 'A'.repeat(3500) + '\n' + 'B'.repeat(1000)
    const result = splitText(text, 4000)
    expect(result.length).toBe(2)
  })

  it('hard-cuts when no good boundary exists', () => {
    const text = 'A'.repeat(8000)
    const result = splitText(text, 4000)
    expect(result.length).toBe(2)
    expect(result[0].length).toBe(4000)
  })

  it('handles empty string', () => {
    expect(splitText('')).toEqual([''])
  })

  it('handles exact boundary', () => {
    const text = 'A'.repeat(4000)
    expect(splitText(text, 4000)).toEqual([text])
  })
})
```

### 2. `extractText()` — Message parsing

```typescript
import { MessageItemType } from '../src/main/wechat/types'

// Test the extraction logic in router
describe('extractText', () => {
  it('extracts text from item_list', () => {
    const msg = {
      item_list: [{ type: MessageItemType.TEXT, text_item: { text: 'hello' } }]
    }
    // Should return 'hello'
  })

  it('returns null for empty item_list', () => {
    const msg = { item_list: [] }
    // Should return null
  })

  it('returns null for non-text items', () => {
    const msg = {
      item_list: [{ type: MessageItemType.IMAGE }]
    }
    // Should return null
  })
})
```

### 3. API header construction

```typescript
describe('buildHeaders', () => {
  it('includes required headers', () => {
    // Verify Content-Type, AuthorizationType, X-WECHAT-UIN are present
    // Verify Bearer token when provided
  })

  it('generates random X-WECHAT-UIN each call', () => {
    // Two calls should produce different values (probabilistic)
  })
})
```

---

## Integration Tests (manual, with real iLink endpoint)

### Test 1: QR Code Login Flow

**Steps:**
1. Call `connectWeChat()` via DevTools: `window.aide.wechat.connect()`
2. Observe console/renderer for `wechat:qrcode` event
3. Scan QR code with WeChat
4. Verify `wechat:login-progress` events: `scanned` → `confirmed`
5. Verify token saved: check `%APPDATA%/aide/wechat/token.json`

**Expected:**
- QR code image data emitted to renderer
- After scan, token persisted with correct shape `{ token, baseUrl, accountId, userId, savedAt }`
- Status returns `{ connection: 'connected', monitorActive: true }`

### Test 2: Push Report to WeChat

**Steps:**
1. Ensure connected (Test 1 passed)
2. Set target user (first time: send any message from WeChat to bot, monitor captures userId)
3. Generate a report in Dashboard
4. Click "推送到微信" button
5. Check WeChat for received message

**Expected:**
- Message arrives in WeChat within 2-3s
- Long reports (>4000 chars) arrive as multiple messages
- No markdown artifacts; plain text readable on mobile

### Test 3: Inbound Quick Commands

**Steps:**
1. Ensure monitor is running
2. Send `/任务` from WeChat
3. Send `/日报` from WeChat
4. Send `/帮助` from WeChat
5. Send `/完成` from WeChat

**Expected:**
- `/任务` → replies with numbered task list
- `/日报` → replies with today's summary (completed/in-progress/pending counts)
- `/帮助` → replies with command list
- `/完成` → either completes the single active task or asks to choose

### Test 4: Agent Conversation via WeChat

**Steps:**
1. Send a natural language message from WeChat, e.g. "帮我创建一个任务：明天下午开会准备 PPT"
2. Wait for agent reply
3. Verify task was created in Aide

**Expected:**
- Agent processes the message (visible in agent logs)
- Reply arrives in WeChat as plain text (no markdown code blocks)
- Task appears in Aide's task list

### Test 5: Confirmation Flow

**Steps:**
1. Send a message that triggers a tool requiring confirmation, e.g. "帮我把上周的周报发给老板"
2. Agent should ask for confirmation via WeChat text
3. Reply "确认" from WeChat
4. (or reply "取消" to test cancellation)

**Expected:**
- Bot sends "需要确认: [action]. 回复确认/取消"
- "确认" → action proceeds, reply with result
- "取消" → action cancelled, reply acknowledgment
- Timeout (5min no reply) → auto-cancel

### Test 6: Session Expiry and Recovery

**Steps:**
1. Connect and verify monitor running
2. Wait for errcode -14 (or simulate by invalidating token)
3. After pause period, verify monitor resumes

**Expected:**
- Console log: `[WeChat] Session expired, pausing 1hr`
- Monitor auto-resumes after pause
- No crash or unhandled rejection

### Test 7: Disconnect and Reconnect

**Steps:**
1. `window.aide.wechat.disconnect()` from DevTools
2. Verify monitor stops, token cleared
3. `window.aide.wechat.connect()` → new QR flow
4. Verify fully reconnected

**Expected:**
- After disconnect: status shows `disconnected`, cursor file preserved
- Reconnect starts fresh QR flow
- After reconnect: previous cursor used (no duplicate messages)

### Test 8: Error Resilience

**Steps:**
1. Disconnect network while monitor running
2. Wait for 3 consecutive errors + backoff
3. Restore network

**Expected:**
- Console logs show error count incrementing
- After 3 failures, 30s backoff
- Auto-recovers when network restored
- No memory leaks (AbortController properly used)

---

## Performance Metrics to Observe

| Metric | Target |
|--------|--------|
| Login (QR scan → token) | < 10s after scan |
| Message send latency | < 3s per chunk |
| Monitor poll cycle | ~35s idle, immediate on message |
| Memory usage (monitor idle) | < 5MB additional |
| Reconnect after error | < 35s |

---

## Smoke Test Script (DevTools)

```javascript
// Quick validation after deployment
const status = await window.aide.wechat.getStatus()
console.log('Status:', status)

// If connected, try push:
await window.aide.wechat.push('测试消息 from Aide ' + new Date().toLocaleTimeString())
console.log('Push sent!')
```
