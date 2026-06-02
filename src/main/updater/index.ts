// Auto-update subsystem.
//
// Wraps electron-updater behind a small state machine and surfaces every
// transition to the renderer via `aide:event` ({ type: 'update:state' }).
//
// Behavior:
//   - On a packaged build, checks for updates shortly after launch and then
//     on a fixed interval.
//   - Updates download automatically in the background (autoDownload).
//   - When a download finishes, the user is notified and can restart to
//     install on demand; otherwise it installs on next quit.
//   - In dev / unpackaged builds the updater is inert (electron-updater has
//     no app-update.yml to read), but getState() still reports the version.

import { app, BrowserWindow, Notification } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateState, UpdateStatus } from '@shared/types'

const { autoUpdater } = electronUpdater

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // every 6 hours
const STARTUP_DELAY_MS = 8 * 1000 // let the app settle before the first check

let getWindow: () => BrowserWindow | null = () => null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let initialized = false

const state: UpdateState = {
  status: 'idle',
  supported: app.isPackaged,
  currentVersion: app.getVersion(),
  latestVersion: null,
  progressPercent: null,
  error: null,
  lastCheckedAt: null,
}

function emit(): void {
  getWindow()?.webContents.send('aide:event', { type: 'update:state', state: { ...state } })
}

function setState(patch: Partial<UpdateState>): void {
  Object.assign(state, patch)
  emit()
}

function transition(status: UpdateStatus, patch: Partial<UpdateState> = {}): void {
  setState({ status, ...patch })
}

export function getUpdateState(): UpdateState {
  return { ...state }
}

/**
 * Initialize the updater. Safe to call once on app startup.
 * @param windowGetter returns the current main window (for event delivery & notifications)
 */
export function initUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter
  if (initialized) return
  initialized = true

  // electron-updater cannot run without a packaged build + app-update.yml.
  if (!app.isPackaged) {
    console.log('[Aide][updater] Disabled in dev (app not packaged).')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => {
    transition('checking', { error: null, lastCheckedAt: new Date().toISOString() })
  })

  autoUpdater.on('update-available', (info) => {
    transition('available', { latestVersion: info.version, error: null })
  })

  autoUpdater.on('update-not-available', (info) => {
    transition('not-available', { latestVersion: info.version, progressPercent: null })
  })

  autoUpdater.on('download-progress', (progress) => {
    transition('downloading', { progressPercent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    transition('downloaded', { latestVersion: info.version, progressPercent: 100 })
    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'Update ready',
        body: `Aide ${info.version} has been downloaded. Restart to install.`,
      })
      n.show()
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('[Aide][updater] error:', err)
    transition('error', { error: err instanceof Error ? err.message : String(err), progressPercent: null })
  })

  // First check after a short delay, then on a fixed interval.
  setTimeout(() => { void checkForUpdates() }, STARTUP_DELAY_MS)
  intervalTimer = setInterval(() => { void checkForUpdates() }, CHECK_INTERVAL_MS)
}

/**
 * Trigger an update check. Resolves once the check has been kicked off;
 * results arrive asynchronously through state transitions.
 */
export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) return getUpdateState()
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    transition('error', { error: err instanceof Error ? err.message : String(err) })
  }
  return getUpdateState()
}

/**
 * Force a download of an available update (no-op when autoDownload already
 * handled it, but lets the UI retry after an error).
 */
export async function downloadUpdate(): Promise<UpdateState> {
  if (!app.isPackaged) return getUpdateState()
  try {
    transition('downloading', { progressPercent: state.progressPercent ?? 0, error: null })
    await autoUpdater.downloadUpdate()
  } catch (err) {
    transition('error', { error: err instanceof Error ? err.message : String(err) })
  }
  return getUpdateState()
}

/**
 * Quit and install a downloaded update. Only valid in the 'downloaded' state.
 */
export function quitAndInstall(): void {
  if (!app.isPackaged || state.status !== 'downloaded') return
  // isSilent=false (show installer progress), isForceRunAfter=true (relaunch)
  autoUpdater.quitAndInstall(false, true)
}

export function stopUpdater(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
