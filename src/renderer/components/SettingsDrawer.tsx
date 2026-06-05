import React, { useEffect, useState } from 'react'
import { X, Link2, FolderOpen, Users, Timer, Brain, Sliders, Trash2, Plus, Save, Check, Github, Send, RefreshCw, Download, CheckCircle2, AlertCircle, Sparkles, Upload, Star, ExternalLink, AlertTriangle, ChevronDown, ChevronRight, Shield, Globe, Settings2 } from 'lucide-react'
import { WeChatLogo, TelegramLogo, DiscordLogo } from '../brand/icons'
import { useSettingsStore } from '../stores/settingsStore'
import type { Project, Relation, Job, ConnectionStatus, MemoryEntry, WeChatStatus, TelegramStatus, DiscordStatus, DeliveryTarget, UpdateState, Skill, GithubSkillSearchResult, MarketplaceSource, BrowsableSkill } from '@shared/types'
import anthropicLogo from '../../../resources/anthropic-com-logo.png'
import { ChannelsList } from '../channels/registry'

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

export function SettingsDrawer() {
  const { isOpen, activeTab, close, setTab, projects, relations, jobs, connections,
    fetchProjects, fetchRelations, fetchJobs, fetchConnections } = useSettingsStore()

  useEffect(() => {
    if (isOpen) { fetchProjects(); fetchRelations(); fetchJobs(); fetchConnections() }
  }, [isOpen])

  if (!isOpen) return null

  const tabs: Array<{ id: typeof activeTab; label: string; icon: React.ReactNode }> = [
    { id: 'connections', label: 'Connections', icon: <Link2 size={14} /> },
    { id: 'jobs', label: 'Jobs', icon: <Timer size={14} /> },
    { id: 'projects', label: 'Projects', icon: <FolderOpen size={14} /> },
    { id: 'relations', label: 'Contacts', icon: <Users size={14} /> },
    { id: 'memory', label: 'Memory', icon: <Brain size={14} /> },
    { id: 'skills', label: 'Skills', icon: <Sparkles size={14} /> },
    { id: 'preferences', label: 'Preferences', icon: <Sliders size={14} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-[720px] max-w-[94vw] bg-surface-1 border-l border-edge shadow-2xl flex flex-col anim-slide-in">
        {/* Header */}
        <div className="shrink-0 bg-surface-0">
          <div className="flex items-center pl-5 pr-5 h-[52px]">
            <h2 className="text-[13px] font-semibold text-text-primary">Manage</h2>
          </div>
          <div className="h-px bg-edge" />
        </div>

        {/* Tabs */}
        <nav className="flex border-b border-edge px-4 gap-0.5 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-2.5 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-text-primary border-accent'
                  : 'text-text-tertiary border-transparent hover:text-text-secondary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {activeTab === 'connections' && <ConnectionsTab connections={connections} />}
          {activeTab === 'projects' && <ProjectsTab projects={projects} onRefresh={fetchProjects} />}
          {activeTab === 'relations' && <RelationsTab relations={relations} onRefresh={fetchRelations} />}
          {activeTab === 'jobs' && <JobsTab jobs={jobs} onRefresh={fetchJobs} />}
          {activeTab === 'memory' && <MemoryTab />}
          {activeTab === 'skills' && <SkillsTab />}
          {activeTab === 'preferences' && <PreferencesTab />}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Connections Tab
   ═══════════════════════════════════════════ */

function ConnectionsTab({ connections }: { connections: ConnectionStatus[] }) {
  const disconnect = useSettingsStore(s => s.disconnect)
  const [cliStatus, setCliStatus] = useState<{ gh: boolean; npx: boolean } | null>(null)
  const [ghAccounts, setGhAccounts] = useState<{ account: string; active: boolean }[]>([])
  const [switching, setSwitching] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    window.aide.connections.checkCli().then(setCliStatus)
    window.aide.connections.listGhAccounts().then(setGhAccounts)
  }, [])

  const handleSwitchAccount = async (account: string) => {
    setSwitching(true)
    try {
      await window.aide.connections.switchGhAccount(account)
      const accs = await window.aide.connections.listGhAccounts()
      setGhAccounts(accs)
    } finally {
      setSwitching(false)
    }
  }

  const isCliMissing = (type: string) => {
    if (!cliStatus) return false
    if (type === 'github') return !cliStatus.gh
    return false // workiq uses npx auto-download
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionLabel title="Sources" desc="Where Aide reads your work from — email, calendar, issues, and more." />
        <div className="space-y-4">
      {connections.map(conn => (
        <Card key={conn.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                conn.type === 'workiq' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-500/10 text-text-secondary'
              }`}>
                {conn.type === 'workiq' ? <MicrosoftIcon /> : <Github size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text-primary">
                  {conn.type === 'workiq' ? 'Microsoft 365' : 'GitHub'}
                </p>
                <p className="text-[12px] text-text-tertiary mt-0.5">
                  {conn.type === 'workiq' ? 'Email · Calendar · Teams · OneDrive' : 'Issues · Pull Requests · Repos'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className={`w-[6px] h-[6px] rounded-full ${
                    conn.checking ? 'bg-text-tertiary animate-pulse' : conn.verified ? 'bg-success' : conn.authenticated ? 'bg-warning' : 'bg-text-tertiary'
                  }`} />
                  <span className={`text-[11px] ${
                    conn.checking ? 'text-text-tertiary' : conn.verified ? 'text-success' : conn.authenticated ? 'text-warning' : 'text-text-tertiary'
                  }`}>
                    {conn.checking
                      ? 'Checking connection…'
                      : conn.verified
                      ? `Connected${conn.activeAccount ? ` · ${conn.activeAccount}` : ''}`
                      : conn.authenticated ? 'Signed in · verifying permissions' : 'Not connected'}
                  </span>
                </div>
                {conn.lastError && <p className="text-[11px] text-danger mt-1">{conn.lastError}</p>}
                {conn.type === 'github' && conn.authenticated && ghAccounts.length > 1 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-text-tertiary mb-1">Switch account:</p>
                    <div className="flex flex-wrap gap-1">
                      {ghAccounts.map(acc => (
                        <button
                          key={acc.account}
                          disabled={acc.active || switching}
                          onClick={() => handleSwitchAccount(acc.account)}
                          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                            acc.active
                              ? 'bg-accent/15 text-accent font-medium cursor-default'
                              : 'bg-surface-2 text-text-secondary hover:bg-surface-2/80 hover:text-text-primary'
                          } ${switching ? 'opacity-50' : ''}`}
                        >
                          {acc.account}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {isCliMissing(conn.type) && !conn.authenticated && (
                  <div className="mt-2 p-2.5 rounded-lg bg-surface-2/60 border border-edge-subtle">
                    <p className="text-[11px] text-text-secondary mb-1">Install the <code className="bg-surface-2 px-1 rounded text-[10px]">gh</code> CLI first:</p>
                    <p className="text-[11px] text-text-tertiary">
                      <code className="bg-surface-2 px-1 rounded text-[10px]">winget install GitHub.cli</code>
                      {' · '}
                      <a href="https://cli.github.com" className="text-accent hover:underline" onClick={e => { e.preventDefault(); window.open('https://cli.github.com') }}>Download</a>
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {conn.authenticated && (
                <Btn variant="danger" onClick={() => disconnect(conn.type)}>Disconnect</Btn>
              )}
              {!isCliMissing(conn.type) && (
                <Btn
                  disabled={connecting === conn.type}
                  onClick={async () => {
                    setConnecting(conn.type)
                    try {
                      if (conn.type === 'github') await window.aide.connections.authenticateGitHub()
                      else await window.aide.connections.authenticateMicrosoft()
                    } catch { /* handled via event */ }
                    finally { setConnecting(null) }
                  }}
                >
                  {connecting === conn.type ? 'Connecting…' : conn.authenticated ? 'Reauthorize' : 'Connect'}
                </Btn>
              )}
            </div>
          </div>
        </Card>
      ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel title="Channels" desc="Pick the one you check most — that's where Aide reaches you." />
        <ChannelsList />
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Projects Tab
   ═══════════════════════════════════════════ */

function ProjectsTab({ projects, onRefresh }: { projects: Project[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Desc>The projects you follow, so Aide can help more precisely.</Desc>
        <Btn onClick={() => setAdding(true)}><Plus size={12} /> Add</Btn>
      </div>

      {adding && (
        <ProjectForm
          onSave={async (data) => { await window.aide.projects.create(data); setAdding(false); onRefresh() }}
          onCancel={() => setAdding(false)}
        />
      )}

      {projects.length === 0 && !adding && <Empty>No projects yet. Click “Add” above to start.</Empty>}

      {projects.map(p => editId === p.id ? (
        <ProjectForm
          key={p.id}
          initial={p}
          onSave={async (data) => { await window.aide.projects.update(p.id, data); setEditId(null); onRefresh() }}
          onCancel={() => setEditId(null)}
          onDelete={async () => { await window.aide.projects.delete(p.id); setEditId(null); onRefresh() }}
        />
      ) : (
        <Card key={p.id} className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-medium text-text-primary">{p.name}</p>
              {p.description && <p className="text-[12px] text-text-tertiary mt-0.5">{p.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-text-tertiary">
                {p.repoPath && <span className="flex items-center gap-1"><FolderOpen size={11} /> {p.repoPath}</span>}
                {p.techStack && <span>{p.techStack}</span>}
                {p.team.length > 0 && <span className="flex items-center gap-1"><Users size={11} /> {p.team.length}</span>}
              </div>
            </div>
            <button onClick={() => setEditId(p.id)} className="text-[12px] text-text-tertiary hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all">
              Edit
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function ProjectForm({ initial, onSave, onCancel, onDelete }: {
  initial?: Partial<Project>; onSave: (data: any) => Promise<void>; onCancel: () => void; onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [repoPath, setRepoPath] = useState(initial?.repoPath || '')

  return (
    <FormCard>
      <Field label="Name" value={name} onChange={setName} placeholder="Project name" required />
      <Field label="Repository" value={repoPath} onChange={setRepoPath} placeholder="owner/repo or local path (optional)" />
      <Field label="One-line description" value={description} onChange={setDescription} placeholder="What's this project about? (optional)" multiline />
      <FormHint>Aide keeps details like tech stack, team, and docs up to date on its own as you work.</FormHint>
      <FormActions
        onSave={() => onSave({ name, description, repoPath: repoPath || undefined })}
        onCancel={onCancel}
        onDelete={onDelete}
        disabled={!name.trim()}
      />
    </FormCard>
  )
}

/* ═══════════════════════════════════════════
   Relations Tab
   ═══════════════════════════════════════════ */

function RelationsTab({ relations, onRefresh }: { relations: Relation[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Desc>Key people you work with, so Aide can prioritize their messages.</Desc>
        <Btn onClick={() => setAdding(true)}><Plus size={12} /> Add</Btn>
      </div>

      {adding && (
        <RelationForm onSave={async (data) => { await window.aide.relations.create(data); setAdding(false); onRefresh() }} onCancel={() => setAdding(false)} />
      )}

      {relations.length === 0 && !adding && <Empty>No contacts yet.</Empty>}

      {relations.map(r => editId === r.id ? (
        <RelationForm key={r.id} initial={r} onSave={async (data) => { await window.aide.relations.update(r.id, data); setEditId(null); onRefresh() }} onCancel={() => setEditId(null)} onDelete={async () => { await window.aide.relations.delete(r.id); setEditId(null); onRefresh() }} />
      ) : (
        <Card key={r.id} className="group">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-text-primary">{r.name}</p>
                <RoleBadge role={r.role} />
              </div>
              <p className="text-[12px] text-text-tertiary mt-0.5">
                {[r.title, r.org].filter(Boolean).join(' · ') || 'Not set'}
              </p>
              {r.expertise.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {r.expertise.map((e, i) => <Tag key={i}>{e}</Tag>)}
                </div>
              )}
            </div>
            <button onClick={() => setEditId(r.id)} className="text-[12px] text-text-tertiary hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all">Edit</button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function RelationForm({ initial, onSave, onCancel, onDelete }: {
  initial?: Partial<Relation>; onSave: (data: any) => Promise<void>; onCancel: () => void; onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(initial?.name || '')
  const [role, setRole] = useState<string>(initial?.role || 'peer')
  const [notes, setNotes] = useState(initial?.notes || '')

  return (
    <FormCard>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Name" value={name} onChange={setName} placeholder="Name" required />
        <div>
          <label className="text-[11px] text-text-tertiary font-medium block mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-surface-0 border border-edge rounded-lg px-2.5 py-[7px] text-[13px] text-text-primary outline-none focus:border-accent/50 transition-colors appearance-none">
            <option value="manager">Manager</option>
            <option value="peer">Peer</option>
            <option value="report">Report</option>
            <option value="external">External</option>
            <option value="stakeholder">Stakeholder</option>
          </select>
        </div>
      </div>
      <Field label="Notes" value={notes} onChange={setNotes} placeholder="Why they matter or how you work together (optional)" multiline />
      <FormHint>Aide picks up details like email, Teams handle, title, and working style on its own as you interact.</FormHint>
      <FormActions
        onSave={() => onSave({ name, role, notes: notes || undefined })}
        onCancel={onCancel}
        onDelete={onDelete}
        disabled={!name.trim()}
      />
    </FormCard>
  )
}

/* ═══════════════════════════════════════════
   Jobs Tab
   ═══════════════════════════════════════════ */

function JobsTab({ jobs, onRefresh }: { jobs: Job[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Desc>Tasks Aide runs automatically on a schedule to keep you up to date.</Desc>
        <Btn onClick={() => { setAdding(true); setEditId(null) }}><Plus size={12} /> New</Btn>
      </div>

      {adding && (
        <JobForm
          onSave={async (data) => { await window.aide.jobs.create(data); setAdding(false); onRefresh() }}
          onCancel={() => setAdding(false)}
        />
      )}

      {jobs.length === 0 && !adding && <Empty>No scheduled jobs yet. Click “New” above to create one.</Empty>}

      {jobs.map(job => editId === job.id ? (
        <JobForm
          key={job.id}
          initial={job}
          managed={job.isBuiltin}
          onSave={async (data) => { await window.aide.jobs.update(job.id, data); setEditId(null); onRefresh() }}
          onCancel={() => setEditId(null)}
          onDelete={job.isBuiltin ? undefined : async () => { await window.aide.jobs.delete(job.id); setEditId(null); onRefresh() }}
        />
      ) : (
        <Card key={job.id} className="group">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-text-primary truncate">{job.name}</p>
                {job.isBuiltin && (
                  <span className="text-[10px] text-text-tertiary border border-edge rounded px-1 py-px shrink-0">Built-in</span>
                )}
                {job.lastResult && (
                  <div className={`w-[6px] h-[6px] rounded-full shrink-0 ${job.lastResult === 'success' ? 'bg-success' : 'bg-danger'}`} />
                )}
              </div>
              <p className="text-[11px] text-text-tertiary mt-0.5">{describeCron(job.cron)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditId(job.id)} className="text-[12px] text-text-tertiary hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all">
                Edit
              </button>
              <Toggle checked={job.enabled} onChange={async v => { await window.aide.jobs.toggle(job.id, v); onRefresh() }} />
            </div>
          </div>

          {/* Instruction preview */}
          <p className="text-[12px] text-text-tertiary mt-1.5 line-clamp-1">{job.instruction}</p>

          {job.deliveryTargets.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Send size={11} className="text-text-tertiary shrink-0" />
              <span className="text-[11px] text-text-tertiary">{job.deliveryTargets.map(t => DELIVERY_LABELS[t]).join(' · ')}</span>
            </div>
          )}

          {/* Last run info */}
          {job.lastRunAt && (
            <div className="mt-2.5 pt-2.5 border-t border-edge-subtle">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] ${job.lastResult === 'success' ? 'text-success' : 'text-danger'}`}>
                  {job.lastResult === 'success' ? 'Last run succeeded' : 'Last run failed'}
                </span>
                <span className="text-[11px] text-text-tertiary">{formatRelativeTime(job.lastRunAt)}</span>
                {job.lastSummary && (
                  <button onClick={() => setExpandedId(expandedId === job.id ? null : job.id)} className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors ml-auto">
                    {expandedId === job.id ? 'Collapse' : 'Details'}
                  </button>
                )}
              </div>
              {expandedId === job.id && job.lastSummary && (
                <pre className="mt-2 text-[12px] text-text-tertiary bg-surface-0 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[200px] overflow-y-auto scrollbar-thin">{job.lastSummary}</pre>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function JobForm({ initial, managed, onSave, onCancel, onDelete }: {
  initial?: Partial<Job>; managed?: boolean; onSave: (data: { name: string; cron: string; instruction: string; deliveryTargets: DeliveryTarget[] }) => Promise<void>; onCancel: () => void; onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(initial?.name || '')
  const [instruction, setInstruction] = useState(initial?.instruction || '')
  const [deliveryTargets, setDeliveryTargets] = useState<DeliveryTarget[]>(initial?.deliveryTargets || [])

  const toggleTarget = (t: DeliveryTarget) =>
    setDeliveryTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  // Parse initial cron into structured schedule
  const parsed = parseCronToSchedule(initial?.cron || '*/15 * * * *')
  const [schedType, setSchedType] = useState<'interval' | 'daily' | 'weekly' | 'monthly'>(parsed.type)
  const [interval, setInterval] = useState(parsed.interval)
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const [weekdays, setWeekdays] = useState<number[]>(parsed.weekdays)
  const [monthDay, setMonthDay] = useState(parsed.monthDay)

  const cron = buildCron(schedType, interval, hour, minute, weekdays, monthDay)

  const selectCls = "bg-surface-0 border border-edge rounded-lg px-3 py-[7px] text-[13px] text-text-primary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all appearance-none pr-7"
  const selectStyle = { backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const toggleDay = (d: number) => setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())

  // Built-in jobs are managed by Aide: name/schedule/instruction are owned by the
  // app (re-synced each launch), so only the delivery target is editable here.
  if (managed) {
    return (
      <FormCard>
        <div>
          <label className="text-[11px] text-text-tertiary font-medium block mb-1.5">Job name</label>
          <p className="text-[13px] text-text-primary">{name}</p>
        </div>
        <div>
          <label className="text-[11px] text-text-tertiary font-medium block mb-1.5">Frequency</label>
          <p className="text-[13px] text-text-secondary">{describeCron(initial?.cron || cron)}</p>
        </div>
        <div>
          <label className="text-[11px] text-text-tertiary font-medium block mb-1.5">Instruction</label>
          <p className="text-[12px] text-text-tertiary whitespace-pre-wrap leading-relaxed">{instruction}</p>
        </div>
        <div>
          <label className="text-[11px] text-text-tertiary font-medium block mb-1.5">Deliver result to</label>
          <div className="flex gap-1.5">
            {DELIVERY_OPTIONS.map(opt => {
              const active = deliveryTargets.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleTarget(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                    active ? 'bg-accent text-white' : 'bg-surface-0 text-text-tertiary border border-edge hover:text-text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-text-tertiary/80 mt-1.5">This is a built-in Aide job. You can change where its summary is delivered or turn it off.</p>
        </div>
        <FormActions onSave={() => onSave({ name, cron, instruction, deliveryTargets })} onCancel={onCancel} disabled={false} />
      </FormCard>
    )
  }

  return (
    <FormCard>
      <Field label="Job name" value={name} onChange={setName} placeholder="e.g. Check unread email" required />

      <div>
        <label className="text-[11px] text-text-tertiary font-medium block mb-1.5">Frequency</label>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={schedType} onChange={e => setSchedType(e.target.value as any)} className={selectCls} style={selectStyle}>
            <option value="interval">Every</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          {schedType === 'interval' && (
            <>
              <select value={interval} onChange={e => setInterval(+e.target.value)} className={`${selectCls} w-[80px]`} style={selectStyle}>
                {[5, 10, 15, 20, 30, 60].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-[13px] text-text-secondary">minutes</span>
            </>
          )}

          {(schedType === 'daily' || schedType === 'weekly' || schedType === 'monthly') && (
            <>
              {schedType === 'monthly' && (
                <>
                  <select value={monthDay} onChange={e => setMonthDay(+e.target.value)} className={`${selectCls} w-[72px]`} style={selectStyle}>
                    {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                  <span className="text-[13px] text-text-secondary">of the month</span>
                </>
              )}
              <select value={hour} onChange={e => setHour(+e.target.value)} className={`${selectCls} w-[72px]`} style={selectStyle}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
              </select>
              <span className="text-[13px] text-text-tertiary">:</span>
              <select value={minute} onChange={e => setMinute(+e.target.value)} className={`${selectCls} w-[72px]`} style={selectStyle}>
                {[0, 5, 10, 15, 20, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </>
          )}
        </div>

        {schedType === 'weekly' && (
          <div className="flex gap-1 mt-2">
            {dayNames.map((d, i) => {
              const dayNum = i + 1 // 1=Mon ... 7=Sun
              const active = weekdays.includes(dayNum)
              return (
                <button
                  key={dayNum}
                  onClick={() => toggleDay(dayNum)}
                  className={`w-7 h-7 rounded-md text-[12px] font-medium transition-colors ${
                    active ? 'bg-accent text-white' : 'bg-surface-0 text-text-tertiary border border-edge hover:text-text-secondary'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Field label="Instruction" value={instruction} onChange={setInstruction} placeholder="Tell Aide what to do, e.g. Check my unread email and flag anything urgent" required multiline />

      <div>
        <label className="text-[11px] text-text-tertiary font-medium block mb-1.5">Deliver result to</label>
        <div className="flex gap-1.5">
          {DELIVERY_OPTIONS.map(opt => {
            const active = deliveryTargets.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => toggleTarget(opt.value)}
                className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                  active ? 'bg-accent text-white' : 'bg-surface-0 text-text-tertiary border border-edge hover:text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-text-tertiary/80 mt-1.5">Where to send this job's summary when it finishes. Leave empty for none.</p>
      </div>

      <FormActions onSave={() => onSave({ name, cron, instruction, deliveryTargets })} onCancel={onCancel} onDelete={onDelete} disabled={!name.trim() || !cron.trim() || !instruction.trim()} />
    </FormCard>
  )
}

const DELIVERY_OPTIONS: { value: DeliveryTarget; label: string }[] = [
  { value: 'desktop', label: 'Aide chat' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
]

const DELIVERY_LABELS: Record<DeliveryTarget, string> = {
  desktop: 'Aide chat',
  wechat: 'WeChat',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  discord: 'Discord',
}

function parseCronToSchedule(cron: string) {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return { type: 'interval' as const, interval: 60, hour: 9, minute: 0, weekdays: [1, 2, 3, 4, 5], monthDay: 1 }

  const [min, hr, dom, , dow] = parts

  // */N pattern (e.g. */15 * * * *)
  if (min.startsWith('*/')) {
    return { type: 'interval' as const, interval: parseInt(min.slice(2)) || 15, hour: 9, minute: 0, weekdays: [1, 2, 3, 4, 5], monthDay: 1 }
  }

  // Hourly pattern: fixed minute, hour is * (e.g. 0 * * * *, 30 * * * *)
  if (hr === '*' && dom === '*') {
    return { type: 'interval' as const, interval: 60, hour: 9, minute: parseInt(min) || 0, weekdays: [1, 2, 3, 4, 5], monthDay: 1 }
  }

  const hour = parseInt(hr.split(',')[0]) || 0
  const minute = min === '*' ? 0 : parseInt(min) || 0

  // Monthly
  if (dom !== '*') {
    return { type: 'monthly' as const, interval: 60, hour, minute, weekdays: [1, 2, 3, 4, 5], monthDay: parseInt(dom) || 1 }
  }

  // Weekly
  if (dow !== '*') {
    const weekdays = dow.split(',').flatMap(seg => {
      if (seg.includes('-')) {
        const [a, b] = seg.split('-').map(Number)
        return Array.from({ length: b - a + 1 }, (_, i) => a + i)
      }
      return [parseInt(seg)]
    }).filter(n => n >= 1 && n <= 7)
    return { type: 'weekly' as const, interval: 60, hour, minute, weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5], monthDay: 1 }
  }

  // Daily
  return { type: 'daily' as const, interval: 60, hour, minute, weekdays: [1, 2, 3, 4, 5], monthDay: 1 }
}

function buildCron(type: string, interval: number, hour: number, minute: number, weekdays: number[], monthDay: number): string {
  switch (type) {
    case 'interval':
      if (interval >= 60) return `${minute} * * * *`
      return `*/${interval} * * * *`
    case 'daily': return `${minute} ${hour} * * *`
    case 'weekly': {
      const sorted = [...weekdays].sort((a, b) => a - b)
      // Use range notation if consecutive (e.g. 1,2,3,4,5 → 1-5)
      const isConsecutive = sorted.length > 1 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1
      const dowStr = sorted.length === 0 ? '1-5' : isConsecutive ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(',')
      return `${minute} ${hour} * * ${dowStr}`
    }
    case 'monthly': return `${minute} ${hour} ${monthDay} * *`
    default: return '*/15 * * * *'
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ═══════════════════════════════════════════
   Skills Tab
   ═══════════════════════════════════════════ */

function SkillsTab() {
  const [view, setView] = useState<'installed' | 'browse' | 'sources'>('installed')
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(false)

  // Browse state
  const [browsableSkills, setBrowsableSkills] = useState<BrowsableSkill[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [marketplaceSearch, setMarketplaceSearch] = useState('')
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set(['anthropic-community']))

  // Sources state
  const [sources, setSources] = useState<MarketplaceSource[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [addingSource, setAddingSource] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')

  // Upload state (folder upload)
  const [uploadMode, setUploadMode] = useState(false)
  const [uploadFolderName, setUploadFolderName] = useState('')
  const [uploadFiles, setUploadFiles] = useState<Array<{ path: string; content: string }>>([])  

  // GitHub search fallback state
  const [githubExpanded, setGithubExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GithubSkillSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectingRepo, setSelectingRepo] = useState<GithubSkillSearchResult | null>(null)
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [confirmInstall, setConfirmInstall] = useState<GithubSkillSearchResult | null>(null)

  useEffect(() => {
    loadSkills()
    loadSources()
  }, [])

  useEffect(() => {
    if (view === 'browse') {
      loadBrowsableSkills()
    }
  }, [view])

  const loadSkills = async () => {
    setLoading(true)
    try {
      const list = await window.aide.skills.list()
      setSkills(list)
    } catch (err) {
      console.error('Failed to load skills:', err)
    }
    setLoading(false)
  }

  const loadSources = async () => {
    try {
      const list = await window.aide.marketplace.listSources()
      setSources(list)
    } catch (err) {
      console.error('Failed to load sources:', err)
    }
  }

  const loadBrowsableSkills = async () => {
    setBrowseLoading(true)
    try {
      const list = await window.aide.marketplace.browse()
      setBrowsableSkills(list)
    } catch (err) {
      console.error('Failed to browse skills:', err)
    }
    setBrowseLoading(false)
  }

  const handleInstallFromMarketplace = async (skill: BrowsableSkill) => {
    setInstalling(`${skill.sourceId}:${skill.path}`)
    try {
      await window.aide.marketplace.install(skill.sourceId, skill.path)
      loadSkills()
      loadBrowsableSkills()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to install skill')
    }
    setInstalling(null)
  }

  const handleSyncSource = async (sourceId: string) => {
    setSyncing(sourceId)
    try {
      await window.aide.marketplace.syncSource(sourceId)
      loadSources()
      loadBrowsableSkills()
    } catch (err) {
      console.error('Sync failed:', err)
    }
    setSyncing(null)
  }

  const handleToggleSource = async (source: MarketplaceSource) => {
    try {
      await window.aide.marketplace.toggleSource(source.id, !source.enabled)
      loadSources()
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  }

  const handleAddSource = async () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) return
    try {
      const newSource = await window.aide.marketplace.addSource({ name: newSourceName, url: newSourceUrl })
      setNewSourceName('')
      setNewSourceUrl('')
      setAddingSource(false)
      // Auto-sync to get skill count
      await window.aide.marketplace.syncSource(newSource.id)
      loadSources()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add source')
    }
  }

  const handleRemoveSource = async (id: string) => {
    if (!confirm('Remove this source? Skills already installed will remain.')) return
    try {
      await window.aide.marketplace.removeSource(id)
      loadSources()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cannot remove this source')
    }
  }

  const handleFileSelect = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.multiple = true
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files
      if (!fileList || fileList.length === 0) return
      
      // Get folder name from first file's path
      const firstPath = fileList[0].webkitRelativePath || fileList[0].name
      const folderName = firstPath.split('/')[0] || 'uploaded-skill'
      
      // Read all files
      const files: Array<{ path: string; content: string }> = []
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        // Only include text-based files
        if (file.type.startsWith('text/') || 
            file.name.endsWith('.md') || 
            file.name.endsWith('.txt') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.yaml') ||
            file.name.endsWith('.yml')) {
          try {
            const content = await file.text()
            const relativePath = file.webkitRelativePath || file.name
            files.push({ path: relativePath, content })
          } catch {
            console.warn('Failed to read file:', file.name)
          }
        }
      }
      
      if (files.length === 0) {
        alert('No valid files found in folder.')
        return
      }
      
      // Check for SKILL.md
      const hasSkillMd = files.some(f => f.path.toLowerCase().endsWith('skill.md'))
      if (!hasSkillMd) {
        alert('No SKILL.md found in folder. Please ensure your folder contains a SKILL.md file.')
        return
      }
      
      setUploadFolderName(folderName)
      setUploadFiles(files)
      setUploadMode(true)
    }
    input.click()
  }

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return
    try {
      await window.aide.skills.createFromFolder(uploadFiles)
      setUploadFolderName('')
      setUploadFiles([])
      setUploadMode(false)
      loadSkills()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload skill')
    }
  }

  const handleGithubSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchPerformed(true)
    try {
      const results = await window.aide.skills.searchGithub(searchQuery)
      setSearchResults(results)
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults([])
    }
    setSearching(false)
  }

  const handleGithubDownload = async (repo: GithubSkillSearchResult, filePath?: string) => {
    if (downloading) return
    setDownloading(repo.fullName)

    try {
      if (!filePath) {
        const files = await window.aide.skills.findFilesInRepo(repo.fullName)
        if (files.length === 0) {
          alert(`No SKILL.md found in ${repo.fullName}`)
          setDownloading(null)
          return
        }
        if (files.length > 1) {
          setSelectingRepo(repo)
          setAvailableFiles(files)
          setDownloading(null)
          return
        }
        filePath = files[0]
      }

      await window.aide.skills.downloadFromGithub(repo.fullName, filePath)
      setSearchQuery('')
      setSearchResults([])
      setSelectingRepo(null)
      setAvailableFiles([])
      setConfirmInstall(null)
      loadSkills()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download skill')
    }
    setDownloading(null)
  }

  const handleToggle = async (skill: Skill) => {
    try {
      await window.aide.skills.toggle(skill.id, !skill.enabled)
      loadSkills()
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  }

  const handleDelete = async (skill: Skill) => {
    if (!confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) return
    try {
      await window.aide.skills.delete(skill.id)
      loadSkills()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const getSourceBadge = (skill: Skill) => {
    // Determine source label
    let sourceLabel = ''
    let bgColor = 'bg-surface-2'
    let textColor = 'text-text-tertiary'
    
    if (skill.source === 'local') {
      sourceLabel = 'Local'
    } else if (skill.source === 'github-search') {
      sourceLabel = 'GitHub'
      bgColor = 'bg-amber-500/10'
      textColor = 'text-amber-600'
    } else if (skill.source === 'marketplace' && skill.sourceId) {
      // Map sourceId to friendly name
      if (skill.sourceId === 'aide-official') {
        sourceLabel = 'AIDE'
        bgColor = 'bg-accent/10'
        textColor = 'text-accent'
      } else if (skill.sourceId === 'anthropic-community') {
        sourceLabel = 'Anthropic'
        bgColor = 'bg-orange-500/10'
        textColor = 'text-orange-600'
      } else if (skill.sourceId?.startsWith('private-')) {
        // Private source - just show "Private"
        sourceLabel = 'Private'
        bgColor = 'bg-purple-500/10'
        textColor = 'text-purple-600'
      } else {
        // Custom source - show sourceId or truncated version
        sourceLabel = skill.sourceId && skill.sourceId.length > 15 ? skill.sourceId.slice(0, 12) + '...' : (skill.sourceId || '')
        bgColor = 'bg-purple-500/10'
        textColor = 'text-purple-600'
      }
    }
    
    if (!sourceLabel) return null
    
    return (
      <span className={`px-1.5 py-0.5 text-[10px] rounded ${bgColor} ${textColor} font-medium`}>
        {sourceLabel}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-surface-1 rounded-lg">
        {(['installed', 'browse', 'sources'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              view === tab
                ? 'bg-surface-0 text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab === 'installed' && 'Installed'}
            {tab === 'browse' && 'Browse Marketplace'}
            {tab === 'sources' && 'Sources'}
          </button>
        ))}
      </div>

      {/* ===== INSTALLED VIEW ===== */}
      {view === 'installed' && (
        <>
          {/* Installed Skills List */}
          <section className="space-y-3">
            <SectionLabel
              title="Installed Skills"
              meta={`${skills.length} installed`}
            />

            {skills.length === 0 ? (
              <Empty>No skills installed. Browse the marketplace or upload from Sources tab.</Empty>
            ) : (
              <div className="space-y-2">
                {skills.map(skill => (
                  <div key={skill.id} className={`group p-3 rounded-lg bg-surface-0 border transition-colors ${skill.enabled ? 'border-edge' : 'border-edge opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className={skill.enabled ? 'text-accent' : 'text-text-tertiary'} />
                          <span className="text-[13px] font-medium text-text-primary">{skill.name}</span>
                          {getSourceBadge(skill)}
                          {!skill.enabled && <Tag>Disabled</Tag>}
                        </div>
                        {skill.description && (
                          <p className="text-[12px] text-text-tertiary mt-1">{skill.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-tertiary">
                          {skill.sourceUrl && (
                            <a href={skill.sourceUrl} target="_blank" rel="noopener" className="hover:text-accent transition-colors inline-flex items-center gap-0.5">
                              <ExternalLink size={10} /> Source
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Toggle checked={skill.enabled} onChange={() => handleToggle(skill)} />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(skill) }}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger/8 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ===== BROWSE VIEW ===== */}
      {view === 'browse' && (
        <>
          {/* Search + Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={marketplaceSearch}
                onChange={e => setMarketplaceSearch(e.target.value)}
                placeholder="Search marketplace skills..."
                className="w-full bg-surface-0 border border-edge rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <button
              onClick={loadBrowsableSkills}
              disabled={browseLoading}
              className="p-2 rounded-lg bg-surface-0 border border-edge hover:border-accent/50 text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-50"
              title="Refresh marketplace"
            >
              <RefreshCw size={14} className={browseLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {browseLoading ? (
            <div className="text-[12px] text-text-tertiary text-center py-8">Loading marketplace…</div>
          ) : browsableSkills.length === 0 ? (
            <Empty>No skills available. Try syncing your sources.</Empty>
          ) : (() => {
            // Filter by search
            const filtered = marketplaceSearch.trim()
              ? browsableSkills.filter(s => 
                  s.name.toLowerCase().includes(marketplaceSearch.toLowerCase()) ||
                  s.description.toLowerCase().includes(marketplaceSearch.toLowerCase())
                )
              : browsableSkills
            
            // Group by source
            const grouped = filtered.reduce((acc, skill) => {
              if (!acc[skill.sourceId]) {
                acc[skill.sourceId] = { name: skill.sourceName, type: skill.sourceType, skills: [] }
              }
              acc[skill.sourceId].skills.push(skill)
              return acc
            }, {} as Record<string, { name: string; type: string; skills: BrowsableSkill[] }>)

            return Object.entries(grouped).map(([sourceId, group]) => {
              const isCollapsed = collapsedSources.has(sourceId)
              const toggleCollapse = () => {
                setCollapsedSources(prev => {
                  const next = new Set(prev)
                  if (next.has(sourceId)) next.delete(sourceId)
                  else next.add(sourceId)
                  return next
                })
              }
              
              // Source-specific logos
              const SourceLogo = () => {
                if (sourceId === 'aide-official') {
                  return (
                    <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="shrink-0">
                      <rect width="32" height="32" rx="7" fill="#4172F0"/>
                      <path d="M16 6 L24 26 L20.5 26 L18.5 21 L13.5 21 L11.5 26 L8 26 Z M16 12 L14.2 19 L17.8 19 Z" fill="white"/>
                      <path d="M23 7 L24 9.5 L26.5 10.5 L24 11.5 L23 14 L22 11.5 L19.5 10.5 L22 9.5 Z" fill="white" opacity="0.85"/>
                    </svg>
                  )
                }
                if (sourceId === 'anthropic-community') {
                  return (
                    <img 
                      src={anthropicLogo} 
                      alt="Anthropic" 
                      width={16} 
                      height={16} 
                      className="shrink-0 rounded"
                    />
                  )
                }
                return <Settings2 size={16} className="text-purple-500 shrink-0" />
              }
              
              return (
                <section key={sourceId} className="space-y-2">
                  <button
                    onClick={toggleCollapse}
                    className="flex items-center gap-2 pt-2 w-full text-left hover:opacity-80 transition-opacity"
                  >
                    {isCollapsed ? <ChevronRight size={14} className="text-text-tertiary" /> : <ChevronDown size={14} className="text-text-tertiary" />}
                    <SourceLogo />
                    <span className="text-[12px] font-medium text-text-secondary">{group.name}</span>
                    <span className="text-[11px] text-text-tertiary">({group.skills.length})</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2 ml-5">
                      {group.skills.map(skill => (
                        <div key={`${skill.sourceId}:${skill.path}`} className="p-3 rounded-lg bg-surface-0 border border-edge hover:border-accent/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-accent" />
                                <span className="text-[13px] font-medium text-text-primary">{skill.name}</span>
                              </div>
                              {skill.description && (
                                <p className="text-[12px] text-text-tertiary mt-1">{skill.description}</p>
                              )}
                              {skill.tags && skill.tags.length > 0 && (
                                <div className="flex items-center gap-1 mt-1.5">
                                  {skill.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="px-1 py-0.5 bg-surface-2 rounded text-[10px] text-text-tertiary">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Btn 
                              onClick={() => handleInstallFromMarketplace(skill)} 
                              disabled={skill.installed || installing === `${skill.sourceId}:${skill.path}`}
                            >
                              {skill.installed ? (
                                <><Check size={12} /> Installed</>
                              ) : installing === `${skill.sourceId}:${skill.path}` ? (
                                'Installing...'
                              ) : (
                                <><Download size={12} /> Install</>
                              )}
                            </Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })
          })()}

          {/* GitHub Search Fallback */}
          <div className="border-t border-edge pt-4">
            <button
              onClick={() => setGithubExpanded(!githubExpanded)}
              className="flex items-center gap-2 text-[12px] text-amber-600 hover:text-amber-500 transition-colors"
            >
              {githubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <AlertTriangle size={14} />
              <span>Search GitHub (unverified sources)</span>
            </button>

            {githubExpanded && (
              <div className="mt-3 space-y-3">
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    <strong>Warning:</strong> Skills from GitHub search are not reviewed. They may reference tools not available in AIDE, contain untested instructions, or have security implications.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGithubSearch()}
                    placeholder="Search for skills on GitHub..."
                    className="flex-1 bg-surface-0 border border-edge rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 transition-colors"
                  />
                  <Btn onClick={handleGithubSearch} disabled={searching || !searchQuery.trim()}>
                    {searching ? 'Searching...' : 'Search'}
                  </Btn>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map(repo => (
                      <div key={repo.fullName} className="p-3 rounded-lg bg-surface-0 border border-edge hover:border-amber-500/30 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Github size={14} className="text-text-tertiary shrink-0" />
                              <a href={repo.url} target="_blank" rel="noopener" className="text-[13px] font-medium text-text-primary hover:text-accent transition-colors truncate">
                                {repo.fullName}
                              </a>
                              <div className="flex items-center gap-1 text-[11px] text-text-tertiary shrink-0">
                                <Star size={11} />
                                <span>{repo.stars}</span>
                              </div>
                            </div>
                            {repo.description && (
                              <p className="text-[12px] text-text-tertiary mt-1 line-clamp-2">{repo.description}</p>
                            )}
                          </div>
                          <Btn onClick={() => setConfirmInstall(repo)} disabled={downloading === repo.fullName}>
                            {downloading === repo.fullName ? 'Installing...' : <><Download size={12} /> Install</>}
                          </Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.length === 0 && searchPerformed && !searching && (
                  <Empty>No skills found. Try a different search term.</Empty>
                )}
              </div>
            )}
          </div>

          {/* Multiple SKILL.md Selection Modal */}
          {selectingRepo && availableFiles.length > 1 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setSelectingRepo(null); setAvailableFiles([]) }}>
              <div className="bg-surface-1 rounded-xl p-5 max-w-lg w-full mx-4 shadow-xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-[14px] font-semibold text-text-primary mb-3">
                  Multiple skills found, please choose one:
                </h3>
                <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
                  {availableFiles.map(filePath => {
                    const dirPath = filePath.replace(/\/SKILL\.md$/i, '')
                    return (
                      <button
                        key={filePath}
                        onClick={() => handleGithubDownload(selectingRepo, filePath)}
                        disabled={downloading === selectingRepo.fullName}
                        className="w-full text-left px-3 py-2 rounded-md bg-surface-0 border border-edge hover:border-accent/50 text-[12px] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                      >
                        {dirPath}
                      </button>
                    )
                  })}
                </div>
                <button 
                  onClick={() => { setSelectingRepo(null); setAvailableFiles([]) }} 
                  className="mt-3 w-full py-2 rounded-lg border border-edge text-[12px] text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Confirm Dialog for GitHub Install */}
          {confirmInstall && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmInstall(null)}>
              <div className="bg-surface-1 rounded-xl p-6 max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-text-primary">Install Unverified Skill?</h3>
                    <p className="text-[12px] text-text-tertiary">{confirmInstall.fullName}</p>
                  </div>
                </div>
                <p className="text-[12px] text-text-secondary mb-6">
                  This skill is from an unverified GitHub repository and has not been reviewed. It may not work correctly with AIDE or could contain unsafe instructions.
                </p>
                <div className="flex justify-end gap-2">
                  <Btn onClick={() => setConfirmInstall(null)}>Cancel</Btn>
                  <button
                    onClick={() => { handleGithubDownload(confirmInstall); setConfirmInstall(null) }}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-medium hover:bg-amber-600 transition-colors"
                  >
                    Install Anyway
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== SOURCES VIEW ===== */}
      {view === 'sources' && (
        <>
          <section className="space-y-3">
            <SectionLabel
              title="Marketplace Sources"
              desc="Repositories containing skill collections"
            />

            <div className="space-y-2">
              {sources.map(source => (
                <div key={source.id} className={`group p-3 rounded-lg bg-surface-0 border transition-colors ${source.enabled ? 'border-edge' : 'border-edge opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {source.type === 'official' && <Shield size={14} className="text-green-500" />}
                        {source.type === 'community' && <Globe size={14} className="text-blue-500" />}
                        {source.type === 'private' && <Settings2 size={14} className="text-purple-500" />}
                        <span className="text-[13px] font-medium text-text-primary">{source.name}</span>
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-surface-2 text-text-tertiary capitalize">{source.type}</span>
                      </div>
                      <p className="text-[12px] text-text-tertiary mt-1 truncate">{source.url}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-tertiary">
                        <span>{source.skillCount} skills</span>
                        {source.lastSyncedAt && (
                          <>
                            <span>•</span>
                            <span>Synced {new Date(source.lastSyncedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleSyncSource(source.id)}
                        disabled={syncing === source.id}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-accent hover:bg-accent/8 transition-all"
                        title="Sync"
                      >
                        <RefreshCw size={14} className={syncing === source.id ? 'animate-spin' : ''} />
                      </button>
                      <Toggle checked={source.enabled} onChange={() => handleToggleSource(source)} />
                      {source.type === 'private' && (
                        <button
                          onClick={() => handleRemoveSource(source.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger/8 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Add Source */}
          {addingSource ? (
            <FormCard>
              <Field label="Source Name" value={newSourceName} onChange={setNewSourceName} placeholder="My Team Skills" required />
              <Field label="GitHub Repository URL" value={newSourceUrl} onChange={setNewSourceUrl} placeholder="https://github.com/owner/repo" required />
              <FormActions
                onSave={handleAddSource}
                onCancel={() => { setAddingSource(false); setNewSourceName(''); setNewSourceUrl('') }}
                disabled={!newSourceName.trim() || !newSourceUrl.trim()}
              />
            </FormCard>
          ) : (
            <Btn onClick={() => setAddingSource(true)}>
              <Plus size={12} /> Add Private Source
            </Btn>
          )}

          {/* Upload Local Skill Folder */}
          <section className="space-y-3 border-t border-edge pt-4">
            <SectionLabel
              title="Upload Local Skill"
              desc="Upload a skill folder from your computer"
            />
            
            {uploadMode ? (
              <FormCard>
                <div className="text-[11px] text-text-tertiary bg-surface-2 rounded-md px-3 py-2 mb-2">
                  <p className="font-medium mb-1">Uploading folder: <code className="text-accent">{uploadFolderName}</code></p>
                  <p>{uploadFiles.length} file(s) found</p>
                </div>
                <div>
                  <label className="text-[11px] text-text-tertiary font-medium block mb-1">Files</label>
                  <div className="w-full bg-surface-0 border border-edge rounded-lg p-3 text-[12px] text-text-secondary max-h-32 overflow-y-auto">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-0.5">
                        <span className={f.path.toLowerCase().endsWith('skill.md') ? 'text-accent font-medium' : ''}>
                          {f.path}
                        </span>
                        <span className="text-text-tertiary text-[10px]">({(f.content.length / 1024).toFixed(1)}KB)</span>
                      </div>
                    ))}
                  </div>
                </div>
                <FormActions
                  onSave={handleUpload}
                  onCancel={() => { setUploadMode(false); setUploadFolderName(''); setUploadFiles([]) }}
                  disabled={uploadFiles.length === 0}
                />
              </FormCard>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-text-tertiary">
                  Folder should include at least a <code className="text-accent">SKILL.md</code> file.
                </p>
                <Btn onClick={handleFileSelect}>
                  <FolderOpen size={12} /> Select Skill Folder
                </Btn>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   Memory Tab
   ═══════════════════════════════════════════ */

function MemoryTab() {
  const [l0, setL0] = useState('')
  const [l0Saved, setL0Saved] = useState(false)
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.aide.memory.getL0().then(setL0)
    loadMemories()
  }, [])

  const loadMemories = async () => {
    setLoading(true)
    const list = await window.aide.memory.list({ layer: ['L1', 'L2'], status: 'active' })
    setMemories(list)
    setLoading(false)
  }

  const saveL0 = async () => {
    await window.aide.memory.setL0(l0)
    setL0Saved(true)
    setTimeout(() => setL0Saved(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* L0 */}
      <section className="space-y-3">
        <SectionLabel
          title="Identity"
          desc="A few core facts about who you are. Aide always keeps these in mind."
          meta={`${l0.length}/1000`}
        />
        <textarea
          value={l0}
          onChange={e => setL0(e.target.value)}
          className="w-full h-24 bg-surface-0 border border-edge rounded-xl p-3 text-[13px] text-text-primary placeholder:text-text-tertiary resize-none outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all leading-relaxed"
          placeholder={"I'm Jane Doe, a senior frontend engineer at ABC Inc.\nI mainly work on the Web App."}
          maxLength={1000}
        />
        <div className="flex justify-end mt-2">
          <Btn onClick={saveL0}>
            {l0Saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Save</>}
          </Btn>
        </div>
      </section>

      {/* L1/L2 */}
      <section className="space-y-3">
        <SectionLabel
          title="Learned"
          desc="What Aide has learned about you as you work together."
          meta={`${memories.length} items`}
        />

        {loading ? (
          <div className="text-[12px] text-text-tertiary text-center py-8">Loading…</div>
        ) : memories.length === 0 ? (
          <Empty>No memories yet. They grow as you use Aide.</Empty>
        ) : (
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
            {memories.map(m => (
              <div key={m.id} className="group p-3 rounded-lg bg-surface-0 border border-edge hover:border-edge transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-text-secondary leading-relaxed">{m.content}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-tertiary">
                      <Tag>{m.layer}</Tag>
                      <span>{new Date(m.createdAt).toLocaleDateString('en-US')}</span>
                      {m.tags.length > 0 && <span>{m.tags.join(', ')}</span>}
                      {m.recallCount > 0 && <span>Recalled {m.recallCount} times</span>}
                    </div>
                  </div>
                  <button onClick={() => { if (confirm('Delete this memory? This cannot be undone.')) { window.aide.memory.delete(m.id); setMemories(prev => prev.filter(x => x.id !== m.id)) } }} className="w-6 h-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger/8 opacity-0 group-hover:opacity-100 transition-all shrink-0" title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Preferences Tab
   ═══════════════════════════════════════════ */

function PreferencesTab() {
  const { preferences, fetchPreferences, setPreferences } = useSettingsStore()

  useEffect(() => { fetchPreferences() }, [])

  if (!preferences) return <div className="text-[12px] text-text-tertiary text-center py-8">Loading…</div>

  return (
    <div className="space-y-4">
      <Desc>Fine-tune how Aide behaves.</Desc>

      <SettingRow label="Autonomy level" description="Decide when Aide should check with you before acting">
        <Select value={preferences.autonomyLevel} onChange={v => setPreferences({ autonomyLevel: v as any })} options={[
          { value: 'default', label: 'Default — Aide acts on its own' },
          { value: 'confirm', label: 'Confirm first — ask me before every action' },
        ]} />
      </SettingRow>

      <SettingRow label="System notifications" description="Get notified about high-priority tasks">
        <Toggle checked={preferences.systemNotifications} onChange={v => setPreferences({ systemNotifications: v })} />
      </SettingRow>

      <UpdatesSection />
    </div>
  )
}

/* ═══════════════════════════════════════════
   Updates / About
   ═══════════════════════════════════════════ */

function UpdatesSection() {
  const [state, setState] = useState<UpdateState | null>(null)

  useEffect(() => {
    window.aide.updates.getState().then(setState)
    const unsub = window.aideEvents.on((event: any) => {
      if (event.type === 'update:state') setState(event.state)
    })
    return unsub
  }, [])

  if (!state) return null

  const busy = state.status === 'checking' || state.status === 'downloading'

  const check = () => window.aide.updates.check().then(setState)
  const install = () => {
    // Optimistically reflect the restart immediately — quitAndInstall can take a
    // moment to spin up, and without instant feedback the button feels frozen.
    setState(s => (s ? { ...s, status: 'installing' } : s))
    window.aide.updates.install()
  }
  const retryDownload = () => window.aide.updates.download().then(setState)

  return (
    <div className="mt-6 pt-5 border-t border-edge">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12.5px] font-medium text-text-primary">About &amp; updates</div>
          <div className="text-[11.5px] text-text-tertiary mt-0.5">Version {state.currentVersion}</div>
        </div>
        {state.supported && state.status !== 'downloaded' && (
          <button
            onClick={check}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-text-secondary bg-surface-2 hover:bg-surface-3 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
            {state.status === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>

      {state.supported ? (
        <UpdateStatusLine state={state} onInstall={install} onRetry={retryDownload} />
      ) : (
        <div className="mt-3 text-[11.5px] text-text-tertiary">
          Update checks run automatically in the installed app. They're unavailable in this development build.
        </div>
      )}
    </div>
  )
}

function UpdateStatusLine({ state, onInstall, onRetry }: { state: UpdateState; onInstall: () => void; onRetry: () => void }) {
  if (state.status === 'not-available') {
    return (
      <div className="flex items-center gap-1.5 mt-3 text-[11.5px] text-text-tertiary">
        <CheckCircle2 size={13} className="text-emerald-500" />
        You're on the latest version.
      </div>
    )
  }

  if (state.status === 'available' || state.status === 'downloading') {
    return (
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11.5px] text-text-secondary">
          <span>Downloading version {state.latestVersion}…</span>
          <span className="text-text-tertiary">{state.progressPercent ?? 0}%</span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${state.progressPercent ?? 0}%` }} />
        </div>
      </div>
    )
  }

  if (state.status === 'downloaded' || state.status === 'installing') {
    const installing = state.status === 'installing'
    return (
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">
          <Download size={13} className="text-accent" />
          {installing ? 'Restarting to install…' : `Version ${state.latestVersion} is ready.`}
        </div>
        <button
          onClick={onInstall}
          disabled={installing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white bg-accent hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {installing && <RefreshCw size={12} className="animate-spin" />}
          {installing ? 'Restarting…' : 'Restart & install'}
        </button>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-[11.5px] text-red-500 min-w-0">
          <AlertCircle size={13} className="shrink-0" />
          <span className="truncate">{state.error || 'Update check failed.'}</span>
        </div>
        <button onClick={onRetry} className="shrink-0 ml-3 px-3 py-1.5 rounded-md text-[12px] font-medium text-text-secondary bg-surface-2 hover:bg-surface-3 transition-colors">
          Retry
        </button>
      </div>
    )
  }

  return null
}

/* ═══════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════ */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 rounded-xl bg-surface-0 border border-edge ${className}`}>{children}</div>
}

function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="p-4 rounded-xl bg-surface-2 border border-edge space-y-2.5 anim-fade-up">{children}</div>
}

function FormHint({ children }: { children: string }) {
  return <p className="text-[11px] text-text-tertiary/80 leading-relaxed">{children}</p>
}

function Desc({ children }: { children: string }) {
  return <p className="text-[12px] text-text-tertiary leading-relaxed">{children}</p>
}

function SectionLabel({ title, desc, meta }: { title: string; desc: string; meta?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[12px] font-semibold text-text-secondary">{title}</p>
        <p className="text-[12px] text-text-tertiary leading-relaxed mt-0.5">{desc}</p>
      </div>
      {meta != null && <span className="text-[11px] text-text-tertiary tabular-nums shrink-0 mt-0.5">{meta}</span>}
    </div>
  )
}

function Empty({ children }: { children: string }) {
  return (
    <div className="flex flex-col items-center py-10">
      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center mb-2">
        <FolderOpen size={14} className="text-text-tertiary" />
      </div>
      <span className="text-[12px] text-text-tertiary">{children}</span>
    </div>
  )
}

function Btn({ children, onClick, variant, disabled }: { children: React.ReactNode; onClick?: () => void; variant?: 'danger'; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-7 px-3 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        variant === 'danger'
          ? 'bg-danger/10 text-danger hover:bg-danger/15 border border-danger/15'
          : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border border-edge'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, value, onChange, placeholder, required, multiline, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; multiline?: boolean; type?: string
}) {
  const cls = "w-full bg-surface-0 border border-edge rounded-lg px-3 py-[7px] text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
  return (
    <div>
      <label className="text-[11px] text-text-tertiary font-medium block mb-1">{label}{required && ' *'}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-none h-[72px] leading-relaxed`} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  )
}

function FormActions({ onSave, onCancel, onDelete, disabled }: { onSave: () => void; onCancel: () => void; onDelete?: () => Promise<void>; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button onClick={onSave} disabled={disabled} className="h-7 px-3 rounded-lg text-[12px] font-medium bg-accent text-white hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100 transition-all inline-flex items-center gap-1.5">
        <Check size={12} /> Save
      </button>
      <button onClick={onCancel} className="h-7 px-3 rounded-lg text-[12px] text-text-tertiary hover:text-text-secondary transition-colors">Cancel</button>
      {onDelete && (
        <button onClick={onDelete} className="h-7 px-3 rounded-lg text-[12px] text-danger/70 hover:text-danger hover:bg-danger/8 transition-colors ml-auto inline-flex items-center gap-1.5">
          <Trash2 size={12} /> Delete
        </button>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative w-9 h-[22px] rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-3'}`}>
      <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'left-[19px]' : 'left-[3px]'}`} />
    </button>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-surface-0 border border-edge rounded-lg px-3 py-[6px] text-[13px] text-text-primary outline-none focus:border-accent/50 transition-colors appearance-none pr-8 min-w-[160px]"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-text-primary">{label}</p>
          <p className="text-[11px] text-text-tertiary mt-0.5">{description}</p>
        </div>
        {children}
      </div>
    </Card>
  )
}

function Tag({ children }: { children: string }) {
  return <span className="text-[11px] px-1.5 py-[1px] rounded-md bg-surface-2 text-text-tertiary border border-edge-subtle">{children}</span>
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    manager: 'bg-purple-500/10 text-purple-400 border-purple-500/15',
    peer: 'bg-surface-2 text-text-tertiary border-edge',
    report: 'bg-blue-500/10 text-blue-400 border-blue-500/15',
    external: 'bg-warning/10 text-warning border-warning/15',
    stakeholder: 'bg-success/10 text-success border-success/15'
  }
  const labels: Record<string, string> = { manager: 'Manager', peer: 'Peer', report: 'Report', external: 'External', stakeholder: 'Stakeholder' }
  return <span className={`text-[11px] px-1.5 py-[1px] rounded-md font-medium border ${styles[role] || styles.peer}`}>{labels[role] || role}</span>
}

function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron

  const [min, hour, dom, , dow] = parts

  // Normalize weekday detection: '1-5' or '1,2,3,4,5' both count as workdays
  const isWorkdays = dow === '1-5' || dow === '1,2,3,4,5'
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  let dayLabel = ''
  if (isWorkdays) {
    dayLabel = 'Weekdays'
  } else if (dow !== '*') {
    const days = dow.split(',').map(d => dayNames[parseInt(d)] || d).join('/')
    dayLabel = days
  }

  // Every N minutes
  if (min.startsWith('*/')) {
    const n = min.slice(2)
    return `Every ${n} min`
  }

  // Monthly (day-of-month specified)
  if (dom !== '*') {
    const time = `${hour}:${min.padStart(2, '0')}`
    return `Day ${dom} monthly at ${time}`
  }

  // Every hour
  if (min === '0' && hour === '*') return 'Hourly on the hour'
  // Specific hours
  if (min === '0' && hour !== '*') {
    const hours = hour.split(',').map(h => `${h}:00`)
    const prefix = dayLabel ? `${dayLabel} ` : 'Daily '
    return `${prefix}${hours.join(' and ')}`
  }
  // Specific minute and hour
  if (hour !== '*' && min !== '*') {
    const prefix = dayLabel ? `${dayLabel} ` : 'Daily '
    return `${prefix}${hour}:${min.padStart(2, '0')}`
  }
  return cron
}
