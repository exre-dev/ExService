# Website 与 PHP 测试层次

执行时机、轻量/完整选择和页面浏览器规则以 `TESTING.md` 为准；PHP 独立测试的命令、资源与清理规则以 `apps/php-server/TESTING.md` 为准。

_最后更新：2026-10-20_

| 层                         | 当前证明范围                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| PHP Contract 静态检查      | Composer 生成、lint、check 对 PHP Attributes、路由、public/internal 归属和生成 YAML 一致性作检查；不执行控制器业务。 |
| 主仓库 Contract 消费       | `pnpm api:lint` 检查两版 PHP 模块入口；`pnpm api:check` 只读核对 SDK 类型和策略；不替代 PHP 路由检查。               |
| 主仓库快速测试             | Web/共享包/jsdom、SDK 适配与轻量 Node 脚本，不要求 Docker 或 Chromium。                                              |
| 主仓库完整测试             | SDK 真实 HTTP、公开包 Chromium、Vite/代理、构建与进程资源归属等完整配置；不运行 PHP Composer 测试。                  |
| PHP Website HTTP 夹具      | 真实 Webman bootstrap、路由、中间件、控制器、PostgreSQL/Redis 与文件副作用，通过进程内捕获传输执行；邮件为记录替身。 |
| 页面浏览器、外部服务和部署 | 各自单独执行并报告，不由前述层自动推出。                                                                             |

PHP `tests/website_http.php` 使用显式测试变量、临时 BASE_PATH、独立 PostgreSQL schema 与 Redis 前缀，检查一部分内部和公开 operation 的响应结构、状态及副作用。它不通过 socket，不证明 Workerman 报文限制、反向代理、SMTP、第三方 OAuth/provider 或完整页面浏览器行为。内部 YAML 的有界 schema 校验不覆盖所有 OpenAPI 语义或未执行 operation。

根 `.github/workflows/ci.yml` 配置递归子模块检出与 `api:check`、`typecheck`、`build`、`test:full`；PHP 仓库自己的 CI 配置六个 PHP 脚本与 Composer 检查。配置存在不等于远端运行成功。主仓库完整测试中的 SDK Chromium 夹具与 `tests/browser/` 页面验收属于不同证据。

旧 Fastify/Glue 原始 handler、Node PostgreSQL Testcontainers 与 Hydra readiness 测试已随 Node Server 退役；其历史原因留在标记为退役的知识和决策页，不作为新增 PHP operation 的测试模板。
