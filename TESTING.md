# 测试

本文件是测试流程、用例归类和执行范围的唯一规则来源。测试夹具和 Contract 验证的结构见 `.ai/architectures/contract-tests/test-layers.md`。

## 开发阶段

开发时可以按需执行与当前变更直接相关的定向 test，用于复现问题、验证实现和回归。只运行相关文件或用例；定向命令见下文。

除非用户明确要求，不自动运行整仓测试或整套检查，包括根 `pnpm test`、`pnpm test:watch`、`pnpm test:full`、`pnpm typecheck`、`pnpm build`、`pnpm api:check`、`pnpm format:check`，也不将这些命令串联为开发结束的固定步骤。实现或定向测试所必需的 Contract 生成与 SDK 构建仍可按需执行。

## 本地提交

创建本地 Commit 时不自动执行整仓测试或整套检查，也不将轻量的 `pnpm test` 作为提交门槛。需要验证当前修改时，仍可按开发阶段规则执行定向 test；集中验证安排在提 PR 前。

Git Hook 继续只格式化暂存文件，不自动启动测试、类型检查、Build 或其他整仓检查。

## 提 PR 前

代码变更准备创建 PR 时，集中运行 `pnpm test`；根据变更范围执行相关的 Contract 检查、类型检查或 Build，并在 PR 中说明实际运行结果及未运行或被阻塞的检查项。纯文档等不影响行为的变更只核对相关内容和格式，无需启动应用测试套件。

`pnpm test` 默认执行轻量测试：纯逻辑、jsdom 组件交互、使用 mock 的页面与 SDK 适配测试，以及不依赖真实服务的脚本测试。用户显式要求监听时使用 `pnpm test:watch`，不在开发阶段自动启动。

轻量入口先依次生成 Contract、构建 SDK，随后执行 `vitest.quick.config.ts` 选中的 Website 测试和 `scripts/runtime/tests.mjs` 登记的轻量 Node 测试。不要求 Docker 或安装 Chromium，不执行数据库容器、真实 HTTP 传输、Vite 打包、公开包编译或进程树清理夹具。watch 每次变化重跑同一轻量范围。

## CI 与完整测试

CI 显式执行 `pnpm test:full`，保留完整 Website Vitest 和 runtime 测试，包括 PostgreSQL/Nginx 容器、HTTP/连接生命周期、迁移、公开 SDK 包与真实 Chromium、编译打包和资源归属/进程清理夹具。完整 Website 配置仍为 `vitest.config.ts`；不因本地轻量模式删除、跳过或缩减 CI 用例。

需要在本地复现完整验证时，显式执行 `pnpm test:full`；完整监听使用 `pnpm test:full --watch`。须先准备 Docker 和 `pnpm exec playwright install chromium`；Linux 如需系统依赖，使用 `pnpm exec playwright install --with-deps chromium`。这些准备不会由日常 runtime 自动执行。数据库夹具仅使用临时数据库，Docker 不可用时失败，不回退开发库。

两种测试入口均先准备 Contract/SDK。同一 checkout 的 dev、test/watch、typecheck、build、Contract 生成和 SDK build 必须串行，完整约束见 `.ai/architectures/runtime/runtime-boundaries.md`。

## 用例归类与定向运行

- 前端和共享包的纯逻辑、jsdom 与 mock 交互测试进入轻量范围。`tests/` 下的轻量组在 `vitest.quick.config.ts` 明确登记；新增集成夹具或已有用例开始访问真实服务、浏览器、数据库、子进程清理或打包工具时，留在完整范围，并核对轻量选择。
- Node 脚本测试在 `scripts/runtime/tests.mjs` 登记。需要真实服务、打包或进程清理的文件标记为 `fullOnly`；混合文件作为整体留在完整范围。
- 用行为断言验证回归；Contract 变更继续补充真实 HTTP 和原始 handler 输出覆盖。用例编写遵循所属模块的既有测试约定，不为已删除的入口恢复实现。
- 定向运行轻量用例可使用 `pnpm exec vitest run --config vitest.quick.config.ts <测试文件>`；完整范围内的指定用例使用 `pnpm exec vitest run --config vitest.config.ts <测试文件> --maxWorkers 2`。直接运行 Vitest 不准备 SDK，须先依次运行 `pnpm api:generate` 和 `pnpm --filter @workspace/sdk build`，或使用最近一次已成功准备且 Contract/SDK 未变化的产物。
- Node 文件可使用 `node --test <测试文件>` 定向运行；标记为完整范围的文件仍要求其对应依赖。

## 页面浏览器验收

本地页面浏览器验收按需运行：仅在用户明确要求验收，或操作者显式选择相关脚本时执行；普通 UI 修改、日常测试和提交前不自动追加浏览器流程。`tests/browser/` 的页面布局、弹窗、焦点、主题和导航脚本继续保持独立入口。

`tests/browser/browser-suite.test.mjs` 测试浏览器运行器自身，使用注入的假浏览器，不启动 Chromium；它可纳入轻量 Node 测试。CI 的 SDK Chromium 夹具位于 `tests/sdk/public-package.test.ts`，随完整测试执行。

交付时分别说明轻量测试、完整集成测试、页面浏览器验收和外部服务验收的实际执行情况。jsdom 通过不能作为真实布局或焦点验收通过的证据。
