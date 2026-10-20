# 邀请注册错误的归属与挂载交接

_最后更新：2026-10-10_

邀请注册的三个表单各自持有 React Hook Form 错误。`apps/web/src/invitations/InvitationRegistrationFlow.tsx` 负责请求分支和固定文案映射，不保留已显示错误的第二份 state。登录表单的 AuthFormHandle 不受注册专用 handle 影响。

## 单一展示入口

邮箱资格问题、入口参数问题、重发失败和完善资料的非字段问题进入目标表单的 `root.server`。语义 kind 存在 `root.server.type`，文案存在 message；`packages/components/src/auth/invitationFeedback.ts` 只把语义 kind 适配成标题、说明与加入操作，不解析 HTTP 状态或异常。

字段错误继续归属于 FieldError：资格检查 400 写入邮箱字段，验证码验证失败写入验证码字段。重发失败是验证码表单的根错误，不能把验证码输入标为无效。邮箱根面板位于邮箱控件之后、提交之前，同时追加描述 ID；清除根错误即移除描述关联。ErrorPanel 的布局与播报约束见 `.ai/knowledge/components/error-panel.md`。

流程不再为同一失败渲染外层 Alert 或发送 toast.error；主动重发和注册成功的 toast.info 仍保留。429 等待时间仅在有限且为正时进入固定用户文案，否则采用无数字的重试提示，不回显异常消息。

## 为什么需要待投递 ref

自动邀请链可能在验证码表单尚未挂载时失败。不能在切换步骤后立即对原邮箱表单写入验证码错误，也不能通过一个通用 error effect 把重发根错误误投到验证码字段。

流程通过单个待投递 ref 记录目标步骤、请求 generation 和注册表单错误。目标步骤仍活跃且其 handle 已挂载时直接投递；否则在对应步骤的 effect 中重新核验 mounted、generation 与目标步骤，投递后消费。三个步骤使用各自的 handle ref，避免旧步骤 handle 被误用。ref 仅用于挂载交接，不存验证码、密码或完成授权，也不保留已显示错误。

提交前清除相关错误；编辑邮箱、返回、加入导航、登录切换和成功清空待投递项，失效 generation 的响应不能再写入表单。真实卸载使请求和待投递失效；StrictMode 的即时 effect 重订阅继续复用原自动链。验证授权及 URL 清理的其余约束见 `.ai/architectures/web/authentication-flow.md`。

## 证据与验证层级

实现位于 `packages/components/src/auth/InvitationForms.tsx` 与 `apps/web/src/invitations/InvitationRegistrationFlow.tsx`。对应 test 文件使用真实表单，覆盖根错误与字段错误分离、手动和自动入口、两种 presentation、重试清理、StrictMode、关闭/返回与迟到请求。API 边界由测试替身控制；这些测试不证明真实数据库、接口服务或实际页面已经可用。
