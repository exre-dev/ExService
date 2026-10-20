# 邀请注册错误的归属与挂载交接

_最后更新：2026-10-20_

邀请注册的邮箱、验证码、完善资料表单各自持有 React Hook Form 错误。`apps/web/src/invitations/InvitationRegistrationFlow.tsx` 负责 PHP HTTP 状态到安全文案的映射，不保留已显示错误的第二份 state。PHP 未提供旧 Node 结构化字段错误时，资格、发码、验证和完善失败落在目标表单的 `root.server`；不能仅凭状态码把邮箱或验证码标为字段无效。客户端自身字段校验仍由 FieldError 呈现。

根错误的语义 kind 位于 `root.server.type`，文案位于 message；`packages/components/src/auth/invitationFeedback.ts` 只将 kind 适配成标题、说明与下一步，不解析 HTTP 异常。429 的等待时间仅在有限且为正时写入固定提示，其他异常不回显原始消息。流程不为同一失败另建外层 Alert 或 ExMessage.error；主动重发和注册成功的 ExMessage.info 保留。布局与播报见 `.ai/knowledge/components/error-panel.md`。

自动邀请链可能在下一步表单尚未挂载时失败。单个待投递 ref 保存目标步骤、generation 与错误，目标表单挂载后重新核验再投递并消费；它不保存验证码、密码或完善凭证。编辑邮箱、返回、切换入口、成功和真正卸载都会使旧请求及待投递失效；StrictMode 即时 effect 重订阅仍复用原自动链。服务根变化会重建流程，旧 root 错误不能落到新表单。

验证依据为 `apps/web/src/invitations/InvitationRegistrationFlow.test.tsx` 的真实表单交互；HTTP fixture 不证明真实邮件、数据库或页面浏览器验收。会话和时间单位见 `.ai/architectures/web/authentication-flow.md`。
