import { getL0Content, searchMemory, writeMemory } from '../memory'
import { createTask, updateTask, listTasks, getTask } from '../tasks'
import { getProject } from '../projects'
import { listRelations, getRelation } from '../relations'
import { getAutonomyLevel } from '../preferences'
import { getConnectionStatus } from '../connections'
import { showSystemNotification } from '../index'
import type { ChatMessage, Task, PendingAction } from '@shared/types'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db'
import { BrowserWindow } from 'electron'
import type { CopilotClient, CopilotSession } from '@github/copilot-sdk'
import type { SessionConfig, PermissionRequest, PermissionRequestResult } from '@github/copilot-sdk'
import { buildTools } from './tools'

// ============================================================
// Agent Engine — Adapter between Aide and Copilot SDK
// ============================================================
// The SDK is responsible for:
//   - Reasoning loop (receive → understand → plan → execute → respond)
//   - Tool orchestration (auto-select, invoke, process results, reason again)
//   - Session persistence & resume
//   - Multi-turn conversation & automatic context-window compaction (infinite sessions)
//   - Streaming output
//
// We are responsible for:
//   - Implementing Custom Tools (memory, tasks, reports)
//   - Lifecycle Hooks (inject Memory, extract facts)
//   - Permission handler (autonomy-level control)
//   - Dynamic System Prompt assembly
// ============================================================

let client: CopilotClient | null = null
let activeSession: CopilotSession | null = null

export function initAgent(sdkClient: CopilotClient): void {
  client = sdkClient
}

export function stopStream(): void {
  if (activeSession) {
    activeSession.abort()
    activeSession = null
  }
}

// === Reset Session (clear a corrupted conversation history) ===

export async function resetSession(taskId: string | null): Promise<void> {
  if (!client) return
  const sessionId = taskId ? getTaskSessionId(taskId) : 'general'
  try {
    await client.deleteSession(sessionId)
    console.log(`[Agent] session reset: ${sessionId}`)
  } catch (e) {
    console.log(`[Agent] session reset failed (may not exist): ${sessionId}`)
  }
}

// === Session ID Convention ===
// Task: "task-{taskId}-{attempt}"
// General: "general"
// Job: "job-{jobId}-{timestamp}"

function getTaskSessionId(taskId: string): string {
  return `task-${taskId}-1`
}

function extractTaskIdFromSession(sessionId: string): string | null {
  const match = sessionId.match(/^task-(.+)-\d+$/)
  return match ? match[1] : null
}

// === Lifecycle Hooks ===

const hooks: SessionConfig['hooks'] = {
  // Inject L0 Identity + dynamic context
  onSessionStart: async (_input: any, invocation: { sessionId: string }) => {
    const l0 = getL0Content()
    const taskId = extractTaskIdFromSession(invocation.sessionId)
    const parts: string[] = []

    if (l0) parts.push(`## Identity\n${l0}`)

    if (taskId) {
      const task = getTask(taskId)
      if (task) {
        parts.push(formatTaskContext(task))
        if (task.projectId) {
          const project = getProject(task.projectId)
          if (project) parts.push(formatProjectContext(project))
        }
        if (task.relatedRelationIds.length > 0) {
          const rels = task.relatedRelationIds.map(id => getRelation(id)).filter(Boolean)
          if (rels.length) parts.push(formatRelationsContext(rels as any[]))
        }
      }
    } else if (invocation.sessionId === 'general') {
      // General chat: inject workspace awareness (task summary + connection status)
      const conns = getConnectionStatus()
      const connSummary = conns.map(c =>
        `- ${c.type}: ${c.authenticated ? `✓ connected${c.activeAccount ? ` (${c.activeAccount})` : ''}` : '✗ not connected'}${c.lastError ? ` [error: ${c.lastError}]` : ''}`
      ).join('\n')
      parts.push(`## Connection status\n${connSummary}`)

      // Brief task overview
      const allTasks = listTasks({})
      const pendingCount = allTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length
      const p0Count = allTasks.filter(t => (t.status === 'pending' || t.status === 'in_progress') && t.priority === 'p0').length
      const unseenCount = allTasks.filter(t => (t.status === 'pending' || t.status === 'in_progress') && !t.seenAt).length
      if (pendingCount > 0) {
        parts.push(`## Tasks overview\nActive tasks: ${pendingCount}${p0Count > 0 ? ` (${p0Count} urgent)` : ''}${unseenCount > 0 ? `, ${unseenCount} unread` : ''}`)
      }
    }

    // Token budget: ~3K total. Fixed prompt ~1K, L0 ~0.5K, dynamic ~1K
    // Truncation priority: Task > Relation > Project > L1
    return { additionalContext: parts.join('\n\n') }
  },

  // Inject L1 Knowledge — FTS5 retrieval based on the user message
  // Also tracks interaction count for periodic memory flush (since infinite sessions never trigger onSessionEnd)
  onUserPromptSubmitted: async (input: any, invocation: { sessionId: string }) => {
    // Track interaction count and periodically flush a session context marker to L2
    const count = (sessionInteractionCount.get(invocation.sessionId) || 0) + 1
    sessionInteractionCount.set(invocation.sessionId, count)
    if (count % MEMORY_FLUSH_INTERVAL === 0) {
      const taskId = extractTaskIdFromSession(invocation.sessionId)
      writeMemory({
        content: `[Session Checkpoint] session=${invocation.sessionId}, ${count} interactions. Recent topic: ${input.prompt.slice(0, 200)}`,
        layer: 'L2',
        source: 'system',
        taskId: taskId || undefined
      })
    }

    const memories = searchMemory(input.prompt, 5)
    if (memories.length === 0) return {}
    const block = memories.map(m => `- [id: ${m.id}] ${m.content}`).join('\n')
    return { modifiedPrompt: `<memory-context>\nRelevant memories (use the id with memory_write update/remove if one is wrong):\n${block}\n</memory-context>\n\n${input.prompt}` }
  },

  // On session end: extract summary → L2, plus catch-up extraction
  onSessionEnd: async (input: any, invocation: { sessionId: string }) => {
    if (input.reason === 'complete' || input.reason === 'user_exit') {
      const taskId = extractTaskIdFromSession(invocation.sessionId)

      // Archive session summary to L2
      if (input.finalMessage) {
        writeMemory({
          content: `[Session Summary] ${input.finalMessage}`,
          layer: 'L2',
          source: 'system',
          taskId: taskId || undefined
        })
      }
    }
    return {}
  },

  // Before tool call — permission interception + push record to UI
  onPreToolUse: async (input: any, invocation: { sessionId: string }) => {
    const toolName: string = input.toolName || ''
    const toolCallId: string = input.toolCallId || `tc-${Date.now()}`
    const inputPreview = summarizeToolInput(toolName, input.toolArgs)
    console.log(`[Agent] tool_pre: ${toolName} | session: ${invocation.sessionId} | args: ${JSON.stringify(input.toolArgs || {}).slice(0, 200)}`)

    // Auto-promote task to in_progress on first tool call
    const taskId = extractTaskIdFromSession(invocation.sessionId)
    if (taskId && !activatedTaskSessions.has(invocation.sessionId)) {
      activatedTaskSessions.add(invocation.sessionId)
      const task = getTask(taskId)
      if (task && task.status === 'pending') {
        updateTask(taskId, { status: 'in_progress' })
        emitEvent({ type: 'task:updated', task: { ...task, status: 'in_progress' } })
      }
    }

    // Push a "running" record to the UI
    toolCallTimestamps.set(toolCallId, Date.now())
    emitEvent({
      type: 'chat:tool-use',
      taskId,
      record: { id: toolCallId, toolName, status: 'running', timestamp: new Date().toISOString(), inputPreview }
    })

    // Protected tools → show a confirmation card and wait for user approval
    if (CONFIRM_REQUIRED_TOOLS.has(toolName)) {
      const approved = await requestToolConfirmation(toolName, input.toolArgs)
      if (!approved) {
        emitEvent({
          type: 'chat:tool-use',
          taskId,
          record: { id: toolCallId, toolName, status: 'error', timestamp: new Date().toISOString(), inputPreview, resultPreview: 'Cancelled by user' }
        })
        toolCallTimestamps.delete(toolCallId)
        return { permissionDecision: 'deny' as const, permissionDecisionReason: 'User cancelled the operation' }
      }
    }
    // All other tools → allow
    return undefined
  },

  // After tool call — push completion record to UI
  onPostToolUse: async (input: any, invocation: { sessionId: string }) => {
    const toolName: string = input.toolName || ''
    const toolCallId: string = input.toolCallId || ''
    const taskId = extractTaskIdFromSession(invocation.sessionId)
    const inputPreview = summarizeToolInput(toolName, input.toolArgs)
    const startTime = toolCallTimestamps.get(toolCallId)
    const durationMs = startTime ? Date.now() - startTime : undefined
    toolCallTimestamps.delete(toolCallId)

    const resultStr = JSON.stringify(input.toolResult || '')
    const resultPreview = resultStr.length > 120 ? resultStr.slice(0, 120) + '…' : resultStr
    console.log(`[Agent] tool_post: ${toolName} | session: ${invocation.sessionId} | ${durationMs}ms | result_size: ${resultStr.length}`)

    emitEvent({
      type: 'chat:tool-use',
      taskId,
      record: { id: toolCallId, toolName, status: 'done', timestamp: new Date().toISOString(), durationMs, inputPreview, resultPreview }
    })
  }
}

// Tool call timing tracker
const toolCallTimestamps = new Map<string, number>()
// Track sessions where task has been auto-promoted to in_progress
const activatedTaskSessions = new Set<string>()
// Track interaction count per session for periodic memory flush
const sessionInteractionCount = new Map<string, number>()
const MEMORY_FLUSH_INTERVAL = 10 // Flush every N user messages

// === Permission Handler (category-level authorization) ===

// onPermissionRequest handles SDK category-level permissions (shell, mcp, write, read, etc.)
// Fine-grained per-tool control lives in onPreToolUse (see hooks above)

const pendingActions = new Map<string, { resolve: (v: boolean) => void; action: PendingAction; timer: ReturnType<typeof setTimeout> }>()

async function handlePermissionRequest(request: PermissionRequest, _invocation: { sessionId: string }): Promise<PermissionRequestResult> {
  const level = getAutonomyLevel()

  // confirm mode — prompt for confirmation on every category
  if (level === 'confirm') {
    const approved = await requestCategoryConfirmation(request)
    return approved ? { kind: 'approve-once' } : { kind: 'reject' }
  }

  // default / auto — auto-approve all categories (specific tools are intercepted by onPreToolUse)
  return { kind: 'approve-once' }
}

function requestCategoryConfirmation(request: PermissionRequest): Promise<boolean> {
  return new Promise((resolve) => {
    const actionId = uuid()
    const action: PendingAction = {
      id: actionId,
      type: request.kind,
      description: `Allow ${request.kind} operation`,
      details: request as unknown as Record<string, unknown>,
      status: 'pending'
    }

    const timer = setTimeout(() => {
      if (pendingActions.has(actionId)) {
        pendingActions.delete(actionId)
        action.status = 'cancelled'
        emitEvent({ type: 'chat:action-expired', actionId })
        resolve(false)
      }
    }, 5 * 60 * 1000)

    pendingActions.set(actionId, { resolve, action, timer })
    emitEvent({ type: 'chat:pending-action', action })
  })
}

// === Tool-level authorization (invoked by onPreToolUse) ===

// Tools that require mandatory confirmation (external write operations)
// Note: WorkIQ send-type tools are already filtered at the MCP layer and not registered with the LLM
const CONFIRM_REQUIRED_TOOLS = new Set([
  // GitHub — comment/review
  'create_issue_comment',
  'create_pull_request_review',
])

const TOOL_LABELS: Record<string, string> = {
  create_issue_comment: 'Comment on a GitHub issue',
  create_pull_request_review: 'Submit a PR review',
}

function requestToolConfirmation(toolName: string, toolArgs: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    const actionId = uuid()
    const action: PendingAction = {
      id: actionId,
      type: 'tool_call',
      toolName,
      description: TOOL_LABELS[toolName] || `Run ${toolName}`,
      details: toolArgs as Record<string, unknown> || {},
      status: 'pending'
    }

    const timer = setTimeout(() => {
      if (pendingActions.has(actionId)) {
        pendingActions.delete(actionId)
        action.status = 'cancelled'
        emitEvent({ type: 'chat:action-expired', actionId })
        resolve(false)
      }
    }, 5 * 60 * 1000)

    pendingActions.set(actionId, { resolve, action, timer })
    emitEvent({ type: 'chat:pending-action', action })
  })
}

export function resolveAction(actionId: string, decision: 'confirm' | 'modify' | 'cancel'): void {
  confirmAction(actionId, decision)
}

// === System Prompt ===

function buildSystemMessage(): string {
  const now = new Date()
  const locale = 'en-US'

  // Gather connected identities
  const conns = getConnectionStatus()
  const ghConn = conns.find(c => c.type === 'github')
  const identityLines: string[] = []
  if (ghConn?.activeAccount) identityLines.push(`- GitHub: ${ghConn.activeAccount}`)

  return `You are Aide, the user's personal work agent. You help the user manage work, track tasks, and process their information streams.

Current time: ${now.toLocaleDateString(locale)} ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}${identityLines.length ? `\nActing as:\n${identityLines.join('\n')}` : ''}

## Behavior
- Answer concisely and directly
- Read operations: just do them. Write operations (send email, comment on PR): call the tool directly — the system shows a confirmation card automatically
- Call memory_write when you learn a new fact worth remembering

## Task management

Use Aide's task tools (create_aide_task, update_aide_task, query_aide_tasks) for task management when needed by background jobs.

**Bar (high)**: only create a Task for things that clearly need the user to act personally.
- Create: the user is named/asked to do something, sent to them individually for action, they are the clear owner
- Don't create: pure notifications, the user is only CC'd or in a broadcast, already-done items, automated subscriptions

**Priority**:
- P0: an important person names the user + sent individually + urgent. All three together.
- P1: needs the user, has importance or a deadline, but not urgent.
- P2: involved but not the sole owner, or low priority.
- When unsure, choose P2.

**De-dup**: before creating, confirm no identical task already exists (the system injects the existing task list). Pass sourceId for exact de-dup.

## Contacts & projects

Be restrained. Quality over quantity.
- Contacts: only record people the user has direct, substantive dealings with. Don't record people in a group who never interacted with the user. Test: will this person still matter next week?
- Projects: must map to a real repo (has a GitHub URL or local path). Don't create abstract concepts.
- Don't record on first sight; create only after it proves important or recurring.

## Memory
- Record: user corrections, preferences, stable facts, relationships
- Don't record: transient state, info that expires quickly

## Context awareness
- In general chat, if something relates to an existing Task → suggest switching to it
- When entering a Task chat → briefly state the task's background, status, and suggested handling`
}

// === Model Selection (persisted to DB) ===

let selectedModel: string | null = null

export async function listModels(): Promise<{ id: string; name: string }[]> {
  if (!client) return [{ id: 'claude-opus-4.8', name: 'Claude Opus 4.8' }]
  try {
    const models = await client.listModels()
    return models.map(m => ({ id: m.id, name: m.name }))
  } catch {
    return [{ id: 'claude-opus-4.8', name: 'Claude Opus 4.8' }]
  }
}

export function getSelectedModel(): string {
  if (!selectedModel) {
    const db = getDb()
    const row = db.prepare("SELECT content FROM memory_entries WHERE id = '__selected_model'").get() as { content: string } | undefined
    selectedModel = row?.content || 'claude-opus-4.8'
  }
  return selectedModel
}

export function setSelectedModel(modelId: string): void {
  selectedModel = modelId
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO memory_entries (id, layer, content, source, status, created_at, updated_at, tags)
    VALUES ('__selected_model', 'L0', ?, 'system', 'active', ?, ?, '[]')
  `).run(modelId, now, now)
}

// === Core API: send message ===

async function getOrCreateSession(taskId: string | null): Promise<CopilotSession> {
  if (!client) throw new Error('Copilot SDK not initialized. Ensure SDK is configured.')

  const sessionId = taskId ? getTaskSessionId(taskId) : 'general'
  const config: SessionConfig = {
    sessionId,
    model: getSelectedModel(),
    streaming: true,
    tools: buildTools(),
    hooks,
    infiniteSessions: { enabled: true },
    systemMessage: { mode: 'append', content: buildSystemMessage() },
    onPermissionRequest: handlePermissionRequest
  }

  try {
    return await client.resumeSession(sessionId, config)
  } catch {
    return await client.createSession(config)
  }
}

export async function sendMessage(
  userMessage: string,
  taskId: string | null,
  onStream: (delta: string) => void,
  attachments?: { name: string; type: string; dataUrl: string }[]
): Promise<ChatMessage> {
  // Save the user message to the local DB (for UI display)
  const userMsg: ChatMessage = {
    id: uuid(),
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
    taskId
  }
  saveMessage(userMsg)

  const session = await getOrCreateSession(taskId)
  activeSession = session

  // Build the prompt (attachments are appended inline)
  let prompt = userMessage
  if (attachments && attachments.length > 0) {
    const attachmentDescriptions = attachments.map(a => {
      if (a.type.startsWith('image/')) {
        return `[Attachment: image "${a.name}" (${a.type}), data: ${a.dataUrl}]`
      }
      return `[Attachment: file "${a.name}" (${a.type})]`
    }).join('\n')
    prompt = `${userMessage}\n\n${attachmentDescriptions}`
  }

  // Subscribe to streaming events
  let fullResponse = ''
  const unsubscribe = session.on('assistant.message_delta', (event) => {
    const delta = event.data.deltaContent || ''
    onStream(delta)
    fullResponse += delta
  })

  try {
    const result = await session.sendAndWait({ prompt }, 180_000)
    if (result) {
      fullResponse = result.data.content || fullResponse
    }
  } finally {
    unsubscribe()
    activeSession = null
  }

  // Save the agent reply
  const agentMsg: ChatMessage = {
    id: uuid(),
    role: 'agent',
    content: fullResponse,
    timestamp: new Date().toISOString(),
    taskId
  }
  saveMessage(agentMsg)
  return agentMsg
}

// === Job execution (headless agent session) ===

// Job: category-level auto-approve. Tool-level blocking via onPreToolUse in job hooks.
function jobPermissionHandler(_request: PermissionRequest): PermissionRequestResult {
  return { kind: 'approve-once' }
}

// Job hooks: override onPreToolUse to hard-deny protected tools (no user to confirm)
const jobHooks = {
  ...hooks,
  onPreToolUse: async (input: any, invocation: { sessionId: string }) => {
    const toolName: string = input.toolName || ''
    console.log(`[Agent/Job] tool_pre: ${toolName} | session: ${invocation.sessionId}`)
    if (CONFIRM_REQUIRED_TOOLS.has(toolName)) {
      return { permissionDecision: 'deny' as const, permissionDecisionReason: 'Job mode does not allow send/write operations' }
    }
    return undefined
  },
  onSessionStart: async () => {
    const parts: string[] = []

    // Identity
    const l0 = getL0Content()
    if (l0) parts.push(`## Identity\n${l0}`)

    // Existing tasks (prevents duplicates — Agent sees what already exists)
    const existingTasks = listTasks({ status: ['pending', 'in_progress'] })
    if (existingTasks.length > 0) {
      const taskLines = existingTasks.slice(0, 30).map(t =>
        `- [${t.priority}] ${t.title}${t.source.externalId ? ` (src:${t.source.externalId})` : ''}`
      ).join('\n')
      parts.push(`## Existing tasks\n${taskLines}`)
    }

    parts.push(`[JOB MODE] Run automatically. You may create tasks and memories. External write operations (send email, comment, etc.) are not allowed.`)

    return { additionalContext: parts.join('\n\n') }
  }
}

import { setJobSession } from './state'

export async function executeJobSession(instruction: string, jobId: string, lastRunAt?: string | null): Promise<string> {
  if (!client) throw new Error('Copilot SDK not initialized')

  // Timeouts per job type (MCP calls like ask_work_iq take 60-90s each)
  const JOB_TIMEOUTS: Record<string, number> = {
    'periodic-poll': 300_000,      // 5 min — checks new items, creates tasks
    'morning-briefing': 480_000,   // 8 min — scans all sources, creates many tasks
    'eod-review': 300_000,         // 5 min — reviews today's tasks
    'world-sync': 600_000,         // 10 min — full relation/project sync
  }
  const timeoutMs = JOB_TIMEOUTS[jobId] || 300_000

  const sessionId = `job-${jobId}-${Date.now()}`
  setJobSession(true)
  try {
    const session = await client.createSession({
      sessionId,
      model: getSelectedModel(),
      tools: buildTools(),
      hooks: jobHooks,
      infiniteSessions: { enabled: false },
      systemMessage: { mode: 'append', content: buildSystemMessage() },
      onPermissionRequest: jobPermissionHandler
    })

    // Inject time context into the prompt so Agent knows the time window
    // Inject time context as metadata, not instructions
    let prompt = instruction
    if (lastRunAt) {
      prompt = `[Last run: ${lastRunAt}]\n\n${instruction}`
    } else {
      prompt = `[First run, current time: ${new Date().toISOString()}]\n\n${instruction}`
    }
    const result = await session.sendAndWait({ prompt }, timeoutMs)
    await session.disconnect()
    return result?.data.content || ''
  } finally {
    setJobSession(false)
  }
}

// === Morning Briefing (proactive message) ===

export async function generateMorningBriefing(): Promise<string> {
  // Fetch instruction from DB so there's a single source of truth
  const db = getDb()
  const row = db.prepare("SELECT instruction FROM jobs WHERE id = 'morning-briefing'").get() as { instruction: string } | undefined
  const instruction = row?.instruction || 'Check today\'s calendar events, new email, Teams messages, and GitHub notifications. Create tasks for anything I need to handle, and give prioritized suggestions for today.'
  return executeJobSession(instruction, 'morning-briefing')
}

// === Chat History (local DB, for UI display) ===

function saveMessage(msg: ChatMessage): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO chat_messages (id, role, content, timestamp, task_id, pending_action)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.role, msg.content, msg.timestamp, msg.taskId, msg.pendingAction ? JSON.stringify(msg.pendingAction) : null)
}

/**
 * Persist an agent message into the General chat (taskId = null) and notify the
 * renderer. Used by job result delivery so background summaries land durably in
 * the desktop chat instead of being injected only when the user happens to be
 * viewing General chat.
 */
export function postAgentMessageToGeneral(content: string): void {
  const msg: ChatMessage = {
    id: uuid(),
    role: 'agent',
    content,
    timestamp: new Date().toISOString(),
    taskId: null
  }
  saveMessage(msg)
  emitEvent({ type: 'chat:message', message: msg })
}

export function getChatHistory(taskId: string | null): ChatMessage[] {
  const db = getDb()
  const rows = taskId
    ? db.prepare('SELECT * FROM chat_messages WHERE task_id = ? ORDER BY timestamp').all(taskId)
    : db.prepare('SELECT * FROM chat_messages WHERE task_id IS NULL ORDER BY timestamp').all()

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    role: row.role as 'user' | 'agent',
    content: row.content as string,
    timestamp: row.timestamp as string,
    taskId: row.task_id as string | null,
    pendingAction: row.pending_action ? JSON.parse(row.pending_action as string) : undefined
  }))
}

export function confirmAction(actionId: string, decision: 'confirm' | 'modify' | 'cancel', modification?: string): void {
  const pending = pendingActions.get(actionId)
  if (!pending) return

  clearTimeout(pending.timer)

  if (decision === 'modify' && modification) {
    pending.action.status = 'cancelled'
    pending.resolve(false)
    pendingActions.delete(actionId)
    return
  }

  pending.action.status = decision === 'confirm' ? 'confirmed' : 'cancelled'
  pending.resolve(decision === 'confirm')
  pendingActions.delete(actionId)
}

// === First Message: Instant task briefing from local data (no LLM call) ===

export async function triggerFirstMessage(taskId: string): Promise<ChatMessage | null> {
  const task = getTask(taskId)
  if (!task) return null

  // Check if there's already chat history for this task — if so, don't re-explain
  const history = getChatHistory(taskId)
  if (history.length > 0) return null

  // Build a local briefing from structured data — instant, no LLM needed
  const sourceLabel = { email: 'Email', github: 'GitHub', teams: 'Teams', calendar: 'Calendar', chat: 'Chat' }[task.source.type] || task.source.type
  const priorityLabel = { p0: 'P0 (urgent)', p1: 'P1 (normal)', p2: 'P2 (can wait)' }[task.priority] || task.priority
  const statusLabel = { pending: 'Pending', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' }[task.status] || task.status

  const lines: string[] = []
  lines.push(`**${task.title}**`)
  lines.push('')
  lines.push(`Source: ${sourceLabel}${task.source.externalUrl ? ` · [link](${task.source.externalUrl})` : ''}`)
  lines.push(`Priority: ${priorityLabel} · Status: ${statusLabel}`)
  if (task.dueDate) {
    const due = new Date(task.dueDate)
    const now = new Date()
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000)
    const dueStr = due.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    if (diffDays < 0) lines.push(`Due: ${dueStr} (${-diffDays} day(s) overdue)`)
    else if (diffDays === 0) lines.push(`Due: today`)
    else lines.push(`Due: ${dueStr} (in ${diffDays} day(s))`)
  }
  if (task.description) {
    lines.push('')
    lines.push(task.description)
  }
  lines.push('')
  lines.push('---')
  lines.push('Want me to help with this task? Just tell me what to do.')

  const agentMsg: ChatMessage = {
    id: uuid(),
    role: 'agent',
    content: lines.join('\n'),
    timestamp: new Date().toISOString(),
    taskId
  }
  saveMessage(agentMsg)
  emitEvent({ type: 'chat:message', message: agentMsg })
  return agentMsg
}

// === Helpers ===

function formatTaskContext(task: Task): string {
  const lines = [`## Current task`, `- ID: ${task.id}`, `- Title: ${task.title}`, `- Status: ${task.status}`, `- Priority: ${task.priority}`]
  if (task.description) lines.push(`- Description: ${task.description}`)
  if (task.dueDate) lines.push(`- Due: ${task.dueDate}`)
  if (task.source.externalUrl) lines.push(`- Source: ${task.source.externalUrl}`)
  lines.push(`\n> The user is in this task's chat. You can operate on it directly with update_aide_task(id: "${task.id}", ...).`)
  return lines.join('\n')
}

function formatProjectContext(p: { name: string; description: string; techStack: string | null }): string {
  return `## Related project: ${p.name}\n${p.description}${p.techStack ? `\nTech stack: ${p.techStack}` : ''}`
}

function formatRelationsContext(rels: Array<{ name: string; role: string; expertise: string[]; communicationStyle: string | null }>): string {
  return '## Related people\n' + rels.map(r =>
    `- ${r.name} (${r.role})${r.expertise.length ? ' — ' + r.expertise.join(', ') : ''}${r.communicationStyle ? ' — ' + r.communicationStyle : ''}`
  ).join('\n')
}

function emitEvent(event: { type: string; [key: string]: unknown }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('aide:event', event)
  }
}

function summarizeToolInput(toolName: string, toolArgs: unknown): string | undefined {
  if (!toolArgs || typeof toolArgs !== 'object') return undefined

  const args = toolArgs as Record<string, unknown>
  const preferredKeys = toolName.toLowerCase().includes('powershell') || toolName.toLowerCase().includes('shell')
    ? ['command', 'cmd', 'script', 'code', 'input']
    : ['command', 'cmd', 'script', 'query', 'prompt', 'title', 'path', 'filePath', 'url', 'repo', 'name', 'action']

  for (const key of preferredKeys) {
    const value = args[key]
    const preview = previewValue(value)
    if (preview) return preview
  }

  const entries = Object.entries(args)
    .map(([key, value]) => {
      const preview = previewValue(value)
      return preview ? `${key}: ${preview}` : null
    })
    .filter(Boolean) as string[]

  if (entries.length === 0) return undefined
  return truncatePreview(entries.slice(0, 2).join(' · '))
}

function previewValue(value: unknown): string | undefined {
  if (typeof value === 'string') return truncatePreview(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) && value.length > 0) return truncatePreview(value.map(v => previewValue(v) || '').filter(Boolean).join(', '))
  return undefined
}

function truncatePreview(value: string, max = 160): string | undefined {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return undefined
  return compact.length > max ? compact.slice(0, max - 1) + '…' : compact
}

// === Relation cleanup helper ===

export function cleanupRelationReferences(relationId: string): void {
  const db = getDb()
  const rows = db.prepare(
    "SELECT id, related_relation_ids FROM tasks WHERE related_relation_ids LIKE ?"
  ).all(`%${relationId}%`) as { id: string; related_relation_ids: string }[]

  for (const row of rows) {
    const ids: string[] = JSON.parse(row.related_relation_ids)
    const filtered = ids.filter(id => id !== relationId)
    db.prepare('UPDATE tasks SET related_relation_ids = ? WHERE id = ?')
      .run(JSON.stringify(filtered), row.id)
  }
}
