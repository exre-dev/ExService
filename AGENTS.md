# AGENTS.md

## 沟通与文档

- 默认用中文沟通；代码、标识符、Commit message 和既有文档沿用各自语言约定。
- 文档、注释和交付说明中的仓库路径以仓库根目录为基准，使用行内代码；不写 `./`、`../`、Markdown 相对链接或本机绝对路径。代码中的 import 和运行时路径遵循工具约定。
- 开工前从 `.ai/README.md` 查找相关知识；启动检查单与命令见 `README.md`，配置、运行和资源边界见 `.ai/architectures/runtime/runtime-boundaries.md`。
- 修改或消费 `packages/common/` 前，阅读 `.agents/rules/package-common.md`。
- Monica 任务使用当前项目提示词和本工程规则提供项目上下文；Exre 通用 Agents 只定义角色职责，不携带其他项目规则。ExWebsite 项目协作约定见 `.ai/architectures/monica-team/workflow.md`。
- `/docs` 和 `/docs/` 是主站公开建设中页面；保留旧深路径的 404，不恢复已退役文档服务。身份客户端与 Hydra 边界见 `.ai/architectures/identity/integration-boundaries.md`。

<!-- codebase-worker:start -->

## Project AI documentation rules

- Before design, development, debugging, or a major decision, read the relevant content in `.ai/`.

### Durable knowledge extraction

- After completing a module or making a major decision, use `codebase-documenter` to update evidence-backed durable `.ai/` knowledge.
- `.ai/CONTEXT.md` holds the domain language; `.ai/architectures/`, `.ai/decisions/`, and `.ai/knowledge/` hold system structure, accepted decisions, and non-obvious behavior, each grouped by module. Database model, database-specific decisions, and database-specific operational knowledge live in `.ai/databases/`. Keep each fact in exactly one place and link instead of duplicating.
- Design documents, RFCs, and implementation plans stay where they are, normally `notes/<module>/`. After a design is complete, ask the user before distilling its stable conclusions into `.ai/`.
- Do not archive transient task narration, raw test output, unadopted speculation, source-code duplication, or version-control and workspace state. Update `.ai/README.md` and `.ai/decisions/README.md` after structural changes.

### Testing and contribution rules

- Testing rules: if this repository has a `TESTING.md`, read it before testing; when it exists, it is the single source of truth for test workflow, test-case authoring, and execution rules. When it does not exist, follow the repository's own testing conventions instead.
- Contribution rules: `@CONTRIBUTING.md`. Read this file before creating a commit or Pull Request; it is the single source of truth for contribution, commit, and PR rules.

### How to Commit

- If a code-commiter skill is available, commits must be made using this SKILL.

<!-- codebase-worker:end -->

## 架构与目录边界

本仓库采用 Contract-first 架构：`api/openapi.yaml` 是唯一 HTTP Contract，`apps/server/` 是唯一 Website Fastify Server，业务数据使用独立 PostgreSQL `exre`。完整架构见 `.ai/architectures/overview.md`。

| 路径                   | 责任与边界                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`                 | HTTP 路径、operation、请求/响应/错误 schema；不放实现。                                                                                            |
| `packages/sdk/`        | 从 Contract 生成类型，公开 Browser/Node 单例 `instance({...})`、配置 setter 与 `storage`；不定义第二份 endpoint。                                  |
| `packages/components/` | 基于 ExUI 的共享 UI；不访问 API、不定义路由表、不导入 ExUI 全局样式。                                                                              |
| `packages/common/`     | 按模块子入口公开跨应用共享的纯逻辑；消费规则见 `.agents/rules/package-common.md`。                                                                 |
| `apps/web/`            | 前端路由、主题、构建配置与 SDK 适配；本站业务 HTTP 调用只经 `@workspace/sdk`，不复制 DTO。                                                         |
| `apps/server/`         | 加载 Contract、映射 handler、执行受控数据库访问；不绕过 Contract 注册 HTTP 路由或静态 JSON mock，不反向生成 OpenAPI，不连接 `hydra` 等其他数据库。 |
| `tests/contract/`      | 从 Contract 读取 schema，验证真实 Fastify 路由、原始 handler 输出和双向 operation 覆盖。                                                           |

Browser 和 Node 的本站业务 HTTP 调用统一使用 `@workspace/sdk` 的 `instance({...})`；上传使用同包 `storage`，其本站阶段经过同一请求管线。方法、路径、请求和响应类型从唯一 OpenAPI Contract 推导。第三方业务请求可自行选择 `fetch` 或其他工具，本站 token 不用于第三方请求。

测试夹具、原始 handler/HTTP 协议断言和需要原始状态、header、Host 的基础设施 readiness 探针保留独立协议验证工具；它们不能成为页面或业务绕过 SDK 的入口。Server 对第三方服务的既有出站客户端继续按其模块规则执行。SDK 的配置、会话与打包边界见 `.ai/architectures/sdk/client-boundaries.md`。

## Contract-first 工作流

1. 实现 API 调用前读取 `api/openapi.yaml`；不得臆造 endpoint、方法、参数或字段。
2. API 变更先改 Contract，再运行 `pnpm api:lint` 和 `pnpm api:generate`。`packages/sdk/src/generated/schema.d.ts` 禁止手改，Contract 变更须同时提交重新生成的结果。
3. 在所属模块的 `apps/server/src/modules/{name}/api/operations.ts` 或 `apps/server/src/domains/{name}/api/operations.ts` 中显式登记 `operationId`（系统 operation 在 `apps/server/src/http/system/operations.ts`），由 `apps/server/src/http/service-handlers.ts` 汇总，实现 handler，并通过 SDK 的对象请求 API 接入消费方。Contract 与登记表必须双向一致；文件名不参与映射。Glue 的 `/api` 前缀须显式配置，`servers[].url` 不能替代它。
4. 新增或修改 operation 时同步更新 `tests/contract/`：校验真实 HTTP 响应及注册 handler 的原始返回值，防止序列化掩盖回归。原因见 `.ai/knowledge/server/serialization-masks-handler-regressions.md` 与 `.ai/knowledge/server/operation-registration-gaps.md`。
5. API 变更的验证时机与范围统一遵守 `TESTING.md`；自动检查、真实浏览器验收和部署验收分别报告。

OpenAPI 3.1 schema 仅使用 JSON Schema Draft-07 兼容子集；引入 Draft 2020-12 专有语义前，须单独设计并确认 validator/serializer compiler。破坏性 Contract 变更须显式评审与版本化；不要自行发明版本策略或兼容层。

## 前端规则

- 修改 Form 前，阅读并遵守 `.ai/rules/frontend-forms.md`；全站临时通知统一使用 `toast`，遵守 `.ai/rules/frontend-notifications.md`。
- 共享组件使用 CSS Modules、ExUI 颜色/边框/圆角 token 和 `lucide-react` 图标，不新建本地 token 层。`react`、`react-dom`、`react-router` 同时声明为 peer/dev dependencies，保证消费方单一实例。
- 修改 ExUI 接入或主题前，阅读 `.ai/knowledge/web/exui-integration-traps.md`。全局样式仅在 `apps/web/src/main.tsx` 导入一次；`useTheme` 必须位于 `ThemeProvider` 内，应用按 light/dark 类补充 `color-scheme`。不要另装 ExUI 已打包的 Sonner、Radix、Base UI 等实现库。

## Server 与数据库规则

Server 按已确认方案组织：公共能力放在 `apps/server/src/modules/{name}/`，具体业务流程放在 `apps/server/src/domains/{name}/`，各模块内部的 `api/` 承载 HTTP 接入。业务与 API 入口均用 `fastify-plugin` 显式注册，业务入口通过 `decorate` 暴露服务；业务核心保持普通 service/factory，通过构造参数依赖公开能力，不依赖 HTTP 层，公共模块不得反向依赖具体业务。各模块只在自己的 `fastify.d.ts` 声明所拥有的扩展，类型提示不能替代运行时依赖检查。`apps/server/src/http/plugin.ts` 汇总 API 插件与 operation 映射，在统一 HTTP 作用域内先安装按 operation 筛选的 hook，检查 Contract 与 handler 双向覆盖，再注册一次 Glue；OpenAPI 源文件独立维护于 `api/`，统一生成 `api/generated/openapi.json`，禁止反向生成或手改产物。具体边界见 `.ai/architectures/server/request-lifecycle.md`。

- 错误统一经 `apps/server/src/errors.ts` 返回 envelope；对外消息仅允许 Contract 校验错误或固定文案，其他异常（含应用抛出的 4xx）的 `error.message` 不得回显。
- 修改表的职责、关系或数据规则前，先阅读并更新 `.ai/databases/data-model.md`，评审模型影响，再改 schema/migration。纯索引、迁移实现和测试数据调整不要求更新模型；物理结构以 `apps/server/src/db/schema.ts`、`apps/server/drizzle/` 为准。
- `DATABASE_URL` 与连接后的 `current_database()` 必须核验为独立 `exre`。Server 监听前检查数据库身份、migration 和必需结构；缺失时拒绝启动，提示显式迁移，不创建数据库、不隐式迁移或 reset。
- 自动数据库测试使用 PostgreSQL Testcontainers 与逐用例 schema；Docker 不可用时明确失败，不回退本机开发库。
- `apps/server/src/db/migrate.ts`、`apps/server/src/db/reset.ts` 是 CLI 入口，禁止 import；复用逻辑位于 `apps/server/src/db/migration-runner.ts`、`apps/server/src/db/reset-plan.ts`、`apps/server/src/db/client.ts`。
- 头像位于 `apps/server/data/avatars/`，不得提交；启动和 reset 不删除头像，清理须显式核对数据库引用。数据库生命周期细节见 `.ai/architectures/server/request-lifecycle.md`。

## 运行与交付边界

- 普通 runtime 只读取根 `.env.local`，受支持的进程变量优先；已有环境须显式导入，保留原数据库、账号、秘密、存储与头像，不用示例默认值覆写。
- 日常运行只核对准备状态；数据库创建、迁移和客户端登记须显式执行；`IDENTITY_CLIENTS_JSON` 默认空集合，不创建默认应用。
- ExUI 使用 registry 发布包，由 pnpm lockfile 锁定；不恢复本地 link/portal。日常启动不改写 lockfile 或依赖树；停止只清理可证明归属的运行资源，不删除持久数据。
- 身份客户端规则见 `.ai/architectures/identity/integration-boundaries.md`；代理与资源归属见 `.ai/architectures/runtime/runtime-boundaries.md`。当前仍是单实例开发阶段，部署材料不代表公网生产验收；本阶段不部署上线。
