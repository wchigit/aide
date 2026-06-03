// ============================================================
// SDK Client Factory — @github/copilot-sdk
// ============================================================

import { CopilotClient } from '@github/copilot-sdk'
import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Resolve the standalone Copilot CLI binary for the current platform.
// We invoke the native binary directly (instead of npm-loader.js, which needs
// Node 24+). The binary lives in a platform-specific package; in a packaged
// app it must be loaded from app.asar.unpacked (see asarUnpack in
// electron-builder.yml) because executables cannot be spawned from inside asar.
//
// Returns the first path that exists, trying the primary location first and
// then known fallbacks. Throws a descriptive error (listing every path tried)
// when the binary cannot be found — that surfaces clearly to the user instead
// of a generic "SDK not initialized" failure.
function resolveCliPath(): string {
  const platformDir = `copilot-${process.platform}-${process.arch}`
  const binName = process.platform === 'win32' ? 'copilot.exe' : 'copilot'
  const segments = ['node_modules', '@github', platformDir, binName]

  // Candidate base directories, in priority order.
  const baseDirs = app.isPackaged
    ? [
        join(process.resourcesPath, 'app.asar.unpacked'),
        // Fallback: some builds keep node_modules beside the asar, unpacked.
        join(process.resourcesPath, 'app'),
        process.resourcesPath
      ]
    : [join(__dirname, '..', '..')]

  const tried = baseDirs.map((base) => join(base, ...segments))
  const found = tried.find((p) => existsSync(p))
  if (found) return found

  throw new Error(
    `Copilot CLI binary not found for ${process.platform}-${process.arch}. ` +
      `Tried:\n${tried.map((p) => `  - ${p}`).join('\n')}`
  )
}

export async function createClient(): Promise<CopilotClient> {
  try {
    const cliPath = resolveCliPath()
    console.log(`[Aide] Resolved Copilot CLI: ${cliPath}`)
    const client = new CopilotClient({ cliPath, useStdio: false })
    await client.start()
    console.log('[Aide] Copilot SDK client started.')
    return client
  } catch (err: any) {
    console.error('[Aide] Failed to start Copilot SDK:', err?.message ?? err)
    throw err
  }
}
