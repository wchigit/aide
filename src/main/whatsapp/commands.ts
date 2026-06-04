/**
 * WhatsApp command dispatch — routes inbound WhatsApp messages to quick commands
 * or the AI agent.
 */

import { sendMessage } from '../agent'
import { listTasks, updateTask } from '../tasks'
import { pushToWhatsApp, setTargetJid } from './index'

const QUICK_COMMANDS: Record<string, () => Promise<string>> = {
  '/tasks': handleListTasks,
  '/report': handleDailyReport,
  '/done': handleCompleteCurrent,
  '/help': handleHelp
}

/**
 * Main entry point: called for each incoming WhatsApp message.
 */
export async function dispatch(msg: { from: string; text: string; pushName?: string }): Promise<void> {
  const { from, text } = msg
  const trimmed = text.trim()

  // Auto-set target to whoever messaged us (for reply routing)
  setTargetJid(from)

  // 1. Check quick commands
  const cmdKey = Object.keys(QUICK_COMMANDS).find(k => trimmed.startsWith(k))
  if (cmdKey) {
    const handler = QUICK_COMMANDS[cmdKey]
    const reply = await handler()
    await pushToWhatsApp(reply)
    return
  }

  // 2. Route to agent
  await dispatchToAgent(trimmed)
}

async function dispatchToAgent(text: string): Promise<void> {
  let fullResponse = ''
  const onStream = (delta: string) => { fullResponse += delta }

  try {
    const result = await sendMessage(text, null, onStream)
    fullResponse = result.content || fullResponse

    if (fullResponse) {
      await pushToWhatsApp(fullResponse)
    }
  } catch (err) {
    console.error('[WhatsApp] Agent dispatch error:', err)
    await pushToWhatsApp('Something went wrong, please try again later.')
  }
}

// ─── Quick Command Handlers ─────────────────────────────────────────

async function handleListTasks(): Promise<string> {
  const tasks = await listTasks({ status: ['pending', 'in_progress'] })
  if (tasks.length === 0) return 'No pending tasks ✓'

  const lines = tasks.slice(0, 10).map((t, i) => {
    const status = t.status === 'in_progress' ? '🔄' : '⏳'
    return `${i + 1}. ${status} ${t.title}`
  })

  return `Pending tasks (${tasks.length}):\n\n${lines.join('\n')}`
}

async function handleDailyReport(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const tasks = await listTasks({})
  const completed = tasks.filter(t => t.completedAt?.startsWith(today))
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const pending = tasks.filter(t => t.status === 'pending')

  return [
    `📊 Daily Report ${today}`,
    '',
    `✅ Completed: ${completed.length}`,
    ...completed.slice(0, 5).map(t => `  · ${t.title}`),
    '',
    `🔄 In progress: ${inProgress.length}`,
    ...inProgress.slice(0, 5).map(t => `  · ${t.title}`),
    '',
    `⏳ Pending: ${pending.length}`
  ].join('\n')
}

async function handleCompleteCurrent(): Promise<string> {
  const tasks = await listTasks({ status: ['in_progress'] })
  if (tasks.length === 0) return 'No tasks in progress'
  if (tasks.length === 1) {
    await updateTask(tasks[0].id, { status: 'completed' })
    return `Completed: ${tasks[0].title} ✓`
  }
  const lines = tasks.map((t, i) => `${i + 1}. ${t.title}`)
  return `Multiple tasks in progress:\n${lines.join('\n')}\n\nReply with a number to choose.`
}

async function handleHelp(): Promise<string> {
  return [
    '🤖 Aide WhatsApp',
    '',
    '/tasks - View pending tasks',
    '/report - Today\'s summary',
    '/done - Complete current task',
    '/help - This message',
    '',
    'Or just send any message to chat with AI.'
  ].join('\n')
}
