# 唯一 Server 使用独立 PostgreSQL `exre`

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：旧 Node 独立 exre 数据库模型已退役；PHP 数据模型现行
- 模块：`server`
- 日期：2026-09-29
- 来源：`.notes/archive/server-promotion/specs/2026-09-29-server-promotion-design.md` 与 `.notes/archive/server-promotion/rfcs/server-postgresql-migration-rfc.md`
- 取代：`.ai/databases/decisions/02-fixed-local-sqlite-database.md`

## 背景

本仓库的 Fastify 服务从开发期 Mock 提升为唯一长期 Server，原定外接 PHP/MySQL 服务目标取消。旧 SQLite 同步连接与本地固定文件不能满足新的 PostgreSQL 拓扑及其事务、并发语义。

## 决策

`apps/server/` 使用 `pg` 连接池访问独立的 PostgreSQL `exre`。`DATABASE_URL` 必须明确指向 `exre`，连接后复核 `current_database()`；不能推断或使用 `outline`。业务查询使用异步参数化 SQL，事务回调在同一个 PostgreSQL 客户端上执行。新库从空库通过一条 PostgreSQL 基线建立当前有效模型，不导入 SQLite 数据。

迁移和重置只由显式 CLI 执行。开发专用重置额外要求回环地址、`--confirm exre` 和应用对象清单核验，拒绝未知对象；不删除本机头像目录。自动测试使用独立 PostgreSQL 容器与逐用例 schema，避免触及本机数据库。

## 影响与边界

Server 启动可以连接并检查目标身份、migration journal、结构及配置，但不建库或自动迁移。PostgreSQL 失败由安全 envelope 处理，不向客户端回显 SQL、连接串或驱动错误。头像仍是本机文件，限流仍是进程内状态；当前单实例开发拓扑不代表已具备公网生产部署能力。

旧 SQLite 数据与头像引用不回填；旧目录中的头像文件保留供用户自行核查。数据库业务规则统一见 `.ai/databases/data-model.md`，实际结构见 `apps/server/src/db/schema.ts` 与 `apps/server/drizzle/`。

## 重新审视的条件

需要上线、多实例运行、共享文件存储、备份恢复或数据迁移时，分别设计运行和数据策略，不从本次开发迁移自动推导生产方案。
