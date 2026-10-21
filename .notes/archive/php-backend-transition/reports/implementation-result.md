# PHP 后端接管实施结果

本次本地改动将 ExWebsite 的 Website HTTP 消费链切到独立 `apps/php-server/`：PHP 定义并生成 public/internal OpenAPI，主仓库从完整 internal YAML 生成 SDK 类型与 operation policy，Web 使用 PHP 完整路径、`{msg,data}` 成功信封及真实 HTTP 状态。根开发工具只启动前端，旧 Node/Fastify/Hydra 编排源码退役。持久知识和现行入口已同步；精确产品路径见 `.notes/php-backend-transition/reports/implementation-paths.json`。

## 已发生的验证

| 阶段              | 本地证据                                                                                                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK/Contract 消费 | PHP 双入口 lint、SDK 双生成物 check、生成器 9/9、SDK 定向 52/52、SDK 类型与 Vite/Rollup 构建通过；401 handler 的同步/异步 veto、旧 token/root 隔离及 file 上传得到定向覆盖。                                                                                                                                          |
| Web 适配          | 最终受影响集合 34 文件、432/432；完整 Web TypeScript 检查通过。包含真实 SDK runtime + HTTP fixture 的持久 token 删除失败/替换、反馈恢复与根错误 UI。                                                                                                                                                                  |
| 会话读取修复      | 自定义 root 的受保护 401 遇到持久化读取失败时，本地失效继续传播：认证转为 `unavailable`、user ID 与私有 UI/缓存清空，旧 token 抑制；未确认删除仍禁止失效通知和导航。实现者定向 10 文件 213/213 与 Web TypeScript 检查通过；独立定向复核 3 文件 6 项通过、40 项跳过。此前 Web 432/432 未因此重跑，覆盖有重叠。         |
| 根工具链与退役    | 定向 runtime、真实子进程/readiness、代理/Chromium 公开 SDK、Hook 检查、SDK/Web 构建与类型检查、frozen pnpm install、真实前端 HTML smoke 均通过；各组有重叠，不能合并成独立测试总数。                                                                                                                                  |
| PHP Website HTTP  | `apps/php-server/tests/website_http.php` 使用真实 Webman bootstrap、路由、中间件、Controller、临时 PostgreSQL/Redis/文件及录制邮件替身，在单个 CLI 进程内完成 70 个请求；覆盖 57 个内部与 2 个公开 operation/status 组合，响应 schema 有界校验及负例通过，退出 0。测试后随机 schema、Redis 前缀与私有目录清理已核验。 |
| 独立阶段评审      | Tasks 1–4 的独立 spec/quality 门禁均 PASS，最终无阻塞项。                                                                                                                                                                                                                                                             |

## 部分实际定向命令

- 生成器：`node --test scripts/api/generate.test.mjs scripts/api/operation-policy.test.mjs`，9/9，退出 0。
- Web 审查者定向复核：`node node_modules/vitest/vitest.mjs run --config vitest.config.ts apps/web/src/api/client.expiry.test.tsx apps/web/src/api/client.race.test.ts apps/web/src/api/client.scope.test.tsx apps/web/src/pages/Support/feedback/FeedbackModal.test.tsx apps/web/src/pages/Support/feedback/schema.test.ts --maxWorkers 2`，5 文件 71/71，退出 0；这些用例与 Web 阶段验证重叠。
- 完整 Web 类型检查：`node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json --pretty false`，退出 0，无诊断。
- 会话修复实现者定向验证：`node node_modules/vitest/vitest.mjs run --config vitest.config.ts apps/web/src/api/client.expiry.test.tsx apps/web/src/api/client.scope.test.tsx apps/web/src/api/client.race.test.ts apps/web/src/auth/AuthContext.test.tsx apps/web/src/auth/storage.session.test.ts apps/web/src/settings/SettingsExperience.test.tsx apps/web/src/notifications/useNotificationsController.test.tsx apps/web/src/notifications/useNotificationPreferencesController.test.tsx apps/web/src/pages/Support/feedback/FeedbackModal.test.tsx apps/web/src/pages/Support/feedback/FeedbackSubmission.test.tsx --maxWorkers 2`，10 文件 213/213，退出 0；`node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json`，退出 0。
- 会话修复独立定向复核：`node node_modules/vitest/vitest.mjs run --config vitest.config.ts apps/web/src/api/client.expiry.test.tsx apps/web/src/api/client.scope.test.tsx apps/web/src/api/client.race.test.ts --maxWorkers 1 -t "selected token becomes unreadable during expiry|denied storage getter|replacement raw token when restored custom expiry|old root response expire an equal-token|newer cross-tab session when an old Web API"`，3 文件 6 项通过、40 项跳过，退出 0。
- 锁文件安装核验：`pnpm install --frozen-lockfile`，退出 0。
- PHP 阶段实际由本次隔离 helper 调起 `apps/php-server/tests/website_http.php`；完整显式变量和子模块独立可复跑入口见 `apps/php-server/TESTING.md`，隔离 helper 不作为日常项目入口。

以上数量分别来自各阶段最终报告和会话修复报告，重复运行和交叠用例不累加；此前广范围验证是修复前的阶段证据。PHP HTTP 请求是进程内捕获传输，未使用监听 socket 或页面浏览器；邮件是本地记录替身。PHP 原有未登录 `/oauth/device` 仍返回 401。PHP file upload 经 prepare 与 multipart 执行；COS prepare 和 complete 当前返回 503。

父线程随后停止并移除本次验证独占的临时 PostgreSQL 18 与 Redis 7.4 容器，且核验二者不再存在。此结论不同于 Task 4 当时报告的“保留供评审”时间点。旧开发库、卷、Hydra client、外部服务资源及真实部署数据没有由本次源码退役推定为已迁移或已清理。

## 证据边界

未运行根整套 `pnpm test`、`pnpm test:full`、`pnpm typecheck`、`pnpm build` 或 `pnpm api:check` 作为单一全仓命令；上述定向子命令和构建通过不能表述为这些根命令已执行。未执行新的干净克隆、远端 GitHub CI、完整 Website 页面浏览器、SMTP、第三方 provider/ClickUp/COS、真实 Workerman socket/反向代理或部署验收。配置了 CI 与子模块 checkout 不等于远端 CI 已通过。没有提交、暂存、推送或部署本次产品改动；原有暂存的子模块登记和用户原始 notes 未纳入本次操作。
