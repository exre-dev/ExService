import { defineConfig } from 'vitest/config'
import fullConfig from './vitest.config.ts'

// Explicit unit-test groups keep newly added integration fixtures in the full suite.
export default defineConfig({
  ...fullConfig,
  test: {
    ...fullConfig.test,
    include: [
      'apps/web/src/**/*.test.{ts,tsx}',
      'apps/admin-web/src/**/*.test.{ts,tsx}',
      'packages/components/src/**/*.test.{ts,tsx}',
      'packages/sdk/src/**/*.test.{ts,tsx}',
      'packages/common/src/**/*.test.{ts,tsx}',
      'tests/content/**/*.test.ts',
      'tests/notifications/contentPolicyParity.test.ts',
      'tests/sdk/{config,request}.test.ts',
    ],
    exclude: [
      ...(fullConfig.test?.exclude ?? []),
      'apps/web/src/api/client.{scope,race,expiry}.test.{ts,tsx}',
      'apps/web/src/routes/DevelopmentEntry.test.ts',
      'apps/web/src/content/*.integration.test.ts',
      'tests/content/team-config.test.ts',
    ],
  },
})
