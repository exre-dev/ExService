# 社区身份组待办

> 迁移说明（2026-09-29）：本文件保留当时的业务与实现决定；其中旧 `apps/mock-server/` 路径、本地 SQLite Mock 与未来 PHP/MySQL 接管的基础设施描述，已由 `.notes/archive/server-promotion/specs/2026-09-29-server-promotion-design.md` 和 `.notes/archive/server-promotion/rfcs/server-postgresql-migration-rfc.md` 取代。当前唯一 Server 位于 `apps/server/`，使用独立 PostgreSQL `exre`；正文中的旧路径和目标仅作历史记录。

_记录日期：2026-09-23_

## 已确认的边界

- 这里的身份组属于 ExWebsite 用户社区，不是游戏角色，也不管理 FiveM 服务器权限。
- 一个用户可以属于多个社区身份组。
- 后续权限来源包括身份组授予的权限，以及直接授予用户的额外权限；具体权限项和管理规则以后再定。
- 当前优先建立默认身份组，不提前实现完整的权限系统。
- 默认组按“通用的”命名：稳定标识 `general`，展示名称“通用”；每个已注册用户都属于该组，组本身不授予特权。

## 当前实现

- `apps/mock-server/src/db/schema.ts` 中的 `auth_users` 没有社区身份组或成员关系；现有数据库迁移也没有身份组表。
- 注册验证成功时，`apps/mock-server/src/auth/service.ts` 只创建用户，没有加入身份组的步骤。
- `api/openapi.yaml` 的 `CurrentUser` 只包含 `id`、`email`、`nickname`；没有身份组或权限的 Contract operation。
- Mock Server 没有身份组权限的计算与校验，前端也没有身份组管理入口。

## 默认身份组的下一步

- [x] 确定默认组的稳定标识 `general` 与展示名称“通用”；本期不提供改名或删除操作。
- [ ] 在修改物理表前更新 `.ai/databases/data-model.md`，确认本地 SQLite 与未来 MySQL 的成员关系规则。
- [ ] 用新的 migration 创建身份组及用户与身份组的关联，并为已有用户补齐默认组成员关系；不修改历史 migration。
- [ ] 注册验证创建用户时，在同一事务中加入默认组，保证新用户不会缺少默认组。
- [ ] 本期 `CurrentUser` 保持不变；后续若需要展示组信息，再按 Contract 优先流程同步 Mock Server、生成 Client 和 Contract Test。

## 后续另行设计

- [ ] 定义站内权限目录，以及身份组授权与用户额外授权的记录和生效规则。
- [ ] 定义谁能创建或管理身份组、调整成员关系、配置权限；包含首位管理员的初始化方式与防止自行提权的约束。
- [ ] 决定权限变更对已登录会话的生效时机、管理操作的审计记录，以及相应 API 和界面。
      y
