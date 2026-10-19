import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { contentPlugin } from './build/content/plugin.ts'
import { contentDefinitions } from './build/collections.ts'
import { teamConfigPlugin } from './build/team-config.ts'
import { devEntryPlugin, trustedProxy, proxyBoundaryPlugin } from './dev-entry.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const communityConfig = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'apps/web/public/config.json'), 'utf8'),
) as { community?: { 'rifling911-qqUrl'?: unknown; 'rifling911-kookUrl'?: unknown } }

/**
 * Server 的本地地址。
 * 与 `apps/server/src/server.ts` 的监听地址保持一致，并显式使用 127.0.0.1，
 * 避免在 Windows 上因 `localhost` 解析到 IPv6 而代理不到只绑定 IPv4 的服务。
 */
const SERVER_ORIGIN = `http://127.0.0.1:${process.env.INTEGRATION_SERVER_PORT ?? '8080'}`
const INTEGRATION_WEB_PORT = Number(process.env.INTEGRATION_WEB_PORT ?? '8081')
const publicOrigin = process.env.SERVER_PUBLIC_WEB_BASE_URL
  ? new URL(process.env.SERVER_PUBLIC_WEB_BASE_URL)
  : undefined

export default defineConfig({
  plugins: [
    proxyBoundaryPlugin(publicOrigin?.origin),
    teamConfigPlugin(resolve(repositoryRoot, 'apps/web')),
    contentPlugin(contentDefinitions),
    ...fumadocsMdx({ macro: false, index: false, updateViteConfig: false }),
    react(),
    ...(process.env.WEBSITE_DEV_ENTRY_PORT
      ? [devEntryPlugin(Number(process.env.WEBSITE_DEV_ENTRY_PORT))]
      : []),
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
      '@server': resolve(repositoryRoot, 'apps/server'),
      '@components': resolve(repositoryRoot, 'packages/components'),
      '@tests': resolve(repositoryRoot, 'tests'),
    },
  },
  server: {
    fs: { allow: [repositoryRoot] },
    host: '127.0.0.1',
    port: INTEGRATION_WEB_PORT,
    strictPort: true,
    hmr: publicOrigin
      ? {
          protocol: publicOrigin.protocol === 'https:' ? 'wss' : 'ws',
          host: publicOrigin.hostname,
          clientPort: Number(publicOrigin.port || (publicOrigin.protocol === 'https:' ? 443 : 80)),
        }
      : undefined,
    // Vite 注入的开发脚本早于 HTML meta，响应头必须先保护邀请 URL。
    headers: { 'Referrer-Policy': 'no-referrer' },
    proxy: {
      // 原样转发 `/api/*`：Server 自己注册 `/api` 前缀，因此这里不做 rewrite。
      '/api': trustedProxy(
        {
          target: SERVER_ORIGIN,
        },
        publicOrigin?.origin ?? 'http://127.0.0.1:8081',
      ),
    },
  },
})
