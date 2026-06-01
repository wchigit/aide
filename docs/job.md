# Job

The scheduling subsystem. It drives the execution of timed tasks.

## Responsibility

Jobs are what make the system run proactively. Without Jobs, the system can only passively wait for the user to open a conversation.

## Built-in Jobs (MVP)

| Job | Frequency | What it does |
|-----|------|--------|
| Morning aggregation | Every morning (configurable) | Pulls all new information; the Agent analyzes it and generates today's task list |
| Periodic polling | Every 15 minutes | Checks for new information (email, messages, PRs, etc.); creates/updates Tasks when found |
| End-of-day reconciliation | Before the end of each workday (configurable) | The Agent reviews the day's information flow, backfills missed tasks, updates statuses, and generates a daily report |

## Execution model

Once a Job triggers, it needs an Agent (LLM) to analyze data and make decisions. The flow:

```
Job triggers (cron)
  → Create a temporary Agent session (no user interaction, pure background)
  → System prompt: "You are the Aide background scheduling Agent; your task is {job.instruction}"
  → Inject L0 Identity + relevant context
  → Agent calls tools (ask_work_iq / fetch_work_iq / GitHub tools)
  → Agent analyzes the results and decides to create/update Tasks and write to Memory
  → Session ends, resources released
```

**Key design: the Job session is non-interactive.** The Agent never asks the user questions; all write operations execute automatically (the Job's permission level is fixed at "notify" — after execution it shows a summary on the Dashboard).

### Cost control

Each Job execution = 1 LLM call. Control strategies:
- Periodic polling does rule-based pre-filtering first: an Agent session only starts when there's actually new data
- Morning aggregation and end-of-day reconciliation run once each per day, an acceptable cost
- Job sessions don't inject L1 retrieval results (saving tokens), only L0 + the job instruction

## Schema

```typescript
interface Job {
  id: string;
  name: string;
  cron: string;              // cron expression
  instruction: string;       // instruction for the Agent ("Check for new email, identify items I need to handle")
  enabled: boolean;
  lastRunAt: Date | null;
  lastResult: 'success' | 'failed' | null;
  lastSummary: string | null; // summary of the last execution
}
```

## Implementation

For a local single-user app, a simple timer + cron parser is enough:
- A JobScheduler module in the main process loads all enabled jobs on startup
- On trigger: rule-based pre-filter → new data found → create Agent session → analyze → write Task/Memory
- Serial execution (no concurrency)
- Failures are logged and retried next time

## Decisions

- **When the app closes, Jobs stop and are not re-run.** The next time it opens, the morning aggregation naturally pulls in all unprocessed information, so there's no risk of anything being missed.
