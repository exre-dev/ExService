# 决策索引

本索引区分仍适用的产品选择与已由 PHP 接管取代的 Node/Fastify 实现。当前运行结构见 `.ai/architectures/overview.md`，API 定义/生成见 `.ai/architectures/api/contract-layout.md`，数据职责见 `.ai/databases/data-model.md`。历史决策保留当时理由，其旧路径和命令不作为当前操作指南。

_最后更新：2026-10-20_

## 仍适用的边界

| 决策                                                                                                                                                                              | 适用范围                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `.ai/decisions/api/04-separate-local-session-and-sso-completion.md`                                                                                                               | Website 会话和 SSO 完成分离的产品原则；旧 Node token/CLI 细节已取代。 |
| `.ai/decisions/web/01-shared-client-with-configurable-base-url.md`                                                                                                                | Web 使用共享 SDK 和可配置服务根的原则；当前默认根是 `/`。             |
| `.ai/decisions/web/02-react-route-skeleton.md`、`.ai/decisions/web/03-exui-as-component-and-theme-source.md`、`.ai/decisions/web/04-settings-state-separate-from-auth-context.md` | React、ExUI 和设置状态边界，具体接口以当前 PHP/Web 实现为准。         |
| `.ai/decisions/components/01-app-level-shared-component-package.md`                                                                                                               | 共享 UI 包边界。                                                      |
| `.ai/decisions/support-center/01-authenticated-support-and-clickup-view.md`                                                                                                       | 登录访问与首页 ClickUp 分享视图；反馈提交当前由 PHP 本地接收。        |

## 历史实现选择

| 决策                                                                                                                                                                                                                                                                                      | 现行取代关系                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.ai/decisions/api/01-openapi-as-single-contract.md`                                                                                                                                                                                                                                      | 根 `api/openapi.yaml` 与 Glue 已退役；PHP public/internal 定义及主仓库消费见 Contract 布局。         |
| `.ai/decisions/api/02-draft07-compatible-schema-subset.md`、`.ai/decisions/api/03-unified-error-envelope.md`                                                                                                                                                                              | 旧 Fastify 编译限制和 `error.code` 信封已退役；以 PHP 生成契约及实际状态/`msg` 为准。                |
| `.ai/decisions/api-client/01-generated-types-committed-and-read-only.md`                                                                                                                                                                                                                  | 禁止手改生成物原则仍适用；旧 Client 形态被 `@workspace/sdk` 取代。                                   |
| `.ai/decisions/server/01-contract-driven-route-registration.md`、`.ai/decisions/server/04-safe-error-messages.md`、`.ai/decisions/server/05-normalize-new-avatars-to-512-square.md`                                                                                                       | 旧 Node handler、错误及头像实现退役；PHP 路由、Controller 和头像逻辑现行。                           |
| `.ai/decisions/contract-tests/01-assert-raw-handler-output.md`、`.ai/decisions/contract-tests/02-contract-as-sole-schema-source.md`                                                                                                                                                       | 旧 Fastify 原始 handler 测试退役；当前测试层次见 `.ai/architectures/contract-tests/test-layers.md`。 |
| `.ai/databases/decisions/02-fixed-local-sqlite-database.md`、`.ai/databases/decisions/03-database-changes-only-by-explicit-command.md`、`.ai/databases/decisions/06-implicit-ordinary-explicit-admin-membership.md`、`.ai/databases/decisions/07-independent-postgresql-exre-database.md` | 旧 SQLite/Node PostgreSQL 模型退役；PHP schema、安装和资源规则现行。                                 |

历史设计保留于 `.notes/archive/`。PHP 外部 provider、真实浏览器、SMTP、数据库/资源现场迁移与部署分别验收；本索引不把本地源码或配置当成这些验收。
