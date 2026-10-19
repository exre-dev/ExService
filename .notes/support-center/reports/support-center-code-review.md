# 支持中心最终独立代码评审

日期：2026-10-12\
模式：`code-review working-tree --paths`，完整精确路径审查。\
结论：**ACK（本次实现范围）**。剩余 findings：P0 0、P1 0、P2 0、P3 0。未发现未关闭的功能、安全、兼容性或关键测试缺口。

## 已关闭的问题

- **[P2，已修复] 无 hash 导航保留旧滚动位置。** `apps/web/src/pages/Support/useSupportFocus.ts:23` 现在对新 h1 调用同一焦点与滚动函数；`Support.module.scss` 为标题保留顶栏空间。回归实际点击下方列表项并断言滚动目标是新标题，另验证正文迟到完成不重新抢夺无 hash 页面的焦点。
- **[P2，已修复] 在途页面/正文加载后退出的关键组合缺少回归。** `apps/web/src/routes/SupportAccess.integration.test.tsx:75` 起新增真实 AuthProvider、SupportAccess、SupportRoutes 和 useContent 的测试：lazy 完成前主动退出、正文完成前跨标签退出，再释放旧 Promise，均不能重新挂载正文、目录或 iframe。只替换 API 外部边界与内容来源。
- **[P2，已修复] 当前 token 失效会将 Support 深链接重定向到独立登录页。** `apps/web/src/api/client.ts:22` 对准确的 Support 路径及后代保留原地址，继续清理 token 并通知认证订阅者。真实 SDK/Client/HTTP 回归先复现三例错误跳转，再验证路径、query、hash 保留；`/support-other` 仍按既有行为跳转。测试观测实际 replace 调用，避免 jsdom 不支持文档导航掩盖失败。
- **内容阶段 P2，已修复：Windows CRLF 最后一项标量解析失败。** `apps/web/build/content/compiler.ts:50` 在读取后归一化 CRLF，再执行原严格 schema。order、featuredOrder、draft、多行 quickAnswer 等价及真实 CRLF Fumadocs 编译均有覆盖；未通过类型 coercion 放宽契约。

## 审查依据与覆盖

基准 HEAD：`3bbd3fdf51c7e0732830077cba31e99b2681b071`。依据根 AGENTS、来源设计与 RFC、相关内容/认证/运行边界文档、code-review 和 code-dev-unit 规则审查。

已检查全部 38 个输入路径的 staged/unstaged 状态，完整阅读全部新增文件和修改内容，并结合实际 SDK 会话失效、AuthProvider、内容 compiler/plugin/syntax/store/useContent、共享导航与错误边界验证调用链。没有使用 top-5 或最大文件快捷筛选。最终范围含 12 个已跟踪修改文件、23 个未跟踪文件及 3 个已恢复无差异文件；无暂存修改、删除、重命名或二进制变更。

`.codegraph/` 与 TESTING.md 均不存在。辅助 analyze.py 最终退出 0，但仅扫描 7 个文件；完整覆盖以逐路径人工审查为依据。

以下为本次精确审查输入：

```text
.ai/architectures/web/content-rendering.md
.ai/knowledge/web/content-authoring.md
.notes/support-center/reports/support-center-implementation.md
api/generated/openapi.json
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
packages/api-client/src/generated/schema.d.ts
packages/components/src/SiteHeader.test.tsx
packages/components/src/SiteHeader.tsx
pnpm-lock.yaml
tests/content/support.test.ts
```

两份 API 生成文件与 pnpm-lock.yaml 已逐一核对无最终残留差异。原有 AI 索引、Support 决策及三份设计来源文档属于既有未提交基线，未纳入本次缺陷对象，未修改。此报告是完成证据采集后的评审输出，不递归计入自身审查输入。

## 需求与测试意图映射

| 需求或风险                            | 验证内容与边界                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 仅真实 authenticated 状态挂载 Support | App 真实路由 SSR loading 门槛；SupportAccess 四状态及 lazy 未启动断言；真实 AuthProvider 恢复、重试、退出和 storage 事件集成。  |
| 页面/正文在途时会话变化               | 新增真实会话边界组合用例释放旧 lazy/正文结果，验证不重新显示受保护内容；普通离开详情也验证迟到结果隔离。                        |
| 过期 token 保留深链接                 | client.race 使用真实本机 HTTP、共享 API Client 和 SDK，仅替换浏览器导航观察点；验证 token/订阅通知、query/hash 及相似前缀排除。 |
| 导航可见集合一致                      | SiteHeader 桌面、移动选项、选中项与状态变化测试；子路由匹配与 support-other 排除。                                              |
| 登录弹窗与焦点归还                    | RootLayout 真实 requestLogin、预填清空、页面触发器恢复及顶栏/移动回退；弹窗关闭焦点另有浏览器冒烟。                             |
| 内容严格契约、引用与草稿隔离          | 真实 readContent 验证字段、排序、分类、文件名、链接/解码锚点、草稿引用及资源；真实打包检查私有 sentinel、loader 和资源不公开。  |
| Windows 与真实编译                    | 三种末尾 CRLF 标量、多行 LF/CRLF 等价、实际 CRLF MDX 经 Fumadocs、virtual registry、原 store 与 React 正文渲染。                |
| 首页/列表/详情与恢复                  | 真实页面覆盖独立折叠、详情/查看更多、排序分类、空态、404、斜杠规范化、目录派生和清理、重试、头像及 QQ 成败。                    |
| 焦点/锚点与窄屏                       | h1 滚动、迟到 hash、无 hash 迟到正文不抢焦点；浏览器覆盖原生 Enter/Space、长文本及临界屏宽。                                    |
| ClickUp 安全配置与初始状态            | 生产固定 host 清单为空时拒绝全部非 null 配置；隔离测试清单验证 HTTPS/来源/凭据/端口；组件验证明确 iframe props 和可选外部回退。 |
| 持久知识与交付记录                    | 两份既有内容文档及新实施记录的完整内容与实现核对；未把空配置或模拟会话描述为真实运营内容及供应商验收。                          |

真实 Fumadocs 测试直接渲染编译后的正文，页面目录测试直接读取渲染后的 h2/h3；两类证据职责不同，未将静态编译结果冒充完整浏览器验收。

## 最终验证与适用范围

- **PASS**：content:check，10 篇公开正文及合法空 Support 集合。
- **PASS**：完整根 typecheck 和完整根 build 均退出 0，包含相应 Website 与 Outline 阶段。
- **PASS**：启动已安装 Docker Desktop 后，完整根 pnpm test 退出 0；Website、runtime/Docs 脚本、三个 Outline 前端项目、九组指定 Outline Server 隔离测试均完成。初次 Docker 不可用和其清理级联失败已被成功重跑取代，不作为最终失败。
- **PASS**：最终受影响定向检查 24 个文件、204 项；最终 Web typecheck 与 Web build。完整根测试的 Website 阶段早于最后的 Client 路径豁免；该修复之后执行了真实 HTTP 回归、认证组合、上述定向检查与 Web 编译。其余根测试阶段不依赖该 Web 回调，没有把较早的 Website 结果声称为最后源码快照的全量运行。
- **PASS**：最终范围 staged diff 为空，生成文件和锁文件无差异，git diff --check 退出 0。Outline 源码和 gitlink 保持干净。
- **浏览器已验证（主任务执行证据）**：真实页面配合测试 HTTP 会话恢复，覆盖匿名深链接、弹窗关闭、登录态首页/列表/404、跨标签退出、真实 SDK 收到 401 后 token 清除和完整 URL 保留、390/850/900/1280px、暗色 token、原生 summary Enter/Space 与独立展开、长姓名/邮箱。临时案例只存在于浏览器内存，刷新后恢复正式空内容；专属浏览器测试会话与 Vite 已清理。
- **NOT_EXECUTED**：真实账号登录、实际 ClickUp 任务视图及原生网络正文 chunk 故障恢复。它们不能从模拟会话、loader retry、iframe 属性或构建通过推定完成。ClickUp 真实官方输入尚未提供，本期交付保持合法 null 配置和空来源策略。

此处根命令退出状态与浏览器操作由实施主任务提供，并核对对应日志/记录；独立评审本身执行的是完整源码、差异与验证证据审查，没有重复声称执行所有浏览器操作或容器用例。

## 交付结论

本次代码与自动验证门槛通过，最终 ACK 适用于已确认的 Support 实现及缺省内容状态。没有未关闭的 code-dev-unit 阻塞项；真实账号、网络 chunk 故障与 ClickUp 接入仍按上文单独报告。没有提交、push、PR 或部署授权或操作。
