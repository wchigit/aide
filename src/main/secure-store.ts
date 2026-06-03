/**
 * Secure config storage using Electron's safeStorage (DPAPI / Keychain / libsecret).
 * Falls back to plain JSON if safeStorage is unavailable (e.g., CI, Linux without keyring).
 */

import { safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Save a config object encrypted to disk.
 */
export function saveSecure<T>(filePath: string, data: T): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  const json = JSON.stringify(data)

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json)
    fs.writeFileSync(filePath, encrypted)
  } else {
    // Fallback: plain JSON (same as before)
    fs.writeFileSync(filePath, json, 'utf-8')
  }
}

/**
 * Load and decrypt a config object from disk.
 */
export function loadSecure<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null

    const raw = fs.readFileSync(filePath)

    let json: string
    if (safeStorage.isEncryptionAvailable()) {
      try {
        json = safeStorage.decryptString(raw)
      } catch {
        // File might be legacy plain JSON — try parsing directly
        json = raw.toString('utf-8')
      }
    } else {
      json = raw.toString('utf-8')
    }

    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/**
 * Delete a secure config file.
 */
export function deleteSecure(filePath: string): void {
  try { fs.unlinkSync(filePath) } catch { /* ignore */ }
}
