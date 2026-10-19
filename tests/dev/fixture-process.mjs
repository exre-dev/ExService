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
// `descendant-exit` 的自退定时器必须比"父进程观察后代身份所需的时间"明显更长：
// 观察方要先等 `spawnOwned`（自身含一次数秒的进程身份查询），再查询后代身份，
// 固定 5 秒只比这两段略长，机器负载决定胜负，于是用例随机失败。
// 因此把延迟做成可覆盖的，默认保持 5 秒，需要观察后代的用例显式放大。
const exitDelay = Number(process.env.EXWEBSITE_FIXTURE_EXIT_MS)
if (action === 'exit' || action === 'descendant-exit') {
  setTimeout(
    () => process.exit(7),
    Number.isSafeInteger(exitDelay) && exitDelay > 0 ? exitDelay : 5000,
  )
} else setInterval(() => {}, 1000)
console.log('FIXTURE_READY')
