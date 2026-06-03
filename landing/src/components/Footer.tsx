import { Logo } from './Logo'
import { IconGithub } from './icons'

const cols = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Preview', href: '#preview' },
      { label: 'Always on', href: '#reach' },
      { label: 'How it works', href: '#how' },
      { label: 'Download', href: '#download' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'GitHub', href: 'https://github.com/houk-ms/aide' },
      { label: 'Releases', href: 'https://github.com/houk-ms/aide/releases' },
      { label: 'Issues', href: 'https://github.com/houk-ms/aide/issues' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-8">
      <div className="mx-auto max-w-5xl">
        <div className="glass rounded-[24px] px-6 py-10 sm:px-10">
          <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <Logo size={30} className="rounded-lg shadow-sm" />
                <span className="text-[16px] font-semibold tracking-tight text-ink-900">Aide</span>
              </div>
              <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-ink-500">
                A personal work agent that sees the full picture, learns as you work,
                and gets things done the way you would.
              </p>
              <a
                href="https://github.com/houk-ms/aide"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-black/[0.07] bg-white/60 px-3 py-1.5 text-[13px] font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-ink-900"
              >
                <IconGithub width={16} height={16} />
                Star on GitHub
              </a>
            </div>

            {cols.map((c) => (
              <div key={c.title}>
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  {c.title}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-[14px] text-ink-500 transition-colors hover:text-brand-600"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-black/[0.06] pt-6 text-[12.5px] text-ink-400 sm:flex-row">
            <span>© {new Date().getFullYear()} Aide. Crafted with care.</span>
            <span>Built for people who do real work.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
