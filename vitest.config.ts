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
      { find: '@admin', replacement: resolve(repositoryRoot, 'apps/admin-web') },
      { find: '@sdk', replacement: resolve(repositoryRoot, 'packages/sdk') },
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
    environment: 'node',
    testTimeout: 60_000,
    include: [
      'tests/**/*.test.{ts,tsx}',
      'apps/web/src/**/*.test.{ts,tsx}',
      'apps/admin-web/src/**/*.test.{ts,tsx}',
      'packages/components/src/**/*.test.{ts,tsx}',
      'packages/sdk/src/**/*.test.{ts,tsx}',
      'packages/common/src/**/*.test.{ts,tsx}',
    ],
    exclude: [
      ...configDefaults.exclude,
      '**/dist/**',
      'vendor/**',
      'output/**',
      'apps/php-server/**',
    ],
  },
})
