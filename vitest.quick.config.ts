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
      'apps/server/src/**/*.test.{ts,tsx}',
      'packages/components/src/**/*.test.{ts,tsx}',
      'packages/sdk/src/**/*.test.{ts,tsx}',
      'packages/common/src/**/*.test.{ts,tsx}',
      'tests/auth/{crypto,identity-config}.test.ts',
      'tests/db/connection-options.test.ts',
      'tests/content/**/*.test.ts',
      'tests/join/form-validation.test.ts',
      'tests/support/{field-copy,metadata,redesign,validation}.test.ts',
      'tests/notifications/contentPolicyParity.test.ts',
      'tests/storage/**/*.test.ts',
      'tests/clickup/**/*.test.ts',
      'tests/server-plugins/{autoload,boot,server-startup,start-application}.test.ts',
      'tests/sdk/request.test.ts',
      'tests/runtime/native-health.test.ts',
    ],
    exclude: [
      ...(fullConfig.test?.exclude ?? []),
      'apps/server/src/db/migration.test.ts',
      'apps/web/src/api/client.{scope,race,expiry}.test.{ts,tsx}',
      'apps/web/src/routes/DevelopmentEntry.test.ts',
      'apps/web/src/content/*.integration.test.ts',
      'tests/content/team-config.test.ts',
    ],
  },
})
