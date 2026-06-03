import React, { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { UpdateState, AideEvent } from '@shared/types'

/**
 * A top-of-window banner that appears once a new version has finished
 * downloading, so the user can restart & install without digging into
 * Settings. It only shows for a genuinely ready update, so there's no
 * manual dismiss — restarting clears it.
 */
export function UpdateBanner() {
  const [state, setState] = useState<UpdateState | null>(null)

  useEffect(() => {
    window.aide?.updates?.getState().then(setState).catch(() => {})
    const unsub = window.aideEvents.on((event: AideEvent) => {
      if (event.type === 'update:state') setState(event.state)
    })
    return unsub
  }, [])

  if (!state) return null
  if (state.status !== 'downloaded' && state.status !== 'installing') return null

  const installing = state.status === 'installing'

  const install = () => {
    setState(s => (s ? { ...s, status: 'installing' } : s))
    window.aide.updates.install()
  }

  // The frameless window's native controls overlay the top-right (Windows) or
  // top-left (macOS). Reserve room so the banner's buttons never sit under them,
  // and make the bar itself draggable like the rest of the title-bar row.
  const isWin = navigator.userAgent.includes('Windows')
  const isMac = navigator.userAgent.includes('Mac')

  return (
    <div
      className="drag-region flex items-center gap-2.5 h-[52px] px-4 bg-surface-1 border-b border-edge"
      style={{ paddingRight: isWin ? 148 : 16, paddingLeft: isMac ? 88 : 16 }}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      <span className="text-[12px] text-text-secondary min-w-0 truncate">
        {installing
          ? 'Restarting to install…'
          : <>A new version <span className="text-text-primary font-medium">{state.latestVersion}</span> is ready.</>}
      </span>
      <div className="no-drag flex items-center gap-1">
        <button
          onClick={install}
          disabled={installing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-accent hover:bg-accent/10 disabled:opacity-60 transition-colors"
        >
          {installing && <RefreshCw size={12} className="animate-spin" />}
          {installing ? 'Restarting…' : 'Restart to update'}
        </button>
      </div>
    </div>
  )
}
