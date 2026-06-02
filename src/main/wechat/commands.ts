/**
 * Aide command dispatch — routes inbound WeChat messages to quick commands,
 * pending confirmations, or the AI agent.
 */

import { sendMessage } from '../agent'
import { listTasks, updateTask } from '../tasks'
import { sendTextMessage } from './messaging'
import { MessageItemType } from './client'
import type { WeChatTokenData, WeChatState, WeixinMessage } from './client'

const userContext: Map<string, { lastTaskId: string | null; lastInteractAt: number }> = new Map()

const pendingConfirmations: Map<string, {
  resolve: (decision: 'confirm' | 'cancel') => void
  timer: ReturnType<typeof setTimeout>
}> = new Map()

const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000

const QUICK_COMMANDS: Record<string, (ctx: CommandContext) => Promise<string>> = {
  '/任务': handleListTasks,
  '/日报': handleDailyReport,
  '/完成': handleCompleteCurrent,
  '/帮助': handleHelp
}

interface CommandContext {
  tokenData: WeChatTokenData
  state: WeChatState
}

let commandContext: CommandContext | null = null

export function setCommandContext(ctx: CommandContext): void {
  commandContext = ctx
}

export function getCommandContext(): CommandContext | null {
  return commandContext
}

/**
 * Main entry point: called by monitor for each incoming message.
 */
export async function dispatch(msg: WeixinMessage): Promise<void> {
  if (!commandContext) return

  const text = extractText(msg)
  if (!text) return

  const userId = msg.from_user_id || ''
  const trimmed = text.trim()

  // Capture context_token from incoming message (required for replies)
  if (msg.context_token) {
    commandContext.state.contextToken = msg.context_token
  }

  // 1. Check confirmation replies
  if (trimmed === '确认' || trimmed === '取消') {
    const pending = findPendingConfirmation(userId)
    if (pending) {
      pending.resolve(trimmed === '确认' ? 'confirm' : 'cancel')
      return
    }
  }

  // 2. Check quick commands
  const cmdKey = Object.keys(QUICK_COMMANDS).find(k => trimmed.startsWith(k))
  if (cmdKey) {
    const handler = QUICK_COMMANDS[cmdKey]
    const reply = await handler(commandContext)
    await sendTextMessage({
      tokenData: commandContext.tokenData,
      state: commandContext.state,
      text: reply
    })
    return
  }

  // 3. Route to agent
  await sendTextMessage({
    tokenData: commandContext.tokenData,
    state: commandContext.state,
    text: '收到，正在处理中…'
  })
  await dispatchToAgent(trimmed, userId)
}

/**
 * Register a pending confirmation. Returns a promise that resolves with the user's decision.
 */
export function waitForConfirmation(userId: string, _description: string): Promise<'confirm' | 'cancel'> {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pendingConfirmations.delete(userId)
      resolve('cancel')
    }, CONFIRMATION_TIMEOUT_MS)

    pendingConfirmations.set(userId, { resolve, timer })
  })
}

function findPendingConfirmation(userId: string) {
  const pending = pendingConfirmations.get(userId)
  if (!pending) return null
  clearTimeout(pending.timer)
  pendingConfirmations.delete(userId)
  return pending
}

async function dispatchToAgent(text: string, userId: string): Promise<void> {
  if (!commandContext) return

  const ctx = userContext.get(userId)
  const taskId = ctx?.lastTaskId || null

  let fullResponse = ''
  const onStream = (delta: string) => { fullResponse += delta }

  try {
    const result = await sendMessage(text, taskId, onStream)
    fullResponse = result.content || fullResponse

    userContext.set(userId, { lastTaskId: taskId, lastInteractAt: Date.now() })

    if (fullResponse) {
      await sendTextMessage({
        tokenData: commandContext.tokenData,
        state: commandContext.state,
        text: fullResponse
      })
    }
  } catch (err) {
    console.error('[WeChat] Agent dispatch error:', err)
    await sendTextMessage({
      tokenData: commandContext.tokenData,
      state: commandContext.state,
      text: '处理出错，请稍后重试。'
    })
  }
}

// ─── Quick Command Handlers ─────────────────────────────────────────

async function handleListTasks(_ctx: CommandContext): Promise<string> {
  const tasks = await listTasks({ status: ['pending', 'in_progress'] })
  if (tasks.length === 0) return '当前没有待办任务 ✓'

  const lines = tasks.slice(0, 10).map((t, i) => {
    const status = t.status === 'in_progress' ? '🔄' : '⏳'
    return `${i + 1}. ${status} ${t.title}`
  })

  return `待办任务 (${tasks.length}):\n\n${lines.join('\n')}`
}

async function handleDailyReport(_ctx: CommandContext): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const tasks = await listTasks({})
  const completed = tasks.filter(t => t.completedAt?.startsWith(today))
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const pending = tasks.filter(t => t.status === 'pending')

  const lines = [
    `📊 日报 ${today}`,
    '',
    `✅ 已完成: ${completed.length}`,
    ...completed.slice(0, 5).map(t => `  · ${t.title}`),
    '',
    `🔄 进行中: ${inProgress.length}`,
    ...inProgress.slice(0, 5).map(t => `  · ${t.title}`),
    '',
    `⏳ 待处理: ${pending.length}`
  ]

  return lines.join('\n')
}

async function handleCompleteCurrent(_ctx: CommandContext): Promise<string> {
  const tasks = await listTasks({ status: ['in_progress'] })
  if (tasks.length === 0) return '没有进行中的任务'
  if (tasks.length === 1) {
    await updateTask(tasks[0].id, { status: 'completed' })
    return `已完成: ${tasks[0].title} ✓`
  }
  const lines = tasks.map((t, i) => `${i + 1}. ${t.title}`)
  return `有 ${tasks.length} 个进行中的任务，请指定:\n${lines.join('\n')}\n\n回复数字选择`
}

async function handleHelp(_ctx: CommandContext): Promise<string> {
  return [
    '🤖 Aide 微信助手',
    '',
    '快捷命令:',
    '  /任务 - 查看待办任务列表',
    '  /日报 - 查看今日工作总结',
    '  /完成 - 标记当前任务完成',
    '  /帮助 - 显示本帮助',
    '',
    '直接发消息即可与 AI 助手对话。',
    '需要确认操作时回复"确认"或"取消"。'
  ].join('\n')
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractText(msg: WeixinMessage): string | null {
  const items = msg.item_list || msg.content
  if (!items || items.length === 0) return null
  const textItem = items.find(i => i.type === MessageItemType.TEXT)
  return textItem?.text_item?.content || textItem?.text_item?.text || null
}
