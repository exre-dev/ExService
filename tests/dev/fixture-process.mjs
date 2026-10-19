import { spawn } from 'node:child_process'
const action = process.argv[2]
if (action === 'lock') {
  const { acquireLock } = await import('../../scripts/runtime/ownership.mjs')
  try {
    const lock = acquireLock({
      mode: process.argv[4],
      fingerprint: 'race-fixture',
      directory: process.argv[3],
    })
    console.log('LOCK_ACQUIRED')
    setTimeout(() => {
      lock.release()
      process.exit(0)
    }, 8000)
  } catch (error) {
    console.log(error.code)
    process.exit(2)
  }
}
if (action === 'descendant' || action === 'descendant-exit' || action === 'descendant-port') {
  const child = spawn(process.execPath, [process.argv[1], 'wait'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  console.log(`DESCENDANT:${child.pid}`)
}
if (action === 'descendant-port') {
  const { createServer } = await import('node:net')
  createServer().listen(Number(process.argv[3]), '127.0.0.1', () => console.log('PORT_READY'))
}
if (action === 'exit' || action === 'descendant-exit') setTimeout(() => process.exit(7), 5000)
else setInterval(() => {}, 1000)
console.log('FIXTURE_READY')
