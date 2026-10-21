# PHP API Contract 的定义与消费

PHP 服务在 Controller 的 OpenAPI Attributes 与 `apps/php-server/app/common/openapi/` schema 中维护接口定义；`apps/php-server/app/route.php` 显式注册实际路由。PHP 的 `composer api:generate` 生成 public/internal 两版 YAML，`composer api:lint` 和 `composer api:check` 分别检查路由/归属和生成集合。PHP 开发规则见 `apps/php-server/AGENTS.md`。

_最后更新：2026-10-20_

| PHP 生成物                                                                                                                  | 用途                                                |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `apps/php-server/api/public/openapi.yaml`、`apps/php-server/api/public/paths/`、`apps/php-server/api/public/schemas/`       | 外部插件、第三方应用和 OAuth 接入的模块化公开契约。 |
| `apps/php-server/api/internal/openapi.yaml`、`apps/php-server/api/internal/paths/`、`apps/php-server/api/internal/schemas/` | Website、管理端等内部业务的模块化契约。             |
| `apps/php-server/api/generated/openapi.public.yaml`                                                                         | 可独立分发的完整公开 YAML。                         |
| `apps/php-server/api/generated/openapi.internal.yaml`                                                                       | 主仓库 SDK 类型与 operation policy 的输入。         |

两版 operation 按 PHP 的 `x-audience` 归属，不互相复制。公开范围和匿名权限是不同维度；契约与实际路由同时核对。模块化入口必须携带其引用文件一起分发。PHP 生成物不可在主仓库手改。

主仓库 `pnpm api:lint` 用 Redocly 检查两版模块化入口；`pnpm api:generate` 从完整内部 YAML 的单一快照生成 `packages/sdk/src/generated/schema.d.ts` 和 `packages/sdk/src/generated/operation-policy.ts`，相同内容不重写，发布失败可回滚；`pnpm api:check` 只读比较这两项 SDK 产物。PHP 的 Composer 检查覆盖定义、路由与全部 PHP 产物，主仓库的命令只证明消费一致性，不能代替 PHP 行为测试。

内部 operation 的完整路径已含 `/api`；SDK 的 base URL 是服务根，`servers[].url` 不替代实际路由登记。成功 JSON 为 PHP `{msg,data}`，错误从真实 HTTP 状态与适用的 `{msg}` 读取；各 operation 可有 HTML、二进制、204 或其他专有响应。SDK 仅在内部契约中声明的会话鉴权 operation 处理本站 401。破坏性契约调整须评审受影响消费者，不沿用旧 Node/Glue 的 Draft-07 限制作为 PHP 的默认规则。
