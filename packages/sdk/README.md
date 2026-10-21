# @workspace/sdk

本站 Browser 与 Node 的 PHP HTTP 客户端。`instance({...})` 的方法、完整路径、请求和响应类型来自 `apps/php-server/api/generated/openapi.internal.yaml`。运行时鉴权策略也由同一份契约生成，不维护手写端点清单。公开的 PHP OAuth HTML 页面不属于此 SDK。

## 入口与准备

| 入口                   | 内容                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `@workspace/sdk`       | 构建后的 ESM，按 Browser/Node 条件选择实现。                               |
| `@workspace/sdk/types` | PHP 内部契约的 `paths`、`operations`、`components`，只用于 `import type`。 |

运行前先在 `apps/php-server/` 由 Composer 生成并核对 PHP 两版 YAML，再在主仓库执行 `pnpm api:generate` 和 `pnpm --filter @workspace/sdk build`。主仓库 `api:lint` 检查 PHP 两版模块化入口；`api:generate` 从完整内部 YAML 的同一份临时快照生成 SDK 类型与 operation policy；`api:check` 只读核对这两项 SDK 产物。这些命令不代替 PHP 的路由覆盖和业务检查。同一 checkout 内的 Contract/SDK 生成与构建须串行运行。

## 服务根与请求

`setBaseUrl` 设置服务根，契约路径自身包含 `/api`。Browser 默认使用当前 origin；Node 必须先设置绝对 HTTP(S) 服务根。部署在 `/backend` 时，请求 `/api/auth/me` 将发送到 `/backend/api/auth/me`。SDK 拒绝越出服务根的路径、重定向和 cookie。

```ts
import { instance, setBaseUrl, setAccessToken } from '@workspace/sdk'

setBaseUrl('https://service.example/backend')
setAccessToken('current-user-token')
const response = await instance({ url: '/api/auth/me' })
const user = response.data // AccountMeData: numeric id, username, avatar
```

`instance` 返回 PHP 原生成功响应，例如 `{ msg, data }`，不会全局拆掉信封。省略 `method` 只表示 GET。`pathParams`、`params` 和 `data` 受生成类型约束；可传 `headers`、`timeout`、`signal`、`responseType` 和 `alert`，不能传 Axios 适配器或每次请求的 base URL。`responseType` 可为 `json`（默认）、`text`、`blob`、`arraybuffer`。204 返回 `undefined`。

```ts
const detail = await instance({
  url: '/api/notifications/{notificationId}',
  pathParams: { notificationId: 'receipt-id' },
})
const file = await instance({
  url: '/api/storage/files',
  params: { key: 'uploads/example.bin' },
  responseType: 'blob',
})
```

Browser 只在默认服务根自动读取 `localStorage`，键为 `exwebsite.php.auth.v1:` 加 `encodeURIComponent(normalizedServiceRoot)`。自定义根只使用随后显式设置的内存 token；Web 负责按根持久化和恢复。根切换会清除显式 token。Node 不读取浏览器存储。单例仅覆盖被加载的环境入口；Node 多用户并发请求应隔离运行环境，不能反复切换同一个单例的用户凭据。

## 错误和会话

普通请求抛 `ExAxiosError`，`kind` 区分配置、网络、超时、取消和 HTTP。HTTP 错误固定使用 SDK 分类码 `HTTP_ERROR` 和真实 `status`；仅当 JSON 错误体不超过 64 KiB 且严格匹配 PHP `{ msg: string }` 时使用其中的消息。未知异常、HTML、过大或无效响应使用固定文案。`retryAfterSeconds` 只来自真实 `Retry-After` header；没有 request ID 时不会合成。

只有受生成策略标记为会话鉴权的操作，在当前本站 token 发出的 401 中才触发会话失效。默认 Browser 存储来源必须条件删除并确认读取为空，才通知和导航；旧 token、旧根、匿名操作及显式其他 Authorization 不会清理当前会话。`alert: false` 关闭临时通知，不关闭符合条件的失效处理。应用可用 `setSessionExpiredHandler(handler)` 接管导航；持久来源清理未获确认时，handler 须返回 `false`，SDK 会抑制本次通知。返回 `void` 或 `true` 保留正常通知；Promise handler 在履行后才决定是否通知，拒绝或抛错不覆盖原 401，也不通知。传 `null` 恢复默认行为。

## 上传

`storage.upload(key, data, options?)` 接受 `Blob`、`File` 或 `Uint8Array`，返回 PHP `response.data.url`。它向 `/api/storage/uploads/prepare` 发送大小、类型和可选 medium，再按 `response.data` 使用原生 FormData 上传到 `/api/storage/uploads`；FormData 的 boundary 由运行时生成。上传阶段共享当前服务根与 token，变化时以 `StorageSdkError('CONFIG_CHANGED')` 停止。缺省本站阶段超时 120 秒，默认单文件上限由 PHP 验证；prepare 的 `maxBytes` 只用于客户端预检。

```ts
import { storage } from '@workspace/sdk'

const url = await storage.upload('uploads/example.bin', new Uint8Array([1, 2, 3]), {
  contentType: 'application/octet-stream',
  medium: 'file',
})
```

PHP 当前对 `medium: 'cos'` 的 prepare 返回 503；SDK 将其映射为 `StorageSdkError` 的 `UNAVAILABLE`，不会自动改用 file。上传错误按真实 HTTP 状态或传输类型映射为稳定码，不从 PHP 消息猜测旧业务码，也不在错误文本中回显文件内容或凭据。
