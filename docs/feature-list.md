# Aide Feature List and Implementation Audit

This document is based on PRODUCT.md and the product-design docs under docs/. It first breaks out the complete feature list, then audits each item against the current code implementation. The focus is not only whether the code exists, but whether the user path, interaction loop, error states, confirmation logic, and information visibility are sufficient for a real user to get work done.

## Audit conclusion

The current implementation is at the stage of "the product skeleton has taken shape, but the core work paths are not yet usable."

- The App Shell, left task list, right Chat, Settings Drawer, SQLite schema, and basic CRUD already have a prototype.
- Task / Project / Relation / Memory / Jobs / Connections all have a data model or a UI entry, but many paths are only shallowly connected.
- The most core promise — "automatically collect information from work systems, use the Agent to understand and handle tasks, persist memory, proactively brief, and generate daily reports" — is no longer blocked by TypeScript/build, but is still limited by unverified MCP/Connections, the lack of observability for headless Job execution, and an incomplete Agent write-operation confirmation chain.
- From a UX perspective, the biggest risk is not a missing button, but that after opening the app the user doesn't know how to complete the initial setup, can't see whether external data was actually pulled, the Agent write-operation confirmation lacks reviewable detail, and task states don't flow naturally — so it easily degenerates into a manual todo list + empty chat.

Status markers:

- [DONE] The main path basically exists and can be used directly by the user.
- [PARTIAL] There's an entry or partial implementation, but the path is incomplete.
- [SKELETON] Only a model, interface, or placeholder skeleton.
- [MISSING] Promised in the product but no usable path in the code.
- [BLOCKED] Theoretically implemented, but the current build/runtime blocks verification or use.

## Highest-priority issues

### P0-1: The build is restored, but the Agent main path still lacks runtime acceptance

Conclusion: type checking and the production build both pass, so there's no longer a need to mark Agent/Chat/Job as "build-blocked." But this only proves the code compiles and packages; it doesn't prove that the Copilot SDK session, MCP server, OAuth token, and headless Job session work at real runtime. The next step needs a runtime smoke test and a user-visible health state.

### P0-2: The product's most core "automatically collect and maintain tasks" has no real loop yet

The docs require a Job to periodically pull information from Work IQ / GitHub and, after Agent judgment, create/update Tasks. There's currently a Job seed, cron, MCP spawn, and Agent tools, and the build passes; but the external connections, MCP tool discovery, headless Agent session, and task-creation effect are still not verified at runtime. The periodic-poll "pre-filter" only checks the last run time; it doesn't first cheaply query whether external systems have new data.

User result: opening the app in the morning won't necessarily have email, Teams, PR, and calendar aggregated, and there's no clear explanation to the user of why there's no data.

### P0-3: Chat streaming messages and history refresh may cause duplicate or misplaced messages

When the renderer sends a message it first locally inserts the user message; main saves the user message and the agent message; the stream-end event triggers `fetchHistory`; then the `sendMessage` Promise returns and appends the agent message to the current store again. This timing easily produces duplicate agent messages, especially when the network is slow or stream-end arrives before the return.

Impact: the user sees the same reply twice, or the pending action attaches to the wrong message, directly damaging Chat's credibility as the "place to get things done."

### P0-4: The write-operation confirmation UX is not enough for the user to safely approve

The product requires showing the draft, the target object, and confirm/edit/cancel buttons in Chat. The current PendingAction only has a description like `execute ${request.kind}`; the UI doesn't render details and doesn't clearly show "who it's sent to, what the content is, what it will change." The Modify flow just fills the description into the input box, and the main side only handles it specially when a modification is passed in; clicking modify usually rejects the original action at the same time.

Impact: the user can't review the real write operation the Agent is about to execute, the confirm button isn't safe, and the modify path is unclear.

### P0-5: First-run onboarding is missing

The target user needs to first complete M365/GitHub connection, identity memory, projects, key relationships, and Job configuration. There's currently no first-launch wizard and no dashboard health check. On first open the user most likely sees an empty task list and empty chat, not knowing what to connect next, why the Agent has no briefing, or whether a Job failed.

## Product Module Feature List

### 1. App Shell / Dashboard / Navigation

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| APP-01 | Standalone Electron desktop app | After opening, enter a single-window workbench with local-first data storage. | [DONE] | Electron main/renderer/preload exist, SQLite exists. |
| APP-02 | No page switching: task list + Chat on one screen | The user always sees the full task picture and can chat at any time. | [DONE] | `TaskPanel` + `ChatPanel` fixed layout implements the core structure. |
| APP-03 | Chat always available | Whether in General or Task mode, the bottom input box is always usable. | [DONE] | `ChatPanel`'s bottom input is always present. |
| APP-04 | Dashboard briefing | When opening the app in the morning, the Agent proactively gives today's overview and priority suggestions. | [PARTIAL] | main has `triggerMorningBriefingIfNeeded`, build passes; but it depends on a real Agent/Connection runtime, and the UI has no briefing loading/error state. |
| APP-05 | Settings drawer rather than page | The gear opens a right-side drawer to manage configuration. | [DONE] | SettingsDrawer implements tabs. |
| APP-06 | First-launch wizard | Guides connecting accounts, creating projects, setting L0, and turning Jobs on/off. | [MISSING] | No onboarding, and no "configuration incomplete" prompt. |
| APP-07 | Global error/health status | Tells the user whether the SDK, MCP, Job, and OAuth are working. | [MISSING] | Errors are mostly in the console or locally thrown, invisible to the user. |

### 2. Task Module

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| TASK-01 | Task data model | Title, description, status, priority, source, project, related people, time, UI state, Agent processing record. | [PARTIAL] | shared/db is basically complete, but `source.connectionId` is missing, so source can't be traced back to a specific connection. |
| TASK-02 | User manually creates a task | The user can quickly create a task, and should also be able to add description, priority, due date, project, related people. | [PARTIAL] | The UI can only input a title, source=user; there's no new-task detail form. |
| TASK-03 | Agent creates tasks from conversation | The user says "note this down / handle this," and the Agent creates a Task. | [PARTIAL] | The `create_task` tool exists and the build passes; but there's no runtime smoke test, and no UI-side confirmation or feedback that a non-high-priority task was created. |
| TASK-04 | Job/Connection auto-creates tasks | Email, Teams, meetings, GitHub notifications enter the task pool. | [PARTIAL] | The Job + MCP skeleton exists and the build passes, but external data pulling and Agent decisions are not verified at runtime. |
| TASK-05 | Active list | Incomplete tasks sorted by priority, showing new, due, overdue. | [PARTIAL] | Active/Due/new are shown; no project/source summary; the sort logic is coarse, and deadline comparison relies on strings. |
| TASK-06 | Done history | Completed tasks grouped by date, today/yesterday first, expandable to earlier. | [PARTIAL] | The UI has grouping and "earlier"; but cancelled tasks are also put into "completed," easily polluting history and daily-report semantics. |
| TASK-07 | Task filtering | Filter by priority, project, status. | [PARTIAL] | main `listTasks(filter)` supports it, the UI has no filter entry. |
| TASK-08 | Single-task detail | Click a task to enter Task Chat and see source, status, project, deadline, related people. | [PARTIAL] | The header only shows priority/source/due/external link; it doesn't show description/project/relation/result/history. |
| TASK-09 | Agent's first task explanation | On first entering a Task, the Agent proactively explains what the task is and how it suggests handling it. | [PARTIAL] | `triggerFirstMessage` exists and the stream field passes type checking; but it depends on a real Agent runtime, with no UI fallback on failure. |
| TASK-10 | State machine | pending -> in_progress -> completed/cancelled; complete/cancel are irreversible. | [PARTIAL] | The backend restricts terminal revert; but the user entering / the Agent starting processing doesn't automatically change to in_progress. |
| TASK-11 | Complete/cancel quick actions | The user can complete or cancel via hover, right-click, or header. | [DONE] | Implemented in multiple places in the UI. |
| TASK-12 | Lower priority | The user can sink a task to the bottom. | [DONE] | The right-click menu sets priority=low. |
| TASK-13 | Snooze until a set time | The user can choose "look on Friday" etc.; it reappears at the time. | [PARTIAL] | Only tomorrow/next-week quick options, no arbitrary time selection; 60s refresh. |
| TASK-14 | Batch cleanup | Multi-select batch complete/cancel/snooze. | [PARTIAL] | Batch complete/cancel exist; batch snooze doesn't. |
| TASK-15 | Active bloat control | By default show only the top N; the Agent suggests cleaning up long-term low-value tasks at end of day. | [PARTIAL] | The visible cap exists; Agent proactive cleanup is only a job instruction, with no UI batch suggestion confirmation. |
| TASK-16 | Deduplication | Exact externalId dedup + content-similarity dedup. | [PARTIAL] | externalId + Jaccard title implemented; with Chinese lacking spaces, similarity is very weak, insufficient for the target user's context. |
| TASK-17 | Automatic priority | Auto-sort based on deadline, relation role, source. | [PARTIAL] | Simple scoring for deadline/relation/source; no "has been chased" or "project importance." |
| TASK-18 | View linked source | Jump from a task back to the email/PR/event. | [PARTIAL] | externalUrl only shows a small arrow; no source title, system name, or accessible error handling. |
| TASK-19 | Task editing | The user can modify title, description, status, priority, project, related people, deadline. | [MISSING] | No task detail/edit form; only local quick status/priority changes. |
| TASK-20 | Task result confirm/reject | After the Agent processes, the user confirms, modifies, or rejects the result. | [PARTIAL] | The PendingAction UI has buttons, but the content and state flow are incomplete. |

### 3. Chat / Agent Module

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| CHAT-01 | General Chat | The user can freely ask questions and instruct the Agent to create/query/handle tasks. | [PARTIAL] | The UI and Agent invocation path exist and the build passes; still lacks a runtime smoke test and visible error states. |
| CHAT-02 | Task Chat | After selecting a Task, Chat automatically carries the task context. | [PARTIAL] | Context assembly exists and the build passes; still depends on the Agent runtime, and the UI header lacks full context. |
| CHAT-03 | Chat history | General and each Task have persistent history. | [PARTIAL] | `chat_messages` exists; but the stream/fetch/append timing may duplicate. |
| CHAT-04 | Streaming replies | Agent output is shown streaming. | [PARTIAL] | The stream fields of sendMessage and triggerFirstMessage pass type checking; the real SDK event order is still unverified, and chat history/final append may duplicate. |
| CHAT-05 | Dynamic system prompt | Fixed role + L0 + Task + Project + Relation. | [PARTIAL] | The build function exists; no real token-budget truncation is seen. |
| CHAT-06 | L1 Memory retrieval injection | Each turn retrieves relevant memory based on the user message. | [PARTIAL] | The hook exists; no retrieval log / citation-transparency UI. |
| CHAT-07 | Project context injection | When handling a task, knows repo/docs/tech stack/notes. | [PARTIAL] | Only injects description + techStack; repoPath/docsPath/notes are not injected, and there's no on-demand read capability. |
| CHAT-08 | Relation context injection | When handling a task, knows the person's role, expertise, communication style. | [PARTIAL] | relation info is assembled; but automatic relationship discovery/enrichment is missing. |
| CHAT-09 | Internal tools | memory_write/search, create/update/query_task, generate_report. | [PARTIAL] | The tools exist; but update_task's default confirmation path doesn't form a reviewable action card. |
| CHAT-10 | External MCP tools | Work IQ + GitHub tools registered to the Agent. | [SKELETON] | MCP spawn/list/call framework exists; server schema, auth token, and tool permission unverified. |
| CHAT-11 | Write-operation permission | Reads automatic, memory notified, writes confirmed. | [PARTIAL] | The rule intent exists; but `skipPermission` bypasses create_task/memory_write, and the default handler's request kind vs. the real SDK type is uncertain. |
| CHAT-12 | PendingAction card | Shows operation content, target, confirm/modify/cancel. | [PARTIAL] | The UI has buttons, lacks details rendering and taskId binding. |
| CHAT-13 | Modify draft | After clicking "modify," the user edits the draft and re-confirms. | [PARTIAL] | Currently just stuffs the description into the input box, the original action is usually rejected; no secondary confirmation card. |
| CHAT-14 | Recognize existing Tasks in General | The Agent suggests switching to the relevant task. | [SKELETON] | Only a prompt instruction, no UI affordance or task-switch action. |
| CHAT-15 | Session restore | Task session / general session can be restored. | [PARTIAL] | The SDK resume code exists and the build passes; but the task session is fixed at `task-{id}-1`, with no attempt management and no restore-failure experience. |
| CHAT-16 | Session-end archiving | The conversation summary enters L2, and the Task processing state is updated. | [PARTIAL] | L2 writes a summary; doesn't update the Task working state/result, and has no gap-filling extraction implementation. |

### 4. Connection Module

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| CONN-01 | M365/Work IQ connection | After the user authorizes, can read Outlook/Teams/Calendar/SharePoint/People. | [SKELETON] | OAuth + MCP config exists; whether a real Work IQ server/env/token is compatible is unverified. |
| CONN-02 | GitHub connection | After the user authorizes, can read/write issues/PR/repos/notifications. | [SKELETON] | OAuth + MCP config exists; the MCP server usually needs token env name confirmation. |
| CONN-03 | Add/remove external connection | The user can connect, re-authorize, disconnect. | [PARTIAL] | The UI has connect/disconnect; after disconnect it doesn't proactively stop the MCP server, and there's no status event. |
| CONN-04 | Permission config read-only/read-write | Each connection can configure a permission scope. | [MISSING] | The UI only has OAuth client config; no read-only/read-write level. |
| CONN-05 | OAuth config | The user fills in client id/tenant/token config. | [PARTIAL] | Can be saved; but the GitHub client secret is stored in plaintext as ordinary config in `memory_entries`, high risk. |
| CONN-06 | Token refresh | Auto-refresh or prompt when authorization expires. | [MISSING] | The refresh token is stored but no refresh flow is used. |
| CONN-07 | Explainable connection status | Show not-configured / not-authorized / auth-failed / MCP-start-failed. | [PARTIAL] | lastError only has the authenticate catch; MCP start failure only console.error. |
| CONN-08 | External source traceable | A Task can know which connection and which email/PR it came from. | [PARTIAL] | externalId/externalUrl exist; connectionId is missing. |

### 5. Project Module

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| PROJ-01 | Project CRUD | The user can create, view, edit, delete projects. | [PARTIAL] | UI + IPC + DB exist. On create, the `notes` field is submitted by the UI but not saved by `CreateProjectInput`/insert, so user input is silently lost. |
| PROJ-02 | repo/docs paths | When the Agent handles code/doc tasks, it can locate the repo and docs. | [PARTIAL] | Fields are saved; the Agent doesn't use repoPath/docsPath to search or read. |
| PROJ-03 | techStack/team/notes | Provide soft context to the Agent. | [PARTIAL] | techStack/team are saved; create notes are lost; the Agent doesn't inject notes/team. |
| PROJ-04 | Tasks linked to projects | A Task can be linked to a Project and filtered by project. | [PARTIAL] | The data model/API support it; the UI for creating/editing tasks can't link a project, and the list doesn't show the project. |
| PROJ-05 | Agent enriches project info | Learn project description, conventions, notes during conversation. | [SKELETON] | Only an updateProject API, no Agent tool. |

### 6. Relation Module

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| REL-01 | Relation CRUD | The user configures boss, colleagues, external people, etc. | [PARTIAL] | UI + IPC + DB exist. On create, the `notes` field is likewise silently lost. |
| REL-02 | role/timezone/expertise/style | The Agent uses these for priority and communication style. | [PARTIAL] | Fields exist; automatic use only shows up as a simple priority-role bonus and context assembly. |
| REL-03 | Automatic relationship discovery | The Agent identifies new people from the information stream and proposes adding them. | [MISSING] | No tool, UI pending suggestion, or job logic. |
| REL-04 | Auto-enrich relationship attributes | The Agent observes communication preferences, expertise, etc. from interactions. | [SKELETON] | The docs have the idea, the code has no implementation. |
| REL-05 | Reference cleanup after deletion | After deleting a relation, task/memory references don't linger. | [PARTIAL] | task related ids are cleaned up; person knowledge in memory isn't handled. |

### 7. Skill / Extensibility

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| SKILL-01 | View installed Skills / capability list | In Settings, see what the Agent can do and which Skills / MCPs are installed. | [MISSING] | docs/skill.md defines Skill as a first-class extension unit (on par with MCP tools), but Settings has no Skill tab yet. |
| SKILL-02 | Install / customize Skills | The user installs from an MCP Registry / community catalog, or creates / edits a custom Skill locally. | [MISSING] | Needs: SKILL.md loading (SDK skillDirectories) + MCP install flow + marketplace source. This is the core of an extensible architecture. |
| SKILL-03 | Tool registration | The Agent session registers internal + MCP tools. | [PARTIAL] | `buildTools` exists and the build passes; MCP tool discovery/call is still unverified at runtime. |
| SKILL-04 | Tool permission explanation | The user knows which are automatic, which need confirmation, and the tool scope each Skill declares. | [PARTIAL] | Preferences has autonomyLevel, but there's no visible explanation per tool / Skill. |

### 8. Job Module

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| JOB-01 | Default morning aggregation | On weekday mornings, collect new info and generate tasks/briefing. | [PARTIAL] | seed + scheduler exist and the build passes; depend on the Agent/Connections runtime, lacking running/failure visibility. |
| JOB-02 | Periodic polling | Check for new email/Teams/GitHub every 15 minutes. | [PARTIAL] | The scheduler exists; no real low-cost external pre-filter, and MCP data pulling unverified. |
| JOB-03 | End-of-day reconciliation | Backfill missed tasks, update completed status, suggest cleanup, generate the daily report. | [PARTIAL] | The job instruction exists; no confirmable cleanup UI, daily-report entry, or reconciliation result detail. |
| JOB-04 | Job list | The user views built-in jobs, frequency, last result. | [PARTIAL] | Settings shows jobs and lastSummary. |
| JOB-05 | Job toggle | The user can enable/disable. | [PARTIAL] | IPC has toggle; after clicking, the UI doesn't refresh the store, so the toggle visual state may not update. |
| JOB-06 | Create/edit/delete Job | The user configures frequency and instructions. | [DONE] | JobForm supports create/edit/delete with name, cron, instruction, and delivery targets. |
| JOB-07 | Job execution records | The user views historical run logs. | [PARTIAL] | Only last result/summary, no history list, duration, error stack, or which tasks were created. |
| JOB-08 | Job failure notification | The user knows when SDK/connection/auth fails. | [MISSING] | catch writes last_summary, but there's no event notification and no dashboard health. |
| JOB-09 | Per-job result delivery | When a job finishes, push its summary to the chosen Channels (Aide chat / WeChat / none). | [DONE] | `deliveryTargets` on the Job, `delivery.ts` dispatcher with per-target isolation; desktop delivery persists to General chat, WeChat sends to the bot. |

### 9. Memory Module

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| MEM-01 | View/edit L0 Identity | The user edits the core identity profile, with the 1K limit visible. | [DONE] | The Memory tab has a textarea and a character count. |
| MEM-02 | L1/L2 list | The user browses the memories the Agent has accumulated. | [PARTIAL] | Only lists the top 100 active L1/L2; no pagination. |
| MEM-03 | Memory search/filter | Search by layer, project, tag, status. | [MISSING] | The API has some list/search capability; the UI has no search/filter. |
| MEM-04 | L1 editing | The user corrects wrong memory content and tags. | [MISSING] | The UI can only delete. |
| MEM-05 | Delete any memory | The user can delete wrong/sensitive memories. | [PARTIAL] | The UI deletes L1/L2; L0 can be overwritten; no delete confirmation. |
| MEM-06 | inactive audit chain | Wrong memories marked inactive, no longer retrieved but auditable. | [PARTIAL] | `markMemoryInactive` exists but the UI/Agent tool remove is a hard delete. |
| MEM-07 | FTS5 retrieval | The Agent can retrieve memories by keyword. | [PARTIAL] | searchMemory is implemented; Chinese tokenization and query escaping may be insufficient. |
| MEM-08 | Retrieval transparency | The user can ask "which memories were used this turn" and see the sources. | [MISSING] | No retrieval log and no answer-citation mechanism. |
| MEM-09 | Archive Session/Task to L2 | After completing a task, retain conclusions long-term. | [PARTIAL] | onSessionEnd writes finalMessage; no task-completed hook, and doesn't clean up task working state. |
| MEM-10 | Memory export | Export JSON/Markdown. | [MISSING] | Mentioned in the roadmap / user control, no code. |
| MEM-11 | Secret and Memory isolation | OAuth secrets/tokens shouldn't be mixed into the user memory model. | [PARTIAL] | Tokens are encrypted and put in the L0 table; the GitHub client secret is plaintext in config; architecturally easy to confuse with user-editable memory. |

### 10. Report / Daily / Weekly Summary

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| RPT-01 | Generate daily report | Before leaving work, the user sees a daily report based on tasks and the information stream. | [SKELETON] | The `generate_report` tool only tallies task status; the end-of-day job instruction mentions a daily report, but there's no UI to view/confirm. |
| RPT-02 | Generate weekly report | The user can proactively have the Agent summarize a week. | [SKELETON] | The tool supports a weekly parameter; no clear UI or prompt shortcut. |
| RPT-03 | Include external completed items in the report | Emails replied, PRs merged, etc. auto-reconciled. | [MISSING] | Needs Connection + Job + Agent judgment, currently no real loop. |
| RPT-04 | Report editable/confirmable/copyable | The user can review, modify, send, or copy. | [MISSING] | No report view or confirmation card. |

### 11. Preferences / Notifications

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| PREF-01 | Language preference | The Agent replies in Chinese/English. | [PARTIAL] | Written into preferences and into the system prompt; depends on the Agent. |
| PREF-02 | Autonomy level | default/auto/confirm controls the confirmation policy. | [PARTIAL] | The UI and handler exist; tool skipPermission and the real SDK request kind may render the policy ineffective. |
| PREF-03 | System notifications | High-priority urgent tasks trigger a system notification. | [PARTIAL] | Only triggered when the create_task tool creates a high-priority task; external Job/connection-status failures don't notify. |
| PREF-04 | Active cap | The user configures the number of tasks shown in the sidebar. | [DONE] | UI + store use it. |
| PREF-05 | Theme preference | The user configures the theme. | [MISSING] | PRODUCT mentions notification/theme preferences, the code has no theme option. |

### 12. Channel / Remote access

A Channel is how Aide reaches the user and takes commands outside the app — distinct from a Connection (a work Source). The built-in Aide chat is the always-on local channel; WeChat is the first remote one.

| ID | Feature | Expected user experience | Implementation status | Audit notes |
|---|---|---|---|---|
| CHAN-01 | WeChat connection | The user scans a QR code to bind a WeChat bot and sees connection status. | [PARTIAL] | QR sign-in + status + polling exist; depends on the WeChat bot service runtime. |
| CHAN-02 | Two-way remote chat | The user messages the bot and the Agent replies; the user can issue commands without opening the app. | [PARTIAL] | Inbound messages route to the Agent; quick commands + confirmation replies handled. |
| CHAN-03 | Result delivery to Channels | Job results are pushed to the chosen Channels (Aide chat / WeChat). | [DONE] | `deliveryTargets` + `delivery.ts` registry; per-target isolation; desktop persists to General chat. |
| CHAN-04 | Sources vs Channels in Settings | Connections are grouped into Sources (M365/GitHub) and Channels (WeChat). | [DONE] | SettingsDrawer Connections tab shows two stacked sections. |
| CHAN-05 | Additional channels | Telegram / Slack as future remote channels. | [MISSING] | Roadmap; the delivery registry is structured to extend, but only desktop + WeChat exist. |

## User Journey Audit

### UF-01: First launch of the app

Expected path: open the app -> see welcome/health status -> connect M365/GitHub -> fill in identity memory -> add projects/relationships -> confirm Jobs -> get the first briefing.

Current status: [MISSING]

Actual experience: the user sees an empty task list and empty Chat. Connections can be made in Settings, but there's no clear order, no missing-item check, and no explanation of where Work IQ/GitHub OAuth config comes from. SDK init failure or MCP start failure mostly go to the console.

Key issue: this product depends heavily on external connections and personal context; without onboarding the user will mistakenly think the product "does nothing."

### UF-02: See the full picture at 9 AM

Expected path: the app has run morning aggregation in the background / after opening -> new tasks appear on the left -> the right General Chat has a briefing -> the user clicks the highest-priority task.

Current status: [PARTIAL]

Existing: the default morning job, `triggerMorningBriefingIfNeeded`, Chat message injection.

Gaps: the build passes, but a real Agent/Connection runtime is unverified; there's no indication the job is running; no "last aggregation failed because M365/GitHub isn't connected"; no display of which tasks were created this time; the briefing may only be saved as a chat message, and the Dashboard has no dedicated summary area.

### UF-03: Scan the full task picture

Expected path: within 30 seconds the user sees the top of Active, priority, deadline, new markers, source, project, and task count.

Current status: [PARTIAL]

Existing: Active/Done sections, priority color dots, new dots, due text, cap expansion.

Gaps: source and project are invisible; can't filter by project/status/priority; no explanation of "why is this task high priority"; cancelled tasks mix into Done; list health cleanup is just hide/expand, not real maintenance.

### UF-04: User manually creates a task

Expected path: the user quickly types a title; if needed adds deadline/project/relation/priority; the task enters Active and can be handled immediately.

Current status: [PARTIAL]

Existing: the sidebar `+` inputs a title to create.

Gaps: can only fill in a title; can't fill description, due, project, related people; a newly created task isn't auto-selected, and there's no guidance into Task Chat.

### UF-05: Click a task to enter the processing context

Expected path: click a task -> the new marker disappears -> Chat enters Task mode -> the Agent's first message explains the task's source/background/suggestion -> the user directly says "handle it."

Current status: [PARTIAL]

Existing: selectTask, markSeen, TaskHeader, triggerFirstMessage entry.

Gaps: the build passes, but the first message still has no runtime smoke test; no fallback on failure; the header info is too thin; the task doesn't enter in_progress; no static-detail fallback.

### UF-06: Quickly ask about a historical fact in General

Expected path: the user asks "what date did A say the deadline was last week?" -> the Agent searches Memory + Work IQ -> gives the answer and source.

Current status: [PARTIAL]

Existing: General chat, memory_search, the Work IQ MCP design.

Gaps: the build passes, but the Agent runtime, Work IQ, and Memory retrieval injection effect are unverified; Memory retrieval has no source transparency; doesn't tell the user where the answer came from.

### UF-07: The Agent handles a task and executes a write operation

Expected path: the user says "approve the PR and comment LGTM" -> the Agent reads the PR diff -> generates a plan -> shows a confirmation card with the target PR, comment content, and impact -> the user confirms -> executes -> the task is completed.

Current status: [SKELETON]

Existing: the MCP tools framework, permission request, PendingAction UI.

Gaps: MCP/GitHub unverified; the confirmation card doesn't show the actual operation details; the pending action has no taskId; after execution it doesn't firmly bind to task completion; failure recovery is missing.

### UF-08: Modify the Agent's draft

Expected path: the Agent gives an email draft -> the user clicks modify -> the draft enters edit mode -> the user finishes editing -> confirms send again.

Current status: [PARTIAL]

Existing: the ActionCard's modify button, the modifyDraft store.

Gaps: what's filled in is the action description, not the real draft; after modifying it's just normal chat input, with no regenerated confirmation card; the original permission promise may already be rejected.

### UF-09: The user completes/cancels/snoozes a task themselves

Expected path: the user completes, cancels, lowers priority, or snoozes to a day via hover/right-click/header; the list updates immediately; Done records the completion time.

Current status: [PARTIAL]

Existing: complete/cancel/lower/tomorrow/next-week snooze, batch complete/cancel.

Gaps: no arbitrary date; cancelled tasks appear in Done like completed ones; complete/cancel have no undo; no error toast; after completing, the user still stays in the completed task chat.

### UF-10: Configure external connections

Expected path: the user sees M365/GitHub status in Settings, clicks connect, completes authorization, the status turns green; on failure, knows the reason and next step.

Current status: [PARTIAL]

Existing: the connection list, OAuth window, config form, status event.

Gaps: no admin consent/redirect URI guidance; the GitHub secret is stored in plaintext; MCP start failure is invisible; disconnect doesn't stop the server; no read-only/read-write permission config.

### UF-11: Configure Project / Relation

Expected path: the user adds projects and relationships; the Agent automatically uses this info later.

Current status: [PARTIAL]

Existing: CRUD UI and DB.

Gaps: Project/Relation notes are silently lost on create; Tasks can't be linked to a project/relationship in the UI; the Agent uses only a few fields; no auto-completion or proposal to add.

### UF-12: View and correct Memory

Expected path: the user sees L0/L1/L2, searches, filters, edits, deletes; after correction the Agent no longer repeats the error.

Current status: [PARTIAL]

Existing: L0 editing, L1/L2 list, delete.

Gaps: can't search/filter/edit L1; delete has no confirmation; the inactive audit chain has no UI; the Agent correcting old memory is just a prompt requirement, lacking a verified tool flow.

### UF-13: Manage Jobs

Expected path: the user views the morning/poll/end-of-day jobs, modifies times, runs manually, views history.

Current status: [PARTIAL]

Existing: list, toggle, last summary.

Gaps: the visual may not refresh after toggle; no create/edit/delete/manual-run; no historical execution records; failures don't proactively prompt.

### UF-14: Generate daily/weekly reports

Expected path: the user or the end-of-day job triggers -> the Agent summarizes tasks, external events, completed-but-uncreated tasks -> generates an editable report.

Current status: [SKELETON]

Existing: the generate_report tool tallies task counts.

Gaps: doesn't retrieve L2 or external systems; no report UI; no edit/confirm/copy path; end-of-day reconciliation can't automatically recognize "the user already completed it externally."

### UF-15: Errors and recovery

Expected path: OAuth failure, SDK failure, MCP failure, Job failure, DB failure, and Agent timeout all have user-understandable prompts and retries.

Current status: [MISSING]

Currently most failure paths just go to the console, throw, or show one error message in chat. There's no global toast, health panel, retry button, or debug export.

## Key Product Risks

1. Agent dependency is too concentrated, but there's no degraded experience. Chat/Job/Briefing/Task first message all depend on the SDK; once the SDK fails, the product needs to still behave like a reliable task board, not a blank screen.
2. The "task as context" design hasn't landed yet. The Task Header is too thin, Task details have no static fallback, and Project/Relation/Memory injection doesn't cover key fields.
3. The confirmation interaction hasn't reached "reviewable." Write operations must show the operation target, content, permission, consequences, and failure recovery; currently it's just a generic action.
4. Settings is a collection of config forms, not a success path. The user needs to know which config is required, what's currently missing, and what's next.
5. Automation has no observability. What the Job actually checked, which tasks it created, what it skipped, and where it failed are invisible to the user.
6. Memory's "correctability" isn't enough yet. Being able to view and delete isn't the same as being correctable; it needs search, edit, source, inactive status, and transparency about what was used this turn.
7. The data security boundary is unclear. OAuth token/config/preference/window state share one table with Memory, and the GitHub secret is stored in plaintext, which mixes "the user owns their memory" with "app-internal secrets."

## Recommended Implementation Order

### Phase 1: Make the existing skeleton trustworthy

1. Add an Agent runtime smoke test: run one reproducible path each for General chat, Task first message, the create_task tool, and the job session.
2. Fix the stream-end/history/final-append timing of the Chat store / main IPC to ensure messages don't duplicate.
3. Add visible health states for SDK/MCP/Job: not-initialized, not-authorized, running, failed, retryable.
4. Complete PendingAction's details rendering and taskId binding, and change the modify flow to "edit draft -> re-confirm."
5. Fix the silent loss of notes on Project/Relation create.

### Phase 2: Close core MVP user paths

1. Build a first-launch checklist: connect M365/GitHub, fill in L0, add projects, add relationships, confirm Jobs.
2. Build Task detail/edit capability: description, priority, deadline, project, relations, source, result.
3. Give Task entering/leaving in_progress clear rules: user enters, Agent starts processing, completes/cancels.
4. Add manual run, history records, and failure display to Jobs; make periodic-poll do a real external pre-filter.
5. Add search, filter, edit, inactive, and source display to Memory.

### Phase 3: Make the product feel like an agent, not a todo app

1. The morning briefing shows the read scope this time, created/updated tasks, skip reasons, and suggestions.
2. End-of-day reconciliation adds a "suggested cleanup" confirmation card instead of just writing it in the summary.
3. The report view supports edit, copy, confirm-send.
4. Skill/Tool visualization: tell the user what the Agent can do, which Skills/MCPs are installed, and which operations need confirmation; provide an entry to install new capabilities from an MCP Registry / community catalog.
5. Improve external-source deep links and permission config: read-only/read-write, connection-level scope, token refresh.
