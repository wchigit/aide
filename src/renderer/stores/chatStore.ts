import { create } from 'zustand'
import type { ChatMessage, PendingAction, ToolCallRecord } from '@shared/types'

/** One step in the live (in-progress) turn: streamed narration or a tool call.
 *  Kept in arrival order so the UI can interleave text and tools chronologically,
 *  matching how the turn is later persisted as a foldable process trail. */
export type LiveStep =
  | { kind: 'text'; content: string }
  | { kind: 'tool'; record: ToolCallRecord }

interface ChatStore {
  messages: ChatMessage[]
  liveSteps: LiveStep[]
  isStreaming: boolean
  loading: boolean
  modifyDraft: string | null // For the modify flow (#36)

  fetchHistory: (taskId: string | null) => Promise<void>
  sendMessage: (message: string, taskId: string | null, attachments?: { name: string; type: string; dataUrl: string }[]) => Promise<void>
  stopStream: () => Promise<void>
  appendStreamDelta: (delta: string) => void
  endStream: () => void
  addMessage: (msg: ChatMessage) => void
  addPendingAction: (action: PendingAction) => void
  updateToolCall: (record: ToolCallRecord) => void
  confirmAction: (actionId: string, decision: 'confirm' | 'modify' | 'cancel', modification?: string) => Promise<void>
  setModifyDraft: (text: string | null) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  liveSteps: [],
  isStreaming: false,
  loading: false,
  modifyDraft: null,

  fetchHistory: async (taskId) => {
    set({ loading: true })
    const messages = await window.aide.chat.getHistory(taskId)
    // Atomic swap: replace messages and clear the live timeline in the SAME
    // commit. Clearing liveSteps *before* the async DB read returned would make
    // the just-finished turn flash out of existence for a few frames ("还没看清
    // 就没了"). Swapping together means the persisted reply takes over seamlessly.
    set({ messages, loading: false, isStreaming: false, liveSteps: [] })
  },

  sendMessage: async (message, taskId, attachments) => {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const userMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      taskId
    }
    set(state => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      liveSteps: []
    }))

    try {
      await window.aide.chat.send(message, taskId, attachments)
      // Don't append here — stream-end event triggers fetchHistory which gets the final state from DB
    } catch (err) {
      // On error, add error message
      set(state => ({
        messages: [...state.messages, {
          id: `err-${Date.now()}`,
          role: 'agent' as const,
          content: `⚠️ ${err instanceof Error ? err.message : 'Request failed'}`,
          timestamp: new Date().toISOString(),
          taskId
        }],
        isStreaming: false,
        liveSteps: []
      }))
    }
  },

  stopStream: async () => {
    await window.aide.chat.stopStream()
    set({ isStreaming: false, liveSteps: [] })
  },

  appendStreamDelta: (delta) => {
    set(state => {
      const steps = state.liveSteps.slice()
      const last = steps[steps.length - 1]
      if (last && last.kind === 'text') {
        steps[steps.length - 1] = { kind: 'text', content: last.content + delta }
      } else {
        steps.push({ kind: 'text', content: delta })
      }
      return { liveSteps: steps }
    })
  },

  endStream: () => {
    set({ isStreaming: false })
  },

  addMessage: (msg) => {
    set(state => ({ messages: [...state.messages, msg] }))
  },

  updateToolCall: (record) => {
    set(state => {
      const steps = state.liveSteps.slice()
      const idx = steps.findIndex(s => s.kind === 'tool' && s.record.id === record.id)
      if (idx >= 0) {
        const prev = steps[idx] as { kind: 'tool'; record: ToolCallRecord }
        steps[idx] = { kind: 'tool', record: { ...prev.record, ...record } }
      } else {
        steps.push({ kind: 'tool', record })
      }
      return { liveSteps: steps }
    })
  },

  addPendingAction: (action) => {
    // Add as a new action message at the bottom (not attached to old messages)
    const actionMsg: ChatMessage = {
      id: `action-${action.id}`,
      role: 'agent',
      content: '',
      timestamp: new Date().toISOString(),
      taskId: get().messages[get().messages.length - 1]?.taskId || null,
      pendingAction: action
    }
    set(state => ({ messages: [...state.messages, actionMsg] }))
  },

  confirmAction: async (actionId, decision, modification) => {
    if (decision === 'modify') {
      // Set draft for user to edit, then they'll send it as new message
      const pending = get().messages.find(m => m.pendingAction?.id === actionId)
      const desc = pending?.pendingAction?.description || ''
      set({ modifyDraft: modification || desc })
    }
    await window.aide.chat.confirmAction(actionId, decision, modification)
    // Update the action status in local state
    set(state => ({
      messages: state.messages.map(m => {
        if (m.pendingAction?.id === actionId) {
          return { ...m, pendingAction: { ...m.pendingAction, status: decision === 'confirm' ? 'confirmed' as const : 'cancelled' as const } }
        }
        return m
      })
    }))
  },

  setModifyDraft: (text) => set({ modifyDraft: text })
}))
