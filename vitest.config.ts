import { configDefaults, defineConfig } from 'vitest/config'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = dirname(fileURLToPath(import.meta.url))
const webNodeModules = resolve(repositoryRoot, 'apps/web/node_modules')

export default defineConfig({
  resolve: {
    // 共享包与应用必须使用同一个 React 和 ExUI 实例。
    dedupe: ['react', 'react-dom', '@exre/exui'],
    alias: [
      { find: '@web', replacement: resolve(repositoryRoot, 'apps/web') },
      { find: '@server', replacement: resolve(repositoryRoot, 'apps/server') },
      { find: '@sdk', replacement: resolve(repositoryRoot, 'packages/sdk') },
      // COS 运行库只装在 packages/sdk 与 apps/server 下（同一版本、同一 store 条目）。
      // 统一解析路径，测试才能用裸包名 mock 掉云 SDK。
      {
        find: /^cos-nodejs-sdk-v5$/,
        replacement: resolve(repositoryRoot, 'packages/sdk/node_modules/cos-nodejs-sdk-v5'),
      },
      {
        find: /^cos-js-sdk-v5$/,
        replacement: resolve(repositoryRoot, 'packages/sdk/node_modules/cos-js-sdk-v5'),
      },
      { find: '@components', replacement: resolve(repositoryRoot, 'packages/components') },
      { find: '@tests', replacement: resolve(repositoryRoot, 'tests') },
      { find: /^react$/, replacement: resolve(webNodeModules, 'react/index.js') },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(webNodeModules, 'react/jsx-runtime.js'),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(webNodeModules, 'react/jsx-dev-runtime.js'),
      },
      { find: /^react-dom$/, replacement: resolve(webNodeModules, 'react-dom/index.js') },
      { find: /^react-dom\/(.*)$/, replacement: resolve(webNodeModules, 'react-dom/$1') },
    ],
  },
  test: {
    // Autoload's dynamic imports must use the same TS/alias module runner as preflight.
    server: { deps: { inline: ['@fastify/autoload'] } },
    environment: 'node',
    testTimeout: 60_000,
    include: [
      'tests/**/*.test.{ts,tsx}',
      'apps/web/src/**/*.test.{ts,tsx}',
      'apps/server/src/**/*.test.{ts,tsx}',
      'packages/components/src/**/*.test.{ts,tsx}',
      'packages/sdk/src/**/*.test.{ts,tsx}',
      'packages/common/src/**/*.test.{ts,tsx}',
    ],
    exclude: [...configDefaults.exclude, '**/dist/**', 'vendor/**', 'output/**'],
  },
})
