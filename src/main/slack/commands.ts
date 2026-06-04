/**
 * Slack command dispatch — routes inbound DMs to quick commands or the AI agent.
 */

import { sendMessage } from '../agent'
import { listTasks, updateTask } from '../tasks'
import { pushToSlack } from './index'

const userContext: Map<string, { lastTaskId: string | null; lastInteractAt: number }> = new Map()

const QUICK_COMMANDS: Record<string, () => Promise<string>> = {
  '/tasks': handleListTasks,
  '/report': handleDailyReport,
  '/done': handleCompleteCurrent,
  '/setup': handleSetup,
  '/help': handleHelp
}

/**
 * Main dispatch: called for each inbound Slack DM.
 */
export async function dispatch(text: string, senderId: string): Promise<void> {
  const trimmed = text.trim()

  // 1. Check quick commands
  const cmdKey = Object.keys(QUICK_COMMANDS).find(k => trimmed.toLowerCase().startsWith(k))
  if (cmdKey) {
    const handler = QUICK_COMMANDS[cmdKey]
    const reply = await handler()
    await pushToSlack(reply)
    return
  }

  // 2. Route to agent
  await pushToSlack('Got it, working on it...')
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
      await pushToSlack(fullResponse)
    }
  } catch (err) {
    console.error('[Slack] Agent dispatch error:', err)
    await pushToSlack('Something went wrong. Please try again later.')
  }
}

// ─── Quick Command Handlers ─────────────────────────────────────────

async function handleListTasks(): Promise<string> {
  const tasks = await listTasks({ status: ['pending', 'in_progress'] })
  if (tasks.length === 0) return 'No pending tasks :white_check_mark:'

  const lines = tasks.slice(0, 10).map((t, i) => {
    const icon = t.status === 'in_progress' ? ':arrows_counterclockwise:' : ':hourglass_flowing_sand:'
    return `${i + 1}. ${icon} ${t.title}`
  })

  return `*Tasks (${tasks.length}):*\n\n${lines.join('\n')}`
}

async function handleDailyReport(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const tasks = await listTasks({})
  const completed = tasks.filter(t => t.completedAt?.startsWith(today))
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const pending = tasks.filter(t => t.status === 'pending')

  const lines = [
    `:bar_chart: *Daily Report ${today}*`,
    '',
    `:white_check_mark: *Completed: ${completed.length}*`,
    ...completed.slice(0, 5).map(t => `  • ${t.title}`),
    '',
    `:arrows_counterclockwise: *In Progress: ${inProgress.length}*`,
    ...inProgress.slice(0, 5).map(t => `  • ${t.title}`),
    '',
    `:hourglass_flowing_sand: *Pending: ${pending.length}*`
  ]

  return lines.join('\n')
}

async function handleCompleteCurrent(): Promise<string> {
  const tasks = await listTasks({ status: ['in_progress'] })
  if (tasks.length === 0) return 'No tasks in progress'
  if (tasks.length === 1) {
    await updateTask(tasks[0].id, { status: 'completed' })
    return `Completed: ${tasks[0].title} :white_check_mark:`
  }
  const lines = tasks.map((t, i) => `${i + 1}. ${t.title}`)
  return `${tasks.length} tasks in progress. Specify which one:\n${lines.join('\n')}\n\nReply with a number`
}

async function handleHelp(): Promise<string> {
  return [
    ':robot_face: *Aide Slack Assistant*',
    '',
    '*Commands:*',
    '  `/tasks` — View pending tasks',
    '  `/report` — Today\'s work summary',
    '  `/done` — Mark current task complete',
    '  `/setup` — Channel setup guide',
    '  `/help` — Show this help',
    '',
    'Or just type freely — I\'ll route it to the AI agent.'
  ].join('\n')
}

async function handleSetup(): Promise<string> {
  return [
    ':wrench: *Slack Channel Setup*',
    '',
    '*1. Create a Slack App*',
    '• Go to https://api.slack.com/apps → Create New App → From scratch',
    '• Name it (e.g. "Aide") and select your workspace',
    '',
    '*2. Configure Permissions*',
    '• OAuth & Permissions → Bot Token Scopes: `chat:write`, `channels:history`, `channels:read`',
    '• Socket Mode → enable → create App-Level Token with `connections:write` scope',
    '• Event Subscriptions → enable → subscribe to `message.channels`',
    '• Install the app to your workspace',
    '',
    '*3. Get Channel ID*',
    '• Right-click channel → View channel details → copy the Channel ID at the bottom',
    '',
    '*4. Configure in Aide*',
    '• Settings → Channels → Slack → paste Bot Token + App Token + Channel ID → Connect'
  ].join('\n')
}
