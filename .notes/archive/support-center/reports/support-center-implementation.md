# 支持中心实施记录

日期：2026-10-12\
状态：Complete with limitations；实现、自动验证与最终独立评审通过，真实外部接入验收范围见下文。\
范围依据：`.notes/support-center/rfcs/support-center-rfc.md` 与来源设计。

## 已实现范围

- 登录保护的 `/support`、`/support/errors`、`/support/errors/:slug`，包含受保护的未知子路由与深链接登录提示。
- 桌面与移动端 Support 导航、布局登录出口和关闭焦点归还、退出或跨标签会话变化时卸载内容。
- 首页三个“即将开放”的反馈卡片、精选案例独立展开、联系人与 ClickUp 配置缺省态、错误列表与正文详情、目录、加载恢复和页面焦点/滚动。
- 独立 Support MDX/YAML 内容集合、严格 schema、草稿/资源发布投影、分类与链接/锚点校验、真实 Fumadocs 编译及 React 正文渲染测试。
- 通用 CRLF frontmatter 读取修复；失效会话在支持路由保留原地址，并保持其他路由的既有重定向行为。

正式错误目录与联系人保持空目录，ClickUp 为 null，固定允许来源清单为空。没有发布预览案例、人物或猜测面板地址。反馈提交、数据库、HTTP operation 与 Outline 功能没有新增实现。

## 验证结果

| 验证                                         | 结果                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @workspace/web content:check` | PASS，10 篇公开正文；Support 合法空集合。                                                                                                                                                   |
| `pnpm typecheck`                             | PASS，完整根流程退出 0；追加失效会话修复后 Web typecheck 再次 PASS。                                                                                                                        |
| `pnpm test`                                  | PASS，完整根流程退出 0，包括 Website、runtime/Docs 脚本、三个 Outline 前端项目与九组指定 Outline Server 测试。                                                                              |
| 最终受影响定向测试                           | PASS，24 个文件、204 项，覆盖内容、路由、认证、Client 和 SiteHeader。                                                                                                                       |
| `pnpm build`                                 | PASS，Website SDK/Web/Server 和 Outline 全部构建阶段退出 0；最后 Client 修复后 Web build 再次 PASS。                                                                                        |
| `git diff --check`                           | PASS。                                                                                                                                                                                      |
| 真实浏览器                                   | 已验证匿名深链接、弹窗关闭焦点、认证后首页/空列表/404、跨标签退出、失效 token 清除及 query/hash 保留、390/850/900/1280px、明暗 token、临时案例 Enter/空格展开与独立展开、长联系人文字换行。 |

最终失效会话修复发生在完整根测试的 Website 阶段结束之后；其真实 HTTP 回归、认证组合、24 文件定向测试及 Web 编译/类型检查在该修复后执行。其余根测试阶段不依赖该 Web 回调。

浏览器会话通过测试 HTTP 响应恢复，长文字和案例为只存在于浏览器内存的临时元数据，重新加载后确认恢复正式空内容；这些结果不证明真实账号登录、真实 ClickUp 任务显示或网络正文分块故障恢复已验收。上述三项为 NOT_EXECUTED。尚需用户提供真实错误正文、联系人资料和官方 ClickUp iframe/分享链接；接入后单独核对来源及视图权限。

## 基线与环境

原有 `.ai/README.md`、`.ai/decisions/README.md`、Support 决策和三份来源文档的未提交改动保留。本次知识更新落在两个原本干净的现有内容文档。

基线首先暴露通用 CRLF 读取错误；Support 的数字、精选与草稿用例也直接复现，已在本次修复并覆盖多行文本和真实 CRLF 编译。Docker 引擎未启动导致初次数据库测试失败，随后启动本机 Docker Desktop，使用原有 Testcontainers 隔离流程完整重跑通过。未使用开发数据库。

此 worktree 的 Outline submodule 原本未初始化；已按原 gitlink 初始化并执行 Yarn immutable 安装，源码与 gitlink保持干净。初次 pnpm 自动安装补齐既有 manifest 依赖时生成的锁文件差异，以及检查期间的 API 产物换行差异，均已恢复；本次不包含 Contract 或依赖版本变更。已有工具警告没有扩大为本期修复。

浏览器测试所用专属会话、测试 token 与 Vite 监听均已清理。Docker Desktop 保持运行，供后续本地开发使用。

## 本次保留的精确路径

以下 35 个实施与记录文件属于本次交付；所有改动均未暂存。独立评审输出另保留在 `.notes/support-center/reports/support-center-code-review.md`。

```text
.ai/architectures/web/content-rendering.md
.ai/knowledge/web/content-authoring.md
.notes/support-center/reports/support-center-implementation.md
apps/web/build/collections.ts
apps/web/build/content/compiler.ts
apps/web/build/support/clickup-policy.ts
apps/web/build/support/definition.ts
apps/web/build/support/schema.ts
apps/web/content/support/contacts.yaml
apps/web/content/support/errors/.gitkeep
apps/web/content/support/settings.yaml
apps/web/source.config.ts
apps/web/src/App.test.tsx
apps/web/src/App.tsx
apps/web/src/api/client.race.test.ts
apps/web/src/api/client.ts
apps/web/src/content/support.integration.test.ts
apps/web/src/content/support/registry.ts
apps/web/src/content/support/types.ts
apps/web/src/content/support/virtual.d.ts
apps/web/src/pages/Support/Support.module.scss
apps/web/src/pages/Support/SupportErrors.tsx
apps/web/src/pages/Support/SupportHome.tsx
apps/web/src/pages/Support/SupportRoutes.test.tsx
apps/web/src/pages/Support/SupportRoutes.tsx
apps/web/src/pages/Support/useSupportFocus.ts
apps/web/src/routes/RootLayout.support.test.tsx
apps/web/src/routes/RootLayout.tsx
apps/web/src/routes/SupportAccess.integration.test.tsx
apps/web/src/routes/SupportAccess.module.scss
apps/web/src/routes/SupportAccess.test.tsx
apps/web/src/routes/SupportAccess.tsx
packages/components/src/SiteHeader.test.tsx
packages/components/src/SiteHeader.tsx
tests/content/support.test.ts
```

本次流程还重生成后恢复了 `api/generated/openapi.json`、`packages/api-client/src/generated/schema.d.ts` 与 `pnpm-lock.yaml`；最终审查已确认它们无残留差异。浏览器截图保留于已忽略的工具目录。

## 评审与交付

已由独立代理依照 `code-review working-tree --paths` 完整审查 38 个输入路径，包括未跟踪文件与已恢复的生成状态。内容阶段发现的 CRLF 兼容问题，以及综合评审的无 hash 滚动、在途退出测试缺口和失效会话重定向问题均已修复并复验。最终结论为 ACK，剩余 P0/P1/P2/P3 均为 0，完整依据保留在 `.notes/support-center/reports/support-center-code-review.md`。

未请求提交，因此没有创建 commit；没有 push、PR 或部署。真实运营内容与 ClickUp 接入按上述输入边界另行完成。
