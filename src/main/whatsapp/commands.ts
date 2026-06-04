/**
 * WhatsApp command dispatch — routes inbound messages to quick commands or the AI agent.
 */

import { sendMessage } from '../agent'
import { listTasks, updateTask } from '../tasks'
import { pushToWhatsApp } from './index'

const userContext: Map<string, { lastTaskId: string | null; lastInteractAt: number }> = new Map()

const QUICK_COMMANDS: Record<string, () => Promise<string>> = {
  '/tasks': handleListTasks,
  '/report': handleDailyReport,
  '/done': handleCompleteCurrent,
  '/setup': handleSetup,
  '/help': handleHelp
}

/**
 * Main dispatch: called for each inbound WhatsApp message.
 */
export async function dispatch(text: string, senderId: string): Promise<void> {
  const trimmed = text.trim()

  // 1. Check quick commands
  const cmdKey = Object.keys(QUICK_COMMANDS).find(k => trimmed.toLowerCase().startsWith(k))
  if (cmdKey) {
    const handler = QUICK_COMMANDS[cmdKey]
    const reply = await handler()
    await pushToWhatsApp(reply, senderId)
    return
  }

  // 2. Route to agent
  await pushToWhatsApp('Got it, working on it...', senderId)
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
      await pushToWhatsApp(fullResponse, userId)
    }
  } catch (err: any) {
    await pushToWhatsApp(`Error: ${err.message}`, userId)
  }
}

// ─── Command Handlers ────────────────────────────────────────────────

async function handleListTasks(): Promise<string> {
  const tasks = await listTasks({ status: ['pending', 'in_progress'] })
  if (!tasks.length) return '✅ No active tasks!'

  const lines = tasks.map((t, i) => `${i + 1}. ${t.title} [${t.priority}]`)
  return `📋 *Active tasks (${tasks.length}):*\n\n${lines.join('\n')}`
}

async function handleDailyReport(): Promise<string> {
  const tasks = await listTasks({})
  const active = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length
  const completed = tasks.filter(t => t.status === 'completed').length

  return `📊 *Daily Report*\n\n• Active: ${active}\n• Completed: ${completed}\n• Total: ${tasks.length}`
}

async function handleCompleteCurrent(): Promise<string> {
  const tasks = await listTasks({ status: ['pending', 'in_progress'] })
  if (!tasks.length) return 'No active tasks to complete.'

  const task = tasks[0]
  await updateTask(task.id, { status: 'completed' })
  return `✅ Completed: *${task.title}*`
}

async function handleSetup(): Promise<string> {
  return `🔧 *WhatsApp Setup Guide*

1. Go to developers.facebook.com → Create App → Business type
2. Add WhatsApp product → API Setup
3. Copy your *Access Token* and *Phone Number ID*
4. In Aide Settings → WhatsApp → paste both values
5. Set the Webhook URL shown in Aide into Meta's Webhook config
6. Subscribe to "messages" webhook field

Your relay handles the rest!`
}

async function handleHelp(): Promise<string> {
  return `🤖 *Aide Commands*

/tasks — List active tasks
/report — Daily summary
/done — Complete first active task
/setup — Setup guide
/help — This message

Or just type naturally — I'll route it to the AI agent.`
}
