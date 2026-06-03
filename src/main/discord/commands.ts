/**
 * Discord command dispatch — routes inbound messages to quick commands or the AI agent.
 */

import { sendMessage } from '../agent'
import { listTasks, updateTask } from '../tasks'
import { pushToDiscord } from './index'

const userContext: Map<string, { lastTaskId: string | null; lastInteractAt: number }> = new Map()

const QUICK_COMMANDS: Record<string, () => Promise<string>> = {
  '/tasks': handleListTasks,
  '/report': handleDailyReport,
  '/done': handleCompleteCurrent,
  '/help': handleHelp
}

/**
 * Main dispatch: called for each inbound Discord message.
 */
export async function dispatch(text: string, senderId: string): Promise<void> {
  const trimmed = text.trim()

  // 1. Check quick commands
  const cmdKey = Object.keys(QUICK_COMMANDS).find(k => trimmed.toLowerCase().startsWith(k))
  if (cmdKey) {
    const handler = QUICK_COMMANDS[cmdKey]
    const reply = await handler()
    await pushToDiscord(reply)
    return
  }

  // 2. Route to agent
  await pushToDiscord('Got it, working on it...')
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
      await pushToDiscord(fullResponse)
    }
  } catch (err) {
    console.error('[Discord] Agent dispatch error:', err)
    await pushToDiscord('Something went wrong. Please try again later.')
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

  return [
    `📊 **Daily Report** — ${today}`,
    '',
    `✅ Completed today: ${completed.length}`,
    ...completed.slice(0, 5).map(t => `   • ${t.title}`),
    '',
    `🔄 In progress: ${inProgress.length}`,
    ...inProgress.slice(0, 5).map(t => `   • ${t.title}`),
    '',
    `⏳ Pending: ${pending.length}`
  ].join('\n')
}

async function handleCompleteCurrent(): Promise<string> {
  const tasks = await listTasks({ status: ['in_progress'] })
  if (tasks.length === 0) return 'No in-progress tasks to complete.'

  const task = tasks[0]
  await updateTask(task.id, { status: 'completed' })
  return `✅ Completed: ${task.title}`
}

async function handleHelp(): Promise<string> {
  return [
    '🤖 **Aide Discord Commands**',
    '',
    '`/tasks` — List active tasks',
    '`/report` — Today\'s progress report',
    '`/done` — Complete current task',
    '`/help` — Show this help',
    '',
    'Or just type naturally to chat with the AI agent.'
  ].join('\n')
}
