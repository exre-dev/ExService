# Contract Test 与 PostgreSQL 测试层次

Contract Test 对真实 Fastify app 的 HTTP 行为、Glue 映射和原始 handler 输出分别断言；数据库行为测试使用独立 PostgreSQL 容器。单条断言的失败模式见 `.ai/knowledge/server/serialization-masks-handler-regressions.md` 与 `.ai/knowledge/contract-tests/contract-parsing-constraints.md`。

_最后更新：2026-10-19_

## 隔离夹具

`tests/helpers/postgres.ts` 使用 `infra/runtime/images.lock.json` 的 PG18 镜像启动临时 PostgreSQL Testcontainers 容器，库名为 `exre`，每例创建独立 schema 和同 schema 的 migration journal。夹具不读取本机 `DATABASE_URL`，用例结束关闭连接并清理 schema，测试进程结束时停止容器。Docker 不可用时数据库测试失败，不回退到本机 `exre` 或 `outline`。

`tests/helpers/auth.ts` 异步创建业务服务和真实 `createApp()` 实例。常规 HTTP 用 `app.inject()`；SDK/multipart 与连接生命周期测试绑定随机本机端口。测试不把开发库已迁移当作夹具结果。

## HTTP 与 schema

| 层                | 覆盖目的                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract 双向覆盖 | `operationId` 与各模块 `api/operations.ts`、`apps/server/src/http/system/operations.ts` 汇总的 `serviceHandlers` 两边都无缺漏或多余映射；应用启动前也检查覆盖。 |
| HTTP 响应         | `/api` 前缀、状态、header、错误 envelope 和响应 schema；Bearer 异步验证在 handler 前完成。                                                                      |
| 原始 handler 输出 | 检查序列化前结果，发现 Fastify 静默丢弃字段或强制 `const` 掩盖的回归。                                                                                          |
| schema 反例       | 证明缺字段、额外字段、错误类型和 `const` 冲突受到校验。                                                                                                         |
| 日志与传输        | 真实日志流不泄密；multipart 字节、摘要、容量与断开连接回收。                                                                                                    |

schema 经 `tests/helpers/contract.ts` 从 `api/generated/openapi.json` 读取，统一转换引用并编译结构校验器，不在各套件复制解析器或 DTO。校验器不检查 `format`，相应语义由业务行为测试验证；缺字段、额外字段、类型和常量等结构反例仍保留。同一层已做封闭 schema 或精确对象断言时，不另建夹具重复检查字段名。读器的引用、路径和 operation 约束见 `.ai/knowledge/contract-tests/contract-parsing-constraints.md`。跨多步业务测试覆盖保留的内部申请、审核、验证码、完善、登录、资料与头像；申请 HTTP 退役不代表删除邀请注册和历史资料兼容覆盖。PostgreSQL 专项测试覆盖空库迁移、重复迁移、错误目标拒绝、半迁移、未知对象重置拒绝、约束、事务回滚及双连接竞争。自动测试证明隔离容器中的行为；本机迁移与真实服务冒烟另行验证。

## Website 与身份运行测试

根 `vitest.config.ts` 包含 Website Web、Server、共享包及 `tests/` 的自有测试，排除 `vendor/` 和 `output/`。DOM 用例以文件标记使用 jsdom；其余使用 Node。`scripts/runtime/tests.mjs` 每轮先依次生成 Contract 与构建 SDK，再执行完整 Website Vitest 和明确列出的 runtime/共享身份配置 Node 测试；`scripts/api/generate.test.mjs` 纳入默认脚本测试。Vitest 限制两个 worker，减少独立数据库容器和 CPU 争用，不缩减断言。

`tests/auth/` 和 `tests/contract/identity.test.ts` 保留独立 OIDC、内部身份接口和会话撤销覆盖；默认空客户端与显式普通客户端分别测试。runtime 测试验证配置投影、client 核验、资源归属、receipt 和退役维护；`tests/runtime/native-health.test.ts` 核对 Website/Hydra readiness、显式 client 校验及 Website 检查 CLI，不调用开发服务。维护数据库测试使用临时 PostgreSQL，资源删除使用受控适配器或临时目录。真实生命周期、浏览器和外部应用验收分别报告。

`tests/browser/error-panel.mjs` 和 `tests/browser/notification-experience.mjs` 使用根锁定的 Playwright 和隔离 UI 夹具，`tests/browser/navbar-geometry.mjs` 接收真实浏览器 tab；这些工具不由 `pnpm test` 自动执行，DOM 测试不能替代真实布局或焦点验收。

`tests/server-plugins/build.test.ts` 在一次构建生命周期中验证源文件启动、删除与重命名后的纯 JavaScript 启动及失败回收；安全清理用例可独立运行，不依赖另一用例留下的产物。正向 Server 类型夹具由根 `pnpm typecheck` 执行，Vitest 仅保留声明冲突的反例。附件校验的恶意前缀探针共用一个有操作系统期限的子进程，函数耗时与 Node/tsx 启动预算分开，避免把启动速度当成算法性能。

## GitHub CI

`.github/workflows/ci.yml` 在目标为 `main` 的 PR、`main` push 和手动触发时执行。`verify` 使用 Ubuntu 24.04 runner，检出当前仓库，按 pnpm lockfile 安装依赖，然后执行 `pnpm api:check`、`pnpm typecheck`、`pnpm build` 和 `pnpm test`。Linux runner 提供测试夹具所需的 Docker；Docker 不可用时失败，不改用开发服务。

CI 使用 Node 22、pnpm 11.9.0 与 Corepack 0.34.6。通过 `INTEGRATION_NODE_BIN` 和 `INTEGRATION_COREPACK_JS` 显式提供实际工具路径，避免 runtime 按 Node 安装目录推测 Corepack 位置。测试入口沿用前述 Website 与 runtime 统一流程，不复制或缩减身份测试范围。

根 `pnpm typecheck` 先生成 Contract，再构建 `@workspace/sdk`，随后依次检查所有 workspace、公开 SDK 类型夹具与 Server NodeNext 类型夹具。SDK 的公开导出指向 `dist/` 中的 JavaScript 和声明；仅执行 `tsc --noEmit` 不会生成这些文件，干净检出不能依赖此前 Build 留下的产物。Common 的反馈入口直接导出源码和声明，不需要构建或测试 alias；共享内容行为纳入 Vitest，Node 公开入口、私有路径拒绝与真实 Vite 浏览器打包测试由根脚本分组执行。Common 的源码与入口测试目录均纳入 watch。

SDK 的行为与公开包测试位于 `tests/sdk/`，覆盖对象请求类型、配置与会话边界、上传和真实产物入口；类型夹具通过 `@workspace/sdk` 解析公开声明。原始 HTTP、handler 与需要显式 Host 的 readiness 测试保留独立协议工具，不能作为业务绕过 SDK 的调用方式。同一 checkout 的产物写入必须串行，约束见 `.ai/architectures/runtime/runtime-boundaries.md`。

默认测试包含 Playwright Chromium 的真实 Browser SDK 夹具。首次本地测试先显式运行 `pnpm exec playwright install chromium`；Linux 如需同时安装系统依赖，使用 `pnpm exec playwright install --with-deps chromium`。依赖安装和日常 runtime 不自动下载浏览器；浏览器夹具也不代表完整 Website 浏览器验收。

唯一汇总检查名为 `ci-gate`。它在 `verify` 结束后始终执行，仅当 `verify` 的结果为 `success` 时通过；失败、取消或跳过均不能通过。工作流仅有 `contents: read` 权限，不使用 App 私钥或业务环境秘密。主分支 Ruleset 是否已将 `ci-gate` 设为必需检查，需独立核对 GitHub；本地配置校验不代表远程 CI 已通过。
