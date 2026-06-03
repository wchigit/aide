// Channel registry — the single source of truth for delivery channels.
//
// A "channel" is a way Aide reaches the user and takes commands on the go
// (WeChat today; Slack / Telegram / Feishu in the future). Both the Settings
// drawer and the onboarding wizard render channels from this list, so adding a
// new channel only requires appending one `ChannelDef` here.
//
// Each channel encapsulates its own connection protocol behind a `useChannel`
// hook returning a `ChannelController`. The generic `ChannelCard` renders any
// channel from its controller, so protocol differences (QR scan vs OAuth) stay
// inside the channel and never leak into the shared UI.

import React, { useState, useEffect, type ReactNode } from 'react'
import { WeChatLogo } from '../brand/icons'
import type { DeliveryTarget } from '@shared/types'

export interface ChannelController {
  connected: boolean
  connecting: boolean
  statusLabel: string
  error: string | null
  /** Channel-specific UI shown below the card body (e.g. a QR code). */
  extraContent?: ReactNode
  connect: () => void
  disconnect: () => void
}

export interface ChannelDef {
  id: DeliveryTarget
  name: string
  description: string
  icon: ReactNode
  /** Tailwind classes for the channel's icon badge. */
  accentClass: string
  /** Hook encapsulating this channel's connection protocol. */
  useChannel: () => ChannelController
}

// === WeChat ===

function useWeChatChannel(): ChannelController {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof window.aide.wechat.getStatus>> | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [qrImg, setQrImg] = useState<string | null>(null)

  useEffect(() => {
    window.aide.wechat.getStatus().then(setStatus)
  }, [])

  useEffect(() => {
    const handler = (event: any) => {
      if (event.type === 'wechat:qrcode') {
        setQrImg(event.imgContent)
      } else if (event.type === 'wechat:login-progress') {
        if (event.stage === 'confirmed') {
          setQrImg(null)
          setConnecting(false)
          window.aide.wechat.getStatus().then(setStatus)
        } else if (event.stage === 'expired' || event.stage === 'timeout') {
          setQrImg(null)
          setConnecting(false)
        }
      }
    }
    return window.aideEvents.on(handler)
  }, [])

  const connect = async () => {
    setConnecting(true)
    try {
      const result = await window.aide.wechat.connect()
      setStatus(result)
      if (result.connection !== 'connected' || result.lastError) {
        setQrImg(null)
        setConnecting(false)
      }
    } catch {
      setConnecting(false)
      window.aide.wechat.getStatus().then(setStatus)
    }
  }

  const disconnect = async () => {
    const result = await window.aide.wechat.disconnect()
    setStatus(result)
    setQrImg(null)
  }

  const connected = status?.connection === 'connected'

  return {
    connected,
    connecting,
    statusLabel: connected
      ? `Connected${status?.monitorActive ? ' · listening' : ''}`
      : connecting ? 'Waiting for scan…' : 'Not connected',
    error: status?.lastError ?? null,
    extraContent: qrImg ? (
      <div className="mt-4 flex flex-col items-center gap-2 p-4 rounded-lg bg-surface-2 border border-edge">
        <img src={qrImg} alt="WeChat QR Code" className="w-48 h-48 rounded-md" />
        <p className="text-[11px] text-text-tertiary">Scan the QR code with WeChat to sign in</p>
      </div>
    ) : null,
    connect,
    disconnect,
  }
}

// === Registry ===

export const CHANNELS: ChannelDef[] = [
  {
    id: 'wechat',
    name: 'WeChat',
    description: 'Report delivery · Task notifications · Remote chat',
    icon: <WeChatLogo size={18} />,
    accentClass: 'bg-[#07C160] text-white',
    useChannel: useWeChatChannel,
  },
]

// === Generic card ===

/**
 * Renders a single channel from its controller. Used by both the Settings
 * drawer and the onboarding wizard so the two stay in sync automatically.
 */
export function ChannelCard({ channel }: { channel: ChannelDef }) {
  const ctrl = channel.useChannel()

  return (
    <div className="p-4 rounded-xl bg-surface-0 border border-edge">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${channel.accentClass}`}>
            {channel.icon}
          </div>
          <div>
            <p className="text-[13px] font-medium text-text-primary">{channel.name}</p>
            <p className="text-[12px] text-text-tertiary mt-0.5">{channel.description}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className={`w-[6px] h-[6px] rounded-full ${ctrl.connected ? 'bg-success' : 'bg-text-tertiary'}`} />
              <span className={`text-[11px] ${ctrl.connected ? 'text-success' : 'text-text-tertiary'}`}>
                {ctrl.statusLabel}
              </span>
            </div>
            {ctrl.error && <p className="text-[11px] text-danger mt-1">{ctrl.error}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ctrl.connected ? (
            <button
              onClick={ctrl.disconnect}
              className="h-7 px-3 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors bg-danger/10 text-danger hover:bg-danger/15 border border-danger/15"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={ctrl.connect}
              className="h-7 px-3 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors bg-surface-2 text-text-secondary hover:bg-surface-3 border border-edge"
            >
              {ctrl.connecting ? 'Scanning…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {ctrl.extraContent}
    </div>
  )
}
