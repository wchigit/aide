/**
 * Telegram command dispatch — routes inbound messages to quick commands or the AI agent.
 * English-first commands for international users.
 */

import { sendMessage } from '../agent'
import { listTasks, updateTask } from '../tasks'
import { pushToTelegram } from './index'

const userContext: Map<string, { lastTaskId: string | null; lastInteractAt: number }> = new Map()

const QUICK_COMMANDS: Record<string, () => Promise<string>> = {
  '/tasks': handleListTasks,
  '/report': handleDailyReport,
  '/done': handleCompleteCurrent,
  '/help': handleHelp,
  '/start': handleHelp
}

/**
 * Main dispatch: called for each inbound Telegram message.
 */
export async function dispatch(text: string, senderId: string): Promise<void> {
  const trimmed = text.trim()

  // 1. Check quick commands
  const cmdKey = Object.keys(QUICK_COMMANDS).find(k => trimmed.toLowerCase().startsWith(k))
  if (cmdKey) {
    const handler = QUICK_COMMANDS[cmdKey]
    const reply = await handler()
    await pushToTelegram(reply)
    return
  }

  // 2. Route to agent
  await pushToTelegram('Got it, working on it...')
  await dispatchToAgent(trimmed, senderId)
}

async function dispatchToAgent(text: string, userId: string): Promise<void> {
  const ctx = userContext.get(userId)
  const taskId = ctx?.lastTaskId || null

  let fullResponse = ''
  const onStream = (delta: string) => { fullResponse += delta }

  try {
    const result = await sendMessage(text, taskId, onStream)
    fullResponse = result.content || fullResponse

    userContext.set(userId, { lastTaskId: taskId, lastInteractAt: Date.now() })

    if (fullResponse) {
      await pushToTelegram(fullResponse)
    }
  } catch (err) {
    console.error('[Telegram] Agent dispatch error:', err)
    await pushToTelegram('Something went wrong. Please try again later.')
  }
}

// ─── Quick Command Handlers ─────────────────────────────────────────

async function handleListTasks(): Promise<string> {
  const tasks = await listTasks({ status: ['pending', 'in_progress'] })
  if (tasks.length === 0) return 'No pending tasks ✓'

  const lines = tasks.slice(0, 10).map((t, i) => {
    const icon = t.status === 'in_progress' ? '🔄' : '⏳'
    return `${i + 1}. ${icon} ${t.title}`
  })

  return `Tasks (${tasks.length}):\n\n${lines.join('\n')}`
}

async function handleDailyReport(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const tasks = await listTasks({})
  const completed = tasks.filter(t => t.completedAt?.startsWith(today))
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const pending = tasks.filter(t => t.status === 'pending')

  const lines = [
    `📊 Daily Report ${today}`,
    '',
    `✅ Completed: ${completed.length}`,
    ...completed.slice(0, 5).map(t => `  · ${t.title}`),
    '',
    `🔄 In Progress: ${inProgress.length}`,
    ...inProgress.slice(0, 5).map(t => `  · ${t.title}`),
    '',
    `⏳ Pending: ${pending.length}`
  ]

  return lines.join('\n')
}

async function handleCompleteCurrent(): Promise<string> {
  const tasks = await listTasks({ status: ['in_progress'] })
  if (tasks.length === 0) return 'No tasks in progress'
  if (tasks.length === 1) {
    await updateTask(tasks[0].id, { status: 'completed' })
    return `Completed: ${tasks[0].title} ✓`
  }
  const lines = tasks.map((t, i) => `${i + 1}. ${t.title}`)
  return `${tasks.length} tasks in progress. Specify which one:\n${lines.join('\n')}\n\nReply with a number`
}

async function handleHelp(): Promise<string> {
  return [
    '🤖 Aide Telegram Assistant',
    '',
    'Commands:',
    '  /tasks — View pending tasks',
    '  /report — Today\'s work summary',
    '  /done — Mark current task complete',
    '  /help — Show this help',
    '',
    'Or just type freely — I\'ll route it to the AI agent.'
  ].join('\n')
}
