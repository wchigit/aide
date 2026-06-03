import { useState } from 'react'
import { SectionHeading } from './Features'
import { useReveal } from '../useReveal'
import { Logo } from './Logo'

const tabs = [
  {
    id: 'triage',
    label: 'Triage',
    title: 'A board that fills itself',
    body: 'Tasks arrive pre-sorted by urgency and source. You scan once and decide.',
  },
  {
    id: 'chat',
    label: 'Work together',
    title: 'Talk it through, then act',
    body: 'Ask Aide to draft, summarize, or dig in. It works with full context and shows you before sending.',
  },
  {
    id: 'memory',
    label: 'Memory',
    title: 'It remembers so you don\u2019t',
    body: 'People, projects, decisions, preferences — kept and reused, never re-explained.',
  },
]

export function Preview() {
  const [active, setActive] = useState('triage')
  const { ref, shown } = useReveal<HTMLDivElement>()
  const current = tabs.find((t) => t.id === active)!

  return (
    <section id="preview" className="relative px-4 py-28 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          kicker="Inside Aide"
          title="Designed to feel calm, not crowded"
          subtitle="A focused, native desktop app that gets out of your way."
        />

        {/* Tabs */}
        <div className="mt-10 flex justify-center">
          <div className="glass inline-flex gap-1 rounded-full p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-all ${
                  active === t.id
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={ref}
          className={`reveal ${shown ? 'in' : ''} mt-10 grid items-center gap-10 md:grid-cols-2`}
        >
          <div className="order-2 md:order-1">
            <h3 className="text-[24px] font-bold tracking-tight text-ink-900">{current.title}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-500">{current.body}</p>
            <ul className="mt-6 space-y-3">
              {[
                'Native performance, instant launch',
                'Keyboard-first navigation',
                'Your data stays on your machine',
              ].map((p) => (
                <li key={p} className="flex items-center gap-3 text-[14.5px] text-ink-700">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/12 text-brand-600">
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m20 6-11 11-5-5" />
                    </svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 md:order-2">
            <PreviewPane active={active} />
          </div>
        </div>
      </div>
    </section>
  )
}

function PreviewPane({ active }: { active: string }) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-[20px] p-1">
      <div className="rounded-[16px] bg-[#fafafa] p-4">
        {active === 'triage' && <TriagePane />}
        {active === 'chat' && <ChatPane />}
        {active === 'memory' && <MemoryPane />}
      </div>
    </div>
  )
}

// Priority tag matching the real app (P0 solid indigo / P1 sage / P2 grey)
function Pri({ p }: { p: 'P0' | 'P1' | 'P2' }) {
  const styles: Record<string, string> = {
    P0: 'bg-[oklch(0.35_0.05_270)] text-white',
    P1: 'bg-[oklch(0.93_0.03_255)] text-[oklch(0.42_0.08_255)]',
    P2: 'bg-[oklch(0.95_0_0)] text-[oklch(0.55_0_0)]',
  }
  return (
    <span className={`shrink-0 rounded px-[4px] py-[1px] text-[9px] font-semibold leading-none ${styles[p]}`}>
      {p}
    </span>
  )
}

// Triage = the real dashboard task list (section bar + rows)
function TriagePane() {
  const items: { p: 'P0' | 'P1' | 'P2'; t: string; s: string; m: string; working?: boolean }[] = [
    { p: 'P0', t: 'Reply to Q3 budget thread', s: 'Email', m: 'Due today' },
    { p: 'P1', t: 'Review PR #482 — auth refactor', s: 'GitHub', m: '4 files' },
    { p: 'P1', t: 'Summarize design sync', s: 'Teams', m: '42 messages', working: true },
    { p: 'P2', t: 'Prep notes for 1:1', s: 'Calendar', m: 'in 45m' },
  ]
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="h-[13px] w-[3px] rounded-full bg-[oklch(55%_0.18_260)]" />
        <span className="text-[12.5px] font-semibold text-[oklch(18%_0.01_270)]">New tasks</span>
        <span className="rounded-md bg-[oklch(55%_0.18_260_/_0.1)] px-1.5 py-[1px] text-[10.5px] font-medium text-[oklch(55%_0.18_260)]">4</span>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.t}
            className="rounded-xl border border-[oklch(88%_0.006_270)] bg-white px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <Pri p={it.p} />
              {it.working && (
                <span className="relative shrink-0">
                  <span className="block h-[5px] w-[5px] rounded-full bg-[oklch(55%_0.18_260)]" />
                  <span className="absolute inset-0 h-[5px] w-[5px] animate-pulse-dot rounded-full bg-[oklch(55%_0.18_260)]" />
                </span>
              )}
              <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[oklch(18%_0.01_270)]">{it.t}</p>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10.5px] text-[oklch(58%_0.01_270)]">
              <span>{it.s}</span>
              <span className="ml-auto">{it.m}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Work together = the real chat: agent = avatar + plain text, user = muted accent tint
function ChatPane() {
  return (
    <div className="space-y-3.5">
      {/* user message */}
      <div className="flex flex-row-reverse">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-[oklch(55%_0.18_260_/_0.12)] px-4 py-2.5 text-[12.5px] leading-[1.6] text-[oklch(18%_0.01_270)]">
          Summarize the design sync and list the decisions.
        </div>
      </div>
      {/* agent message — no bubble, just avatar + text */}
      <div className="flex gap-2.5">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-sm">
          <Logo size={13} />
        </div>
        <div className="min-w-0 text-[12.5px] leading-[1.7] text-[oklch(40%_0.01_270)]">
          <p className="font-semibold text-[oklch(18%_0.01_270)]">Three decisions from the sync:</p>
          <ul className="mt-1.5 space-y-1">
            <li>· Ship the glass nav in v0.4</li>
            <li>· Drop the sidebar on mobile</li>
            <li>· Revisit onboarding copy on Friday</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// Memory = accumulated context, styled with real surface tokens
function MemoryPane() {
  const items = [
    { k: 'People', v: 'Priya leads finance · prefers bullet replies' },
    { k: 'Project', v: 'Aide v0.4 — glass redesign, due next sprint' },
    { k: 'Style', v: 'Warm but concise · signs off as "— H"' },
    { k: 'Routine', v: 'Reviews PRs right after standup' },
  ]
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div
          key={it.k}
          className="rounded-xl border border-[oklch(88%_0.006_270)] bg-white px-3 py-2.5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded-md bg-[oklch(55%_0.18_260_/_0.1)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[oklch(55%_0.18_260)]">
              {it.k}
            </span>
            <p className="text-[12.5px] leading-relaxed text-[oklch(40%_0.01_270)]">{it.v}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
