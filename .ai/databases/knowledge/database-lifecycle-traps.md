# PostgreSQL 数据库生命周期陷阱

> 已退役：历史 Node/Fastify 实现记录。文中路径、命令和行为仅用于理解当时选择；现行 PHP/Webman 边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 与 `apps/php-server/TESTING.md`。

_最后更新：2026-10-11_

## 缺库或半迁移不能靠启动修复

`apps/server/src/server.ts` 在监听前连接并检查 `exre` 身份、migration journal 与必需结构。空库、半迁移或配置缺失会使启动失败；它不会创建数据库或执行 migration。先由数据库管理员建立独立 `exre`，配置仓库根 `.env.local`，再显式运行 `pnpm db:migrate`。`outline` 不能作为替代目标。

## URL 与连接后的身份都要核对

`apps/server/src/db/client.ts` 拒绝缺失或错误数据库名的 `DATABASE_URL`，连接后还检查 `current_database()` 和预期 schema。支持的连接选项与受控 `search_path` 规则见 `.ai/architectures/server/request-lifecycle.md` 的数据库连接与事务部分；不能用 query 覆盖连接目标，也不能把所有 query 一律拒绝。迁移测试应验证业务表与 journal 只写入受控 schema、其他 schema 保持不变；非法目标覆盖应断言 `DatabaseConfigurationError.code`，避免固定诊断文案调整使数据保护测试误报。凭据只存本机环境，不写进文档或测试快照。

## 重置的对象范围比数据库小

`pnpm db:reset -- --confirm exre` 仅在开发用途下接受回环地址上的 `exre`。它先检查应用 schema、migration schema 的对象清单和函数；出现未知对象就拒绝。它清理应用表与 journal 后重新应用基线，不删除数据库、整个 `public` schema 或 `apps/server/data/avatars/`。不要把它作为启动失败的自动恢复动作。

## CLI 入口不可作为库导入

`apps/server/src/db/migrate.ts` 与 `apps/server/src/db/reset.ts` 在模块顶层检查直接执行，import 会抛错。测试或其他显式调用应使用 `apps/server/src/db/migration-runner.ts`、`apps/server/src/db/reset-plan.ts` 中的可复用逻辑，不通过 CLI import 触发写入。

## 自动测试与本机库分开

`tests/helpers/postgres.ts` 只从新启动的 PostgreSQL Testcontainers 容器取得连接 URL，并为每例创建独立 schema 和 migration journal。若 Docker 不可用，数据库测试应明确失败；不能因环境问题回退到本机 `exre`。测试容器内库名也是 `exre`，因此库名校验不能替代容器来源隔离。
