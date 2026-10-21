# SDK 请求、配置与会话边界

`@workspace/sdk` 是 Website Browser/Node 的本站业务 HTTP 入口；`instance({...})` 与 `storage` 共享服务根、token 和请求管线。类型及 operation policy 从 PHP 完整内部契约生成，过程见 `.ai/architectures/api/contract-layout.md`；示例见 `packages/sdk/README.md`。

_最后更新：2026-10-20_

## 服务根和凭据

Browser 默认服务根为当前 origin，Node 须显式设置绝对 HTTP(S) 服务根。`setBaseUrl` 可以包含部署前缀；调用路径本身包含 `/api`，例如 `/backend` 加 `/api/auth/me`。root 变化清除显式 token，拒绝路径逃逸、重定向与 cookie。Node 多用户并发要隔离单例环境，不反复切换同一实例凭据。

Browser 仅在默认服务根自动逐请求读取 `localStorage` 的 `exwebsite.php.auth.v1:` 加编码后的规范化服务根。自定义 root 只使用显式内存 token；Web 负责按 root 持久化与恢复。有效 token/root 变化使迟到请求不能清理新会话或把上传后续阶段送向新身份。Web 的条件删除、替换同步与导航见 `.ai/architectures/web/authentication-flow.md`。

## 请求、错误和失效

`instance({...})` 接受生成类型约束的完整 path、method、pathParams、params、data；成功返回 PHP 原生 `{msg,data}`，204 返回 `undefined`。未知 operation 在替换 path 参数前拒绝。HTTP 错误为 `ExAxiosError`，保留真实 status 和 `HTTP_ERROR` 分类；仅解析不超过 64 KiB 且严格匹配 `{msg:string}` 的 JSON 错误，其他内容使用固定文案。`Retry-After` 只来自真实 header。`alert:false` 关闭临时通知，但不跳过符合条件的会话失效处理。

只有由生成策略标记会话鉴权、使用当前本站 token 发出的 401 才尝试失效清理。默认存储 token 须条件删除并再次确认空值；旧 root/token、匿名 operation 和显式其他 Authorization 不清理当前会话。应用 `setSessionExpiredHandler` 可接管：同步或异步返回 `false` 禁止通知；`true` 或 `void` 允许通知，Promise 完成前不通知。异常或拒绝不覆盖原 HTTP 401。通知前仍核对凭据代次。Web 自定义 root 处理器在持久化删除成功并二次确认空值后才允许通知，发现替换值会恢复 SDK 新 token。

## 文件上传

`storage.upload` 用 PHP `/api/storage/uploads/prepare` 获取 file 信息，再用原生 multipart FormData POST `/api/storage/uploads`，返回 `response.data.url`。`medium: 'cos'` 的 PHP prepare 和 `/api/storage/uploads/complete` 当前返回 503；SDK 把 COS prepare 映射为 `UNAVAILABLE`，不自动回退 file。各阶段检查 root/token 版本、超时与中止，失败不继续下一阶段。PHP 文件存储职责见 `.ai/knowledge/storage/lifecycle-traps.md`。

旧 Axios/COS 上传和 Node 错误 envelope 已退役；公开入口和当前类型以 `packages/sdk/package.json`、`packages/sdk/src/` 为准。
