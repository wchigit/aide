# WeChat Report Sync — Investigation Report

## Executive Summary

Aide 的日报（ReportCard）目前只能在 Dashboard 里查看和复制文本。我们希望增加"一键推送到微信"能力，让用户的日报自动/手动同步到自己的微信消息。

经调研，最佳路径是 **基于 iLink Bot API（OpenClaw 的 WeChat 通信协议）** 在 Aide 的 Electron main process 中内置一个轻量 WeChat sender 模块。

---

## 1. WeChat 可用接口调研

### 1.1 iLink Bot API（OpenClaw WeChat 通信协议）

这是微信官方为"智能对话"场景提供的 HTTP API，核心端点：

| 端点 | 功能 |
|------|------|
| `GET /ilink/bot/get_bot_qrcode` | 获取登录二维码 |
| `GET /ilink/bot/get_qrcode_status` | 轮询扫码状态 |
| `POST /ilink/bot/getupdates` | 长轮询收取消息 |
| `POST /ilink/bot/sendmessage` | 发送消息（文本/图片/文件） |
| `POST /ilink/bot/sendtyping` | 发送"正在输入"状态 |
| `POST /ilink/bot/getuploadurl` | 获取媒体上传 URL |
| `POST /ilink/bot/getconfig` | 获取会话配置（typing ticket） |

**认证方式**: 
- 首次：扫微信二维码 → 获得 `bot_token` 
- 后续：Bearer token 复用（持久化到本地）
- Header: `AuthorizationType: ilink_bot_token`

**发送消息的数据结构** (`SendMessageReq`):
```typescript
{
  msg: {
    from_user_id: "",           // 留空（bot 身份）
    to_user_id: "<target>",    // 目标用户 ID
    client_id: "<uuid>",       // 幂等 key，防重
    message_type: 2,           // BOT
    message_state: 2,          // FINISH
    context_token: "<token>",  // 会话 context
    item_list: [
      { type: 1, text_item: { text: "..." } }    // 文本
      // { type: 2, image_item: {...} }           // 图片
      // { type: 4, file_item: {...} }            // 文件
    ]
  }
}
```

**限制**:
- 仅支持 1:1 私聊，不支持群聊
- 消息长度无官方限制，建议按 4000 字符分段
- 需要目标用户先向 bot 发过消息才能获得 `context_token`
- Token 有效期未公开，可能过期需重新扫码

### 1.2 其他 WeChat 接口对比

| 方案 | 优劣 |
|------|------|
| **iLink Bot API** | ✅ OpenClaw 已验证可用，有成熟实现参考；仅需微信扫码；轻量 HTTP |
| **企业微信 Webhook** | ❌ 需要企业微信 + 群机器人，面向团队不是个人 |
| **微信公众号** | ❌ 需要注册公众号、认证，且模板消息受限 |
| **itchat / wxpy** | ❌ Web 微信协议已被大面积封禁 |
| **Appium/UI 自动化** | ❌ 极度脆弱，不可生产使用 |

**结论：iLink Bot API 是唯一可行的个人微信消息发送方案。**

---

## 2. OpenClaw iLink 通信层

OpenClaw（`@tencent-weixin/openclaw-weixin`）是 iLink Bot API 的官方 TypeScript 实现。它提供了完整的 WeChat 通信能力，包括：

| 模块 | 说明 | Aide 是否需要 |
|------|------|--------------|
| HTTP 客户端 (api.ts) | iLink 请求封装、header 构造、超时处理 | ✅ 参考实现 |
| 消息发送 (send.ts) | 文本/图片/文件消息发送 + 分段 | ✅ 参考实现 |
| 类型定义 (types.ts) | iLink 协议类型（MessageType, MessageState 等） | ✅ 参考实现 |
| 二维码登录 (auth.ts) | QR 获取 + 扫码轮询 | ✅ 改造为 Electron |
| 消息轮询 (monitor.ts) | getupdates 长轮询 + cursor 管理 | ✅ 双向交互需要 |

**源码参考**: [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin)

**关键常量（从 OpenClaw 源码确认）:**

| 项 | 值 |
|----|-----|
| API 基础 URL | `https://ilinkai.weixin.qq.com` |
| CDN 基础 URL | `https://novac2c.cdn.weixin.qq.com/c2c` |
| channel_version | 从 `package.json` version 字段动态读取 |
| bot_agent | `"OpenClaw"`（默认值，可自定义） |
| ilink_appid | 从 `package.json` 的 `ilink_appid` 字段读取 |
| 长轮询超时 | 35,000ms（服务端建议） |
| API 请求超时 | 15,000ms（sendMessage 等） |
| Config 请求超时 | 10,000ms（getConfig, sendTyping） |

**认证流程（从 OpenClaw accounts.ts 确认）:**
- QR 登录后返回 `bot_token` + `baseUrl` + `ilink_bot_id`（accountId）+ `ilink_user_id`
- Token 持久化为 `{ token, savedAt, baseUrl, userId }` JSON
- 多账号支持：每次 QR 登录创建新 account entry
- baseUrl 优先从登录返回值取，fallback 到 `DEFAULT_BASE_URL`

---

## 3. 实现策略

我们基于 OpenClaw 的 iLink 协议实现，在 Aide 的 main process 中自建轻量通信模块。不依赖任何外部 daemon 或中间件——直接 HTTP 调用 iLink API，消息路由到 Aide 现有的 Agent engine。

---

## 4. Aide 当前日报系统

当前状态：
- **生成**: `DashboardView.tsx` 中 `buildReportText()` 根据完成/忽略的任务列表生成纯文本
- **展示**: `ReportCard` 组件内联展示
- **导出**: 仅"复制到剪贴板"
- **自动生成**: `daily-reconcile` Job（每天 18:00）生成日报存入 `lastSummary`

缺失：没有任何推送渠道。

---

## 5. 实现方案提议

### 5.1 方案概述

在 Aide Electron main process 中新增 `src/main/wechat/` 模块，实现：

1. **WeChat 连接管理**（登录、token 持久化）
2. **消息发送能力**（调 iLink `sendmessage` API）
3. **日报推送触发**（手动按钮 + Job 自动推送）

### 5.2 模块设计

```
src/main/wechat/
├── index.ts          # 模块入口：init / send / getStatus
├── api.ts            # iLink HTTP client
├── auth.ts           # QR 登录 + token 管理
├── send.ts           # sendTextMessage + splitText
└── types.ts          # iLink 协议类型
```

### 5.3 用户流程

#### 首次设置
```
Settings Drawer → WeChat 连接
  → 点击"连接微信"
  → Electron 弹出小窗口展示 QR 码
  → 用户微信扫码确认
  → token 保存到 userData (~/.aide/wechat-token.json)
  → 连接状态变绿 ✓
  → 用户需要从微信发一条消息给 bot 以建立 contextToken
```

#### 手动推送日报
```
Dashboard → 日报卡片 → 点击"推送到微信"按钮
  → IPC: aide:wechat:send-report { text }
  → main process → sendTextMessage(...)
  → 成功 → toast 提示 ✓
  → 失败 → toast 显示错误（token过期则提示重连）
```

#### 自动推送（daily-reconcile Job 后）
```
daily-reconcile Job 完成
  → 检查 WeChat 连接是否 active
  → 是 → 自动调用 sendTextMessage 推送日报
  → 否 → 跳过（不阻断 Job）
```

### 5.4 数据流

```
┌──────────────────────┐
│  Renderer            │
│  DashboardView       │
│  [推送到微信] button │
└──────────┬───────────┘
           │ IPC: aide:wechat:send-report
           ▼
┌──────────────────────┐
│  Main Process        │
│  src/main/wechat/    │
│  - 检查 token 有效   │
│  - splitText(4000)   │
│  - sendTextMessage() │
└──────────┬───────────┘
           │ HTTPS
           ▼
┌──────────────────────┐
│  WeChat iLink API    │
│  /ilink/bot/         │
│  sendmessage         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  用户微信客户端      │
│  收到日报消息        │
└──────────────────────┘
```

### 5.5 关键实现细节

| 项 | 方案 |
|----|------|
| Token 存储 | `~/.aide/wechat/token.json` |
| contextToken | 首次需要用户从微信发消息给 bot，存储到 `~/.aide/wechat/state.json` |
| 分段发送 | 4000 字符一段，段间 150ms 间隔（保序） |
| 幂等 | 每段一个 UUID client_id |
| 错误处理 | Token 过期 → 提示用户重新扫码；网络错误 → 3 次重试 |
| 消息格式 | 纯文本（微信不支持 Markdown 渲染），可用 emoji 分隔 |
| 共存 | 同一 bot account 的 token 可被多个客户端并发使用（每条消息有独立 client_id） |

### 5.6 双向交互设计（WeChat 作为远程操作入口）

除了推送日报，WeChat 还将作为 Aide 的远程交互通道——用户在手机上直接回复消息即可驱动 Agent 执行任务，结果同步回 WeChat 和桌面 App。

#### 5.6.1 扩展模块设计

```
src/main/wechat/
├── index.ts          # 模块入口：init / send / getStatus / startMonitor
├── api.ts            # iLink HTTP client
├── auth.ts           # QR 登录 + token 管理
├── send.ts           # sendTextMessage + splitText
├── types.ts          # iLink 协议类型
├── monitor.ts        # 长轮询收消息 (getupdates)
└── router.ts         # 消息路由：解析意图 → 分发到 Agent/确认/快捷命令
```

#### 5.6.2 用户交互流程示例

**任务通知推送到微信：**
```
📌 新任务 [P0]
Alice 在 PR #142 要求你 review auth 模块重构

💬 回复指令即可处理，例如：
• "看一下具体改了什么"
• "帮我写 approve review"
• "先标记已读，稍后处理"

🔗 task:abc123
```

**用户在微信直接回复：**
```
看看改了哪些文件，给我一个 summary
```

**Aide Agent 处理后回复到微信：**
```
📋 PR #142 变更摘要

改动 5 个文件，+182 / -47 行：
• src/auth/oauth.ts — 重写 token 刷新逻辑
• src/auth/middleware.ts — 新增 session 校验
• src/auth/types.ts — 新增 RefreshConfig 类型
• tests/auth.test.ts — 覆盖新路径
• README.md — 更新认证文档

核心变化：从单次 token 换为 sliding window refresh，支持 multi-tenant。

💬 需要我帮你写 review 吗？
```

**用户继续对话：**
```
approve，评论"LGTM, sliding window approach looks good"
```

**写操作确认（文本形式）：**
```
⚠️ 确认操作

将执行：提交 PR Review (approve)
目标：PR #142
评论："LGTM, sliding window approach looks good"

回复 "确认" 执行，"取消" 放弃
```

**用户确认后：**
```
✅ 已提交 Review (approve) 到 PR #142
任务已标记为完成。
```

#### 5.6.3 双向架构

```
┌─────────────────────────────────────────────────────┐
│  Aide Main Process                                   │
│                                                      │
│  src/main/wechat/                                    │
│  ┌────────────┐    ┌──────────────────────┐         │
│  │  monitor   │───→│  router.ts           │         │
│  │  (poll)    │    │  - parse task ref     │         │
│  └────────────┘    │  - detect quick cmd   │         │
│                    │  - detect confirm      │         │
│                    └───────────┬────────────┘         │
│                                │                     │
│              ┌─────────────────┼──────────────┐      │
│              ▼                 ▼               ▼      │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────┐ │
│  │ Agent session │  │ Confirmation     │  │ Quick │ │
│  │ (task context)│  │ (confirm/cancel) │  │ Cmds  │ │
│  │ sendMessage() │  │                  │  │       │ │
│  └───────┬───────┘  └────────┬─────────┘  └───┬───┘ │
│          │                   │                 │     │
│          ▼                   ▼                 ▼     │
│  ┌────────────────────────────────────────────────┐  │
│  │  send.ts → sendTextMessage (reply to WeChat)   │  │
│  └────────────────────────────────────────────────┘  │
│          │                                           │
│          ├──→ chat_messages DB (同步到桌面 UI)       │
│          │                                           │
└──────────┼───────────────────────────────────────────┘
           │ HTTPS
           ▼
┌──────────────────────┐
│  WeChat iLink API    │
└──────────────────────┘
```

#### 5.6.4 消息路由逻辑

```typescript
// router.ts — 收到微信消息后的处理逻辑
function routeIncomingMessage(text: string, userId: string, contextToken: string): void {
  
  // 1. 正在等待确认？→ 处理确认/取消
  if (pendingWeChatConfirmations.has(userId)) {
    if (text.trim() === '确认') {
      resolveConfirmation(userId, true)
    } else if (text.trim() === '取消') {
      resolveConfirmation(userId, false)
    } else {
      sendReply(userId, contextToken, '⚠️ 当前有待确认操作，请回复"确认"或"取消"')
    }
    return
  }

  // 2. 快捷命令？
  const quickCmd = matchQuickCommand(text)
  if (quickCmd) {
    handleQuickCommand(quickCmd, userId, contextToken)
    return
  }

  // 3. 路由到 Agent session（关联最近推送的 Task 或 general）
  const taskId = resolveTaskContext(userId, text)
  
  // 调用 Aide 现有的 sendMessage()，复用完整 Agent 能力
  sendAgentMessage(text, taskId, (fullReply) => {
    sendReply(userId, contextToken, fullReply)
  })
}
```

#### 5.6.5 快捷命令

| 命令 | 别名 | 功能 |
|------|------|------|
| `/任务` | `任务列表`, `tasks` | 列出活跃任务（P0/P1 优先） |
| `/日报` | `日报`, `report` | 生成并返回今日日报 |
| `/完成` | `标记完成`, `done` | 标记当前任务为完成 |
| `/切换 <关键词>` | — | 切换到匹配的任务上下文 |
| `/帮助` | `help`, `?` | 显示可用命令列表 |

快捷命令支持两种风格：
- **斜杠命令** (`/任务`) — 精确匹配命令 token
- **自然语言** (`任务列表`) — 全文匹配（适合微信语音输入转文字场景）

#### 5.6.6 Task 上下文路由

用户在微信的对话隐式关联到某个 Task：

```
路由优先级：
1. 消息中显式提到 task ID（"task:abc123"）
2. 用户最近收到的任务推送通知所关联的 task
3. 用户上一次交互的 task（session 粘性）
4. 以上都没有 → general session
```

实现方式：维护 `Map<userId, { lastTaskId, lastInteractAt }>` 在内存中，推送通知时更新 lastTaskId。

#### 5.6.7 确认流程（写操作安全）

微信没有 UI 按钮，确认流程用文本实现：

```typescript
// Agent 的 onPreToolUse 检测到需确认的工具
// → 不弹桌面 UI，而是发微信确认消息 + 挂起等待

async function requestWeChatConfirmation(
  userId: string, 
  contextToken: string,
  toolName: string, 
  toolArgs: Record<string, unknown>
): Promise<boolean> {
  const description = formatConfirmationMessage(toolName, toolArgs)
  await sendReply(userId, contextToken, description)
  
  // 挂起，等用户回复"确认"或"取消"（timeout 5分钟）
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingWeChatConfirmations.delete(userId)
      sendReply(userId, contextToken, '⏰ 操作已超时取消')
      resolve(false)
    }, 5 * 60 * 1000)
    
    pendingWeChatConfirmations.set(userId, { resolve, timer })
  })
}
```

#### 5.6.8 桌面 & 微信会话同步

所有通过微信的对话都写入同一个 `chat_messages` SQLite 表：

| 字段 | 说明 |
|------|------|
| `source` | `'desktop'` \| `'wechat'` — 区分消息来源 |
| `task_id` | 关联的任务 |
| `role` | `'user'` \| `'agent'` |

效果：
- 用户在微信回复了 task 相关消息 → 桌面 ChatPanel 实时看到对话更新
- 用户切回桌面继续同一 Task 的对话 → 上下文完整保留
- Agent session 共享（同一 `task-{id}-1` sessionId） → 无论从哪个端发起，LLM 看到的对话历史一致

#### 5.6.9 Monitor 生命周期

| 状态 | 行为 |
|------|------|
| App 启动 + WeChat 已连接 | 自动启动 monitor 长轮询 |
| Token 过期 (errcode -14) | 停止 monitor，通知用户重新扫码 |
| App 最小化/后台 | Monitor 继续运行（Electron main process 不受窗口影响） |
| App 退出 | 停止 monitor |
| 网络中断 | 3 次重试 → 30s backoff → 自动恢复 |
| 多次连续失败 | 降级为不轮询，仅保留发送能力 |

### 5.7 消息格式规范

微信不支持 Markdown，所有推送使用纯文本 + emoji 格式化：

**日报：**
```
📋 2026-05-31 日报

✅ 完成 4 项
• 回复 Alice 关于 API 设计的邮件
• Review PR #128 代码变更
• 更新项目周报数据
• 修复登录页 CSS 样式问题

🚫 忽略 2 项
• 市场部问卷填写
• 团建投票

━━━━━━━━━━━━
🕕 生成于 18:00 | Aide
```

**任务通知：**
```
📌 新任务 [P0]
<title>

来源：<source description>
💬 直接回复即可处理

🔗 task:<id>
```

**Agent 回复：**
```
<内容，纯文本>

💬 继续对话或回复新指令
```

**确认卡片：**
```
⚠️ 确认操作

将执行：<操作描述>
目标：<target>
内容：<preview>

回复"确认"执行，"取消"放弃
```

### 5.8 工作量估算

| 任务 | 复杂度 | Phase |
|------|--------|-------|
| 实现 iLink 通信层 (api/auth/send/types) | 低 | 1 |
| Electron QR 登录窗口 | 中 | 1 |
| IPC handlers + Settings UI | 中 | 1 |
| Dashboard "推送到微信"按钮 | 低 | 2 |
| Job 完成后自动推送 | 低 | 2 |
| 实现 monitor.ts 长轮询 | 低 | 3 |
| 消息路由 router.ts | 中 | 3 |
| 快捷命令系统 | 低 | 3 |
| Agent session 对接（复用现有 sendMessage） | 中 | 3 |
| 文本确认流程 | 中 | 3 |
| 桌面/微信消息同步 (chat_messages source 字段) | 中 | 3 |
| 新任务推送通知 | 低 | 3 |
| 测试 + token 刷新逻辑 | 中 | 1-3 |

---

## 6. 风险与注意事项

1. **iLink API 稳定性**: 此 API 尚未正式公开文档化，微信可能调整策略
2. **Token 过期**: 无官方文档说明有效期，需要 graceful fallback
3. **用户需先发消息**: 必须让用户先在微信中给 bot 发一条消息以建立 context_token
4. **并发安全**: 同一 bot token 可被多个客户端并发 sendmessage（每条消息有独立 client_id）
5. **隐私**: 日报内容/任务详情通过微信服务器传输，需告知用户
6. **Rate limit**: 未知，但日常交互频率不太可能触发
7. **长轮询资源**: Monitor 持续一个 HTTP 连接，每 35s 一个请求，资源开销极低
8. **Session 冲突**: 微信和桌面同时对同一 Task 发消息时，Agent session 需要串行处理（现有 `sendMessage` 已有 activeSession 互斥）
9. **离线场景**: App 关闭时无法收微信消息，重启后不补处理（与 Job 设计一致）

---

## 7. 推荐行动

### Phase 1 — 基础通信层（发送能力）
- 实现 iLink 通信层 `src/main/wechat/`
- Electron QR 登录窗口
- Settings 中 WeChat 连接配置 UI
- 实现 `sendTextMessage` + token 管理

### Phase 2 — 推送能力
- Dashboard 日报卡片加"推送到微信"按钮
- daily-reconcile / morning-briefing Job 完成后自动推送
- 新任务创建时推送通知到微信

### Phase 3 — 双向交互
- 启动 monitor 长轮询
- 实现消息路由 (router.ts)
- 快捷命令支持
- 微信消息 → Agent sendMessage() 对接
- 文本确认流程（写操作安全）
- chat_messages 增加 source 字段，桌面/微信同步

### Phase 4 — 增强（可选）
- 语音消息识别（iLink 返回 voice_item.text 已有转写）
- 图片/文件接收并传给 Agent
- 定时推送配置（用户自定义 cron）
- 富文本日报（通过文件消息发 HTML/PDF）

---

## 附录 A. OpenClaw-Weixin 源码调研

> 来源: [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin) (v2.4.3, 546⭐, MIT)

### A.1 项目概述

- **定位**: OpenClaw 平台的微信频道插件（channel plugin）
- **安装**: `openclaw plugins install "@tencent-weixin/openclaw-weixin"`
- **登录**: `openclaw channels login --channel openclaw-weixin`
- **运行时**: Node.js，TypeScript 源码
- **多账号**: 支持多个微信账号，每个 account 有独立 contextToken 隔离
- **bot_agent**: 自定义 UA 风格字符串，语法 `product/version (comment)`

### A.2 核心源码文件

| 文件 | 职责 |
|------|------|
| `src/api/api.ts` (529行) | HTTP 客户端：`apiGetFetch`, `apiPostFetch`, `getUpdates`, `sendMessage`, `getUploadUrl`, `getConfig`, `sendTyping`, `notifyStart`, `notifyStop` |
| `src/api/types.ts` | 协议类型定义：BaseInfo, WeixinMessage, MessageItemType, GetUpdatesReq/Resp 等 |
| `src/auth/accounts.ts` | 账号管理：token 持久化、多账号索引、登录状态解析 |
| `src/auth/pairing.ts` | allowFrom 授权用户管理 |
| `src/storage/state-dir.ts` | 状态目录解析 |
| `src/util/logger.ts` | 日志 |
| `src/util/redact.ts` | 脱敏（URL/body 中的 token） |

### A.3 API 端点（从源码确认）

| 端点 | 方法 | 用途 |
|------|------|------|
| `ilink/bot/getupdates` | POST | 长轮询收消息 |
| `ilink/bot/sendmessage` | POST | 发消息 |
| `ilink/bot/getuploadurl` | POST | 获取 CDN 上传预签名 URL |
| `ilink/bot/getconfig` | GET | 获取 bot 配置 |
| `ilink/bot/sendtyping` | POST | 发送"正在输入"状态 |
| `ilink/bot/msg/notifystart` | POST | 通知后端 channel 启动 |
| `ilink/bot/msg/notifystop` | POST | 通知后端 channel 停止 |
| `ilink/bot/get_bot_qrcode` | GET | 获取登录二维码 |
| `ilink/bot/get_qrcode_status` | GET | 轮询扫码状态 |

### A.4 请求 Headers

```
Content-Type: application/json
AuthorizationType: ilink_bot_token
Authorization: Bearer <bot_token>
X-WECHAT-UIN: <random_uint32_base64>
iLink-App-Id: <package.json ilink_appid>
iLink-App-ClientVersion: <version_as_uint32>
```

### A.5 getUpdates 请求体

```json
{
  "get_updates_buf": "<cursor_string>",
  "base_info": {
    "channel_version": "2.4.3",
    "bot_agent": "OpenClaw"
  }
}
```

### A.6 sendMessage 请求体

```json
{
  "to_user_id": "<target_user>",
  "content": [
    { "type": 1, "text_item": { "content": "消息内容" } }
  ],
  "context_token": "<from_getupdates_msg>",
  "base_info": { "channel_version": "2.4.3", "bot_agent": "OpenClaw" },
  "client_id": "<uuid>"
}
```

### A.7 关键发现

1. **Base URL 确认**: `https://ilinkai.weixin.qq.com`（源码 `accounts.ts` 中 `DEFAULT_BASE_URL`）
2. **CDN URL**: `https://novac2c.cdn.weixin.qq.com/c2c`（`CDN_BASE_URL` 常量）
3. **QR 登录返回 baseUrl**: 登录成功后服务端可能返回不同的 baseUrl，应优先使用返回值
4. **AbortSignal 支持**: getUpdates 支持外部 AbortSignal 以快速中断长轮询
5. **notifyStart/notifyStop**: 连接启动/断开时应通知后端（我们的实现中缺少这两个 API）
6. **iLink-App-Id**: 需要在 package.json 中设置 `ilink_appid` 字段
7. **bot_agent 校验**: 有严格的格式校验（`product/version (comment)`），不合法会降级为 `"OpenClaw"`
8. **多账号同 userId 去重**: QR 登录后自动清除同一 userId 的旧 account（防重复绑定）
