import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { contentPlugin } from './build/content/plugin.ts'
import { contentDefinitions } from './build/collections.ts'
import { teamConfigPlugin } from './build/team-config.ts'
import { phpProxy, proxyBoundaryPlugin } from './dev-entry.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const communityConfig = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'apps/web/public/config.json'), 'utf8'),
) as { community?: { 'rifling911-qqUrl'?: unknown; 'rifling911-kookUrl'?: unknown } }

const phpOrigin = process.env.PHP_SERVER_ORIGIN ?? 'http://127.0.0.1:8787'
const webPort = Number(process.env.WEBSITE_WEB_PORT ?? '8080')
const publicOrigin = 'http://127.0.0.1:' + webPort

export default defineConfig({
  // Root runtime adapters provide the public environment explicitly.
  envDir: false,
  plugins: [
    proxyBoundaryPlugin(publicOrigin),
    teamConfigPlugin(resolve(repositoryRoot, 'apps/web')),
    contentPlugin(contentDefinitions),
    ...fumadocsMdx({ macro: false, index: false, updateViteConfig: false }),
    react(),
  ],
  define: {
    'import.meta.env.VITE_COMMUNITY_QQ_URL': JSON.stringify(
      communityConfig.community?.['rifling911-qqUrl'] ?? '',
    ),
    'import.meta.env.VITE_COMMUNITY_KOOK_URL': JSON.stringify(
      communityConfig.community?.['rifling911-kookUrl'] ?? '',
    ),
  },
  resolve: {
    dedupe: ['react', 'react-dom', '@exre/exui'],
    alias: {
      '@web': resolve(repositoryRoot, 'apps/web'),
      '@components': resolve(repositoryRoot, 'packages/components'),
      '@tests': resolve(repositoryRoot, 'tests'),
    },
  },
  server: {
    fs: { allow: [repositoryRoot] },
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,

    // Vite 注入的开发脚本早于 HTML meta，响应头必须先保护邀请 URL。
    headers: { 'Referrer-Policy': 'no-referrer' },
    proxy: phpProxy(phpOrigin, publicOrigin),
  },
})
