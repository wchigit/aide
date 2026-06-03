// ============================================================
// SDK Client Factory — @github/copilot-sdk
// ============================================================

import { CopilotClient } from '@github/copilot-sdk'
import { app } from 'electron'
import { join } from 'node:path'

// Resolve the standalone Copilot CLI binary for the current platform.
// We invoke the native binary directly (instead of npm-loader.js, which needs
// Node 24+). The binary lives in a platform-specific package; in a packaged
// app it must be loaded from app.asar.unpacked (see asarUnpack in
// electron-builder.yml) because executables cannot be spawned from inside asar.
function resolveCliPath(): string {
  const platformDir = `copilot-${process.platform}-${process.arch}`
  const binName = process.platform === 'win32' ? 'copilot.exe' : 'copilot'
  const segments = ['node_modules', '@github', platformDir, binName]
  const baseDir = app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked')
    : join(__dirname, '..', '..')
  return join(baseDir, ...segments)
}

export async function createClient(): Promise<CopilotClient> {
  try {
    const cliPath = resolveCliPath()
    const client = new CopilotClient({ cliPath, useStdio: false })
    await client.start()
    console.log('[Aide] Copilot SDK client started.')
    return client
  } catch (err: any) {
    console.error('[Aide] Failed to start Copilot SDK:', err.message)
    throw err
  }
}
