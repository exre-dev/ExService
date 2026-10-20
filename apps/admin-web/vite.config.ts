import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

function proxyTarget() {
  const value = process.env.ADMIN_API_PROXY_TARGET ?? 'http://127.0.0.1:8787'
  try {
    if (!/^https?:\/\/[^/?#\\\s]+\/?$/i.test(value)) throw new Error()
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      value.trim() !== value
    )
      throw new Error()
    return url.origin
  } catch {
    throw new Error(
      'ADMIN_API_PROXY_TARGET must be an HTTP(S) origin without credentials, path, query or hash',
    )
  }
}
export default defineConfig(({ command }) => ({
  envDir: false,
  plugins: [react()],
  resolve: { alias: { '@admin': fileURLToPath(new URL('.', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: command === 'serve' ? proxyTarget() : 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  preview: { host: '127.0.0.1', strictPort: true },
  build: {
    outDir: 'dist',
  },
}))
