import { createRequire } from 'module'

// Use Node's createRequire to bypass vite's bundler
// nut.js has native bindings that don't work with vite's commonjs plugin
const require = createRequire(import.meta.url)
const nutjs = require('@nut-tree-fork/nut-js') as typeof import('@nut-tree-fork/nut-js')
const { mouse, keyboard, screen, Point, Button, Key } = nutjs

// ============================================================
// Desktop Automation Module — nut.js-based desktop control
// ============================================================

// Configure nut.js defaults
mouse.config.autoDelayMs = 100
keyboard.config.autoDelayMs = 50

/**
 * Move mouse to absolute screen coordinates
 */
export async function moveMouse(x: number, y: number): Promise<void> {
  await mouse.move([new Point(x, y)])
}

/**
 * Click at current mouse position or specified coordinates
 */
export async function click(x?: number, y?: number, button: 'left' | 'right' = 'left'): Promise<void> {
  if (x !== undefined && y !== undefined) {
    await mouse.move([new Point(x, y)])
  }
  const btn = button === 'right' ? Button.RIGHT : Button.LEFT
  await mouse.click(btn)
}

/**
 * Double-click at current position or specified coordinates
 */
export async function doubleClick(x?: number, y?: number): Promise<void> {
  if (x !== undefined && y !== undefined) {
    await mouse.move([new Point(x, y)])
  }
  await mouse.doubleClick(Button.LEFT)
}

/**
 * Right-click at current position or specified coordinates
 */
export async function rightClick(x?: number, y?: number): Promise<void> {
  await click(x, y, 'right')
}

/**
 * Drag from one point to another
 */
export async function drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
  await mouse.move([new Point(fromX, fromY)])
  await mouse.pressButton(Button.LEFT)
  await mouse.move([new Point(toX, toY)])
  await mouse.releaseButton(Button.LEFT)
}

/**
 * Scroll the mouse wheel
 */
export async function scroll(amount: number, direction: 'up' | 'down' = 'down'): Promise<void> {
  const scrollAmount = direction === 'up' ? -amount : amount
  await mouse.scrollDown(scrollAmount)
}

/**
 * Type text using keyboard
 */
export async function typeText(text: string): Promise<void> {
  await keyboard.type(text)
}

/**
 * Press a single key
 */
export async function pressKey(key: string): Promise<void> {
  const keyMap: Record<string, Key> = {
    'enter': Key.Enter,
    'return': Key.Enter,
    'tab': Key.Tab,
    'escape': Key.Escape,
    'esc': Key.Escape,
    'backspace': Key.Backspace,
    'delete': Key.Delete,
    'space': Key.Space,
    'up': Key.Up,
    'down': Key.Down,
    'left': Key.Left,
    'right': Key.Right,
    'home': Key.Home,
    'end': Key.End,
    'pageup': Key.PageUp,
    'pagedown': Key.PageDown,
    'f1': Key.F1,
    'f2': Key.F2,
    'f3': Key.F3,
    'f4': Key.F4,
    'f5': Key.F5,
    'f6': Key.F6,
    'f7': Key.F7,
    'f8': Key.F8,
    'f9': Key.F9,
    'f10': Key.F10,
    'f11': Key.F11,
    'f12': Key.F12
  }

  const k = keyMap[key.toLowerCase()]
  if (k) {
    await keyboard.pressKey(k)
    await keyboard.releaseKey(k)
  } else {
    // Single character
    await keyboard.type(key)
  }
}

/**
 * Press a keyboard shortcut (e.g., Ctrl+C, Cmd+V)
 */
export async function pressShortcut(shortcut: string): Promise<void> {
  const parts = shortcut.toLowerCase().split('+').map(p => p.trim())
  const modifiers: Key[] = []
  let mainKey: Key | null = null

  const modifierMap: Record<string, Key> = {
    'ctrl': Key.LeftControl,
    'control': Key.LeftControl,
    'alt': Key.LeftAlt,
    'shift': Key.LeftShift,
    'cmd': Key.LeftSuper,
    'command': Key.LeftSuper,
    'meta': Key.LeftSuper,
    'win': Key.LeftSuper
  }

  const keyMap: Record<string, Key> = {
    'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E,
    'f': Key.F, 'g': Key.G, 'h': Key.H, 'i': Key.I, 'j': Key.J,
    'k': Key.K, 'l': Key.L, 'm': Key.M, 'n': Key.N, 'o': Key.O,
    'p': Key.P, 'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T,
    'u': Key.U, 'v': Key.V, 'w': Key.W, 'x': Key.X, 'y': Key.Y,
    'z': Key.Z,
    '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3,
    '4': Key.Num4, '5': Key.Num5, '6': Key.Num6, '7': Key.Num7,
    '8': Key.Num8, '9': Key.Num9,
    'enter': Key.Enter, 'tab': Key.Tab, 'escape': Key.Escape,
    'space': Key.Space, 'backspace': Key.Backspace, 'delete': Key.Delete,
    'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4,
    'f5': Key.F5, 'f6': Key.F6, 'f7': Key.F7, 'f8': Key.F8,
    'f9': Key.F9, 'f10': Key.F10, 'f11': Key.F11, 'f12': Key.F12
  }

  for (const part of parts) {
    if (modifierMap[part]) {
      modifiers.push(modifierMap[part])
    } else if (keyMap[part]) {
      mainKey = keyMap[part]
    }
  }

  if (!mainKey) {
    throw new Error(`Unknown key in shortcut: ${shortcut}`)
  }

  // Press modifiers
  for (const mod of modifiers) {
    await keyboard.pressKey(mod)
  }

  // Press main key
  await keyboard.pressKey(mainKey)
  await keyboard.releaseKey(mainKey)

  // Release modifiers in reverse order
  for (const mod of modifiers.reverse()) {
    await keyboard.releaseKey(mod)
  }
}

/**
 * Take a screenshot of the entire screen
 */
export async function takeScreenshot(): Promise<Buffer> {
  const image = await screen.grab()
  // Convert to PNG buffer
  const { data, width, height } = image
  // Note: nut.js returns raw RGBA data, need to encode to PNG
  // For simplicity, return raw data info - real implementation would use sharp or similar
  return Buffer.from(data)
}

/**
 * Get screen dimensions
 */
export async function getScreenSize(): Promise<{ width: number; height: number }> {
  const width = await screen.width()
  const height = await screen.height()
  return { width, height }
}

/**
 * Get current mouse position
 */
export async function getMousePosition(): Promise<{ x: number; y: number }> {
  const pos = await mouse.getPosition()
  return { x: pos.x, y: pos.y }
}

/**
 * Wait for a specified duration (in milliseconds)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if desktop automation is available
 * (nut.js requires a display)
 */
export function isDesktopAvailable(): boolean {
  // In headless CI environments, this would fail
  // Could add more sophisticated detection
  return process.env.DISPLAY !== undefined || process.platform === 'win32' || process.platform === 'darwin'
}
