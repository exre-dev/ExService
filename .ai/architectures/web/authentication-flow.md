# Web 认证、邀请与会话

`apps/web/` 通过 `@workspace/sdk` 消费 PHP 内部 operation。共享组件负责表单与可访问 UI，Web 负责状态、请求、持久化与导航；HTTP 字段、状态和鉴权以 `apps/php-server/api/generated/openapi.internal.yaml` 为准。

_最后更新：2026-10-20_

## 入口与字段

`/login`、`/register` 和 `/sso/success` 是保留的独立认证页面；顶栏继续使用登录/注册 Modal。四条旧 `/identity/login`、`/identity/consent`、`/identity/logout`、`/identity/signed-out` 走现有 404。`/docs` 与 `/docs/` 的建设中页面不受身份迁移影响。

普通登录使用 PHP `/api/auth/login`，本人信息从 `/api/auth/me` 恢复：`id` 为 numeric，展示字段为 `username` 与 `avatar`。设置和顶栏读同一当前身份，但设置资料缓存只在内存中；HTTP 状态决定 401/403/409 等错误分支。PHP 未提供旧 Node 结构化字段错误时，表单显示根错误，不猜测邮箱、验证码或申请资格字段。邀请流程的冷却时间从 PHP 秒值在 UI 倒计时边界换算为毫秒。

邀请四步仍为资格、邮件码、验证、完善账号；URL 参数只读一次，自动链与响应订阅抵抗 StrictMode、卸载和 root 切换的迟到结果。敏感码、密码和完善凭证只保存在内存；入口 `no-referrer` 降低 URL 经资源 Referer 泄露风险。错误交接见 `.ai/knowledge/web/invitation-error-handoff.md`。旧 Join HTTP 申请页和四条身份路由不恢复。

## 服务根与浏览器存储

`VITE_API_BASE_URL` 选择服务根，默认当前 origin；SDK 完整路径已经包含 `/api`。`apps/web/src/auth/storage.ts` 按规范化服务根隔离 `exwebsite.php.auth.v1:<encoded-root>` 和 `exwebsite.php.sso-success.v1:<encoded-root>`。反馈恢复指针还包含 numeric user id 与 area。升级只定向删除已知旧 token、SSO、反馈 key；不迁移旧值、不清空整个 storage。不同 root 和浏览器 origin 各自登录。

默认 root 的 SDK 可自动读本 root 键；自定义 root 的 Web 先读取持久值，再显式安装到 SDK。切换 root 会使旧请求/认证流程代次失效，清理当前内存状态，不把旧 root 响应带入新 root。`AuthProvider` 仍以 `/api/auth/me` 而非存储值证明身份。登出先清理本地身份，再用捕获的旧 token 发撤销请求；网络失败不恢复本地登录，也不能被迟到结果覆盖较新的会话。

## 401 与 SSO

受保护操作的当前凭据收到 401，SDK 先检查请求归属；Web 的 `setSessionExpiredHandler` 对自定义 root 再做持久化条件删除与二次空值确认。读取失败、删除 no-op、替换 token 或失活 scope 返回 `false`，禁止旧 401 的通知/导航；发现跨标签页新值立即 `syncSessionToken()` 恢复 SDK 凭据。当前凭据已失效但持久化读取不可用时，处理器仍返回 `false`，同时同步本地会话：订阅者逐个接收变更，某个订阅者抛错不阻断后续通知；`AuthProvider` 转为 `unavailable`、清空 user ID，私有页面与资料/通知缓存随之清空。读取恢复后，保留的旧 token 仍被抑制，不会重新授权；同 root 的新登录可恢复。确认持久化已清空后返回 `true`，按当前路由处理导航。详细 SDK 门禁见 `.ai/architectures/sdk/client-boundaries.md`。

SSO 页面保留 `ssoRequestId` 检查、密码登录与成功页指针。`/api/auth/sso/inspect` 已返回 completed 时直接结束；`/api/auth/sso/login` 与 `/api/auth/sso/confirm` 完成不写 Website token。成功页的 sessionStorage 指针只控制提示，不是授权凭据。PHP `/oauth/device` 未登录时返回 401 的上游行为仍在，Vite 代理不改变它。PHP/public OAuth 与 Website SSO 边界见 `.ai/architectures/identity/integration-boundaries.md`。
