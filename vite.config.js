// vite.config.js
import { defineConfig } from 'vite'
import path from 'node:path'

// Use env var when provided; otherwise auto-detect GitHub Actions to set repo path,
// and default to '/' for local builds.
const repoBase = '/TMLS_playcards_viewer/'
const base =
  process.env.VITE_BASE ??
  (process.env.GITHUB_ACTIONS ? repoBase : '/')

export default defineConfig({
  base,
  server: { port: 5173 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
