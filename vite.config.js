import { defineConfig } from 'vite'
import path from 'node:path'

const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  server: { port: 5173 },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } }
})
