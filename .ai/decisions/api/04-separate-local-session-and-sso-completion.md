# 本站会话与 SSO 完成使用不同的 Contract 结果

> 部分取代：会话与 SSO 完成分离的原则仍适用；本页的 Node token、CLI 与旧路径细节仅记录历史。现行接线见 `.ai/architectures/identity/integration-boundaries.md`。

- 状态：会话与 SSO 结果分离原则保留；Node 细节已取代
- 模块：`api`
- 日期：2026-09-23
- 来源：`.notes/archive/auth/specs/2026-09-23-auth-design.md`、`.notes/archive/auth/rfcs/authentication-rfc.md`

_最后更新：2026-09-29_

## 背景

普通登录需要让浏览器获得本站会话，而 SSO 接收页只需要把一个短期请求关联到已经验证的用户。若两条路径复用同一响应，前端容易把 SSO 结果误当作本站 token 保存，也会让未来的发起方协议与本站会话边界混在一起。

## 决策

- 普通登录使用独立 operation 签发 7 天固定期限的本站不透明 token。
- SSO 密码确认与已有会话确认使用各自的 operation，只返回请求已完成，不返回或创建新的本站 token。
- SSO 请求由显式本地 CLI 创建和检查；当前 HTTP Contract 不提供请求签发或结果轮询 operation。
- 浏览器只通过 Bearer 使用本站 token；共享 Client 不读取存储，也不自动附加凭据。

## 理由

- 响应形状直接区分两种安全语义，调用方无法把 SSO 完成响应当作登录响应使用。
- 已有本站会话可以复用用户身份，同时服务端仍需在完成 SSO 前重新验证会话。
- 将发起方和轮询协议留在 Contract 之外，避免本地验证工具被误当作生产 SSO 协议。

## 影响

- 前端认证流程必须显式区分普通登录和 SSO 上下文。
- SSO 密码路径不能调用会创建本站会话的普通登录方法。
- `/sso/success` 的浏览器展示记录不是凭据；服务端完成状态才是实际结果。
- 唯一 Server 保持响应分离与会话边界；SSO CLI 仍是开发期显式入口，当前没有生产发起方或轮询协议。

## 重新审视的条件

- 设计生产 SSO 发起方、授权确认、回调或轮询协议时。
- 本站会话从 Bearer/localStorage 迁移到其他传输与存储机制时。
- 需要跨 origin 复用登录状态时。

## 证据

- `api/openapi.yaml` 的 `/auth/login`、`/auth/sso/login` 与 `/auth/sso/confirm` 响应 schema。
- `apps/server/src/modules/auth/service.ts` 的普通登录与两条 SSO 完成路径。
- `apps/web/src/auth/AuthFlow.tsx` 的普通登录存储分支和 SSO 完成分支。
- `tests/contract/auth.test.ts` 对 SSO 不创建新本站会话的断言。
