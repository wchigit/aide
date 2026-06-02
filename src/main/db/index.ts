import { createRequire } from 'module'
import type DatabaseConstructor from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const require = createRequire(import.meta.url)

let Database: typeof DatabaseConstructor
try {
  Database = require('better-sqlite3')
} catch (err: any) {
  const msg = `Failed to load the database module (better-sqlite3). Please reinstall the app.\n${err?.message || err}`
  if (typeof process !== 'undefined' && process.versions?.electron) {
    const { dialog } = require('electron') as typeof import('electron')
    dialog.showErrorBox('Aide failed to start', msg)
  }
  throw new Error(msg)
}

type DatabaseInstance = ReturnType<typeof DatabaseConstructor>

let db: DatabaseInstance | null = null

export function getDb(): DatabaseInstance {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbDir = join(userDataPath, 'data')
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }
    const dbPath = join(dbDir, 'aide.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
    runMigrations(db)
  }
  return db
}

function initSchema(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'p1',
      source_type TEXT NOT NULL,
      source_connection_id TEXT,
      source_external_id TEXT,
      source_external_url TEXT,
      project_id TEXT,
      related_relation_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      due_date TEXT,
      completed_at TEXT,
      seen_at TEXT,
      snoozed_until TEXT,
      session_id TEXT,
      result TEXT,
      last_activity_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_activities (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'progress',
      summary TEXT NOT NULL,
      status_from TEXT,
      status_to TEXT,
      source_ref TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      layer TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      task_id TEXT,
      project_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      recall_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      content,
      tags,
      content='memory_entries',
      content_rowid='rowid',
      tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_fts(rowid, content, tags)
      VALUES (new.rowid, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, tags)
      VALUES ('delete', old.rowid, old.content, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, tags)
      VALUES ('delete', old.rowid, old.content, old.tags);
      INSERT INTO memory_fts(rowid, content, tags)
      VALUES (new.rowid, new.content, new.tags);
    END;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      repo_path TEXT,
      docs_path TEXT,
      tech_stack TEXT,
      team TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      org TEXT,
      title TEXT,
      email TEXT,
      teams_id TEXT,
      timezone TEXT,
      expertise TEXT NOT NULL DEFAULT '[]',
      communication_style TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      instruction TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_result TEXT,
      last_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      task_id TEXT,
      pending_action TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_activity_task ON task_activities(task_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_memory_layer ON memory_entries(layer);
    CREATE INDEX IF NOT EXISTS idx_memory_status ON memory_entries(status);
    CREATE INDEX IF NOT EXISTS idx_memory_project ON memory_entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_chat_task ON chat_messages(task_id);
    CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);
  `)

  // Seed default jobs if empty
  const jobCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }
  if (jobCount.count === 0) {
    seedDefaultJobs(db)
  }

  // Always sync built-in job definitions (instruction/name/cron) on startup
  // Preserves runtime state (enabled, last_run_at, last_result, last_summary)
  syncBuiltinJobs(db)
}

function runMigrations(db: DatabaseInstance): void {
  // Add source column to projects/relations for existing DBs
  const projCols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[]
  if (!projCols.some(c => c.name === 'source')) {
    db.exec("ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'user'")
  }
  const relCols = db.prepare("PRAGMA table_info(relations)").all() as { name: string }[]
  if (!relCols.some(c => c.name === 'source')) {
    db.exec("ALTER TABLE relations ADD COLUMN source TEXT NOT NULL DEFAULT 'user'")
  }
  // Add source_connection_id to tasks
  const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
  if (!taskCols.some(c => c.name === 'source_connection_id')) {
    db.exec("ALTER TABLE tasks ADD COLUMN source_connection_id TEXT")
  }
  // Add last_activity_at to tasks (task progress timeline)
  if (!taskCols.some(c => c.name === 'last_activity_at')) {
    db.exec("ALTER TABLE tasks ADD COLUMN last_activity_at TEXT")
  }
  // Task activities timeline table (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_activities (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'progress',
      summary TEXT NOT NULL,
      status_from TEXT,
      status_to TEXT,
      source_ref TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_activity_task ON task_activities(task_id, timestamp);
  `)
  // Add last_polled_at to connections tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS connection_state (
      connection_id TEXT PRIMARY KEY,
      last_polled_at TEXT,
      poll_cursor TEXT
    )
  `)
  // Migrate priority values: high→p0, medium→p1, low→p2
  db.exec(`
    UPDATE tasks SET priority = 'p0' WHERE priority = 'high';
    UPDATE tasks SET priority = 'p1' WHERE priority = 'medium';
    UPDATE tasks SET priority = 'p2' WHERE priority = 'low';
  `)
}

const DEFAULT_PERIODIC_POLL_INSTRUCTION = `Check for new email, Teams messages, and GitHub notifications since the last run (on first run, look back 24 hours). When using ask_work_iq, set the query range based on the time info above.

Before handling each new item, call query_aide_tasks to see current active tasks, then make one of four decisions:

1. Link to an existing task: if the item is a follow-up to an existing task. First use find_related_task (with sourceId/PR#/email ID, etc.) to confirm ownership; on a match, use add_task_activity to record progress, including sourceRef when possible.
2. Update status: on objective complete/blocked signals (PR merged → completed, CI failing or changes requested → record a blocker, etc.) use update_aide_task to change status (status changes are logged automatically).
3. Create a new task: only when no related task exists. Always fill sourceType by the real source (GitHub → github, Teams → teams, email → email, calendar → calendar) and attach sourceId and sourceUrl (external link).
4. Ignore: if unrelated to existing tasks and not worth creating, skip it.

Keep the bar for recording activity strict: only record when something actually moves forward, gets blocked, changes status, or requires substantive input from the user. Skip pleasantries, acknowledgements, forwards, CCs, bot notifications, and minor wording tweaks; default to ignoring — recording is the exception. Record each piece of progress only once (check with get_task_activities first), and merge multiple related items for the same task in one poll into a single note.`

const DEFAULT_WORLD_SYNC_INSTRUCTION = `Maintain the contacts and projects lists. Do not create tasks.

Contacts: look at people with 1:1 interactions over the past week (direct emails, direct replies, 1:1 chats). Only create/update contacts for these people. Skip broadcast CCs and people who appear only once.

Projects: look at GitHub repos with recent commit/PR/issue activity. Make sure a matching project exists (must have a repo URL).

Retire: contacts with no interaction for 3 months → inactive. Projects with no activity → archived.`

function seedDefaultJobs(db: DatabaseInstance): void {
  const insert = db.prepare(`
    INSERT INTO jobs (id, name, cron, instruction, enabled)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const job of BUILTIN_JOBS) {
    insert.run(job.id, job.name, job.cron, job.instruction, 1)
  }
}

const BUILTIN_JOBS: { id: string; name: string; cron: string; instruction: string }[] = [
  { id: 'morning-briefing', name: 'Daily morning briefing', cron: '0 9 * * 1-5', instruction: 'Check for new email, Teams messages, and GitHub notifications since the last run, plus today\'s calendar events. Create a Task for items that need the user to act (fill sourceType by the real source: github/teams/email/calendar, and attach sourceId and sourceUrl), and give a prioritized summary of suggestions for today.' },
  { id: 'periodic-poll', name: 'Periodic poll', cron: '*/30 * * * *', instruction: DEFAULT_PERIODIC_POLL_INSTRUCTION },
  { id: 'daily-reconcile', name: 'End-of-day review', cron: '0 18 * * 1-5', instruction: 'Review today\'s task statuses. Mark tasks that are confirmed done but unmarked as completed. Suggest cleaning up P2 tasks untouched for over 7 days. Generate a short daily summary.' },
  { id: 'world-sync', name: 'Relationships & projects sync', cron: '0 10 * * 1', instruction: DEFAULT_WORLD_SYNC_INSTRUCTION },
]

function syncBuiltinJobs(db: DatabaseInstance): void {
  const upsert = db.prepare(`
    INSERT INTO jobs (id, name, cron, instruction, enabled)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, cron = excluded.cron, instruction = excluded.instruction
  `)
  for (const job of BUILTIN_JOBS) {
    upsert.run(job.id, job.name, job.cron, job.instruction)
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
