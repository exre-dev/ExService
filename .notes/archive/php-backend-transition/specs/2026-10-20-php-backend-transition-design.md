# PHP 后端接入与旧 Node 系统完整退役

日期：2026-10-20。状态：设计待最终审阅，尚未实施。

模块根目录：`.notes/php-backend-transition/`。本设计获批后，RFC 写入 `.notes/php-backend-transition/rfcs/`。

## 已确认范围

用户已选择完整退役 `apps/server/` 和根 `api/`，直接接入最新 PHP 实现，并进一步确认：

- `apps/php-server/` 成为唯一业务后端；HTTP 契约归属 `apps/php-server/api/`。
- 旧 Node 后端、Hydra/OIDC、相关页面、内部身份接口及其运行依赖一并退役。
- 旧系统数据不保留、不迁移；不建设旧协议或旧数据兼容层。
- 同步修改 `README.md`、`AGENTS.md` 和相关 `.ai/`，清理脚本、依赖、测试，并完成 SDK 与现有前端的接入调整。
- 本次没有提交、推送、发布或部署授权。

这里的“旧系统数据”指被退役的 Node/Hydra 数据、文件和浏览器恢复状态。PHP 是接入目标，其已有独立环境不因本次退役自动重置。该解释将清理范围限定在用户指定的旧系统，避免误删目标后端或其他项目资源。

## 现状与依据

| 已核对事实                                                                                                                                                                            | 依据与影响                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| PHP 新实现位于子模块当前 `feat/openapi-contract` 分支；核对时 HEAD 为 `99bb4103dc50a6c6994a0127503ff6fb6e4fb79a`。远端默认分支仍是较旧的 `9d450283e3f17e573ec5b463eb77c5888b4012b3`。 | “最新”按当前子模块新实现及其契约接入，不以默认分支名称替代版本判断。实施前重新核对在途更新，交付时固定子模块提交。                                 |
| PHP 已有公开版、内部版模块化契约及完整单文件。                                                                                                                                        | `apps/php-server/AGENTS.md`、`apps/php-server/config/openapi.php`、`apps/php-server/api/`。YAML 从 PHP Attributes 和公共 schema 生成，不能手改。   |
| 旧后端 41 个方法与路径中，34 个在 PHP 契约中存在。                                                                                                                                    | 比对旧生成 JSON 与 PHP 两版完整 YAML；同名不代表请求、响应或行为兼容。                                                                             |
| 其余 7 个旧 operation 全部属于 Hydra/OIDC 或内部身份核验。                                                                                                                            | 四个 `/api/auth/oidc/*` 和三个 `/api/internal/identity/*`；按用户决定退役。                                                                        |
| PHP 契约的路径已经包含 `/api`，`servers` 根为 `/`。                                                                                                                                   | `apps/php-server/api/internal/openapi.yaml`。SDK 和代理必须避免重复添加 `/api`。                                                                   |
| PHP 成功响应通常为 `{msg, data}`，业务错误为 `{msg}`；账号 ID、有效期及部分资料字段也与旧服务不同。                                                                                   | `apps/php-server/app/functions.php`、账号 schema 和 `CheckLogin`；SDK 与页面要消费真实 PHP 格式。                                                  |
| 当前 PHP 存储支持 file，COS 明确不可用；反馈完成是 PHP 自身的提交状态。                                                                                                               | `apps/php-server/app/storage/StorageController.php`、`apps/php-server/app/support/FeedbackController.php`。不能继续把完成显示为 ClickUp 同步成功。 |
| 根命令、生成器、别名、CI 与测试仍引用旧服务。                                                                                                                                         | `package.json`、`scripts/api/`、`scripts/runtime/`、`tsconfig.base.json`、Vitest/Vite 配置及 `.github/workflows/ci.yml`。                          |
| 当前 checkout 的 `apps/server/data/` 仅发现 `.gitkeep`，没有根 `.env.local` 或 `.local/runtime/`。PHP 自身已有 `.env` 与安装标记。                                                    | 仅核对存在性和目录内容，没有读取秘密。不能由当前 checkout 的缺失证明整机不存在旧数据库或容器。                                                     |

上述依据支持设计，不代表 PHP 真实 HTTP、浏览器、外部服务或部署已经验收。当前主仓库未安装所需 Node 依赖，未运行应用测试。

## 方案选择

采用直接适配 PHP 原生契约：前端和 SDK 改为消费 PHP 当前字段、状态和权限行为，PHP 继续维护自己的接口定义和显式路由。

已排除两个方向：保留旧响应的兼容适配层会继续维护旧行为；把 Hydra/OIDC 或旧业务逐项迁入 PHP 会扩大为协议与数据迁移项目。它们均不符合本次直接退役、不要旧数据的决定。

## 目标结构与责任

```text
apps/php-server/app/ 中的 PHP 接口定义
    └─ PHP CLI ─▶ apps/php-server/api/internal/ 与 public/
                       └─ api/generated/ 中的完整单文件
                               └─ 主仓库生成 SDK 类型 ─▶ packages/sdk/ ─▶ apps/web/

apps/web/ ── /api 请求 ─▶ PHP Webman ─▶ PHP 自有 PostgreSQL、Redis、文件存储
```

| 单元                   | 职责与依赖                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `apps/php-server/`     | 唯一业务实现和 HTTP 契约所有者；其运行、数据库、初始化和测试规则由子模块维护。                |
| `packages/sdk/`        | 从 PHP 内部契约生成本站调用类型；保留 Browser/Node 请求入口、配置 setter 和当前可用上传能力。 |
| `apps/web/`            | 保留现有站点和共享 UI，适配 PHP 响应、鉴权和提交结果。                                        |
| `packages/components/` | 继续只接收 UI props 与回调，不调用 API、不依赖已删除的 Server 类型。                          |
| `packages/common/`     | 保留仍被前端或工具使用的纯逻辑；删除只服务旧 Node/Hydra 的入口及无消费者代码。                |
| 主仓库工具             | 负责 SDK 类型生成、前端开发、构建和测试；不管理第二套业务服务或身份基础设施。                 |

本次不把 PHP 管理端并入 Website，不新增空间、插件管理等前端产品功能。公开业务接口继续由 PHP 的公开契约面向其受众交付；本站 SDK 当前消费内部版，不额外合并两版 schema。

## 契约与 SDK

### 唯一来源与命令语义

接口定义修改在 PHP Controller Attributes、`apps/php-server/app/common/openapi/` 和相应显式路由中完成。在子模块运行 `composer api:generate`、`composer api:lint`、`composer api:check`，同步维护两版全部生成物。

主仓库删除根 `api/`，不在其他根目录复制一份人工维护的 YAML 或 JSON。SDK 类型生成读取 `apps/php-server/api/generated/openapi.internal.yaml`，输出 `packages/sdk/src/generated/schema.d.ts`；生成物仍禁止手改。

根命令保留清晰的消费者语义：

- `pnpm api:lint` 检查 PHP 两版契约的引用与 OpenAPI 文档。
- `pnpm api:generate` 从已生成的 PHP 内部契约更新 SDK 类型。
- `pnpm api:check` 只读核对 SDK 类型与消费的 PHP 契约一致。
- PHP 定义、路由覆盖及 YAML 是否陈旧由子模块 Composer 命令核验；根检查不得冒充这部分验证。

日常前端开发和构建消费已入库的 PHP 契约，不隐式安装 Composer 依赖、启动 PHP 或生成 PHP 契约。修改 PHP 定义后先显式生成；前端开发工具再对变化后的契约和 SDK 串行重建。子模块缺失或契约不可用时给出明确错误，不回退旧契约。

### URL 与返回值

SDK 的 base URL 改为服务根地址，Browser 缺省为当前 origin 的 `/`。`instance` 的 `url` 使用 PHP 契约完整路径，例如 `/api/auth/login`；请求组合结果只包含一次 `/api`。远端配置同样填写服务根地址，可包含部署前缀，不再填写旧的 API root。

SDK 返回生成类型描述的真实响应，页面读取对应 `data`，不在传输层伪装成旧 Node 响应。表单和展示层可以做字段映射，但不得复制 endpoint 或手写一套 HTTP DTO。账号 ID、可空字段及每个时间字段的单位按 PHP 契约逐项处理。

`storage` 适配当前 PHP file 上传和读取流程。COS 仍按当前 PHP 能力报告不可用；不恢复旧 COS 实现，不以成功或本地回退掩盖不可用。

### 错误与凭据

SDK 读取受限大小、契约允许的 PHP JSON 业务错误，其他响应使用固定兜底文案；不把未知异常或原始响应展示给用户。保留 HTTP 状态与契约实际提供的诊断信息，不依赖 PHP 没有承诺的 `SESSION_INVALID`、`requestId` 等字段。

会话失效依据请求上下文处理 PHP 401：受保护的本站会话请求收到 401 才进入失效处理，匿名登录失败不误清另一有效会话。保留请求时捕获的 root/token 版本、条件清理和迟到响应隔离；403 继续作为权限拒绝，不当作会话退出。

新会话使用独立的 PHP 凭据存储命名，并按规范化服务根隔离。新客户端不读取旧 Node token。切换后定向清除已知旧凭据、反馈恢复指针及相关缓存；不清空同一 origin 上其他功能的全部存储。浏览器本地值仍不能替代 `/api/auth/me` 的身份核验。

## 前端行为

现有登录、资料、邀请注册、通知、文件上传、反馈和 PHP 已声明的 SSO 接收流程继续接入 PHP；每个请求按新生成类型调整。共享组件和现有视觉结构保持现有职责。

删除 `/identity/login`、`/identity/consent`、`/identity/logout`、`/identity/signed-out` 的旧 OIDC 页面及其专属状态、调用和测试；旧地址进入现有 404。保留 PHP 实际支持的 `/login`、`/register`、`/sso/success` 及其契约描述的 SSO 流程，不将 PHP OAuth 宣称为 OIDC 兼容实现。

PHP 的 OAuth HTML 页面归属 PHP 服务；开发代理按明确路由转发其 `/oauth/authorize`、`/oauth/device` 页面及实际需要的资源，不能让 SPA fallback 吞掉授权入口。实现时沿页面实际引用验证所需资源，不开放整个 PHP 文件目录。

`/docs`、`/docs/` 继续显示主站建设中页面，旧深路径继续 404，不因 PHP 存在文档 API 而恢复历史文档服务。

反馈提交按 PHP 当前的本地接收和附件状态显示结果；删除依赖旧 ClickUp 状态与维护命令的逻辑和说明。保留仍适用的正文编辑与上传交互，校验和展示以 PHP 的字段、大小限制及状态为准。移除仅服务旧 COS、ClickUp 或 Node 历史记录恢复的消费者逻辑。

## 开发运行与依赖清理

PHP 后端和 PostgreSQL/Redis 通过子模块自己的 CLI、Compose 与配置启动。主仓库不再维护 Hydra、旧 Website PostgreSQL 生命周期或旧 PM2/Nginx 部署方案。

根 `pnpm dev` 准备 SDK 后启动前端，缺省监听 `127.0.0.1:8080`，把 `/api` 转发到 PHP 的 `127.0.0.1:8787` 并保留路径；`pnpm dev:web` 作为同一前端入口的别名。保留端口与后端地址的公开配置能力，不向前端注入 PHP 数据库、Redis 或身份秘密。根 `.env.example` 只说明当前前端需要的配置；PHP 配置归属子模块。

删除或改写所有指向旧服务的根命令。旧 `service:*`、`infra`、`db:*` 和旧部署 `start/stop/logs` 不继续作为空壳命令存在；PHP 的管理方式在 README 明确说明。

删除仅服务旧系统的根 Compose、Hydra 配置、Server 构建和别名改写、旧部署模板、数据库维护入口及测试夹具。`scripts/runtime/` 中仍服务前端、SDK 准备、输出或子进程退出的工具按真实引用保留并收敛依赖；不为删目录重写无关公共工具。

从根依赖、workspace、lockfile、TS/Vite/Vitest 别名和 CI 中移除 `@workspace/server` 及无消费者的 Fastify、Glue、Drizzle、旧数据库与云传输依赖。Node 继续用于前端和工具链，退役业务 Server 不代表删除所有 Node 工具。

CI 递归检出固定 PHP 子模块，验证 SDK 生成与前端；PHP 的独立 CI 继续验证其接口定义和业务。若主仓库加入 PHP 接入检查，使用隔离资源，不接入开发库。依赖子模块新提交的可复现检出，须在获授权的交付阶段保证该提交可从远端获取。

## 旧数据与资源退出

不执行旧账号、通知、反馈、会话、头像或上传文件的迁移，不建立历史读取、备份或兼容路径。`apps/server/` 内旧数据随目录退出；当前只发现 `.gitkeep`，实施时再次检查，按已确认的“不保留旧数据”执行。

外部数据库、容器、卷和进程只清理能够核实归属旧 Node/Hydra 的目标。现有规则要求精确资源身份；本设计不以同名库、同端口或整个 Docker 环境作为归属依据。清理前检查真实目标、资源身份和共享消费者，删除操作遵循平台路径与资源核验规则。

当前 checkout 没有旧 runtime 归属记录，也没有根连接配置，因此尚不能列出可删除的外部资源。实施先做只读盘点；发现可证明属于旧系统的目标后按本次退役授权清理。无法证明归属的目标不得猜测删除，交付时准确说明清理范围，不宣称全机旧数据已经清空。

PHP 当前的 `.env`、安装标记、数据目录和未提交工作不属于旧 Node 目录。接入流程不重置 PHP、不覆写其秘密，也不删除同机其他项目资源。

## 文档与持久知识

通过 `codebase-documenter` 同步已验证的最终边界，不将本设计中的待实施内容写成已经完成：

- `README.md`：新前提、子模块准备、PHP 独立启动、前端启动、端口、SDK 与 Composer 命令边界。
- `AGENTS.md`：PHP 为唯一后端、子模块规则入口、生成契约不可手改、SDK 消费规则；删除 Fastify/Glue/Drizzle/Hydra 专属强制要求。
- `.ai/README.md`、架构总览、Contract、SDK、runtime、Web 认证、存储、通知和反馈知识：更新当前来源、依赖及真实能力。
- `.ai/databases/data-model.md`：退出 Node 数据模型，以 PHP 现役模型的职责为依据；物理结构归属 `apps/php-server/database/schema.sql`，不复制整份 schema。
- `.ai/decisions/README.md` 及相关决策：标记被 PHP 方案取代的历史选择，保留当时理由；历史 `.notes/archive/` 不改写为当前运行说明。
- `TESTING.md`、`CONTRIBUTING.md`、SDK README 及当前有效说明：清理旧命令与验证承诺。

PHP 子模块 README 中将 Website 描述为独立 Node/Hydra 系统的内容也需同步，遵守其自身规则。现有子模块测试、CI 和笔记改动在实施前重新核对，不覆盖其他在途工作。

## 验证与完成条件

开发阶段遵守根和 PHP 各自的 `TESTING.md`，按变更运行定向检查；不把设计完成当作应用通过，也不自动运行整套测试。提交、PR、浏览器和部署继续遵守各自执行边界。

| 范围       | 必须核对的行为                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| 结构退役   | `apps/server/`、根 `api/` 退出；有效源码、脚本、依赖、别名和测试不再引用它们。历史设计引用单独识别。                     |
| 契约消费   | PHP 内部契约生成 SDK 类型；缺失子模块、陈旧 SDK、重复 `/api`、错误 base URL 能被定向检查发现。                           |
| SDK        | 按 PHP 原生成功与错误响应工作；当前 token 的受保护请求 401 正确清理，登录失败、403、晚到旧请求及切换服务根不误清新会话。 |
| 前端       | 登录、资料恢复/修改、邀请注册、通知命令、file 上传和反馈接收按 PHP 契约运行；移除的身份路由返回 404。                    |
| 运行与构建 | 前端开发、停止、SDK 准备和 Build 不引用旧服务，也不要求 Hydra 或旧数据库；PHP 使用其独立入口。                           |
| 测试体系   | 移除只验证退役系统的用例，保留并调整前端、组件、SDK 的有效行为覆盖；PHP 真实 HTTP 校验由其对应夹具承担。                 |
| 数据退出   | 不迁移旧数据；工作区内删除范围、外部已核实清理目标与无法确认的目标分别记录。                                             |
| 文档       | 现行入口和 `.ai/` 一致指向 PHP；生成定义、运行数据和测试证明的边界准确。                                                 |

自动测试、真实 PHP HTTP 联调、真实浏览器和外部服务分别报告。需要 PR 时再按贡献规则集中验证；本阶段不部署上线。

## 实施交接与风险

默认形成一份 RFC，覆盖契约/SDK、前端、运行清理与文档这条完整替换链；不拆出协议迁移或数据迁移项目。RFC 必须把删除清单、配置变化、响应映射、会话失效条件和定向验证变成可执行步骤。

已知风险是 PHP 与旧前端虽存在同名路径，字段和语义仍不同；PHP 的契约覆盖检查也不能证明真实响应。实施遇到定义与行为不符时，在 PHP 所属模块修正并重新生成，不能添加旧 Node 兜底。当前 PHP 在途改动和独立 Git 边界需要在写入前重新确认；未经授权不提交或推送子模块与主仓库。

设计的最终审阅通过后，按 `superpowers:brainstorming` 交接 `technical-design-doc-creator`，沿用本模块目录生成 RFC；该交接不自动启动实施。
