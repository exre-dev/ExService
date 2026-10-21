# 领域语言

_最后更新：2026-10-20_

**Website 服务**：`apps/php-server/` 中负责本站 HTTP、账号、反馈、通知与存储的 PHP/Webman 服务；主仓库提供 Web 和 SDK。避免把已退役 `apps/server/` 当作现行服务。

**服务根**：SDK 配置的 origin 或部署前缀，默认浏览器当前 origin；operation 路径已含 `/api`。避免把 `/api` 配为相对服务根。

**内部 / 公开契约**：PHP 定义的两组互斥 operation；内部供本站及后台消费，公开供第三方/OAuth 接入。公开与匿名鉴权是不同维度。定义和生成归属见 `.ai/architectures/api/contract-layout.md`。

**本站会话**：PHP 普通登录签发、Web 按服务根隔离保存的 Bearer 凭据；以 PHP 服务验证为准，不以 localStorage 内容证明身份。

**SSO 请求**：PHP 请求状态经 inspect/login/confirm 完成；成功指针仅控制 Web 提示，不是 Website token。PHP 自有 OAuth HTML 和公开 token 接口是另一条接入链。

**邀请资格 / 完善凭证**：资格检查选择注册下一步，不证明邮箱归属；验证码验证后得到的短期完善授权不等于本站会话。

**反馈接收**：PHP 本地 receiving → completed 流程；Web 同时要求 completed 与 nextAction done 才报告“反馈已接收”。匿名反馈仍关联提交账号，管理员可见身份。ClickUp 分享视图属于支持首页展示，非本流程的提交终点。

**通知 receipt**：PHP `app_notifications` 的个人收件行，包含本人已读、清理和 revision；与旧 Node 的 event/content/receipt 多表投影不同。

**资源归属**：PHP 管理数据库、Redis、`.env`、`install.lock`、上传和头像；根 runtime 只管理本轮前端进程。源码退役与现场资源清理分别核对。
