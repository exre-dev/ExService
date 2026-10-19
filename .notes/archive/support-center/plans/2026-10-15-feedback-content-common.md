# Feedback Content Common Migration Implementation Plan

> **For agentic workers:** 按单个迁移任务执行；先验证新公开入口，再迁移实现和消费者，最后进行独立评审。

**Goal:** 将反馈共享规则迁入 `@workspace/common/feedback-content`，删除独立反馈内容包及其前置构建。

**Architecture:** Common 沿用已有 Common 分支的独立子入口和 `.mjs`、`.d.mts` 源码消费方式。本分支只引入反馈入口，不复制另一分支的身份配置或文档重构。提交编号与 ClickUp 正文回读核对归支持中心服务端。

**Tech Stack:** pnpm workspace、ESM、TypeScript、mdast-util-to-markdown、remark-parse、Vitest、Node test runner、Vite。

**Spec:** 用户已批准本次迁移；既有内容行为以 `.notes/support-center/rfcs/support-feedback-rfc.md` 和现行反馈测试为准。

## Global Constraints

- 前后端共用相同的反馈内容规则；HTTP DTO 与 Client 仍归 `packages/api-client/`。
- Common 不开放根入口或深层源路径；浏览器通用入口不得加载 Node 专属实现。
- 保持正文、大小限制、冻结载荷和远端核对语义；不修改 HTTP Contract、数据库、环境或外部服务。
- 保留另一个工作树的全部改动。本次不提交、不推送。

### Task 1: 迁移共享规则与全部消费者

**Files:**

- Create: `packages/common/package.json`、`packages/common/src/feedback-content/index.mjs`、`packages/common/src/feedback-content/index.d.mts`、共享内容行为测试与 `packages/common/test/entry.test.mjs`。
- Create: `apps/server/src/domains/support/markdown.ts` 与对应测试。
- Modify: Web 的 `FeedbackModal.tsx`、`schema.ts`、`flow.ts` 和 Server 的 `validation.ts`、`metadata.ts`、`service.ts`、`records.ts`。
- Modify: `tests/support/state-machine.test.ts`、`tests/support/maintenance-cli.test.ts`、workspace manifests/lockfile、`vitest.config.ts`、runtime 构建/测试入口及相关测试。
- Delete: `packages/feedback-content/`。
- Create/Modify: `.agents/rules/common.md`、`AGENTS.md`、`.gitignore`、`.ai/README.md`、架构总览、反馈生命周期与测试层次说明。

**Interfaces:**

- Common 导出 `FEEDBACK_LIMITS`、`FREQUENCIES`、`utf8Bytes`、`escapePlainText`、`analyzeRequest`、`composeBug`、`normalizeMime` 及分析/正文类型。
- Server `markdown.ts` 导出 `finalMarkdown` 和 `equivalentMarkdown`，保留原实现语义。
- 移除无业务消费者的 `validHttpsUrl` 和未使用的规则版本导出。

- [x] 核对已隔离工作树、无重叠改动；原有内容测试 16/16 通过。
- [x] 新建公开入口回归测试：Node 可直接调用 `analyzeRequest('正文')`；根入口和私有路径拒绝；真实 Vite 浏览器 bundle 可执行相同规则。
- [x] 执行 `node --test packages/common/test/entry.test.mjs`，确认新入口缺失导致失败。
- [x] 迁移共享实现与声明，拆出服务端 Markdown 核对；迁移现有行为测试并更新全部消费者。
- [x] 更新依赖与 pnpm lockfile，移除旧包构建、alias 和维护 CLI 测试绕过 `dist` 的配置；根测试发现和 watch 覆盖 Common。
- [x] 同步规则与持久架构说明；历史 RFC 保留当时的实现安排。
- [x] Common 入口 3 项测试、内容与表单 60 项测试通过；浏览器产物通过 Vite 构建并在 jsdom DOM 环境执行。
- [x] 顺序执行 `pnpm typecheck`、`pnpm build`，两项均通过。
- [x] 根 `pnpm test` 的 Website 全量分组通过，覆盖支持中心数据库和维护 CLI。runtime 的构建阶段数断言由 9 改为 8 后，按原 `testSpecifications` 清单续跑 runtime 与全部 Outline 分组，均通过；未重复执行已通过的 Website 分组。
- [x] 独立评审通过，无 P2 及以上问题；旧包源码和注册已删除，现行代码无旧入口。

本地旧包目录仍含忽略的 `dist`、`node_modules` 和空源码目录；递归清理被工具策略拒绝，未采用其他方式绕过。该残留不参与 workspace 注册或源码消费。
