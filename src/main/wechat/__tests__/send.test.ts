/**
 * Unit tests for WeChat send module.
 * Run with: npx vitest run src/main/wechat/__tests__/send.test.ts
 */

import { describe, it, expect } from 'vitest'
import { splitText } from '../messaging'

describe('splitText', () => {
  it('returns single chunk for short text', () => {
    const result = splitText('Hello World')
    expect(result).toEqual(['Hello World'])
  })

  it('returns single chunk at exact boundary', () => {
    const text = 'A'.repeat(4000)
    const result = splitText(text, 4000)
    expect(result).toEqual([text])
  })

  it('splits at paragraph boundary (double newline)', () => {
    const first = 'A'.repeat(3500)
    const second = 'B'.repeat(1000)
    const text = first + '\n\n' + second
    const result = splitText(text, 4000)
    expect(result.length).toBe(2)
    expect(result[0]).toBe(first)
    expect(result[1]).toBe(second)
  })

  it('falls back to single newline when no paragraph break', () => {
    const first = 'A'.repeat(3500)
    const second = 'B'.repeat(1000)
    const text = first + '\n' + second
    const result = splitText(text, 4000)
    expect(result.length).toBe(2)
    expect(result[0]).toBe(first)
  })

  it('hard-cuts when no natural boundary exists', () => {
    const text = 'A'.repeat(8000)
    const result = splitText(text, 4000)
    expect(result.length).toBe(2)
    expect(result[0].length).toBe(4000)
    expect(result[1].length).toBe(4000)
  })

  it('handles empty string', () => {
    const result = splitText('')
    expect(result).toEqual([''])
  })

  it('handles multi-chunk with mixed boundaries', () => {
    // 3 paragraphs, each 2000 chars, separated by double newlines
    const para = 'X'.repeat(2000)
    const text = [para, para, para].join('\n\n')
    const result = splitText(text, 4000)
    expect(result.length).toBeGreaterThanOrEqual(2)
    // All X characters preserved across chunks
    const totalX = result.join('').replace(/[^X]/g, '').length
    expect(totalX).toBe(6000)
  })

  it('preserves content integrity (no data loss)', () => {
    const text = 'Hello World! This is a test.\n\nSecond paragraph here.\n\nThird one.'
    const result = splitText(text, 30)
    const joined = result.join('\n\n')
    // Every original word should appear in the output
    expect(joined).toContain('Hello World')
    expect(joined).toContain('Second paragraph')
    expect(joined).toContain('Third one')
  })
})
