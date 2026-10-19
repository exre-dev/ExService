import { runnerImport } from 'vite'
import { fileURLToPath } from 'node:url'
try {
  const { module } = await runnerImport(fileURLToPath(new URL('./check.mts', import.meta.url)), {
    configFile: false,
    envDir: false,
    root: fileURLToPath(new URL('../../', import.meta.url)),
  })
  console.log(`内容校验通过：${await module.checkContent()} 篇公开正文`)
} catch (error) {
  console.error(error instanceof Error ? error.message : '内容校验失败')
  process.exitCode = 1
}
