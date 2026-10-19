# Outline Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 移除 Outline，保留可独立使用的 Hydra、第三方认证和 SSO，并提供 Docs 建设中入口。

**Architecture:** 使用纯配置包让 Server 与 runtime 共享客户端解析；保持现有 OIDC、内部身份接口及撤销安全语义。先完成身份脱钩，再清理运行链路与子模块，最后完成页面、文档和整体验收。

**Tech Stack:** Node.js、TypeScript、Fastify、React、pnpm、PostgreSQL Testcontainers、Hydra。

**Spec:** `.notes/archive/outline-retirement/specs/2026-10-15-outline-retirement-design.md`。

**RFC:** `.notes/archive/outline-retirement/rfcs/outline-retirement-rfc.md`。

## Global Constraints

- 保留第三方登录、CLI SSO、Hydra、七个 identity operation、身份表及现役秘密，不新增 provider。
- 只清理精确 Outline clientId；其他客户端和混合 outbox 事件必须保留。
- 不隐式迁移、登记、重置、轮换秘密或接管资源；不删除 PostgreSQL/Hydra 和承载 Website 的卷。
- 现有隔离工作树为 `refactor/docs`，不要创建另一个工作树，不改其他工作树。
- 用户没有要求提交或发布；禁止 commit、push、merge、上线。评审使用工作树 diff 与任务文件清单。
- 生产行为变化先写失败测试并验证，再实现；纯配置和文档仅做适当检查，不写镜像实现的测试。
- 自动数据库测试只使用 Testcontainers；运行资源清理必须有精确归属证据。
- 所有工作者独自完成任务，不派生代理；父代理负责每任务评审及最终整体评审。

## Task 1: 独立身份配置与会话能力

**Files:** 新增 `packages/identity-config/`；修改 `apps/server/src/modules/identity/`、`apps/server/src/server.ts`、身份 readiness、相关 `tests/auth/` 和 `tests/contract/identity.test.ts`、`tests/helpers/` 的身份夹具；按需修改根及 Server package manifest 和 lockfile。保留现有 HTTP 形状与 DB schema。

**Interfaces:** 产出 `@workspace/identity-config` 的 `parseIdentityClients(raw, mode)` 和 `parseIdentityDeliveryTargets(raw, mode)`；前者返回按 clientId 索引的冻结配置，后者返回显式 cleanup-only 目标。原始配置形状及校验采用 RFC。`IdentityConfig` 消费 `IDENTITY_ENABLED`、`IDENTITY_MODE`、`IDENTITY_CLIENTS_JSON` 和现有共享 identity/Hydra 设置，不再包含 Outline 专属字段。

- [ ] 写配置行为测试，先证明旧实现无法在无 Outline 配置下启用空客户端身份服务：

```ts
const config = parseIdentityConfig({
  IDENTITY_ENABLED: 'true',
  IDENTITY_MODE: 'local',
  SERVER_PUBLIC_WEB_BASE_URL: 'http://127.0.0.1:8080',
  HYDRA_PUBLIC_URL: 'http://127.0.0.1:4444/',
  HYDRA_ADMIN_URL: 'http://127.0.0.1:4445/',
  IDENTITY_FLOW_KEY: 'a'.repeat(64),
  IDENTITY_BOOTSTRAP_KEY: 'b'.repeat(64),
  IDENTITY_CLIENTS_JSON: '[]',
})
expect(config).toMatchObject({ enabled: true, approvedClients: {} })
```

- [ ] 运行 `pnpm exec vitest run tests/auth/identity-config.test.ts --maxWorkers 2`，记录预期失败；为配置包使用 Node 原生测试覆盖重复 ID、非法 URL、scope、秘密和 cleanup-only 隔离。
- [ ] 按 RFC 实现纯配置包及 Server 适配，保留通用 OIDC/内部 API；以明确的 revocation 配置替代 probe/Outline 特判，不跟随投递重定向。
- [ ] 调整身份夹具为显式 `test-app` 等客户端；保留并运行会话、停用恢复、幂等、混合客户端、缺失目标 pending 和 late delivery 测试。
- [ ] 运行 `pnpm exec vitest run tests/auth tests/contract/identity.test.ts --maxWorkers 2` 及 Server typecheck，记录结果，报告工作树改动；不提交。

## Task 2: 运行、维护、CI 和子模块退役

**Files:** `scripts/runtime/`、`scripts/docs-integration/`、`compose.yaml`、`infra/runtime/`、`.env.example`、`.github/workflows/ci.yml`、根 manifest、workspace、lockfile、`.gitmodules`、`apps/outline` gitlink 及运行测试。不得修改 Task 1 的 Server/配置包实现；发现接口缺口通过父代理协调。

**Interfaces:** 消费 Task 1 的解析器；保留 service/dev/build/test/native 职责；新增显式 `pnpm infra clients`、一次性 `scripts/runtime/retire-outline.mjs --plan/--apply`；实现 RFC v2 identity receipt。实际资源维护只在归属可核验时执行。

- [ ] 先扩展 runtime 设置/应用计划测试，证明只提供 Website/Hydra 设置仍会因旧 Outline 强制项失败。写纯计划与 JSON 精确过滤行为测试，例如：

```js
const result = planRetiredTargets([
  { clientId: 'ex-outline', hydraSid: 'retired' },
  { clientId: 'another-app', hydraSid: 'keep' },
])
assert.deepEqual(result.remaining, [{ clientId: 'another-app', hydraSid: 'keep' }])
```

- [ ] 实现并验证通用运行工具迁移、Hydra client 显式核验/登记、空客户端启动、v2 receipt 和严格转换；保留资源证明而非刷新证明。
- [ ] 实现退役只读计划、事务内精确过滤与幂等维护；行为测试覆盖错误库/归属拒绝、混合事件保留、坏快照回滚、保留 PG/Hydra。不要连接开发库跑测试。
- [ ] 删除 Outline/Redis 的配置、进程、代理、安装、构建、测试、监听、bootstrap 和 CI 分支；保留 Website/Hydra 以及安全边界。保留品牌样式源直到 Task 3 已从固定 Git revision 迁回；子模块 Git 对象保留。
- [ ] 运行所改 Node 原生 runtime 测试；确认没有遗留文档目录 import。`tests/dev` 与 Vite/dev-entry 同属 Task 3，集成后再运行，避免重叠修改。报告实际资源维护证据或明确未执行原因；不提交。

## Task 3: 主站页面、品牌样式与当前文档

**Files:** `apps/web/src/App.tsx`、`apps/web/src/main.tsx`、`apps/web/src/styles/website-theme.css`、`apps/web/src/pages/DocsPage/`、`apps/web/src/pages/IdentityPage/`、`apps/web/dev-entry.ts`、`apps/web/vite.config.ts`、`tests/dev/entry.test.ts`、`tests/dev/proxy-boundary.test.ts`、`packages/components/src/SiteHeader*`、相关 Web 测试、README、AGENTS、相关 `.ai/` 当前架构/知识及索引。保持源设计与 RFC，不改其他任务实现。

**Interfaces:** `/docs` 和 `/docs/` 为公开建设中页面；其他 `/docs/*` 使用现有 404；身份登录/授权/退出仍保留。品牌 CSS 从原 gitlink 对应 revision 读取，不需要检出 Outline。

- [ ] 为建设中路由和保留身份页面先写行为测试，证明根地址有“文档建设中”且旧子路径不会被占位页吞掉。
- [ ] 迁回 `websiteTheme.css` 的原值和选择器；使用现有 ExUI、RootLayout、主题和路由模式实现占位页及内部导航。
- [ ] 删除 Outline status iframe、Docs resume/return 工具与专属测试，保留 OIDC signed-out 检查、会话竞态防护和通用身份文案。
- [ ] 删除 Vite/dev-entry 的 docsProxy 和旧 Docs 模式分支；使用显式 SERVER_PUBLIC_WEB_BASE_URL，保留 INTEGRATION_SERVER_PORT、INTEGRATION_WEB_PORT、WEBSITE_DEV_ENTRY_PORT 所承载的通用开发入口，以及内部路径拒绝、HMR 与可信转发边界。
- [ ] 使用 codebase-documenter 更新已经实现的当前知识、数据职责描述和索引；不把未验收能力描述为上线可用。
- [ ] 运行所改 Web/组件测试、`pnpm exec vitest run tests/dev --maxWorkers 2` 与类型检查，报告改动；不提交。

## Task 4: 整体验证与交付

**Files:** 不承担新的功能实现；依据失败结果将已确认问题退回对应任务工作者。父代理维护本计划的执行记录与评审文件。

- [ ] 按 RFC 执行 Contract 检查、全 workspace 类型检查、完整自动测试和构建，依赖产物的步骤顺序运行；记录基线和新回归。
- [ ] 使用实际浏览器验证 Docs 和身份页面的桌面/移动、明暗主题、刷新与深链；运行需要真实配置的验收时保护现役秘密与其他工作树资源。
- [ ] 逐任务独立评审通过后，生成整个工作树的 review package，执行最终安全/正确性评审及必要修复。
- [ ] 核对 `git diff --check`、旧执行依赖扫描、子模块登记与 CI；报告源码、自动测试、本机/浏览器及实际资源清理各层结果，不提交或部署。
