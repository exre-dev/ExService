# ExUI 1.0 实施与验证记录

日期：2026-10-19。

实施依据为 `.notes/exui-v1-upgrade/specs/2026-10-19-exui-v1-upgrade-design.md` 与 `.notes/exui-v1-upgrade/rfcs/exui-v1-upgrade-rfc.md`。原设计和 RFC 原位保留。本次调用未请求提交。

## 实施范围

Web、共享组件和 SDK 的 ExUI 声明统一为 `^1.0.0`，lockfile 解析为 registry `1.0.0`；SDK 保留 optional peer。移除 `emoji-picker-react`，使用 ExUI 原生 inline Picker 和本地中文 emojibase 17 数据；补充 `emojibase` 以满足数据包的 peer。

反馈、通知历史与成员弹窗迁移为 Dialog；反馈保留草稿、附件、关闭确认与在途任务，通知保留 pending 关闭限制和嵌套确认，成员保留焦点归还。设置项改为 ExItem，标签关联实际控件，RHF 与受控 `File[]` 保持原归属。补齐 Join 长正文、设置嵌套弹窗与大字号顶栏的滚动或布局边界，并修正反馈输入框的无效 token。

邀请码 InputOTP 的 Tab 循环在 ExUI 0.8 和 1.0 都可复现。本次键盘验收修复该组合问题：只在原生 blur 目标属于同一表单且活动焦点暂为 body 时恢复原定目标，保留 RHF blur，不拦截 Tab。对应真实浏览器检查已从失败转为通过。

API、数据库与正文持久格式未作语义变更。`pnpm api:generate` 仅将两个生成产物恢复为校验器所需的 LF；Git 语义 diff 为空，但这些触及路径仍纳入审查。

About 浏览器回归还暴露了中断导航边界：Team 正文未就绪就 POP 回首页时，旧「已恢复」标记会跳过恢复。按原字号与长标题前置，修复前的工作树与 HEAD/ExUI 0.8 的 fast 探针各三轮都失败；等待 Team 完成恢复则通过。现仅在 location key 变化时清除该标记，保留历史位置与 POP 焦点。真实 Hook 的新增用例先失败、修复后 4/4 通过，AboutUs 22/22 通过；未修改原浏览器断言。修复前对照证据保留在 `output/playwright/exui-v1-history-probe/repeat-fast-results.json`。

## 自动验证

| 命令或检查                                                                          | 结果与边界                                                                                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                    | 最终运行 exit 0，记录在 `output/exui-upgrade-typecheck-final.log`。                                                             |
| `pnpm test`                                                                         | 完整运行 exit 0，包含 Website/Testcontainers 和 runtime；记录在 `output/exui-upgrade-test-final.log`。                          |
| `pnpm exec vitest run apps/web/src packages/components/src --maxWorkers=2`          | 最终增量后完整运行，94 个文件、1158 个用例通过，含 OTP 与 About 中断导航修复；记录在 `output/exui-upgrade-frontend-final.log`。 |
| `pnpm exec vitest run packages/components/src/tiptap/emoji.test.tsx --maxWorkers=1` | 最终 Emoji 实现 10/10 通过，使用真实 ExUI Picker。                                                                              |
| `pnpm build`                                                                        | 最终运行 exit 0，记录在 `output/exui-upgrade-build-final.log`。                                                                 |
| `pnpm peers check`                                                                  | 无 peer dependency 问题。                                                                                                       |
| `pnpm list @exre/exui react react-dom -r --depth 0`                                 | 三个消费者均为 ExUI 1.0.0，Web 与组件的 React/React DOM 均为 19.3.0。                                                           |
| 构建 chunk 核对                                                                     | 中文数据仅出现在 `EmojiPickerPanel-BvlBYmk4.js`（753979 字节），由 FeedbackModal 动态导入；入口 HTML 未预加载该文件。           |
| `git diff --check`                                                                  | 通过；未暂存任何文件。                                                                                                          |

完整测试之后的最终增量（OTP、Emoji、顶栏和 About 中断导航）用前端全集、Emoji 定向测试、类型检查、构建和 Chromium 复验覆盖；没有把早先完整测试的运行时间混作最终源码快照时间。

## Chromium 验证

- `node tests/browser/notification-experience.mjs`：48 组布局与字号阈值、4 组主题和动效偏好通过，含 48 个当前根 rem 阈值两侧及 640×320/root32。
- `node tests/browser/exui-v1-overlays.mjs`：3/3 场景通过，含认证/验证码 21 组、OIDC/Join 15 组与 ExMessage 的 loading、完成、失败和取消。结果在 `output/playwright/exui-v1-overlays/results.json`。
- `node tests/browser/exui-v1-experience.mjs`：组件定稿构建后完整复跑，7/7 场景通过。覆盖设置双宿主与头像真实 PNG 裁剪、反馈草稿/附件/在途关闭、Member 全屏与焦点、Emoji、30 组真实公开路由和 32 组顶栏组合。Emoji 覆盖 16/20/24px 与 640×320/root32，实际滚轮、指针命中和鼠标点击插入均通过；结果在 `output/playwright/exui-v1-experience/results.json`。
- `node tests/browser/exui-v1-existing-regressions.mjs`：最后的 About 增量与最终构建后，5/5 原有回归通过，含两项导航几何、About 首页长文案/字号/历史返回/键盘导航、失败恢复和捐赠页；没有改动原断言或预热 Team 页面。结果在 `output/playwright/exui-v1-existing-regressions/results.json`。

浏览器 fixture 只证明受控组件及本地回调行为；实际公开路由使用应用真实路由树、主题与样式，但 `/api/` 请求被明确替换为 503。页面渲染结果不代表登录、通知、ClickUp、身份提供方或部署已验收。没有操作生产数据或部署；Firefox、WebKit 与浏览器工具栏原生缩放未验收。

历史诊断脚本 `node tests/browser/exui-v1-history-probe.mjs` 使用 HEAD 源文件与本机真实 0.8 包作对照，每个变体有独立 Vite cache。它的 exit 0 表示证据采集完成，JSON 中的 FAIL 仍是场景失败；缺少真实 0.8 缓存会明确失败。它不替代原回归脚本的验收结果。

## 回归与边界

首次全套测试暴露 jsdom 缺失 matchMedia，已在原测试中补浏览器边界，未替代 ExUI 实现。ExUI 0.8/1.0 的 OTP 对照与红绿探针位于忽略目录 `output/otp-tab-diagnosis/`。构建仍有原有 OpenAPI oneOf/未使用 Join schema 与大 chunk 提示；不作为业务或部署验收。

用户原有 `.gitignore` 改动、未跟踪的 `.agents/skills/exui/`、原设计和 RFC 均保留，不属于本次编辑。未提交、推送或部署。

本报告及以下完整清单作为最终 `$code-review working-tree --paths` 的输入；最终审查结论随交付回复单独报告。

## 精确触及路径

- `.ai/architectures/support-center/feedback-lifecycle.md`
- `.ai/architectures/web/content-rendering.md`
- `.ai/knowledge/components/tiptap-content-boundaries.md`
- `.ai/knowledge/web/exui-integration-traps.md`
- `.notes/exui-v1-upgrade/reports/implementation-validation.md`
- `api/generated/openapi.json`
- `apps/web/package.json`
- `apps/web/src/pages/AboutUs/MemberModal.module.scss`
- `apps/web/src/pages/AboutUs/MemberModal.test.tsx`
- `apps/web/src/pages/AboutUs/MemberModal.tsx`
- `apps/web/src/pages/AboutUs/useReadingPosition.test.tsx`
- `apps/web/src/pages/AboutUs/useReadingPosition.ts`
- `apps/web/src/pages/IdentityPage/OidcPage.presentation.test.tsx`
- `apps/web/src/pages/IdentityPage/OidcPage.test.tsx`
- `apps/web/src/pages/Support/feedback/FeedbackMarkdownField.module.scss`
- `apps/web/src/pages/Support/feedback/FeedbackModal.module.scss`
- `apps/web/src/pages/Support/feedback/FeedbackModal.test.tsx`
- `apps/web/src/pages/Support/feedback/FeedbackModal.tsx`
- `apps/web/src/pages/Support/feedback/FeedbackSubmission.test.tsx`
- `apps/web/src/settings/NotificationPreferencesExperience.test.tsx`
- `apps/web/src/settings/SettingsExperience.test.tsx`
- `apps/web/src/settings/SettingsProfileLoading.test.tsx`
- `packages/api-client/src/generated/schema.d.ts`
- `packages/components/package.json`
- `packages/components/src/SettingsPanel.module.scss`
- `packages/components/src/SettingsPanel.test.tsx`
- `packages/components/src/SettingsPanel.tsx`
- `packages/components/src/SiteHeader.module.scss`
- `packages/components/src/auth/InvitationForms.tsx`
- `packages/components/src/join/JoinReviewDialog.module.scss`
- `packages/components/src/join/JoinReviewDialog.tsx`
- `packages/components/src/notifications/NotificationHistoryModal.module.scss`
- `packages/components/src/notifications/NotificationHistoryModal.test.tsx`
- `packages/components/src/notifications/NotificationHistoryModal.tsx`
- `packages/components/src/tiptap/EmojiPickerPanel.module.scss`
- `packages/components/src/tiptap/EmojiPickerPanel.tsx`
- `packages/components/src/tiptap/emoji-data.ts`
- `packages/components/src/tiptap/emoji.test.tsx`
- `packages/sdk/package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tests/browser/exui-v1-existing-regressions.mjs`
- `tests/browser/exui-v1-experience.mjs`
- `tests/browser/exui-v1-fixture.tsx`
- `tests/browser/exui-v1-history-probe.mjs`
- `tests/browser/exui-v1-overlays-fixture.tsx`
- `tests/browser/exui-v1-overlays.mjs`
- `tests/browser/notification-experience.mjs`
- `tests/browser/notification-fixture.tsx`
