# 支持反馈接收与恢复

支持首页的 development/community 两个入口复用一个 Web Modal，八类反馈仍可填写 Bug 多段正文、Markdown、匿名选项与附件。独立的 ClickUp 分享进度 iframe 是支持首页展示功能；反馈提交当前进入 PHP 本地 `app_feedback_submissions` 与附件记录，不把已接收文案解释为 ClickUp 任务已创建。表职责见 `.ai/databases/data-model.md`。

_最后更新：2026-10-20_

## 请求与状态

Web 通过 SDK 使用 PHP `/api/support/feedback/options`、`submissions`、`lookup`、`{submissionId}`、附件 PUT 和 `advance`。prepare 的 area 是 query 参数，options 不发送 area。PHP 以 submissionKey 幂等创建或重放：新单进入 `receiving`，附件先为 `expected`，快照给出 `nextAction: upload|continue`。已声明附件经 multipart PUT 对账 byte length 与 SHA-256，成功标为 `uploaded` 并递增 revision。全部附件到位后带 revision 执行 continue；PHP 将记录设为 `completed`、`nextAction: done`。Web 只在两个条件同时满足时显示“反馈已接收”。

Web 冻结表单、文件和 submissionKey，保存按服务根、numeric 用户 ID、area 隔离的恢复指针。失败时先 lookup/readback，不从 HTTP 成功状态推断最终完成，也不自动换 key。丢失 PUT 结果可读已上传状态恢复；409 后读取新 revision，再按 PHP 快照动作继续。token/root/epoch 栅栏拒绝迟到结果。匿名提交在 UI 中说明管理员仍能看到账号信息；它不把数据库 user_id 变为空。

## 内容与安全呈现

`@workspace/common/feedback-content` 提供共享 Markdown/纯文本校验、Bug 段落组合与 MIME 规范化；Web 继续校验正文、附件、64 KiB 补充信息和 PHP 默认 JSON 编码后的整个 form 131072 字节上限。PHP `FeedbackController` 最终验证表单、类型和附件声明，Web 的预检不替代服务端。`apps/web/src/pages/Support/feedback/schema.ts`、`flow.ts` 与 `apps/php-server/app/support/FeedbackController.php` 是现行接线。

PHP 当前本地接收与管理状态分离：`status` 为 receiving/completed，`admin_status` 独立为 pending/processing/resolved。显示 Markdown 和通知 HTML 继续遵守浏览器白名单与失败关闭规则；旧 Node ClickUp 远端任务回读、维护 CLI 与历史 retry 状态机属于退役实现，不作为现在的成功条件。
