// vite.config.js
import { defineConfig } from 'vite'
import path from 'node:path'

const repoBase = '/TMLS_playcards_viewer/'
const base =
  process.env.VITE_BASE ??
  (process.env.GITHUB_ACTIONS ? repoBase : '/')

export default defineConfig({
  base,
  server: { port: 5173 },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      // IMPORTANT: explicitly include all HTML entry points
      input: {
        main: path.resolve(__dirname, 'index.html'),
        solo: path.resolve(__dirname, 'solo.html'),
      },
    },
  },
})
