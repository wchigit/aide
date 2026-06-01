import type { SVGProps } from 'react'

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconLayers(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 16.5 12 21l9-4.5" />
    </svg>
  )
}

export function IconBrain(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M9 4.5A2.5 2.5 0 0 0 6.5 7 2.5 2.5 0 0 0 4 9.5c0 1 .5 1.8 1.2 2.3A2.6 2.6 0 0 0 5 14a2.5 2.5 0 0 0 1.8 2.4A2.4 2.4 0 0 0 9.2 19 2.3 2.3 0 0 0 12 17V6a2 2 0 0 0-3-1.5Z" />
      <path d="M15 4.5A2.5 2.5 0 0 1 17.5 7 2.5 2.5 0 0 1 20 9.5c0 1-.5 1.8-1.2 2.3A2.6 2.6 0 0 1 19 14a2.5 2.5 0 0 1-1.8 2.4A2.4 2.4 0 0 1 14.8 19 2.3 2.3 0 0 1 12 17" />
    </svg>
  )
}

export function IconSpark(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
      <path d="M12 7.5 13.6 10.4 16.5 12 13.6 13.6 12 16.5 10.4 13.6 7.5 12 10.4 10.4 12 7.5Z" />
    </svg>
  )
}

export function IconCheck(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

export function IconArrow(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function IconGithub(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} strokeWidth={0} fill="currentColor" {...p}>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.27 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

export function IconWindows(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M3 5.7 10.4 4.7v6.6H3V5.7Zm0 12.6 7.4 1V12.7H3v5.6Zm8.3 1.1L21 20.6V12.7h-9.7v6.7Zm0-14.7v6.6H21V3.4l-9.7 1.3Z" />
    </svg>
  )
}

export function IconApple(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M17.6 12.7c0-1.9 1.5-2.8 1.6-2.9-.9-1.3-2.2-1.5-2.7-1.5-1.1-.1-2.2.7-2.8.7-.6 0-1.5-.6-2.4-.6-1.2 0-2.4.7-3 1.8-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.8 2.2 1.8.9 0 1.2-.6 2.3-.6 1.1 0 1.4.6 2.4.6 1 0 1.6-.9 2.2-1.7.7-1 1-1.9 1-2-.1 0-1.9-.8-1.9-2.9Zm-1.8-5.4c.5-.6.8-1.4.7-2.3-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1Z" />
    </svg>
  )
}

export function IconLinux(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M9 4.5c0-1 .8-1.5 1.6-1.5h2.8c.8 0 1.6.5 1.6 1.5v4.2c0 1 .6 1.7 1.2 2.6.8 1.2 1.7 2.6 1.7 4.4 0 2.4-2 3.8-5.9 3.8s-5.9-1.4-5.9-3.8c0-1.8.9-3.2 1.7-4.4.6-.9 1.2-1.6 1.2-2.6V4.5Z" />
      <path d="M10 8h.01M14 8h.01M10.5 11.5s.7.7 1.5.7 1.5-.7 1.5-.7" />
    </svg>
  )
}
