// Generates the GitHub social preview image (1280×640) at resources/social-preview.png
// Usage: node scripts/generate-social-preview.js
const sharp = require('sharp')
const path = require('path')

const W = 1280
const H = 640

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3B5EE6"/>
      <stop offset="100%" stop-color="#2440B8"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#5B8CFF"/>
      <stop offset="100%" stop-color="#3B5EE6"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- subtle decorative sparks -->
  <g fill="#FFFFFF" opacity="0.06">
    <path d="M1100 120 L1112 152 L1144 164 L1112 176 L1100 208 L1088 176 L1056 164 L1088 152 Z"/>
    <path d="M180 470 L189 494 L213 503 L189 512 L180 536 L171 512 L147 503 L171 494 Z"/>
  </g>

  <!-- app icon tile -->
  <g transform="translate(120 200)">
    <rect width="240" height="240" rx="52" fill="url(#tile)"/>
    <path d="M120 45 L180 195 L154 195 L140 156 L100 156 L86 195 L60 195 Z M120 90 L107 139 L133 139 Z" fill="white"/>
    <path d="M174 47 L181 62 L196 69 L181 76 L174 91 L167 76 L152 69 L167 62 Z" fill="white" opacity="0.92"/>
  </g>

  <!-- wordmark + tagline -->
  <text x="410" y="270" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="120" font-weight="700" fill="#FFFFFF">Aide</text>
  <text x="414" y="338" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34" font-weight="500" fill="#DCE6FF">Your personal work agent</text>

  <!-- feature chips (single row, auto-sized, left-aligned full width) -->
  ${(() => {
    const chips = ['Aggregates your work', 'Learns your context', 'Acts for you']
    const fontSize = 26
    const charW = fontSize * 0.56 // rough advance width for Segoe UI semibold
    const padX = 26
    const gap = 18
    const h = 56
    const y = 474
    let x = 120
    let out = ''
    for (const label of chips) {
      const w = Math.round(label.length * charW + padX * 2)
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#FFFFFF" opacity="0.12"/>`
      out += `<text x="${x + w / 2}" y="${y + 37}" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="#FFFFFF">${label}</text>`
      x += w + gap
    }
    return out
  })()}

  <!-- footer -->
  <text x="120" y="586" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="#AFC2FF">Electron · GitHub Copilot SDK · MCP · Local-first</text>
</svg>`

const out = path.join(__dirname, '..', 'resources', 'social-preview.png')
sharp(Buffer.from(svg)).png().toFile(out)
  .then(() => console.log('Wrote', out))
  .catch(err => { console.error(err); process.exit(1) })
