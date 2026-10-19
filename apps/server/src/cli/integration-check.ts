import { assertCliEntry, openDatabase } from '@server/src/db/client.js'
import {
  databaseReadinessError,
  integrationCheckFailure,
} from '@server/src/modules/identity/startup-diagnostics.js'
import {
  assertWebsiteIntegrationReady,
  parseIntegrationCheckArguments,
  validateWebsiteIntegrationPreflight,
} from '@server/src/integration-readiness.js'

assertCliEntry(import.meta.url)

try {
  const adminUserId = parseIntegrationCheckArguments(process.argv.slice(2))
  validateWebsiteIntegrationPreflight()
  let db
  try {
    db = await openDatabase()
  } catch (error) {
    throw databaseReadinessError(error)
  }
  try {
    await assertWebsiteIntegrationReady(db, adminUserId)
  } finally {
    await db.close()
  }
  console.log('[integration:check] INTEGRATION_CHECK_READY')
} catch (error) {
  console.error(`[integration:check] ${integrationCheckFailure(error)}`)
  process.exitCode = 1
}
