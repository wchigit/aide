# Relation

The user's network of working relationships. A simple entity that helps the Agent understand priority and communication style.

## Schema

```typescript
interface Relation {
  id: string;
  name: string;
  role: 'manager' | 'peer' | 'report' | 'external' | 'stakeholder';
  org?: string;              // Organization/team
  title?: string;            // Job title
  email?: string;
  teamsId?: string;
  timezone?: string;
  expertise?: string[];      // Areas of expertise
  communicationStyle?: string; // "Prefers short emails" / "Likes Teams voice"
  notes?: string;            // Notes added by the Agent/user
  createdAt: Date;
  updatedAt: Date;
}
```

## How the Agent uses Relation

- **Priority judgment**: a task from a manager > a task from a peer
- **Channel choice**: pick email/Teams/other based on the person's preference
- **Expertise routing**: knows who to ask when help is needed in a given area
- **Context understanding**: "that thing A mentioned" — the Agent knows who A is and their role

## Data sources

- The user manually configures core relationships (manager, immediate teammates)
- The Agent automatically identifies new people from the daily information flow and proposes adding them
- The Agent gradually fills in attributes from interactions (notices A always replies via Teams → records the communication preference)
