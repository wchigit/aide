# Aide — landing page

The marketing / brand page for Aide, deployed to GitHub Pages at
`https://houk-ms.github.io/aide/`.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (glass / bright minimal design system)

## Develop

```bash
cd landing
npm install
npm run dev
```

## Build

```bash
npm run build      # outputs to landing/dist
npm run preview    # preview the production build
```

## Deploy

Pushes to `main` that touch `landing/**` trigger
`.github/workflows/deploy-landing.yml`, which builds and publishes to
GitHub Pages.

One-time setup: in the repo settings, set **Pages → Build and deployment →
Source** to **GitHub Actions**.

The Vite `base` is set to `/aide/` to match the Pages subpath. If you move the
site to a custom domain or a dedicated `*.github.io` repo, change `base` to `/`
in `vite.config.ts`.
