export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="aide-logo-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4A7FF7" />
          <stop offset="100%" stopColor="#3B5EE6" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="108" fill="url(#aide-logo-bg)" />
      <path
        d="M256 96 L384 416 L328 416 L298 332 L214 332 L184 416 L128 416 Z M256 192 L228 296 L284 296 Z"
        fill="white"
      />
      <path
        d="M372 100 L386 132 L418 146 L386 160 L372 192 L358 160 L326 146 L358 132 Z"
        fill="white"
        opacity="0.92"
      />
    </svg>
  )
}
