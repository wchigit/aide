# UI

Electron desktop app. React frontend.

## Design principles

1. **No page switching** — the user's core actions (viewing tasks + talking with the Agent) happen in a single view, no navigation needed
2. **Chat is always available** — no matter what you're looking at, the input box at the bottom is always there; you can talk to the Agent anytime
3. **A task is context** — clicking a task = switching the Agent's working context, not opening a new page
4. **The Agent shows up proactively** — open the app in the morning and the Agent gives you a briefing; you don't have to ask

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  Aide                                    [Settings ⚙️]   │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│  ACTIVE      │  [General Chat / Task: Fix pagination bug]│
│  🔴 API docs │                                           │
│  🟡 PR #351 •│  ┌─────────────────────────────────┐     │
│  🟡 Fix bug  │  │                                 │     │
│  🟡 Design   │  │  Agent: Good morning, 3 new...  │     │
│  🔵 Confirm •│  │                                 │     │
│              │  │  You: Handle the pagination bug │     │
│  DONE        │  │                                 │     │
│  Today       │  │  Agent: OK, I read the issue... │     │
│   ✓ Reply    │  │                                 │     │
│   ✓ Report   │  └─────────────────────────────────┘     │
│  Yesterday   │                                           │
│   ✓ Deploy   ├───────────────────────────────────────────┤
│              │  [Message input...               ] [Send]│
│  [+ New]     │                                           │
└──────────────┴───────────────────────────────────────────┘
```

### Left panel: Task List (always visible)

Only two areas, no complex categorization:

```
ACTIVE                          ← all unfinished tasks, sorted by priority
  🔴 API docs review (due today)
  🟡 PR #351 review        •new
  🟡 Fix pagination bug
  🟡 Write design doc
  🔵 Confirm next week's meeting  •new

DONE                            ← completed, grouped by date
  Today
    ✓ Reply to Zhang San
    ✓ Daily report
  Yesterday  
    ✓ Deploy hotfix
    ✓ ...
  [More history...]
```

**Active (unfinished tasks)**

- All unfinished tasks are in this one list, sorted by priority
- **Not grouped by date** — you don't care when a task was created, only how important it is
- Newly discovered tasks have a `•new` marker (disappears once the user clicks)
- Overdue/urgent tasks float to the top automatically (the Agent re-evaluates priority)
- Tasks not finished yesterday don't need to be "moved to today" — they stay in Active, just possibly with a changed priority

**Done (completed tasks)**

- Grouped by date, newest on top
- By default shows only today + yesterday
- Click `[More history...]` to expand earlier history (grouped by day/week)
- This is the user's entry point for reviewing "what did I do in the past"
- It's also the data source for daily/weekly report generation

**Lifecycle of an unfinished task:**

```
Agent discovers it → enters Active (with •new marker, Agent sets priority)
User clicks/views → •new disappears
User finishes it → moves to Done (completion date recorded)
User says "never mind" → marked cancelled, disappears from Active
Never handled → stays in Active; the Agent may remind or lower priority during end-of-day reconciliation
```

**Task quick actions (right-click menu / hover buttons):**

| Action | Effect | Scenario |
|------|------|------|
| ✓ Complete | Move to Done | Handled it yourself (not through the Agent) |
| ✗ Cancel | Remove from Active | Don't need to do it / not relevant to me |
| ↓ Lower priority | Sink to the bottom of the list | Saw it, don't want to deal with it now, later |
| ⏰ Snooze until... | Temporarily hide, reappear at the set time | "Look at this on Friday" |

**Controlling Active-list bloat:**

A list that only grows will break down. Control mechanisms:

1. **Visible cap**: by default show only the ~15 highest-priority items. The bottom shows `+12 more...` to expand. Most of the time the user only needs to focus on the top few.

2. **Agent proactive cleanup (part of end-of-day reconciliation)**:
   - No interaction for over 7 days + no deadline + low priority → the Agent proposes a batch cleanup
   - "These 5 tasks haven't moved in over a week, keep them?" → the user confirms in one click / decides one by one
   - Items already closed in external systems (email replied, PR merged) → the Agent marks them complete automatically

3. **Natural attrition**: tasks snoozed many times + persistently low priority gradually sink. If a task has sat in Active for over 2 weeks and the user has never opened it, the Agent proposes a disposition in the next briefing.

4. **User batch operations**: long-press/multi-select → batch complete/cancel/snooze. For weekend-cleanup scenarios.

**Core principle: the Agent's job isn't just to create tasks, but also to keep the list healthy.** If Active exceeds 20 items, that itself is a problem the Agent needs to handle — remind the user, suggest merging, auto-close stale ones.

### Right panel: Chat (context-aware)

Two modes, switching smoothly:

**Task mode** (a task is clicked)

```
┌─────────────────────────────────────────────┐
│ ← General          Fix pagination bug [✓] [✗]│  ← title + quick actions
│ 🔴 High · From: GitHub #234 · Project: Web  │  ← metadata bar (one line)
│ Due: Today · Related: Zhang San             │
├─────────────────────────────────────────────┤
│                                             │
│ Agent: This issue is about the feedback     │  ← Chat area
│ list's second page loading empty. I read    │
│ the code; the problem is in the pagination  │
│ component's offset calculation...           │
│                                             │
│ You: Fix it and write a test                │
│                                             │
│ Agent: OK, on it...                          │
└─────────────────────────────────────────────┘
```

- Top: the Task title + an arrow to return to General + complete/cancel quick buttons
- Metadata bar: priority, source (clickable to jump to the original system), associated Project, deadline, related people
- The metadata bar is a **compact one-to-two-line display**, not a form. Click to expand for full information
- Below it is normal Chat — the Agent automatically has the Task's full context

**Key: the Agent's first message is the "details".** The first time the user clicks into a Task, the Agent proactively explains what it is, where it came from, its current status, and how it suggests handling it. No need for a static details panel — the conversation itself is a dynamic, judgment-driven presentation of the details.

**General mode** (no task selected, or click the top title to return to General)
- Free conversation, ask anything
- The Agent answers based on L0 + L1 Memory
- If the conversation touches an existing Task, the Agent can suggest "want to switch to that task?"

### Mode switching

```
Click a Task on the left → enter Task mode (Chat loads that Task's session)
Click "Aide" / "General" at the top → return to General mode
The Agent creates a new Task during a General-mode conversation → the left list updates, clickable to enter
```

## Agent proactive behavior (reflected in Chat)

| Trigger | What the Agent does |
|------|-------------|
| Open the app in the morning | Proactively sends a morning briefing (today's overview + priority suggestions) |
| An urgent new task arrives | Prompts in Chat: "Just received XX, you should take a look" |
| A Task is auto-completed | "I handled XX for you, the result is..." |
| End of day | "Today's daily report is ready, want to see it?" |

## Confirmation interaction

When the Agent needs user confirmation before a write operation, it's rendered in Chat as a special message with buttons:

```
┌─────────────────────────────────────────┐
│ Agent: I'll reply to Zhang San. Draft below:│
│                                         │
│ "Hi Zhang San, the API docs are updated,  │
│  please review. Reach out anytime."       │
│                                         │
│ Send to: zhangsan@company.com           │
│                                         │
│   [✓ Confirm send]  [✎ Edit]  [✗ Cancel] │
└─────────────────────────────────────────┘
```

- **Confirm**: the Agent executes the operation, Chat shows "Sent ✓"
- **Edit**: the input box is auto-filled with the draft; the user edits and re-confirms
- **Cancel**: nothing is done; the Agent responds "OK, cancelled"

No need for the user to type "confirm" — a button click is enough. Keep it smooth.

## Settings (gear icon → modal drawer)

Not a separate page; a drawer/modal that slides out from the right.

Tabs:
- **Connections** — Work IQ authorization status, GitHub token
- **Projects** — project list, linked repo/docs
- **Relations** — relationship configuration
- **Jobs** — scheduled-task toggles and frequencies
- **Memory** — browse/edit/delete the Agent's memories
- **Preferences** — language, theme, notification preferences

## Key interaction flows

### Flow 1: handling a task

```
1. The user sees "PR review: fix auth flow" on the left
2. Clicks → the right side enters that Task's Chat
3. Agent: "This PR changes the auth middleware; I read the diff, the main change is..."
4. User: "approve it, add a comment saying LGTM"
5. Agent: [needs confirmation] Approve PR #342 and comment "LGTM"?
6. User: confirm
7. Agent: Done. The task is marked complete.
8. The Task moves to Completed on the left
```

### Flow 2: starting the morning

```
1. The user opens the app
2. The left shows the updated task list (the Job already ran in the background)
3. In the General Chat on the right, the Agent proactively sends:
   "Good morning. Since last night there are 3 new items:
    1. [High] Zhang San's email requesting an API docs review (deadline today)
    2. [Med] PR #351 needs your review  
    3. [Low] Confirm next week's meeting schedule
   I suggest handling #1 first."
4. The user clicks the corresponding Task on the left to start
```

### Flow 3: a quick question

```
1. In General mode the user types directly: "What date did A say that deadline was last week?"
2. The Agent searches Memory + Work IQ: "Per last Wednesday's email, A said the deadline is June 15."
3. No Task switching involved
```

## Tech selection

| Decision | Choice | Rationale |
|------|------|------|
| UI framework | React | Mature ecosystem |
| State management | Zustand | Lightweight, fits medium scale |
| Styling | Tailwind CSS | Fast iteration |
| Component library | shadcn/ui | Customizable, not bloated |
| Chat rendering | Markdown + streaming | Streaming display of Agent replies |
| IPC | Electron contextBridge + typed API | Type-safe |

## Notifications

- In-app: the Agent's proactive messages in Chat + a •new marker on the left Active list
- System-level: only high-priority urgent tasks trigger a system notification (off by default, configurable)
