import { shell } from 'electron'
import { homedir } from 'node:os'
import { existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Agent-created files ("artifacts") live in the Copilot CLI session-state
// sandbox:
//   ~/.copilot/session-state/{sessionId}/files/{name}
// sessionId follows the convention defined in agent/index.ts:
//   task        -> "task-{taskId}-1"
//   general chat-> "general"
const SESSION_STATE_ROOT = path.join(homedir(), '.copilot', 'session-state')

function sessionIdForTask(taskId: string | null): string {
  return taskId ? `task-${taskId}-1` : 'general'
}

// Resolve an agent-reported file reference to a real, sandboxed absolute path.
// The reference the agent prints may be a full relative path
// ("session-state/{id}/files/x.md"), a truncated one
// ("session-state/.../files/x.md"), or a bare name ("x.md"). We resolve by
// (current session's files dir + basename), which is robust to the truncated
// middle. A path-traversal guard ensures the result never escapes the
// session-state root.
function resolveArtifact(taskId: string | null, ref: string): string | null {
  if (!ref) return null
  const base = path.basename(ref.replace(/\\/g, '/').trim())
  if (!base || base === '.' || base === '..') return null

  const filesDir = path.join(SESSION_STATE_ROOT, sessionIdForTask(taskId), 'files')
  const candidate = path.resolve(filesDir, base)

  // Sandbox: the resolved path must stay within the session-state root.
  const root = path.resolve(SESSION_STATE_ROOT)
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null

  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null
}

export type ArtifactResult = { ok: boolean; error?: string }

export async function openArtifact(taskId: string | null, ref: string): Promise<ArtifactResult> {
  const abs = resolveArtifact(taskId, ref)
  if (!abs) return { ok: false, error: 'File not found' }
  const err = await shell.openPath(abs) // returns '' on success
  return err ? { ok: false, error: err } : { ok: true }
}

export function revealArtifact(taskId: string | null, ref: string): ArtifactResult {
  const abs = resolveArtifact(taskId, ref)
  if (!abs) return { ok: false, error: 'File not found' }
  shell.showItemInFolder(abs)
  return { ok: true }
}

// Whether a referenced artifact currently exists. The renderer uses this to
// decide between an interactive chip and plain text, so we never present a
// dead link.
export function artifactExists(taskId: string | null, ref: string): boolean {
  return resolveArtifact(taskId, ref) !== null
}

// Reduce an arbitrary user filename to a safe basename: strip directory parts,
// allow only a conservative character set, and never let it start with a dot
// (which would hide it or, when empty, resolve to the dir itself).
function sanitizeFilename(name: string): string {
  const base = path.basename((name || 'attachment').replace(/\\/g, '/').trim())
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '')
  return cleaned || 'attachment'
}

// Persist a user-attached chat file into the session sandbox
//   ~/.copilot/session-state/{sessionId}/files/{name}
// so the agent can open it with its native file tools (instead of receiving an
// unreadable base64 blob inlined in the prompt). Returns the absolute path plus
// a sandbox-relative "files/{name}", or null if the data URL is malformed.
export function saveChatAttachment(
  taskId: string | null,
  name: string,
  dataUrl: string
): { absPath: string; relPath: string } | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  const isBase64 = /;base64/i.test(dataUrl.slice(0, comma))
  const payload = dataUrl.slice(comma + 1)
  let buf: Buffer
  try {
    buf = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
  } catch {
    return null
  }

  const filesDir = path.join(SESSION_STATE_ROOT, sessionIdForTask(taskId), 'files')
  mkdirSync(filesDir, { recursive: true })

  // De-dupe on collision so two "image.png" attachments don't clobber.
  const safe = sanitizeFilename(name)
  const ext = path.extname(safe)
  const stem = path.basename(safe, ext)
  let finalName = safe
  for (let n = 1; existsSync(path.join(filesDir, finalName)); n++) {
    finalName = `${stem}-${n}${ext}`
  }

  const absPath = path.join(filesDir, finalName)
  writeFileSync(absPath, buf)
  return { absPath, relPath: `files/${finalName}` }
}
