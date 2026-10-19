import { createAppAuthService } from '@server/src/cli/support.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function runAuthAccountCommand(
  action: 'disable' | 'enable',
  args: string[],
): Promise<void> {
  const supplied = args[0] === '--' ? args.slice(1) : args
  if (supplied.length !== 2 || supplied[0] !== '--user-id' || !UUID.test(supplied[1] ?? '')) {
    throw new Error(`Usage: pnpm auth:${action} -- --user-id <uuid>`)
  }
  const { authServices, close } = await createAppAuthService()
  try {
    if (action === 'disable') await authServices.disableUser(supplied[1]!)
    else await authServices.enableUser(supplied[1]!)
  } finally {
    await close()
  }
}
