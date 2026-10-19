# Feedback Markdown 本地验收

产品依据：`.notes/support-center/specs/2026-10-16-feedback-markdown-design.md`。实施范围是反馈正文与四项 Bug 正文；标题、大文件信息和附件流程沿用原规则。

## 自动验证

- `pnpm api:lint` 和 `pnpm api:generate` 通过；保留既有 Join oneOf 三项 lint warnings。
- `pnpm typecheck` 通过。
- `pnpm build` 通过；历史只读显示修复后再次执行 `pnpm --filter @workspace/web build` 通过，浏览器使用该产物。
- 定向 Tiptap/反馈集合 234 项通过；追加空剪贴板与历史长文本回归后，反馈集合 60 项通过。
- 共享内容、服务端正文回读与 HTTP/原始 handler Contract 集合 30 项通过；数据库相关用例使用临时 PostgreSQL，Common 的 Node/浏览器入口 3 项通过。
- 独立最终审查未发现已确认的 P1/P2；审查者独立执行 common、guard、field、schema 四个文件的 61 项用例全部通过。
- 根 `pnpm test` 已完整通过（退出码 0），包括 Website、runtime/Docs 脚本、Outline 前端及逐文件执行的全部 Outline 服务端分组；测试进程使用真实 Python 的进程局部 PATH，未修改系统配置。

## 浏览器证据

使用构建产物、独立 Chromium 会话和拦截的本地 API；不连接真实 ClickUp 写流程。系统剪贴板 Ctrl+V 已验证 Markdown 标题、加粗、代码、任务列表和简单表格；网页富文本粘贴保留支持格式，不显示降级通知或纯文本建议。无顶部工具栏。四项 Bug 正文均为可编辑 Tiptap，键入 `## ` 自动转为标题。

浅色、深色和 390×844 窄屏已检查，Modal 未超出视口。旧纯文本冻结记录恢复时保留 `**`、`#`、换行和空行，不重新解释排版。图片文件继续走附件区。

截图位于 `output/playwright/feedback-markdown-light.png`、`output/playwright/feedback-markdown-dark.png`、`output/playwright/feedback-markdown-narrow.png`、`output/playwright/feedback-markdown-bug.png` 和 `output/playwright/feedback-markdown-legacy-recovery.png`，均为本地测试数据。

## 修复与边界

独立任务审查发现并修复两项 P2：未闭合围栏吞掉固定提交编号，以及历史纯文本超过编辑器节点预算时恢复为空。两项均先复现失败再修复，并通过独立复审。

用户随后确认项目未上线，Markdown 与纯文本均保持 `content_rule_version=1`，只通过 `form_json` 内可选 `contentFormat` 区分格式。已撤回未应用的 `0006` SQL、snapshot 和 journal 项，数据库 schema、readiness 签名、创建与读取的版本检查恢复原值。本次 Markdown 接入不再新增迁移要求，现有数据库未改动。

版本 1 调整后，受影响的 PostgreSQL Contract、数据库 migration、共享内容与正文回读四文件 37 项回归全部通过；Server 类型检查和构建通过，针对性独立复核未发现 P1/P2。数据库 schema、readiness 签名、迁移目录以及创建和读取实现均无相对本次开发前的改动。

实现与验收阶段未进行真实 ClickUp 写入、网关验收或部署；Git 交付另行授权，本地测试不证明第三方实际渲染。上方全量测试与浏览器证据对应完成版编辑器；内容版本简化后的验证范围为上述受影响检查。
