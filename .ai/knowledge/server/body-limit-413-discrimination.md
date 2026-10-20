# 请求体上限：413 的两种来源及其判别

应用全局 `bodyLimit` 是 4 MiB（`apps/server/src/app.ts`），路由可以单独覆盖；Docs 与通用上传都在自己的 transport 里显式赋值。**路由 config（如 `x-fastify-config`）不会改变默认 JSON 解析器**，只写 config 等于没有上限。

## 同一个 413 来自两层，状态码本身无法区分

1. **传输层**：`FST_ERR_CTP_BODY_TOO_LARGE`。解析器在读正文之前就拒绝。
2. **内容层**：正文已经完整消费并解析，随后由领域预算（例如 Docs 的 8 MiB 规范化字节）拒绝。

两者经统一错误出口后都可能是 `413`，于是"看到 413"不能说明是哪一层拦下的，也就无法证明"恰好等于上限的正文是否被放行"。

## 判别依据是 Fastify 解析器错误路径的行为

`lib/content-type-parser.js` 的 `onDone` 在解析出错时先 `reply.header('connection', 'close')` 再 `reply.send(error)`，并且不再读完正文：

- **413 且响应带 `Connection: close`** → 传输层拒绝，正文没有被消费。
- **413 但没有该响应头（保持 keep-alive）** → 正文已被完整解析，是内容层的预算拒绝。

预算本身是**包含边界**的：`contentLength > limit` 与 `receivedLength > limit` 都是严格大于，因此长度正好等于上限的正文会被放行。

## 没有声明长度时只有累加计数可依赖

- `Transfer-Encoding: chunked`：没有 `Content-Length` 预检，靠 `onData` 里对 `receivedLength` 与 `receivedEncodedLength` 的累加判定，超限同样给 413。
- 既不声明 `Content-Length` 也不声明 `Transfer-Encoding`：HTTP/1.1 下正文长度按 0 处理，请求在请求头处即结束，后续字节不会被当作请求体，也不会被持久化。

## 只能靠真实 socket 证明

`app.inject()` 走内存通道，不经过 Node 的 HTTP 解析器，因此 `Content-Length` 预检、chunked 累加与"未声明长度"三种行为都测不到，必须用原始 TCP 客户端。

一个客户端侧陷阱：响应已经到达后若继续灌入约 1 MiB 以上字节，该响应会在 RST 中丢失，服务端看起来像"挂住"。写测试时应把写出的正文压小，并在拿到响应后立刻停止发送，判定依据是"声明/未终止长度与已送出字节的差额"，而不是客户端的写速度。
