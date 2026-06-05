// ============================================================
// SDK Client Factory — @github/copilot-sdk
// ============================================================

import { CopilotClient, RuntimeConnection } from '@github/copilot-sdk'
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

  // npm may install the platform binary either hoisted at the top level or
  // nested under the @github/copilot loader package. Try both layouts.
  const layouts = [
    ['node_modules', '@github', platformDir, binName],
    ['node_modules', '@github', 'copilot', 'node_modules', '@github', platformDir, binName]
  ]

  // Candidate base directories, in priority order.
  const baseDirs = app.isPackaged
    ? [
        join(process.resourcesPath, 'app.asar.unpacked'),
        // Fallback: some builds keep node_modules beside the asar, unpacked.
        join(process.resourcesPath, 'app'),
        process.resourcesPath
      ]
    : [join(__dirname, '..', '..')]

  const tried: string[] = []
  for (const base of baseDirs) {
    for (const segments of layouts) {
      const candidate = join(base, ...segments)
      tried.push(candidate)
      if (existsSync(candidate)) return candidate
    }
  }

  throw new Error(
    `Copilot CLI binary not found for ${process.platform}-${process.arch}. ` +
      `Tried:\n${tried.map((p) => `  - ${p}`).join('\n')}`
  )
}

export async function createClient(): Promise<CopilotClient> {
  try {
    const cliPath = resolveCliPath()
    console.log(`[Aide] Resolved Copilot CLI: ${cliPath}`)
    // SDK 1.0 replaced `{ cliPath, useStdio }` with the RuntimeConnection API.
    // forTcp preserves the previous behavior (useStdio: false = TCP transport),
    // spawning the resolved CLI binary and connecting over a loopback socket.
    const client = new CopilotClient({ connection: RuntimeConnection.forTcp({ path: cliPath }) })
    await client.start()
    console.log('[Aide] Copilot SDK client started.')
    return client
  } catch (err: any) {
    console.error('[Aide] Failed to start Copilot SDK:', err?.message ?? err)
    throw err
  }
}
