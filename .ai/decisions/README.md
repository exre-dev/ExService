# 决策索引

本索引记录已接受决策及被取代的历史选择。数据库专属决策集中于 `.ai/databases/decisions/`；当前结构见 `.ai/architectures/overview.md`，独立身份结构见 `.ai/architectures/identity/integration-boundaries.md`。当前身份实现没有另建决定条目，运行边界以源码和上述架构页为准。

_最后更新：2026-10-19_

| 决策                                                                        | 模块              | 状态                                                      |
| --------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| `.ai/decisions/api/01-openapi-as-single-contract.md`                        | API               | Contract 原则继续适用；早期接管动机属于历史背景。         |
| `.ai/decisions/api/02-draft07-compatible-schema-subset.md`                  | API               | 已接受。                                                  |
| `.ai/decisions/api/03-unified-error-envelope.md`                            | API               | 已接受。                                                  |
| `.ai/decisions/api/04-separate-local-session-and-sso-completion.md`         | API               | 已接受。                                                  |
| `.ai/decisions/api-client/01-generated-types-committed-and-read-only.md`    | SDK / 历史 Client | 部分被 SDK 单例方案取代；生成类型入库和禁止手改原则保留。 |
| `.ai/decisions/components/01-app-level-shared-component-package.md`         | UI                | 共享 UI 边界保留；旧 Client 形态对齐背景已被取代。        |
| `.ai/decisions/server/01-contract-driven-route-registration.md`             | Server            | 已接受。                                                  |
| `.ai/databases/decisions/02-fixed-local-sqlite-database.md`                 | 数据库            | 已被 PostgreSQL 决策取代。                                |
| `.ai/databases/decisions/03-database-changes-only-by-explicit-command.md`   | 数据库            | 已接受，执行细节已更新。                                  |
| `.ai/decisions/server/04-safe-error-messages.md`                            | Server            | 已接受。                                                  |
| `.ai/decisions/server/05-normalize-new-avatars-to-512-square.md`            | Server            | 已实现。                                                  |
| `.ai/databases/decisions/06-implicit-ordinary-explicit-admin-membership.md` | 数据库            | 已接受。                                                  |
| `.ai/databases/decisions/07-independent-postgresql-exre-database.md`        | 数据库            | 已接受并在开发环境实现。                                  |
| `.ai/decisions/web/01-shared-client-with-configurable-base-url.md`          | Web               | 共享入口与 root 配置原则保留；旧 Client 接入被 SDK 取代。 |
| `.ai/decisions/web/02-react-route-skeleton.md`                              | Web               | 已接受。                                                  |
| `.ai/decisions/web/03-exui-as-component-and-theme-source.md`                | Web               | 已接受。                                                  |
| `.ai/decisions/web/04-settings-state-separate-from-auth-context.md`         | Web               | 已实现。                                                  |
| `.ai/decisions/support-center/01-authenticated-support-and-clickup-view.md` | 支持中心          | 页面与访问边界已实现，反馈提交待实现。                    |
| `.ai/decisions/contract-tests/01-assert-raw-handler-output.md`              | 测试              | 已接受。                                                  |
| `.ai/decisions/contract-tests/02-contract-as-sole-schema-source.md`         | 测试              | 已接受。                                                  |

当前 SDK 的配置、会话与打包边界集中于 `.ai/architectures/sdk/client-boundaries.md`；存储上传运行约束见 `.ai/knowledge/storage/lifecycle-traps.md`。

ExWebsite 使用 Exre 通用团队的项目分工、已授权审查边界与交互设计交付规则集中于 `.ai/architectures/monica-team/workflow.md`，本索引不重复记录。

过时决策保留当时理由，但其旧运行指令不适用于当前 Server。公网部署、共享头像和限流、真实邮件、人机验证、备份恢复与监控仍需后续独立设计。
