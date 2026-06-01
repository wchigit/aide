# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately**. Do not open a public issue.

- Use [GitHub private vulnerability reporting](https://github.com/houk-ms/aide/security/advisories/new), or
- Contact the maintainer directly through their GitHub profile.

We will acknowledge your report and work with you on a fix and disclosure timeline.

## Scope & data handling

Aide is a **local-first** desktop app. Your work data and credentials live on your machine:

- Application data and logs: `~/.aide/`
- Account authorization is handled by the underlying MCP servers (Microsoft Entra OAuth for Work IQ, the `gh` CLI for GitHub). Aide does not store raw passwords.

When reporting, please include the affected version (or commit SHA), your OS, and reproduction steps.
