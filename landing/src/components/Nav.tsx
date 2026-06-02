import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { IconGithub } from './icons'

const links = [
  { label: 'Features', href: '#features' },
  { label: 'Preview', href: '#preview' },
  { label: 'Anywhere', href: '#reach' },
  { label: 'How it works', href: '#how' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={`flex w-full max-w-5xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 ${
          scrolled ? 'glass shadow-lg' : 'border border-transparent'
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5">
          <Logo size={28} className="rounded-lg shadow-sm" />
          <span className="text-[15px] font-semibold tracking-tight text-ink-900">Aide</span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-ink-500 transition-colors hover:bg-black/[0.04] hover:text-ink-900"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/houk-ms/aide"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-ink-500 transition-colors hover:bg-black/[0.04] hover:text-ink-900 sm:flex"
          >
            <IconGithub width={16} height={16} />
            GitHub
          </a>
          <a
            href="#download"
            className="btn-primary rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold"
          >
            Download
          </a>
        </div>
      </nav>
    </header>
  )
}
