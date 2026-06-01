import { writeMemory, searchMemory, updateMemory, markMemoryInactive } from '../memory'
import { createTask, updateTask, listTasks, addTaskActivity, listTaskActivities, findRelatedTask } from '../tasks'
import { listProjects, createProject, updateProject, deleteProject } from '../projects'
import { listRelations, createRelation, updateRelation, deleteRelation } from '../relations'
import { getPreferences, setPreferences } from '../preferences'
import { listJobs, createJob, updateJob, deleteJob, toggleJob } from '../jobs'
import { showSystemNotification } from '../index'
import { isJobSession, jobCreatedTaskIds } from './state'
import { getActiveMcpTools } from './mcp'
import { BrowserWindow } from 'electron'
import type { Tool } from '@github/copilot-sdk'

// ============================================================
// Custom Tools — registered to the SDK for the agent to call autonomously
// ============================================================

export function buildTools(): Tool<any>[] {
  // Internal tools + all active MCP server tools
  const mcpTools = getActiveMcpTools()
  return [
    memoryWriteTool,
    memorySearchTool,
    createTaskTool,
    updateTaskTool,
    queryTasksTool,
    findRelatedTaskTool,
    addTaskActivityTool,
    getTaskActivitiesTool,
    queryProjectsTool,
    queryRelationsTool,
    manageProjectTool,
    manageRelationTool,
    manageJobTool,
    managePreferencesTool,
    generateReportTool,
    ...mcpTools
  ]
}

const memoryWriteTool: Tool<any> = {
  name: 'memory_write',
  description: 'Manage memory. add = record new info, update = correct an existing memory, remove = delete a wrong memory. When the user corrects you, first check whether a wrong memory needs update/remove.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'update', 'remove'], description: 'Operation type' },
      content: { type: 'string', description: 'New content (required for add/update)' },
      target_id: { type: 'string', description: 'Target memory ID (required for update/remove)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Category tags, e.g. ["preference", "tech"]' },
      projectId: { type: 'string', description: 'Associated project ID (optional)' }
    },
    required: ['action']
  },
  skipPermission: true, // memory writes are auto-allowed
  handler: async (args: { action: 'add' | 'update' | 'remove'; content?: string; target_id?: string; tags?: string[]; projectId?: string }) => {
    if (args.action === 'remove') {
      if (!args.target_id) return { success: false, error: 'remove requires target_id' }
      markMemoryInactive(args.target_id)
      return { success: true, message: 'Marked inactive (auditable)' }
    }
    if (args.action === 'update') {
      if (!args.target_id || !args.content) return { success: false, error: 'update requires target_id and content' }
      updateMemory(args.target_id, args.content)
      return { success: true, message: 'Updated' }
    }
    // add
    if (!args.content) return { success: false, error: 'add requires content' }
    const entry = writeMemory({ content: args.content, tags: args.tags, projectId: args.projectId })
    return { success: true, id: entry.id, message: 'Recorded' }
  }
}

const memorySearchTool: Tool<any> = {
  name: 'memory_search',
  description: 'Search past memories. Use when you need to recall earlier conversations, user preferences, project info, or details about a person.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keyword/phrase' },
      limit: { type: 'number', description: 'Max results (default 5)' }
    },
    required: ['query']
  },
  skipPermission: true,
  handler: async (args: { query: string; limit?: number }) => {
    const results = searchMemory(args.query, args.limit || 5)
    if (results.length === 0) return { memories: [], message: 'No relevant memories found' }
    return {
      memories: results.map(m => ({
        content: m.content,
        tags: m.tags,
        createdAt: m.createdAt,
        source: m.source
      }))
    }
  }
}

const createTaskTool: Tool<any> = {
  name: 'create_task',
  description: 'Create a new task. Always fill sourceType by the task\'s real source (from a GitHub PR/Issue use github, Teams message use teams, email use email, calendar event use calendar; for a task with no external source that originated from chatting with the user, use chat). Pass sourceId (email ID/notification ID, etc.) for exact de-dup. The system auto-detects similar tasks and skips duplicates.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title, concise and clear (one line)' },
      description: { type: 'string', description: 'Task details: background + core content + suggested handling steps. The user should be able to decide directly without going back to the original info.' },
      priority: { type: 'string', enum: ['p0', 'p1', 'p2'] },
      sourceType: { type: 'string', enum: ['github', 'teams', 'email', 'calendar', 'chat'], description: 'The task\'s real source. GitHub PR/Issue → github, Teams message → teams, email → email, calendar → calendar; a task with no external source that originated from chatting with the user → chat.' },
      sourceId: { type: 'string', description: 'Unique source identifier (email ID, notification ID, message ID, PR/Issue number). Extract from MCP response data.' },
      sourceUrl: { type: 'string', description: 'External link to the source (PR/Issue URL, email/message deep link, etc.) for one-click navigation.' },
      dueDate: { type: 'string', description: 'ISO 8601 due date' },
      projectId: { type: 'string', description: 'Associated project ID' },
      relatedRelationIds: { type: 'array', items: { type: 'string' }, description: 'List of related people IDs' }
    },
    required: ['title', 'priority', 'description']
  },
  skipPermission: true, // creating a task is auto-allowed (notify level)
  handler: async (args: any) => {
    const source: any = { type: (args.sourceType as string) || 'chat' }
    if (args.sourceId) {
      source.externalId = args.sourceId
    }
    if (args.sourceUrl) {
      source.externalUrl = args.sourceUrl
    }
    const { task, deduplicated } = createTask({ ...args, source })

    if (deduplicated) {
      return { success: true, deduplicated: true, taskId: task.id, title: task.title, message: 'An identical task already exists; skipped creation' }
    }

    emitToRenderer({ type: 'task:created', task })

    // Track task IDs created during job sessions (to prevent same-session completion)
    if (isJobSession) {
      jobCreatedTaskIds.add(task.id)
    }

    // System notification for high priority tasks
    const prefs = getPreferences()
    if (task.priority === 'p0') {
      if (prefs.systemNotifications) {
        showSystemNotification('Urgent task', task.title)
      }
      // Also push a chat message to General for visibility
      emitToRenderer({
        type: 'chat:message',
        message: {
          id: `notify-${task.id}`,
          role: 'agent',
          content: `⚡ New urgent task: **${task.title}**${task.dueDate ? ` (due ${new Date(task.dueDate).toLocaleDateString('en-US')})` : ''}`,
          timestamp: new Date().toISOString(),
          taskId: null
        }
      })
    } else if (task.priority === 'p1') {
      if (prefs.systemNotifications) {
        showSystemNotification('New task', task.title)
      }
      emitToRenderer({
        type: 'chat:message',
        message: {
          id: `notify-${task.id}`,
          role: 'agent',
          content: `📋 New task: **${task.title}**${task.dueDate ? ` (due ${new Date(task.dueDate).toLocaleDateString('en-US')})` : ''}`,
          timestamp: new Date().toISOString(),
          taskId: null
        }
      })
    } else if (task.priority === 'p2') {
      // P2: in-app notification only (no system notification)
      emitToRenderer({
        type: 'chat:message',
        message: {
          id: `notify-${task.id}`,
          role: 'agent',
          content: `📝 Low-priority task: **${task.title}**`,
          timestamp: new Date().toISOString(),
          taskId: null
        }
      })
    }

    return { success: true, deduplicated: false, taskId: task.id, title: task.title }
  }
}

const updateTaskTool: Tool<any> = {
  name: 'update_task',
  description: 'Update a task. Change status (complete/cancel), priority, title, etc.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task ID' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
      priority: { type: 'string', enum: ['p0', 'p1', 'p2'] },
      title: { type: 'string' },
      description: { type: 'string' }
    },
    required: ['id']
  },
  skipPermission: true,
  handler: async (args: any) => {
    const { id, ...changes } = args

    // Prevent jobs from completing tasks they JUST created in the same session (anti-self-completion)
    // But allow completing pre-existing tasks based on new external info (e.g. PR merged → task done)
    if (isJobSession && changes.status && (changes.status === 'completed' || changes.status === 'cancelled')) {
      if (jobCreatedTaskIds.has(id)) {
        return { success: false, error: 'Cannot create and complete a task within the same Job run. Task status should be updated by a later check or user confirmation.' }
      }
    }

    const task = updateTask(id, changes)
    emitToRenderer({ type: 'task:updated', task })
    return { success: true, task: { id: task.id, title: task.title, status: task.status } }
  }
}

const findRelatedTaskTool: Tool<any> = {
  name: 'find_related_task',
  description: 'Before creating a new task or attaching progress, use this to check whether a related task already exists. Returns the most likely candidate, a similarity score (0-1), and the match reason. High score (>=0.7) should attach to the existing task; no result means you may create a new one. Passing an external reference (PR#/email ID/message ID) precisely matches a previously bound task.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title/subject of the content to evaluate' },
      description: { type: 'string', description: 'Details of the content to evaluate (optional)' },
      sourceRef: { type: 'string', description: 'External reference: PR#, issue#, email messageId, Teams message id, etc. (optional, but improves matching accuracy)' }
    },
    required: ['title']
  },
  skipPermission: true,
  handler: async (args: { title: string; description?: string; sourceRef?: string }) => {
    const match = findRelatedTask(args.title, args.description, args.sourceRef)
    if (!match) return { found: false, message: 'No related task found; can be treated as a new task' }
    return {
      found: true,
      taskId: match.task.id,
      title: match.task.title,
      status: match.task.status,
      score: Math.round(match.score * 100) / 100,
      reason: match.reason
    }
  }
}

const addTaskActivityTool: Tool<any> = {
  name: 'add_task_activity',
  description: 'Record one "substantive update" for an existing task. The bar is strict: only record when things actually moved forward, got blocked, changed status, or require the user\'s direct response. Pleasantries / acknowledgements / forwards / CCs / bot notifications / minor wording tweaks are never recorded. Record each update only once (check first with get_task_activities). summary must state "what substantive thing happened", not paraphrase the raw message.',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID' },
      type: { type: 'string', enum: ['progress', 'blocker', 'comment', 'note'], description: 'progress = forward movement, blocker = blocked/risk, comment = substantive input needing a response, note = other key point' },
      summary: { type: 'string', description: 'One-sentence plain-language summary of this substantive update' },
      sourceRef: { type: 'string', description: 'External reference (PR#/email ID/message id) for precise later linking (strongly recommended)' }
    },
    required: ['taskId', 'summary']
  },
  skipPermission: true,
  handler: async (args: { taskId: string; type?: any; summary: string; sourceRef?: string }) => {
    const activity = addTaskActivity(args.taskId, {
      type: args.type || 'progress',
      summary: args.summary,
      sourceRef: args.sourceRef
    })
    emitToRenderer({ type: 'task:activity', taskId: args.taskId, activity })
    return { success: true, activityId: activity.id }
  }
}

const getTaskActivitiesTool: Tool<any> = {
  name: 'get_task_activities',
  description: 'View a task\'s progress timeline (newest first). Use it before recording a new update to avoid recording the same update twice.',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID' }
    },
    required: ['taskId']
  },
  skipPermission: true,
  handler: async (args: { taskId: string }) => {
    const activities = listTaskActivities(args.taskId)
    return {
      total: activities.length,
      activities: activities.slice(0, 30).map(a => ({
        timestamp: a.timestamp,
        type: a.type,
        summary: a.summary,
        sourceRef: a.sourceRef
      }))
    }
  }
}

const queryTasksTool: Tool<any> = {
  name: 'query_tasks',
  description: 'Query the task list. Filter by status, priority, or project. Use to understand the current workload.',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'array', items: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] } },
      priority: { type: 'array', items: { type: 'string', enum: ['p0', 'p1', 'p2'] } },
      projectId: { type: 'string' }
    }
  },
  skipPermission: true,
  handler: async (args: any) => {
    const tasks = listTasks(args || {})
    return {
      total: tasks.length,
      tasks: tasks.slice(0, 20).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        source: t.source.type
      }))
    }
  }
}

const queryProjectsTool: Tool<any> = {
  name: 'query_projects',
  description: 'Query the list of existing projects. Use when creating a task to determine whether there is a matching project to associate.',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Fuzzy search by name or description (optional; returns all if omitted)' }
    }
  },
  skipPermission: true,
  handler: async (args: { keyword?: string }) => {
    let projects = listProjects()
    if (args?.keyword) {
      const kw = args.keyword.toLowerCase()
      projects = projects.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        p.description.toLowerCase().includes(kw) ||
        (p.techStack || '').toLowerCase().includes(kw)
      )
    }
    if (projects.length === 0) return { projects: [], message: 'No matching project found', hint: 'If a project is genuinely involved, create it with manage_project(action: create)' }
    return {
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        techStack: p.techStack,
        team: p.team
      }))
    }
  }
}

const queryRelationsTool: Tool<any> = {
  name: 'query_relations',
  description: 'Query existing contacts. Use when creating a task to determine which known people are involved. Also used to look up someone\'s contact info, role, etc.',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Fuzzy search by name, organization, or title (optional; returns all if omitted)' },
      role: { type: 'string', enum: ['manager', 'peer', 'report', 'external', 'stakeholder'], description: 'Filter by role' }
    }
  },
  skipPermission: true,
  handler: async (args: { keyword?: string; role?: string }) => {
    let relations = listRelations()
    if (args?.role) {
      relations = relations.filter(r => r.role === args.role)
    }
    if (args?.keyword) {
      const kw = args.keyword.toLowerCase()
      relations = relations.filter(r =>
        r.name.toLowerCase().includes(kw) ||
        (r.org || '').toLowerCase().includes(kw) ||
        (r.title || '').toLowerCase().includes(kw) ||
        (r.email || '').toLowerCase().includes(kw)
      )
    }
    if (relations.length === 0) return { relations: [], message: 'No matching contact found', hint: 'If a new person is involved, create them with manage_relation(action: create)' }
    return {
      relations: relations.map(r => ({
        id: r.id,
        name: r.name,
        role: r.role,
        org: r.org,
        title: r.title,
        email: r.email,
        expertise: r.expertise
      }))
    }
  }
}

const manageProjectTool: Tool<any> = {
  name: 'manage_project',
  description: 'Create, update, or delete a project. repoPath is required when creating.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'delete'], description: 'Operation type' },
      id: { type: 'string', description: 'Project ID (required for update/delete)' },
      name: { type: 'string', description: 'Project name (required for create)' },
      description: { type: 'string', description: 'Project description' },
      repoPath: { type: 'string', description: 'GitHub repo URL or local folder path (required for create)' },
      docsPath: { type: 'string', description: 'Docs path' },
      techStack: { type: 'string', description: 'Tech stack' },
      team: { type: 'array', items: { type: 'string' }, description: 'List of team member relation IDs' },
      notes: { type: 'string', description: 'Notes' }
    },
    required: ['action']
  },
  skipPermission: true,
  handler: async (args: any) => {
    const { action, id, ...fields } = args
    if (action === 'create') {
      if (!fields.name) return { success: false, error: 'create requires name' }
      if (!fields.repoPath) return { success: false, error: 'create requires repoPath (GitHub repo URL or local path). A project must map to a real code repo or folder.' }
      const project = createProject({ ...fields, source: 'agent' })
      emitToRenderer({ type: 'project:created', project })
      return { success: true, id: project.id, name: project.name }
    }
    if (action === 'update') {
      if (!id) return { success: false, error: 'update requires id' }
      const project = updateProject(id, fields)
      return { success: true, id: project.id, name: project.name }
    }
    if (action === 'delete') {
      if (!id) return { success: false, error: 'delete requires id' }
      deleteProject(id)
      emitToRenderer({ type: 'project:deleted', projectId: id })
      return { success: true, message: 'Deleted' }
    }
    return { success: false, error: 'Unknown action' }
  }
}

const manageRelationTool: Tool<any> = {
  name: 'manage_relation',
  description: 'Create, update, or delete a contact.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'delete'], description: 'Operation type' },
      id: { type: 'string', description: 'Contact ID (required for update)' },
      name: { type: 'string', description: 'Name (required for create)' },
      role: { type: 'string', enum: ['manager', 'peer', 'report', 'external', 'stakeholder'], description: 'Role relationship' },
      org: { type: 'string', description: 'Organization/team' },
      title: { type: 'string', description: 'Job title' },
      email: { type: 'string', description: 'Email' },
      teamsId: { type: 'string', description: 'Teams ID' },
      timezone: { type: 'string', description: 'Timezone' },
      expertise: { type: 'array', items: { type: 'string' }, description: 'Areas of expertise' },
      communicationStyle: { type: 'string', description: 'Communication preference' },
      notes: { type: 'string', description: 'Notes' }
    },
    required: ['action']
  },
  skipPermission: true, // contact management runs automatically
  handler: async (args: any) => {
    const { action, id, ...fields } = args
    if (action === 'create') {
      if (!fields.name) return { success: false, error: 'create requires name' }
      if (!fields.role) fields.role = 'peer' // default to peer
      const relation = createRelation({ ...fields, source: 'agent' })
      emitToRenderer({ type: 'relation:created', relation })
      return { success: true, id: relation.id, name: relation.name }
    }
    if (action === 'update') {
      if (!id) return { success: false, error: 'update requires id' }
      const relation = updateRelation(id, fields)
      return { success: true, id: relation.id, name: relation.name }
    }
    if (action === 'delete') {
      if (!id) return { success: false, error: 'delete requires id' }
      deleteRelation(id)
      emitToRenderer({ type: 'relation:deleted', relationId: id })
      return { success: true, message: 'Deleted' }
    }
    return { success: false, error: 'Unknown action' }
  }
}

const manageJobTool: Tool<any> = {
  name: 'manage_job',
  description: `Manage scheduled jobs. Supports create, update, delete, toggle, and list.

Usage examples:
- User says "check my email every day at 8am" → create, cron="0 8 * * *"
- User says "change that scheduled job to hourly" → update, cron="0 * * * *"
- User says "pause the morning briefing" → toggle, enabled=false
- User says "what scheduled jobs do I have" → list`,
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'delete', 'toggle', 'list'], description: 'Operation type' },
      id: { type: 'string', description: 'Job ID (required for update/delete/toggle)' },
      name: { type: 'string', description: 'Scheduled job name (required for create)' },
      cron: { type: 'string', description: 'Cron expression, e.g. "0 8 * * *" means daily at 8am (required for create)' },
      instruction: { type: 'string', description: 'Execution instruction — the agent receives this text as its prompt when triggered (required for create)' },
      enabled: { type: 'boolean', description: 'Whether enabled (required for toggle)' }
    },
    required: ['action']
  },
  skipPermission: true,
  handler: async (args: { action: string; id?: string; name?: string; cron?: string; instruction?: string; enabled?: boolean }) => {
    if (args.action === 'list') {
      const jobs = listJobs()
      return {
        total: jobs.length,
        jobs: jobs.map(j => ({ id: j.id, name: j.name, cron: j.cron, enabled: j.enabled, lastRunAt: j.lastRunAt, lastResult: j.lastResult }))
      }
    }
    if (args.action === 'create') {
      if (!args.name || !args.cron || !args.instruction) return { success: false, error: 'create requires name, cron, instruction' }
      const job = createJob({ name: args.name, cron: args.cron, instruction: args.instruction })
      emitToRenderer({ type: 'job:created', job })
      return { success: true, id: job.id, name: job.name, cron: job.cron }
    }
    if (args.action === 'update') {
      if (!args.id) return { success: false, error: 'update requires id' }
      updateJob(args.id, { name: args.name, cron: args.cron, instruction: args.instruction })
      emitToRenderer({ type: 'job:updated', jobId: args.id })
      return { success: true, message: 'Updated' }
    }
    if (args.action === 'delete') {
      if (!args.id) return { success: false, error: 'delete requires id' }
      deleteJob(args.id)
      emitToRenderer({ type: 'job:deleted', jobId: args.id })
      return { success: true, message: 'Deleted' }
    }
    if (args.action === 'toggle') {
      if (!args.id || args.enabled === undefined) return { success: false, error: 'toggle requires id and enabled' }
      toggleJob(args.id, args.enabled)
      emitToRenderer({ type: 'job:toggled', jobId: args.id, enabled: args.enabled })
      return { success: true, message: args.enabled ? 'Enabled' : 'Paused' }
    }
    return { success: false, error: 'Unknown action' }
  }
}

const managePreferencesTool: Tool<any> = {
  name: 'manage_preferences',
  description: 'View or change user preferences, such as notifications and autonomy level.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['get', 'set'], description: 'Operation type' },
      autonomyLevel: { type: 'string', enum: ['default', 'confirm'], description: 'Autonomy level: default = write operations run automatically, confirm = confirm before every operation' },
      systemNotifications: { type: 'boolean', description: 'Whether system notifications are enabled' }
    },
    required: ['action']
  },
  skipPermission: true,
  handler: async (args: any) => {
    const { action, ...fields } = args
    if (action === 'get') {
      return getPreferences()
    }
    if (action === 'set') {
      const validKeys = ['autonomyLevel', 'systemNotifications']
      const updates: Record<string, unknown> = {}
      for (const k of validKeys) {
        if (fields[k] !== undefined) updates[k] = fields[k]
      }
      if (Object.keys(updates).length === 0) return { success: false, error: 'No valid settings provided' }
      setPreferences(updates)
      emitToRenderer({ type: 'preferences:updated' })
      return { success: true, updated: updates }
    }
    return { success: false, error: 'Unknown action' }
  }
}

const generateReportTool: Tool<any> = {
  name: 'generate_report',
  description: 'Generate a work report. Summarizes completed and in-progress tasks within the given time window.',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['daily', 'weekly'], description: 'Daily or weekly report' }
    },
    required: ['type']
  },
  skipPermission: true,
  handler: async (args: { type: 'daily' | 'weekly' }) => {
    const tasks = listTasks()
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - (args.type === 'daily' ? 1 : 7))
    const cutoffStr = cutoff.toISOString()

    const completed = tasks.filter(t => t.status === 'completed' && t.completedAt && t.completedAt >= cutoffStr)
    const inProgress = tasks.filter(t => t.status === 'in_progress')
    const pending = tasks.filter(t => t.status === 'pending')

    return {
      period: args.type,
      dateRange: { from: cutoffStr, to: now.toISOString() },
      completed: completed.map(t => ({ title: t.title, completedAt: t.completedAt })),
      inProgress: inProgress.map(t => ({ title: t.title, priority: t.priority })),
      pending: pending.length,
      summary: `${args.type === 'daily' ? 'Today' : 'This week'}: ${completed.length} completed, ${inProgress.length} in progress, ${pending.length} pending`
    }
  }
}

function emitToRenderer(event: { type: string; [key: string]: unknown }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('aide:event', event)
  }
}
