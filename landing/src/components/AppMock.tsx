import { Logo } from './Logo'

/**
 * A faithful, 1:1 recreation of the real Aide desktop UI:
 * a light sidebar (task lists) + a dashboard with section bars and task cards.
 * Tokens mirror the app's design system (surface / edge / text / accent).
 * Note: all Tailwind classes are written as complete literals so the JIT
 * compiler can detect them — do not interpolate arbitrary values.
 */

// ── Source icons (mirror the lucide set used in the app) ──
const ico = {
  width: 11,
  height: 11,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
function MailIcon() {
  return (
    <svg {...ico}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}
function GithubIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.27 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}
function TeamsIcon() {
  return (
    <svg {...ico}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg {...ico}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

type Src = 'email' | 'github' | 'teams' | 'calendar'
const srcIcon: Record<Src, JSX.Element> = {
  email: <MailIcon />,
  github: <GithubIcon />,
  teams: <TeamsIcon />,
  calendar: <CalendarIcon />,
}
const srcLabel: Record<Src, string> = {
  email: 'Email',
  github: 'GitHub',
  teams: 'Teams',
  calendar: 'Calendar',
}

function Priority({ p }: { p: 'P0' | 'P1' | 'P2' }) {
  const styles: Record<string, string> = {
    P0: 'bg-[oklch(0.35_0.05_270)] text-white',
    P1: 'bg-[oklch(0.93_0.03_160)] text-[oklch(0.38_0.05_160)]',
    P2: 'bg-[oklch(0.95_0_0)] text-[oklch(0.55_0_0)]',
  }
  return (
    <span
      className={`mr-1 inline-block rounded px-[5px] py-[1px] align-middle text-[10px] font-semibold leading-[1.4] ${styles[p]}`}
    >
      {p}
    </span>
  )
}

export function AppMock() {
  return (
    <div className="glass-panel grid grid-cols-[148px_1fr] overflow-hidden rounded-[18px] bg-[#fafafa] text-left sm:grid-cols-[200px_1fr]">
      {/* ───────── Sidebar ───────── */}
      <aside className="flex flex-col border-r border-[oklch(88%_0.006_270)] bg-[oklch(96%_0.003_270)]">
        {/* header */}
        <div className="flex h-[46px] items-center justify-between px-3.5">
          <div className="flex items-center gap-2">
            <Logo size={20} className="rounded-[5px] shadow-sm" />
            <span className="text-[12.5px] font-semibold tracking-tight text-[oklch(18%_0.01_270)]">Aide</span>
          </div>
          <div className="hidden items-center gap-1 text-[10.5px] text-[oklch(58%_0.01_270)] sm:flex">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h6M14 18h6" />
              <circle cx="15" cy="6" r="1.7" />
              <circle cx="9" cy="12" r="1.7" />
              <circle cx="12" cy="18" r="1.7" />
            </svg>
            Manage
          </div>
        </div>

        {/* New tasks */}
        <div className="px-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-[oklch(58%_0.01_270)]">New tasks</span>
            <span className="rounded-full bg-[oklch(55%_0.18_260_/_0.1)] px-1.5 py-[1px] text-[9.5px] font-medium text-[oklch(55%_0.18_260)]">2</span>
          </div>
          <SidebarItem p="P0" title="Reply to Q3 budget thread" isNew />
          <SidebarItem p="P1" title="Review PR #482" isNew />
        </div>

        {/* In progress */}
        <div className="mt-1 px-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-[oklch(58%_0.01_270)]">In progress</span>
            <span className="text-[10px] text-[oklch(58%_0.01_270)]">2</span>
          </div>
          <SidebarItem p="P1" title="Summarize design sync" />
          <SidebarItem p="P2" title="Prep notes for 1:1" />
        </div>

        {/* bottom CTA */}
        <div className="mt-auto px-2.5 pb-3 pt-3">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[oklch(55%_0.18_260_/_0.2)] bg-[oklch(55%_0.18_260_/_0.03)] px-3 py-2">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="oklch(55% 0.18 260)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
            </svg>
            <span className="text-[11.5px] font-medium text-[oklch(40%_0.01_270)]">Tell Aide what you need</span>
          </div>
        </div>
      </aside>

      {/* ───────── Dashboard ───────── */}
      <main className="flex min-w-0 flex-col bg-[#fafafa]">
        {/* Overview header */}
        <div className="flex h-[46px] items-center border-b border-[oklch(88%_0.006_270)] px-5">
          <span className="text-[12px] font-medium text-[oklch(40%_0.01_270)]">Overview</span>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* New tasks section */}
          <section>
            <SectionBar title="New tasks" count={2} bar="bg-[oklch(55%_0.18_260)]" countCls="bg-[oklch(55%_0.18_260_/_0.1)] text-[oklch(55%_0.18_260)]" />
            <div className="mt-2.5 grid max-w-[640px] grid-cols-1 gap-2.5 lg:grid-cols-2">
              <TaskCard
                p="P0"
                title="Reply to Q3 budget thread"
                desc="Priya needs the revised figures before the board sync — the draft reply is ready for your review."
                src="email"
                due="Due today"
                time="8m"
              />
              <TaskCard
                p="P1"
                title="Review PR #482 — auth refactor"
                desc="4 files changed across the session layer; I’ve summarized the risky bits to look at first."
                src="github"
                time="1h"
              />
            </div>
          </section>

          {/* In progress section */}
          <section>
            <SectionBar title="In progress" count={2} bar="bg-[oklch(62%_0.16_80)]" countCls="bg-[oklch(93%_0.004_270)] text-[oklch(40%_0.01_270)]" />
            <div className="mt-2.5 grid max-w-[640px] grid-cols-1 gap-2.5 lg:grid-cols-2">
              <TaskCard
                p="P1"
                title="Summarize design sync"
                desc="42 messages across the thread — pulling out the decisions and the open questions for you."
                src="teams"
                time="2h"
                tint="bg-[oklch(0.98_0.005_160)] border-l-[oklch(0.60_0.06_160)]"
              />
              <TaskCard
                p="P2"
                title="Prep notes for 1:1"
                desc="Pulling last week’s threads and open items so you walk in with everything in one place."
                src="calendar"
                due="in 45m"
                time="3h"
                tint="bg-white border-l-[oklch(0.80_0_0)]"
              />
            </div>
          </section>

          {/* Completed section — timeline */}
          <section>
            <div className="flex items-center justify-between">
              <SectionBar title="Completed" count={3} bar="bg-[oklch(52%_0.16_155)]" countCls="bg-[oklch(93%_0.004_270)] text-[oklch(58%_0.01_270)]" />
              <div className="flex items-center gap-1 text-[10.5px]">
                <span className="rounded-md bg-[oklch(93%_0.004_270)] px-2 py-[3px] font-medium text-[oklch(18%_0.01_270)]">This week</span>
                <span className="px-2 py-[3px] text-[oklch(58%_0.01_270)]">This month</span>
              </div>
            </div>
            <div className="relative mt-3 pl-6">
              {/* timeline line */}
              <div className="absolute left-[7px] top-2 bottom-1 w-px bg-[oklch(88%_0.006_270)]" />
              {/* node */}
              <div className="absolute left-[4px] top-[5px] h-[7px] w-[7px] rounded-full border-2 border-[#fafafa] bg-[oklch(52%_0.16_155_/_0.6)]" />
              <div className="mb-2 flex items-baseline gap-2.5">
                <span className="text-[11.5px] font-semibold text-[oklch(40%_0.01_270)]">Today</span>
                <span className="text-[10.5px] font-medium text-[oklch(40%_0.01_270)]">3 completed</span>
              </div>
              <div className="space-y-[3px]">
                <DoneRow title="Send sprint update to the team" src="email" time="09:12" />
                <DoneRow title="Triage incoming GitHub issues" src="github" time="10:48" />
                <DoneRow title="Confirm Thursday design review" src="calendar" time="13:30" />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function DoneRow({ title, src, time }: { title: string; src: Src; time: string }) {
  return (
    <div className="-mx-1 flex items-center gap-2.5 rounded-lg px-2 py-[5px]">
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="oklch(52% 0.16 155 / 0.5)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="m20 6-11 11-5-5" />
      </svg>
      <span className="flex-1 truncate text-[12px] text-[oklch(58%_0.01_270)]">{title}</span>
      <span className="shrink-0 text-[oklch(58%_0.01_270)] opacity-50">{srcIcon[src]}</span>
      <span className="shrink-0 text-[10.5px] tabular-nums text-[oklch(58%_0.01_270)] opacity-60">{time}</span>
    </div>
  )
}

function SidebarItem({
  p,
  title,
  isNew,
}: {
  p: 'P0' | 'P1' | 'P2'
  title: string
  isNew?: boolean
}) {
  const tag: Record<string, string> = {
    P0: 'bg-[oklch(0.35_0.05_270)] text-white',
    P1: 'bg-[oklch(0.93_0.03_160)] text-[oklch(0.38_0.05_160)]',
    P2: 'bg-[oklch(0.95_0_0)] text-[oklch(0.55_0_0)]',
  }
  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-[6px]">
      <span className={`shrink-0 rounded px-[4px] py-[1px] text-[9px] font-semibold leading-none ${tag[p]}`}>{p}</span>
      <span className="flex-1 truncate text-[12px] leading-[1.4] text-[oklch(40%_0.01_270)]">{title}</span>
      {isNew && <span className="h-[5px] w-[5px] shrink-0 animate-pulse-dot rounded-full bg-[oklch(55%_0.18_260)]" />}
    </div>
  )
}

function SectionBar({
  title,
  count,
  bar,
  countCls,
}: {
  title: string
  count: number
  bar: string
  countCls: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-[13px] w-[3px] rounded-full ${bar}`} />
      <h3 className="text-[12.5px] font-semibold tracking-tight text-[oklch(18%_0.01_270)]">{title}</h3>
      <span className={`min-w-[18px] rounded-md px-1.5 py-[1px] text-center text-[10.5px] font-medium ${countCls}`}>{count}</span>
    </div>
  )
}

function TaskCard({
  p,
  title,
  desc,
  src,
  due,
  time,
  tint,
}: {
  p: 'P0' | 'P1' | 'P2'
  title: string
  desc?: string
  src: Src
  due?: string
  time: string
  tint?: string
}) {
  const base = tint
    ? `border border-l-2 border-[oklch(88%_0.006_270)] ${tint}`
    : 'border border-[oklch(88%_0.006_270)] bg-white'
  return (
    <div className={`rounded-xl px-4 py-4 ${base}`}>
      <h4 className="text-[13px] font-medium leading-[1.5] text-[oklch(18%_0.01_270)]">
        <Priority p={p} />
        {title}
      </h4>
      {desc && <p className="mt-2 text-[12px] leading-[1.5] text-[oklch(40%_0.01_270)]">{desc}</p>}
      <div className="mt-3.5 flex items-center gap-3 text-[10.5px] text-[oklch(58%_0.01_270)]">
        <span className="inline-flex items-center gap-1">
          {srcIcon[src]}
          {srcLabel[src]}
        </span>
        {due && <span className={due.includes('overdue') ? 'font-medium text-[oklch(55%_0.2_25)]' : ''}>{due}</span>}
        <span className="ml-auto">{time}</span>
      </div>
    </div>
  )
}
