# 生成的类型纳入版本控制，共享 Client 以源码形式导出

- 状态：部分被 SDK 单例方案取代；生成类型入库、禁止手改与 Contract 同步提交原则继续适用
- 模块：`api-client`
- 日期：2026-09-16
- 来源：`.notes/archive/backend-sandbox/specs/2026-09-16-backend-sandbox-scaffold-design.md` §5.1、§9

_最后更新：2026-10-19_

## 当前适用范围

以下正文保留当时的决策与证据。旧 `packages/api-client/`、openapi-fetch factory、源码运行时导出和 Node 限制均属历史，已由 `packages/sdk/` 的 Browser/Node 构建入口与单例对象请求 API 取代；当前边界见 `.ai/architectures/sdk/client-boundaries.md`。当前从 PHP 完整内部 YAML 生成 `packages/sdk/src/generated/schema.d.ts` 与 `packages/sdk/src/generated/operation-policy.ts`，生成物只由生成器维护并随 Contract 提交；唯一契约布局与生成流程说明见 `.ai/architectures/api/contract-layout.md`。

## 背景

前端与共享 Client 需要与 Contract 一致的类型。手写 DTO 会与 Contract 漂移，而且是那种「能编译、运行时才发现字段不对」的漂移。

同时需要决定这个包以什么形态被消费：构建产物，还是源码。

## 决策

- 用 `scripts/api/generate.mjs` 将 `api/openapi.yaml` 及拆分源文件打包为 `api/generated/openapi.json`，再用 `openapi-typescript` 从该 JSON 生成 `packages/api-client/src/generated/schema.d.ts`。两份生成物均纳入版本控制，**禁止人工编辑**；Contract 变更必须同时提交重新生成的结果。
- 用 `openapi-fetch` 实现 `createApiClient({ baseUrl })`；该函数不定义任何 endpoint。
- 包以**源码形式**导出运行时 Client：包根 `main` / `types` / `exports` 指向 `src/index.ts`，不产出构建产物；`@workspace/api-client/types` 仅导出生成的类型声明，供 Server 的 NodeNext 编译使用。
- 包内不引入 React、Valtio、Framer Motion、业务状态或 endpoint 定义。

## 理由

- 生成物入库让代码评审能看到 API 类型的真实变化；如果只在 CI 生成，评审看到的差异就只是 Contract 的文本改动。
- 源码导出让 Web 的 Vite 直接编译，省掉一层构建产物与 watch 步骤；消费方负责解析包内的 `@api-client` 路径别名。类型专用子路径让 Server 不必加载 Client 运行时源码。
- 保持包内无 UI、无状态，使它可以在未来被 Node 侧或其他前端复用，而不会把 React 依赖带进去。

## 影响

- 任何 Contract 变更都必须与重新生成的 `api/generated/openapi.json` 和 `schema.d.ts` 在同一个提交里，否则运行时 schema 与类型会漂移；`pnpm api:check` 无写入检查一致性。
- 包根运行时入口**不是 Node 运行时包**：Node ESM 不直接解析包内的 `@api-client` 别名。NodeNext Server 只通过 `@workspace/api-client/types` 做 type-only import；若要在 Node 侧调用运行时 Client，仍需补构建产物与运行时 `exports` 条件。
- 手工修 `schema.d.ts` 的改动会在下一次 `pnpm api:generate` 时被覆盖。

## 重新审视的条件

- 出现 Node 侧运行时消费方时（需要构建产物或调整 import 约定）。
- 生成物体积大到不宜入库时（改为由 CI 生成并校验一致性）。

## 证据

- `package.json` 中的 `api:generate`。
- `packages/api-client/package.json` 的包根与 `./types` exports。
- `packages/api-client/src/index.ts` 顶部注释（含 Node v22.22.1 的实测结果）。
- `packages/api-client/src/client.ts` 与 `src/generated/schema.d.ts`。
- `AGENTS.md` 的「不可手改的生成物」。
