# Contributing to Aide

Thanks for your interest in improving Aide! This guide covers how to get set up and the conventions we follow.

## Development setup

> **Prerequisites:** Node.js 20+ and npm.

```bash
npm install      # install dependencies
npm run dev      # run in development with hot reload
npm run build    # production build
npm run preview  # preview the production build
```

The app is a single Electron project:

- `src/main/` — main process: agent, scheduler, connections, storage (SQLite)
- `src/renderer/` — React 19 + Zustand + Tailwind CSS UI
- `src/preload/` — typed IPC bridge (`window.aide`)
- `src/shared/` — shared types
- `docs/` — design docs (one per subsystem)

## Project conventions

- **TypeScript everywhere.** Keep the typed IPC contract in `src/shared/types.ts` in sync with main/renderer usage.
- **Keep docs honest.** If you change a subsystem's behavior, update the matching file in `docs/`.
- **Small, focused PRs.** One logical change per PR is easier to review.
- **No secrets in commits.** Tokens and account data stay in `~/.aide/`, never in the repo.

## Making a change

1. Fork the repo and create a branch: `git checkout -b feature/short-description`.
2. Make your change and verify it builds: `npm run build`.
3. Test locally with `npm run dev`.
4. Open a pull request using the template and link any related issue.

## Reporting bugs & requesting features

Open an issue on the [issues page](https://github.com/houk-ms/aide/issues). For security issues, see [SECURITY.md](SECURITY.md) — please do **not** open a public issue.

## Code of conduct

Be respectful and constructive. We follow the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/).
