# 前端只经共享 Client 调用，base URL 由配置决定

- 状态：共享入口和可配置 API root 原则继续适用；旧 Client 接入已被 SDK 取代
- 模块：`web`
- 日期：2026-09-16
- 来源：`.notes/archive/backend-sandbox/specs/2026-09-16-backend-sandbox-scaffold-design.md` §7.2

_最后更新：2026-10-19_

## 当前适用范围

以下正文记录早期 Client 选择。当前本站业务请求统一使用 `@workspace/sdk` 的 `instance({...})`，`apps/web/src/api/client.ts` 在请求前安装服务根与会话失效处理，不再创建 Client。Browser 缺省服务根为当前 origin，operation 路径包含 `/api`；非默认 root 的显式凭据规则见 `.ai/architectures/sdk/client-boundaries.md`。实际代理与端口以 `.ai/architectures/runtime/runtime-boundaries.md` 为准，旧固定代理目标与 factory 描述不能作为启动指南。

## 背景

Web 需要经唯一 Server 调用 API。把 URL 和请求写法集中在共享 Client，可以避免业务组件直接依赖代理地址或 HTTP 细节。

## 决策

- 前端只能通过 `@workspace/api-client` 的共享 Client 发起 API 请求：不得直接使用浏览器 `fetch`，不得在本仓库内复制 DTO 类型。
- API base URL 的唯一来源是 `VITE_API_BASE_URL`，缺省 `/api`；该解析只发生在 `apps/web/src/api/client.ts` 一处。
- 开发期由 Vite 把 `/api/*` 代理到 `http://127.0.0.1:8080`，**不做 rewrite**。
- 开发期的连通性检查（`GET /health`）只在 `import.meta.env.DEV` 下执行，失败只记录开发错误，不渲染任何面板或业务 UI。

## 理由

- 把「接口前缀」收敛为配置项，使 Web 的业务调用点不依赖开发代理地址。
- 代理不 rewrite 让服务端保留 Contract 中声明的 `/api` 前缀语义；重写会让服务端收到 `/health` 并返回 404。
- 开发期检查不落地为 UI，避免脚手架里出现一个迟早要被删掉的假功能。

## 影响

- 前端源码中不允许出现硬编码 endpoint。
- 空字符串环境变量的回退方式与代理目标的解析方式各自对应一个会让本地开发直接不可用的失败模式，见 `.ai/knowledge/web/api-base-url-and-proxy-traps.md`。

## 重新审视的条件

- 前端需要同时调用多个后端服务时。
- 需要按环境注入不同客户端实例或引入服务端状态缓存（React Query 等）时。

## 证据

- `apps/web/src/api/client.ts`、`apps/web/src/main.tsx`。
- `apps/web/vite.config.ts`。
- `.notes/archive/backend-sandbox/specs/2026-09-16-backend-sandbox-scaffold-design.md` §7.2 与 §13 验收标准。
