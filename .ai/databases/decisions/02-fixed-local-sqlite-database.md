# 历史决策：本地 Mock 数据库使用固定 SQLite 路径

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：先被 Node PostgreSQL 决策取代；现由 PHP 数据模型与安装规则接管
- 原模块：`mock-server`
- 日期：2026-09-16
- 取代日期：2026-09-29

## 当时的背景与决定

本地 Mock Server 最初需要保存状态，同时避免开发命令误连原规划中的外部数据库。`db:reset` 当时是删除文件的命令，因此选择固定的 `apps/mock-server/data/mock.sqlite`，不接受覆盖路径，使用 `better-sqlite3` 和 Drizzle SQLite migration。这个选择还避免了任意路径删除风险。

## 被取代的原因

此条历史注释描述过 Node Server 与独立 PostgreSQL `exre` 阶段；该阶段已由 PHP/Webman 接管。旧 SQLite 与 Node 数据是否迁移或清理不能由源码变化推定。现行表职责见 `.ai/databases/data-model.md`，PHP 安装与数据操作见 `apps/php-server/README.md`。

本文件保留原决策的原因，不作为当前开发或运行指令。
