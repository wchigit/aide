import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from GitHub Pages subpath: https://houk-ms.github.io/aide/
export default defineConfig({
  base: '/aide/',
  plugins: [react()],
})
