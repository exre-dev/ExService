# AGENTS.md

<!-- CODEGRAPH_START -->

## CodeGraph

在仓库根目录存在 `.codegraph/` 时，定位或理解代码先使用 `codegraph_explore`（若可用）或 `codegraph explore "<问题或符号>"`；不存在该目录时跳过索引。
<!-- CODEGRAPH_END -->

## 沟通与文档

- 默认用中文沟通；代码、标识符、Commit message 和既有文档沿用各自语言约定。
- 文档、注释和交付说明中的仓库路径以仓库根目录为基准，使用行内代码；不写 `./`、`../`、Markdown 相对链接或本机绝对路径。代码中的 import 和运行时路径遵循工具约定。
- 开工前从 `.ai/README.md` 查找相关知识；启动命令见 `README.md`，运行与资源边界见 `.ai/architectures/runtime/runtime-boundaries.md`。修改或消费 `packages/common/` 前读 `.agents/rules/package-common.md`。
- Monica 任务使用当前项目提示词和本工程规则提供项目上下文；项目协作约定见 `.ai/architectures/monica-team/workflow.md`。
- `/docs` 和 `/docs/` 是主站公开建设中页面；旧深路径保持 404。PHP 另有自身文档 API，不属于主站该页面。身份与 SSO 边界见 `.ai/architectures/identity/integration-boundaries.md`。

<!-- codebase-worker:start -->

## Project AI documentation rules

- Before design, development, debugging, or a major decision, read the relevant content in `.ai/`.

### Durable knowledge extraction

- After completing a module or making a major decision, use `codebase-documenter` to update evidence-backed durable `.ai/` knowledge.
- `.ai/CONTEXT.md` holds domain language; `.ai/architectures/`, `.ai/decisions/` and `.ai/knowledge/` hold structure, decisions and non-obvious behavior by module. Database knowledge lives in `.ai/databases/`. Keep each fact in one place and link to it.
- Design documents, RFCs and plans stay in `.notes/`. Ask before distilling a design that has not been implemented or otherwise approved; explicitly authorized completed implementation conclusions may be recorded.
- Do not archive transient task narration, raw test output, speculation, source-code duplication or workspace state. Update `.ai/README.md` and `.ai/decisions/README.md` after structural changes.

### Testing and contribution rules

- Read `TESTING.md` before testing; it is the root testing workflow source. PHP tests follow `apps/php-server/TESTING.md`.
- Read `CONTRIBUTING.md` before a commit or PR; it is the contribution source.

### How to Commit

- If a code-commiter skill is available, use it for commits.

<!-- codebase-worker:end -->

## 现行责任边界

`apps/php-server/` 是独立 Composer/Webman 子模块，拥有 Website HTTP 实现、PostgreSQL/Redis、PHP 配置、运行文件、PHP 自有 HTML 与后台。PHP 接口定义位于 Controller 的 OpenAPI Attributes 和 `apps/php-server/app/common/openapi/`；PHP CLI 生成 `apps/php-server/api/public/`、`apps/php-server/api/internal/` 模块契约和 `apps/php-server/api/generated/` 完整文档。PHP 路由在 `apps/php-server/app/route.php` 显式注册。主仓库不编排 PHP 服务或数据库，PHP 开发规则见 `apps/php-server/AGENTS.md`。

| 路径                         | 责任                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `scripts/api/`               | 验证 PHP 两版契约，从完整内部 YAML 生成和核对 SDK 类型、operation policy；不定义第二份 endpoint。 |
| `packages/sdk/`              | Browser/Node 单例 `instance({...})`、配置 setter、`storage`；本站 HTTP 消费入口。                 |
| `packages/components/`       | 基于 ExUI 的共享 UI；不访问本站 API 或定义路由。                                                  |
| `packages/common/`           | 跨应用纯逻辑，按子入口导出；仅保留实际消费者需要的入口。                                          |
| `apps/admin-web/`            | 独立管理端 SPA，保留 Ant Design、自己的 Axios/初始化 fetch 与 PHP 类型；不接入 Website SDK。      |
| `apps/web/`                  | React 路由、主题、SDK 适配与 Vite 开发代理。                                                      |
| `tests/`、`scripts/runtime/` | 主仓库 Web/SDK/工具测试与仅前端的开发监督器。                                                     |

Website 的 Browser/Node 业务 HTTP 调用统一使用 `@workspace/sdk` 的 `instance({...})`，上传使用同包 `storage`；完整 `/api` 路径、方法、字段与鉴权从 PHP 内部 Contract 推导。第三方请求和 PHP 自有页面按所属项目的边界执行。原始协议夹具保留独立验证用途，不成为页面绕过 SDK 的入口。

## Contract 与 SDK 工作流

1. 改 PHP HTTP 行为前，读取 `apps/php-server/api/internal/openapi.yaml` 或 `apps/php-server/api/public/openapi.yaml` 及其引用；修改 PHP 定义和业务时遵守 `apps/php-server/AGENTS.md`，运行 PHP 自身 `composer api:generate`、`composer api:lint`、`composer api:check`。
2. 主仓库消费 PHP 生成的完整内部文档 `apps/php-server/api/generated/openapi.internal.yaml`。运行 `pnpm api:lint`、`pnpm api:generate`、`pnpm api:check`；`packages/sdk/src/generated/schema.d.ts` 与 `packages/sdk/src/generated/operation-policy.ts` 由生成器维护，禁止手改。PHP 的 public operation 不进入本站 SDK。
3. 新增或改变 Website 使用的 operation 时，按 `TESTING.md` 更新相应 Web/SDK 与 PHP HTTP 行为断言；PHP 自身测试来源为 `apps/php-server/TESTING.md`。分别报告 Contract 静态检查、进程内/网络 HTTP、浏览器、远端 CI 与部署的实际证据。
4. 破坏性契约变更单独评审；不凭旧 Fastify/Draft-07 规则推断 PHP validator 或 serializer 的行为。详见 `.ai/architectures/api/contract-layout.md`。

管理端请求和会话边界见 `.ai/architectures/admin-web/application-boundaries.md`。

## Web 规则

- 修改 Form 前读 `.ai/rules/frontend-forms.md`；临时通知统一使用 ExUI `toast`，遵守 `.ai/rules/frontend-notifications.md`。
- 共享组件使用 CSS Modules、ExUI 颜色/边框/圆角 token 和 `lucide-react`，不新建本地 token 层。`react`、`react-dom`、`react-router` 同时声明 peer/dev dependencies。
- 修改 ExUI 接入或主题前读 `.ai/knowledge/web/exui-integration-traps.md`；全局样式仅在 `apps/web/src/main.tsx` 导入一次，`useTheme` 位于 `ThemeProvider` 内。
- `VITE_API_BASE_URL` 是服务根，默认 `/`；SDK operation 路径已含 `/api`。PHP `USER_WEB_URL` 与前端公开 origin 同步核对。会话和状态码处理见 `.ai/architectures/web/authentication-flow.md`。

## 运行与交付

根 `pnpm dev`、`pnpm dev:web` 准备 SDK 后启动 Website 与管理端两个前端；`pnpm dev:admin` 只启动管理端；`PHP_SERVER_ORIGIN` 仅指定开发代理目标，缺省 `http://127.0.0.1:8787`。根构建、类型检查和测试不初始化 PHP，也不管理 PostgreSQL/Redis。PHP 的 `apps/php-server/.env`、`apps/php-server/install.lock`、数据库、头像和上传文件由子模块独立管理。停止时只清理可证明归属的本轮前端子进程。运行边界见 `.ai/architectures/runtime/runtime-boundaries.md`。

根测试的轻量/完整范围与浏览器验收遵守 `TESTING.md`；PHP 的测试运行及隔离遵守 `apps/php-server/TESTING.md`。配置了 CI 不等于已运行 CI；本地源码或测试通过不等于外部服务和部署验收。本阶段不部署上线。
