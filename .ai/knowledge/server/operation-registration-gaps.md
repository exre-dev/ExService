# Contract 与 handler 登记之间的两种漂移

> 已退役：历史 Node/Fastify 实现记录。文中路径、命令和行为仅用于理解当时选择；现行 PHP/Webman 边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 与 `apps/php-server/TESTING.md`。

**结论：Contract 中新增 operation 却漏登记 handler 时，只有「双向覆盖检查」能发现；既有断言不会失败。**

_最后更新：2026-10-11_

## 失败模式

各模块的 `api/operations.ts`（系统入口为 `apps/server/src/http/system/operations.ts`）显式登记 `operationId -> handler`，`apps/server/src/http/service-handlers.ts` 合并为 `serviceHandlers`；`fastify-openapi-glue` 按 `operationId` 查找它。文件名、目录结构、导出名都不参与解析。合并时拒绝重复登记，`apps/server/src/http/plugin.ts` 在注册 Glue 前检查 Contract 与映射的双向覆盖。

两个方向都可能漂移；如果移除启动覆盖检查，既有 operation 的 HTTP 断言也不能发现它们：

1. **Contract 已声明、`serviceHandlers` 未登记**：缺少启动覆盖检查时，该路由在运行时返回 500；其他 operation 的断言照常通过。
2. **`serviceHandlers` 已登记、Contract 未声明**：缺少启动覆盖检查时不会产生路由（路由来自 Contract），多余 handler 可能留作死代码。

## 如何应用

- 新增 operation 时同时改相关 `api/paths/` 源文件和所属模块的 `api/operations.ts`；汇总入口为 `apps/server/src/http/service-handlers.ts`。
- 启动前覆盖检查快速拒绝错配；`tests/contract/health.test.ts` 的双向断言独立守卫映射，不能用人工检查替代。选择双向覆盖检查的理由见 `.ai/decisions/contract-tests/02-contract-as-sole-schema-source.md`。
- 重命名 `operationId` 等同于「删除旧 operation + 新增新 operation」，两个方向都要同步。

## 证据

- `tests/contract/health.test.ts` 的 `contract coverage` 两组用例（`registers a handler for every operation declared in the contract`、`registers no handler that the contract does not declare`）及其注释。
- `apps/server/src/http/service-handlers.ts`、`apps/server/src/contract/document.ts` 和 `apps/server/src/http/plugin.ts`。
- `AGENTS.md` 的「Server 实现约定」与「修改 API 的固定顺序」。
