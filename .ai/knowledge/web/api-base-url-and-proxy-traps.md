# 服务根与开发代理陷阱

`VITE_API_BASE_URL` 默认 `/`，表示服务根；SDK operation 本身含 `/api`。设为完整 HTTP(S) 服务根可保留部署前缀，旧相对值 `/api` 被拒绝。空值与未设置使用默认值。Web 先校验 root，再切换会话 namespace；非法值不能把旧 token 发送到新地址。会话细节见 `.ai/architectures/web/authentication-flow.md`。

_最后更新：2026-10-20_

`PHP_SERVER_ORIGIN` 默认 `http://127.0.0.1:8787`，必须是纯 origin，只用于 Vite 开发代理。代理保留 `/api` 路径和 query，并转发精确 `/oauth/authorize`、`/oauth/device` PHP HTML 路径。PHP 路由本就注册在 `/api` 下，剥除前缀会 404。其他 SPA 页面仍由 Web 处理。PHP `/oauth/device` 未登录返回 401 是上游现有行为。

Vite 固定端口冲突会退出，不静默换号；`pnpm dev --port <port>` 选择新端口后还须核对 PHP `USER_WEB_URL` 和浏览器 origin。不同 origin 的 localStorage 不共享 token，canonical Host 重定向不迁移旧凭据。前端 HTML readiness 不代表 PHP、数据库、OAuth 或外部服务就绪；详见 `.ai/architectures/runtime/runtime-boundaries.md`。
