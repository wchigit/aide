import { useEffect, useRef, useState } from 'react'

/** Reveal-on-scroll: returns a ref to attach and a boolean when in view. */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number
  rootMargin?: string
  once?: boolean
}) {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (options?.once !== false) obs.unobserve(entry.target)
          } else if (options?.once === false) {
            setShown(false)
          }
        }
      },
      {
        threshold: options?.threshold ?? 0.15,
        rootMargin: options?.rootMargin ?? '0px 0px -8% 0px',
      },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [options?.threshold, options?.rootMargin, options?.once])

  return { ref, shown }
}
