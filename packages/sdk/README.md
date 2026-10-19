# @workspace/sdk

Browser 与 Node.js 共用的本站 HTTP 与上传入口。`instance({...})` 从唯一 OpenAPI Contract 推导方法、路径、请求和响应类型，直接返回成功数据；`storage.upload()` 返回 URL 字符串，不落库、不维护文件表。

## 入口与准备

| 入口                   | 内容                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `@workspace/sdk`       | 构建后的 ESM；按 `browser` / `node` 条件选择实现，`default` 为 Browser。                        |
| `@workspace/sdk/types` | Contract 生成类型（`paths`、`operations`、`components` 等），使用 `import type`，无运行时入口。 |

包当前是私有 workspace 包。公开入口读取 `dist/`；消费前依次运行 `pnpm api:generate`、`pnpm --filter @workspace/sdk build`。根开发、检查、测试和构建入口自动准备，顺序与同一 checkout 的串行约束见 `README.md`。

运行依赖 Axios 与对应环境的 COS SDK 保持外置。Browser 入口静态导入 `@exre/exui`，应用必须安装匹配的 ExUI，并在应用入口按 ExUI 约定提供样式与消息宿主；`alert: false` 不会消除这个依赖。Node 入口不导入 ExUI。COS 实现仅在上传 prepare 选择 COS 后懒加载，普通 HTTP 和 file 上传不加载 COS 运行代码。Node 要求 22.12+。

## Browser 用法

```ts
import { instance } from '@workspace/sdk'

const health = await instance({ url: '/health', alert: false })
const notifications = await instance({
  url: '/notifications',
  params: { view: 'unread', limit: 20 },
})
const detail = await instance({
  url: '/notifications/{notificationId}',
  pathParams: { notificationId: 'receipt-id' },
})
const download = await instance({
  url: '/storage/files',
  params: { key: 'uploads/example.bin' },
  responseType: 'blob',
})
```

默认 API root 是当前 origin 的 `/api`。每次请求在该默认 root 下自动读取 `localStorage` 的 `exwebsite.auth.token`；读取失败时不附带自动凭据，不抛出存储异常。SDK 不提供登录界面、刷新 token 或持久写入 token 的功能。

`setBaseUrl(url)` 可设 Browser 相对地址或绝对 HTTP(S) 地址。切换规范化后的 root 会清除显式 token；非默认 root 仅使用之后通过 `setAccessToken(token)` 设置的内存凭据，不继承默认存储凭据。返回默认 root 后重新启用自动读取。配置状态、覆盖有效期与会话失效边界见 `.ai/architectures/sdk/client-boundaries.md`。

本站 Web 适配层自行按 root 持久化，并在自定义 root 启动时显式恢复内存凭据；应用存储键与升级后的首次登录要求见 `.ai/architectures/web/authentication-flow.md`。

## Node 用法与单例范围

Node 没有默认 root、不读取浏览器存储、不显示通知或默认跳转。先设置完整 API root，再设置 token；顺序反过来会在 root 变化时清掉 token。

```ts
import { instance, storage, setBaseUrl, setAccessToken } from '@workspace/sdk'

setBaseUrl('http://127.0.0.1:8080/api')
setAccessToken(process.env.WEBSITE_ACCESS_TOKEN ?? null)
const health = await instance({ url: '/health' })
const url = await storage.upload('uploads/example.bin', new Uint8Array([1, 2, 3]))
```

`instance`、`storage` 与 setter 共享同一个被加载的环境入口模块的配置。单例不是跨进程、跨 worker 或跨包副本的全局状态。Node 多用户服务不得按并发请求反复切换这个单例的用户凭据；调用方须采用独立运行隔离。

## 对象请求参数

| 字段                    | 规则                                                                          |
| ----------------------- | ----------------------------------------------------------------------------- |
| `url` / `method`        | 使用 Contract 路径模板；省略方法仅表示 GET，方法可大写或小写。                |
| `pathParams` / `params` | 路径与查询参数按 Contract 推导，不能内联 query 或完整 URL。                   |
| `data`                  | JSON DTO 或 multipart 的 `FormData`，是否必填由 Contract 决定。               |
| `headers`               | 字符串 header；未显式提供 Authorization 时才附加有效 token。                  |
| `timeout` / `signal`    | 超时毫秒数，缺省 30,000；支持 `AbortSignal`。                                 |
| `responseType`          | 缺省 `json`，也支持 `text`、`blob`、`arraybuffer`，返回类型随之推导。         |
| `alert`                 | 缺省 true；Browser 错误使用 ExUI 提示。false 只关闭提示，不阻止会话失效处理。 |

成功返回响应 body，204 返回 `undefined`。请求不携带 cookie，不跟随重定向；路径必须保留在 API root 的 origin 与路径范围内，不接受 adapter、每请求 base URL 等底层配置。第三方请求使用独立工具，不能携带本站 token。

## 上传

```ts
import { storage } from '@workspace/sdk'

const data = new Uint8Array([1, 2, 3])
const url = await storage.upload('uploads/example.bin', data, {
  contentType: 'application/octet-stream',
  medium: 'file',
})
```

数据接受 `Blob`、`File` 或 `Uint8Array`；Node `Buffer` 作为 `Uint8Array` 支持。可选 `medium` 为 `file` 或 `cos`，省略由 Server 决定；`contentType` 省略时取合法的 `Blob.type`，再回退 `application/octet-stream`。

上传先 prepare，再执行本站 multipart，或 COS PutObject 后本站 complete。本站阶段走同一请求管线，缺省超时 120,000 ms 且关闭自动提示；会话失效处理仍生效。每个阶段核对开始时的配置与 token 版本，变化则抛 `CONFIG_CHANGED`，已完成的上传不会回滚。没有有效 token 时上传直接拒绝。

同一 key 覆盖，不做分块或应用层自动重试；COS 直传成功但 complete 失败仍抛错，重新调用可能再次覆盖。默认单文件上限 20 MiB，Server 可配置；prepare 的 `maxBytes` 只是客户端预检，Server 是最终校验者。COS 下载 URL 的签名有效期为签发起一年，不提供续签。

## 错误与会话失效

普通请求抛 `ExAxiosError`，具有 `kind`（`config`、`network`、`timeout`、`cancelled`、`http`）、`code`、可选 `status`、`requestId`、`retryAfterSeconds`。仅接受 JSON Content-Type 下不超过 64 KiB（65,536 bytes）的严格本站错误 envelope；其他错误体使用固定文案，不把 HTML 或任意返回对象当作用户提示。

上传抛 `StorageSdkError`，提供稳定 `code`、可选 `status` 与 `requestId`；网络映射为 `NETWORK`，超时与取消映射为 `TIMEOUT`，不直接展示 COS 原始异常。

```ts
import { setSessionExpiredHandler } from '@workspace/sdk'

setSessionExpiredHandler(({ error, loginUrl }) => {
  // 应用在此同步匿名状态，并决定导航；返回 Promise 也可以。
})
// 恢复 SDK 缺省行为：setSessionExpiredHandler(null)
```

只有匹配当前配置与凭据版本的 401 `SESSION_INVALID` 才清理对应会话，同一失效版本只处理一次。显式 Authorization 必须匹配当前 token 才能触发这一清理。默认 Browser 处理会前往该 API origin 的 `/login`；自定义 handler 替代默认导航。迟到旧响应、其他 401 或无法确认清理的存储状态不会清除较新的会话。

## 破坏性迁移

- 删除 `@workspace/api-client`；Server 的类型导入改为 `@workspace/sdk/types`，Web 请求改为 `instance({...})`。
- 不再公开 `createApiClient`、`createSdk`、`createExAxios`、`ExAxios`，也没有 `/browser`、`/node` 深入口。
- 不再使用 `client.GET/POST`、实例 setter 或 `getAccessToken` factory 选项；使用根导出的 setter 与对象参数。
- 不支持调用方传响应 DTO 泛型；方法、请求和成功响应类型统一由 Contract 推导。
- 旧源码 Client 的无需构建约定已退役；准备顺序与当前边界见根 `README.md` 和 `.ai/architectures/sdk/client-boundaries.md`。
