import { useReveal } from '../useReveal'
import { IconApple, IconWindows, IconLinux, IconArrow } from './icons'

const platforms = [
  { icon: <IconApple width={20} height={20} />, label: 'macOS', sub: 'Apple Silicon & Intel' },
  { icon: <IconWindows width={18} height={18} />, label: 'Windows', sub: '10 & 11' },
  { icon: <IconLinux width={20} height={20} />, label: 'Linux', sub: 'AppImage & .deb' },
]

export function Download() {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <section id="download" className="relative px-4 py-20 sm:py-28">
      <div
        ref={ref}
        className={`reveal ${shown ? 'in' : ''} relative mx-auto max-w-4xl overflow-hidden rounded-[28px] px-6 py-16 text-center sm:px-12`}
      >
        {/* gradient backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(40rem 24rem at 80% -20%, rgba(255,255,255,0.28), transparent 60%), radial-gradient(34rem 24rem at 0% 120%, rgba(255,255,255,0.16), transparent 55%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <h2 className="mx-auto max-w-2xl text-balance text-[32px] font-bold leading-[1.1] tracking-[-0.025em] text-white sm:text-[42px]">
          Stop managing your work. Start finishing it.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-balance text-[16.5px] leading-relaxed text-white/80">
          Free during early access. Download Aide and let it carry the busywork.
        </p>

        <a
          href="https://github.com/houk-ms/aide/releases"
          target="_blank"
          rel="noreferrer"
          className="group mt-9 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15.5px] font-semibold text-brand-700 shadow-xl shadow-brand-900/30 transition-transform hover:-translate-y-0.5"
        >
          Download for free
          <IconArrow width={18} height={18} className="transition-transform group-hover:translate-x-0.5" />
        </a>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {platforms.map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-left text-white backdrop-blur"
            >
              <span className="text-white/90">{p.icon}</span>
              <div className="leading-tight">
                <div className="text-[13.5px] font-semibold">{p.label}</div>
                <div className="text-[11px] text-white/60">{p.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
