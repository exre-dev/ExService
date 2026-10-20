# 数据库结构变更只由显式命令执行

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：旧 Node PostgreSQL 执行方式已退役；PHP 安装与数据操作另行管理
- 模块：`server`
- 原日期：2026-09-16
- 当前依据：`.notes/archive/server-promotion/rfcs/server-postgresql-migration-rfc.md`

## 决策

服务启动只连接并校验独立 PostgreSQL `exre` 的身份、migration journal 和必需结构；缺失或半迁移时失败并提示 `pnpm db:migrate`，不建库、建表、迁移或重置。`pnpm db:migrate` 只对已存在的 `exre` 显式应用 migration；`pnpm db:reset -- --confirm exre` 只在开发环境经目标、回环地址、显式确认与对象归属核验后清理本应用结构并重跑基线。`db:generate` 仅生成待审阅的 migration 文件。

`apps/server/src/db/migrate.ts` 与 `apps/server/src/db/reset.ts` 是直接执行的 CLI 入口，不可 import。可复用迁移、重置与连接逻辑分别位于 `apps/server/src/db/migration-runner.ts`、`apps/server/src/db/reset-plan.ts` 和 `apps/server/src/db/client.ts`。

## 理由与影响

自动结构变更会让数据损失或状态漂移难以归因。缺配置、连接错误、错误数据库、未知对象或不完整 migration 必须显式失败，而不是静默修复。CLI 被误 import 时抛错，避免命令成功退出却没有执行预期操作。

新开发环境先配置 `apps/server/.env.local`，确保独立 `exre` 已存在，再运行 `pnpm db:migrate`，最后启动 `pnpm dev`。迁移不创建数据库；启动也不会替代迁移。测试夹具使用自己的容器和 schema，不能回退到开发库。具体失败模式见 `.ai/databases/knowledge/database-lifecycle-traps.md`。
