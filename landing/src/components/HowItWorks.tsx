import { SectionHeading } from './Features'
import { useReveal } from '../useReveal'

const steps = [
  {
    n: '01',
    title: 'Connect your tools',
    body: 'Link Outlook, Teams, GitHub and your calendar in a couple of clicks. Aide starts watching for what needs you.',
  },
  {
    n: '02',
    title: 'Let it learn',
    body: 'As you work, Aide builds a private memory of your projects, people, and preferences — entirely on your machine.',
  },
  {
    n: '03',
    title: 'Work alongside it',
    body: 'Aide drafts, summarizes, and prepares — you review and approve. And when you step away, it keeps running and pings you on WeChat the moment something needs a decision.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="relative px-4 py-28 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          kicker="How it works"
          title="Up and running in minutes"
          subtitle="No setup marathons. Connect, and Aide takes it from there."
        />

        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          {/* connecting line */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-brand-300/50 to-transparent md:block"
          />
          {steps.map((s, i) => (
            <Step key={s.n} {...s} delay={i * 110} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Step({ n, title, body, delay }: { n: string; title: string; body: string; delay: number }) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${shown ? 'in' : ''} relative text-center md:text-left`}
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-[15px] font-bold text-brand-600 shadow-lg shadow-brand-500/10 ring-1 ring-black/[0.05] md:mx-0">
        {n}
      </div>
      <h3 className="mt-5 text-[18px] font-semibold tracking-tight text-ink-900">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500">{body}</p>
    </div>
  )
}
