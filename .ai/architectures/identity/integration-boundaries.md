# PHP 身份与 Website 会话边界

Website 账号、Bearer 会话、邀请注册与 SSO 接入由 `apps/php-server/` 管理；主仓库 Web 仅经内部 SDK 消费对应 operation。现行路径和字段以 PHP internal/public OpenAPI、`apps/php-server/app/route.php` 与控制器为准，Web 适配详见 `.ai/architectures/web/authentication-flow.md`。

_最后更新：2026-10-21_

PHP 的 `/api/auth/login`、`/api/auth/me`、`/api/auth/logout` 和邀请 operation 服务本站会话。Web 保存按服务根隔离的 token，账号 `id` 是 numeric，用户字段使用 PHP `username`、`avatar` 等原生形状。SSO 请求通过 `/api/auth/sso/inspect`、`login`、`confirm` 检查和完成；成功不把 SSO 返回值写作 Website token。Web 保留 `/login`、`/register`、`/sso/success`，已退役的四条 `/identity/*` 地址使用现有 404。

PHP 公开 OAuth/API 与 PHP 自有 `/oauth/authorize`、`/oauth/device` HTML 页面属于 PHP 服务。Vite 仅代理两个精确 HTML 路径；现有未登录 `/oauth/device` 返回 401，这一上游限制仍存在。主仓库 SDK 只由内部契约生成，public token/userinfo 与第三方应用授权不能据 Website 登录流程推定已验收。

本站登录与 OAuth 访问令牌虽然共用会话化 JWT，但用途由服务端会话的 `client_id` 区分。`apps/php-server/app/common/middleware/CheckLogin.php` 拒绝绑定应用的会话并返回 401；用户具备运营或超管角色也不能让应用凭据访问本站账号或平台管理接口。开放资源仍由 `OAuthTokenAuth` 检查应用与授权关系，userinfo 按该会话的 scope 返回字段；授权关系新增 scope 不扩张旧 token。`SessionService::check()` 数据库回源重建缓存时必须保留 scope，避免缓存丢失改变已授权字段。对应行为证据位于 `apps/php-server/tests/website_http.php`，覆盖真实授权码/设备码签发、账号与管理接口拒绝、本站会话，以及缓存命中、回源和重建路径；该夹具验证进程内真实 Webman 管线，不代表监听 socket 或部署验收。

原 Node/Hydra 独立服务、`IDENTITY_CLIENTS_JSON`、outbox、部署 binding 和数据库操作路径已退出当前主仓库代码。历史设计与决策保留当时背景；源码删除不证明现场 Hydra client、数据库、卷或第三方会话已经注销、迁移或清理。PHP 的安装、客户端和持久数据规则以 PHP 子模块实际代码、配置及操作文档为准。
