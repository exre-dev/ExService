# ExWebsite 持久知识库

本目录记录源码不易直接表达的边界、已接受决策、数据规则与运行陷阱。当前 Website HTTP 服务位于 PHP 子模块 `apps/php-server/`；主仓库提供 React Web 与消费 PHP 内部契约的 TypeScript SDK。模块拓扑见 `.ai/architectures/overview.md`。

_最后更新：2026-10-20_

## 模块与入口

| 模块                 | 代码路径                                                               | 知识入口                                                                                                            |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| PHP API 定义与生成物 | `apps/php-server/app/common/openapi/`、`apps/php-server/api/`          | `.ai/architectures/api/contract-layout.md`                                                                          |
| 本站 SDK             | `packages/sdk/`、`scripts/api/`                                        | `.ai/architectures/sdk/client-boundaries.md`                                                                        |
| 管理端               | `apps/admin-web/`                                                      | `.ai/architectures/admin-web/application-boundaries.md`                                                             |
| Web 认证与会话       | `apps/web/src/auth/`、`apps/web/src/api/`                              | `.ai/architectures/web/authentication-flow.md`                                                                      |
| 支持反馈             | `apps/web/src/pages/Support/feedback/`、`apps/php-server/app/support/` | `.ai/architectures/support-center/feedback-lifecycle.md`                                                            |
| 存储上传             | `packages/sdk/src/storage/`、`apps/php-server/app/storage/`            | `.ai/knowledge/storage/lifecycle-traps.md`                                                                          |
| 身份与 SSO           | `apps/php-server/app/oauth/`、`apps/web/src/auth/`                     | `.ai/architectures/identity/integration-boundaries.md`                                                              |
| 前端开发进程与代理   | `scripts/runtime/`、`apps/web/vite.config.ts`                          | `.ai/architectures/runtime/runtime-boundaries.md`                                                                   |
| 测试分层             | `tests/`、`apps/php-server/tests/`                                     | `TESTING.md`、`apps/php-server/TESTING.md`、`.ai/architectures/contract-tests/test-layers.md`                       |
| 数据模型             | `apps/php-server/database/schema.sql`                                  | `.ai/databases/data-model.md`                                                                                       |
| 共享组件与内容       | `packages/components/`、`packages/common/`、`apps/web/src/content/`    | `.ai/knowledge/components/async-boundary.md`、`.ai/architectures/web/content-rendering.md`                          |
| 通知 UI              | `apps/web/src/notifications/`                                          | `.ai/knowledge/notifications/request-lifecycle.md`、`.ai/knowledge/notifications/clear-preview-coexistence.md`      |
| ExUI 与表单          | `apps/web/`、`packages/components/`                                    | `.ai/knowledge/web/exui-integration-traps.md`、`.ai/rules/frontend-forms.md`、`.ai/rules/frontend-notifications.md` |
| Monica 协作          | 项目提示词                                                             | `.ai/architectures/monica-team/workflow.md`                                                                         |

领域术语见 `.ai/CONTEXT.md`，决策状态见 `.ai/decisions/README.md`，Common 消费规则见 `.agents/rules/package-common.md`。支持首页 ClickUp 分享视图见 `.ai/architectures/web/content-rendering.md`；它与本站反馈接收是不同流程。

## 知识归属

`.ai/architectures/` 解释当前结构，`.ai/decisions/` 与 `.ai/databases/decisions/` 记录选择及取代关系，`.ai/knowledge/` 与 `.ai/databases/knowledge/` 记录不明显的失败模式。表职责与关系只在 `.ai/databases/data-model.md` 维护；物理字段以 PHP schema 为准。同一长期事实只维护一处，其他页面链接它。`.notes/` 中的 RFC、设计与历史档案记录当时背景，不充当现行运行指南。

旧 Fastify/Glue 与 Node PostgreSQL 知识页已标明历史状态；现行入口从本索引进入。当前行为应回查 PHP 路由与 Controller、PHP OpenAPI 生成物、主仓库 SDK/Web 源码和各自测试。
