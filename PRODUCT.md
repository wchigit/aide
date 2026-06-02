# Aide — Product Definition

> A personal work agent that sees the full picture, learns as you work, and helps you get things done.

---

## 1. Problem

### Core pain points

**Pain 1: Tasks are scattered, with no unified view**

Work is spread across email, Teams, GitHub, and meeting notes — there's no single place to see the whole picture. Prioritizing is hard, and implicit commitments slip through the cracks. Traditional task managers (ADO, Loop) require you to create tasks and maintain their status by hand, which is really just one more layer of overhead.

**Pain 2: AI starts from zero every time**

Today's AI tools (ChatGPT, Copilot, Claude, etc.) need extensive context setup for every conversation — explaining the project background, who's who, and past decisions. Five minutes of setup for two minutes of help. No AI continuously accumulates an understanding of your work.

**Pain 3: Work leaves no trace; reviews rely on memory**

You do a lot every day, but none of it is recorded automatically. When it's time to write a daily or weekly report, you're left piecing it together from chat logs, email, and git history. Maintaining those reports by hand is tedious, so most people either skip them or write incomplete ones.

### Core need

> One place to manage all my work tasks — automatically collected from everywhere, automatically kept up to date, with the full picture always visible. The AI already knows my work context, so I can just say what I need and it helps.

### Why existing solutions fall short

| Category | Examples | Strengths | What's missing |
|------|---------|------|--------|
| AI assistants | Copilot, Claude | Agentic, can run complex tasks, have memory, project context, tool integration | Conversation-centric; no persistent task lifecycle; not proactive |
| Autonomous agents | OpenClaw, Hermes | Always running, deeply personalized, proactively learn the user, connect to many services | Not focused on work-task management and tracking |
| Task managers | ADO, Loop | Structured task management, team collaboration | Not intelligent; tasks must be created and maintained by hand |
| Automation | Zapier, Power Automate | Cross-system connectivity, trigger-based execution | Rigid rules, no judgment |

---

## 2. Target user

**Employees at large companies who work within structured workflows.**

### User characteristics

- Use multiple work systems daily (Teams, Outlook, ADO, SharePoint, GitHub, etc.)
- Information pours in from many channels: email, chat, meetings, PRs, work items
- Have reporting obligations: regular daily/weekly reports or status updates
- Tasks come from scattered sources: meeting action items, email requests, Teams messages, ADO assignments, etc.
- Work in an organization with defined processes — not a "do whatever" solo setup

## 3. Positioning

### In one sentence

A personal AI agent that helps you see the full picture of your work, continuously builds up your work context, and assists you in getting tasks done.

### What we do

- **Aggregate** — automatically collect, organize, and track tasks from all your work systems, unified in one place
- **Understand** — proactively and continuously build an understanding of your projects, people, and history, so you never have to re-explain context
- **Act** — handle tasks the way you would, using that context: prioritize, communicate, execute, deliver

## 4. User scenarios

### A typical day

**9:00 AM — Start work, see the whole picture**

Open the app. The agent has already organized the email, Teams messages, GitHub notifications, and calendar events from last night until now, generated today's task list, and sorted it by priority. Thirty seconds to scan it and know the few most important things today.

**10:00 AM — Post-meeting follow-up, no dropped commitments**

A 30-minute Teams meeting ends. The agent automatically extracts action items from the meeting notes, links them to the right project, and tags owners and deadlines. No need to manually record "what I promised."

**2:00 PM — Handle a task, no context setup**

Open a task "fix the pagination bug a user reported." The agent already knows which project this is, the code structure, and the related issue discussion. It goes straight to the problem code, produces a fix and test cases, and opens a PR.

**3:00 PM — Lean on the agent's memory and global view**

"What did A conclude about that API change last week?" — the agent answers directly from email, Teams, and meeting records, no digging required. Preparing for tomorrow's report, the agent pulls the relevant information scattered across ADO, email, Teams, and GitHub into one complete view.

**6:00 PM — Auto-reconcile and generate the daily report**

The agent reviews all of today's information flow: some tasks the user already handled themselves (replied to an email directly), some things were resolved before a task was even created. The agent identifies these, updates task statuses, backfills records, and generates the daily report.

## 5. Core concepts

### Entity definitions

**Task** — the central entity; everything revolves around it
- Sources: auto-collected from Connections, generated on schedule by Jobs, or created through user–agent conversation
- Status: pending / in progress / completed / cancelled

**Connection** — an external work system (a *Source*)
- Types: Outlook, Teams, GitHub, ADO, SharePoint, Calendar, etc.
- Capabilities: read information, and (once authorized) perform write actions
- Both the source of Tasks and the conduit through which Tasks are executed

**Channel** — how Aide reaches you and takes commands outside the app
- Types: WeChat (now); Telegram / Slack (later)
- Purpose: deliver Job results and reports to you on the go, and receive remote instructions when the app isn't in front of you
- Distinct from Connection: a Connection is a *Source* Aide reads work from; a Channel is a *delivery + command* surface between you and Aide. The built-in Aide chat is the always-on local channel; WeChat is the first remote one.

**Project** — the user's work project
- Contents: code repository, project docs, wiki
- Purpose: provide background knowledge when the agent handles a Task

**Relation** — the user's network of working relationships
- Attributes: role (manager/peer/report/external), communication preferences, time zone, expertise
- Purpose: help the agent judge task priority, choose the communication channel, and identify the delivery target

**Skill** — an extensible capability unit, peer to MCP tools
- Types: built-in (email drafting, summarization, code generation, etc.) + MCP servers + community / user-defined
- Form: `SKILL.md` (instruction / knowledge injection) + optional bundled tools + optional MCP server dependency
- Purpose: make Aide's capabilities installable, publishable, and composable instead of hard-coded; the agent loads the right Skill on demand when handling a Task
- Sources: built-in / MCP Registry / community catalog / local project (see docs/skill.md)

**Job** — scheduled automation
- Examples: aggregate information every morning to generate the task list; reconcile and generate a daily report before end of day
- Periodically checks each Connection for new information and creates a Task when it finds something that needs handling

**Memory** — the agent's continuous understanding of the user's work
- Contents: user preferences, past decisions, project progress, interpersonal interaction patterns
- Source: accumulated automatically from day-to-day Task handling
- Can be viewed, corrected, and deleted by the user

### Entity relationships

```
Information collection (proactive):
  Job --[scheduled trigger]--> Connection --[pull info]--> Agent --[identify/create]--> Task

Information collection (passive):
  User conversation --[instruction]--> Agent --[create]--> Task

When the Agent handles a Task:
  read Project (project context)
  read Relation (working relationships)
  read Memory (past experience)
  select Skill (execution capability)
  call Connection (read/write external systems)

Memory accumulation:
  Task-handling process --[distill]--> Memory
  Information observed by the Agent --[distill]--> Memory

Result delivery (proactive, outbound):
  Job / Task result --[deliver]--> Channel (Aide chat / WeChat) --> User

Remote command (passive, inbound):
  User message via Channel --[instruction]--> Agent --[handle]--> Task
```

## 6. Features

### General principle

Every entity (Task, Connection, Project, Relation, Skill, Job, Memory) can be created and maintained two ways:
1. **By the agent** — the user instructs the agent in conversation, or the agent discovers, creates, and updates things automatically from the daily information flow
2. **By the user in the UI** — the user views, edits, and manages directly through the interface

### Task

- View the task list (filter by priority, project, status)
- View a single task's details (linked sources, context, history)
- Have the agent handle a task (draft a reply, write a doc, write code, etc.)
- Confirm / modify / reject the agent's results
- Generate daily / weekly reports (auto-generated from task records)

### Connection

- Add / remove external system connections
- Configure each Connection's permissions (read-only / read-write)

### Channel

- Connect / disconnect chat channels (WeChat now; Telegram / Slack later)
- Two-way: receive the Agent's pushes and send it commands remotely
- Per-Job choice of which channels receive that Job's result (Aide chat / WeChat / none)

### Project

- Configure project context (point to the code repo, docs directory, etc.)

### Relation

- Set role, communication preferences, time zone, expertise, and other attributes

### Skill

- View the list of installed Skills / MCP capabilities
- Search and one-click install new capabilities from the MCP Registry / community catalog
- Add / create / edit local custom Skills
- View the tool permissions each Skill declares

### Job

- Create / edit / delete scheduled jobs (including run-frequency configuration)
- Choose where each Job delivers its result (Aide chat / WeChat / none)
- View Job run history

### Memory

- View the memory the agent has accumulated
- Correct / delete incorrect memories

## 7. Interaction design

A standalone desktop app, conversation-first with a supporting Dashboard.

The app contains:
- **Dashboard** — shows the full task picture, status overview, and the agent's briefing; the entry point for "seeing"
- **Chat window** — tell the agent things, give instructions, ask questions, confirm results; the entry point for "doing"
- **Settings pages** — manage Connections (Sources & Channels), Projects, Relations, Skills, Jobs, Memory

Users can click a task from the Dashboard to enter the conversation, or simply describe it in chat and let the agent identify the matching task. All configuration can be done through the UI or by asking the agent.

## 8. Technical approach

| Decision | Choice | Rationale |
|------|------|------|
| Product form | Local desktop app (Electron) | Personal tool, sensitive data, local-first; the Copilot SDK for TypeScript is the most mature, and Electron is a natural fit |
| AI engine | GitHub Copilot SDK | Provides the agent reasoning loop, tool orchestration, and session persistence; no need to build our own LLM call layer |
| External connections | MCP protocol | A standardized tool/resource protocol with the largest ecosystem and many TS implementations |
| Storage | Local SQLite + filesystem | No server needed, sufficient for a single-user scenario, easy to migrate and back up |
| Language | TypeScript everywhere | Unifies Electron + Copilot SDK + MCP; one language throughout |

## 9. MVP scope

The full scope defined in sections 1–8 is the MVP. Goal: be usable for my own daily work.

## 10. Roadmap (post-MVP)

| Direction | Description |
|------|------|
| Permission control system | Configure autonomy level by action type/source: which actions the agent runs automatically, which need confirmation |
| External channel integration | Receive instructions and reports via WeChat/Telegram/Slack, without opening the app (WeChat channel done; Telegram/Slack next) |
| Agent self-improvement | Learn from execution feedback; automatically create, install, and maintain skills |
| Heartbeat proactive reporting | The agent periodically checks and pushes changes worth your attention |
| Browser control | The agent drives the browser via Playwright/CDP: auto-fill forms, scrape web content, operate web apps (ADO, SharePoint, internal systems) |
| System app control | The agent controls local desktop apps: read/write the filesystem, operate Excel/Word/PowerPoint, run terminal commands |
| Screen understanding | Understand on-screen content via screenshots + vision models, enabling the agent to act in any GUI scenario |
| Computer use | Full mouse/keyboard control — click, drag, type — so the agent can operate any app without an API, like a human |
| Workflow orchestration | Compose multi-step actions (across browser + system + API) into reusable workflows: define once, run repeatedly |