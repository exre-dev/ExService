# multipart 上传与响应生命周期陷阱

> 已退役：历史 Node/Fastify 实现记录。文中路径、命令和行为仅用于理解当时选择；现行 PHP/Webman 边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 与 `apps/php-server/TESTING.md`。

仅提高路由 bodyLimit 或让 preParsing 返回计数流，不能证明 multipart 的实际字节、并发和内存预算受到约束。资源值以 `api/openapi.yaml` 为准。

_最后更新：2026-10-16_

## 共同生命周期 module 拥有时序，业务 module 拥有规则

存储上传的连接时序由 `apps/server/src/http/shared/multipart-upload-lifecycle.ts` 拥有：wire 计数流的接入、`request.raw` 的临时替换与幂等还原、deadline、`aborted`/`close` 处理、buffer 引用解除与单次槽位释放。加入申请的 HTTP 上传与下载已退役。

transport 只保留自己该有的知识：配置核验与一致性检查、前置认证、payload 解析规则、可信 getter 与错误分类。新增或调整上传行为时先判断归属：时序改动进共同 module，业务规则留在 transport。

module 内部持有参数化的解析结果，不 import 任何业务服务、错误类或 DTO。

## parts 必须经过实际计数流

`@fastify/multipart` 10.1.2 的 `request.parts()` 直接读取 `request.raw`。Fastify preParsing 返回的 Transform 不会自动成为插件输入，因此计数流必须接进真实解析路径。

插件在调用 `parts()` 时即捕获 `request.raw` 并 pipe，所以共同 module 在 `preValidation` 临时替换 `request.raw`、解析结束后还原原 `IncomingMessage`，不会把插件的读取转回原连接；连接断开、响应结束与期限监听始终绑定原始连接对象。升级插件时必须重新核对这一接缝，避免计数与解析各读不同流。

Busboy 的头部限制可能截断而非拒绝输入，实际 header 字节/对数须在解析前扫描；字段名按 UTF-8 字节数校验，不能只信任 `fieldNameSize`。原文件名通过 preservePath 保留，再独立拒绝路径字符，不能以静默 basename 化掩盖违规输入。

## 容量按注册实例私有，会话按请求键控

上传从 body 解析前占位，保留到响应/失败清理。Content-Length 预检不能替代 chunked wire 计数。

容量由 `createMultipartUploadRegistry()` 在每次 transport 注册时创建的 controller 持有（`create(app)`），因此同一进程内的多个 `createApp()` 实例互不干扰。**不能用 `request.server` 反查 controller**：Glue 在自己的封装作用域里注册路由，那里的 `request.server` 与 transport 拿到的实例不是同一个对象；请求会话因此存在注册表共享的 `WeakMap` 里，按请求对象键控。

Fastify inject 和普通成功请求不能证明真实连接上的释放；`tests/contract/upload-lifecycle-sockets.test.ts` 使用真实本机 HTTP socket 核对存储上传的接管响应、CORS 与 chunked wire 预算。测试缩短期限以覆盖回收，不能据此改短 Contract 默认期限。

## 下载与上传的容量彼此独立

存储下载不占上传槽。下载在响应头尚未发出时可以改写成 408 envelope，头已发出后只能销毁连接，不能追加 JSON 错误。

## 提前终结的响应归属

期限到期、wire 计数报错、连接断开这类**外部事件**会抢在 Fastify 之前终结请求。响应归属必须同步确定，否则会出现两份响应、或原错误 envelope 被覆盖。

1. **普通错误先锁定归属。** Contract 校验、Glue security、业务失败仍由既有 `setErrorHandler` 输出一次原 envelope。共同 module 的 `onError` 钩子在收束资源之前调用 `noteNormalError()` 同步锁定归属并停掉自有 timer；漏掉这一步，后到的期限/计数错误会接管响应，把原本正确的 4xx 变成接管输出。
2. **外部终结用显式状态码与媒体类型序列化。** 接管路径在还原 raw 后调用公开 `reply.hijack()` 停止尚未开始的 Fastify 阶段，再用 `reply.serializeInput(envelope, String(statusCode), 'application/json')` 取得本 route 的 Contract serializer。**不能用 `reply.serialize(payload)`** —— 它不传 contentType，在 content 型响应 schema 上会拿到媒体类型映射而非函数并抛 `TypeError`。该重载返回 `unknown`，必须校验为 string 后才计算长度并写入 raw。
3. **安全 header 与 envelope 必须完整。** 接管不走 onSend，请求 ID、CORS/`Vary`、`no-store` 要靠 `reply.getHeaders()` 透传；envelope 只能是 `{ error: { code, message, requestId } }`，与 `apps/server/src/errors.ts` 的 `resolveErrorResponse` 共用同一映射。共享映射只能产出该 operation 在 Contract 已声明的状态码，未声明状态只记录安全分类并销毁连接，不留 envelope。头已发出且未结束时只能终止连接，不能把 JSON 追加到半截字节后面。

## 取消不等于回滚业务写入

取消/终结所做的是：停止消费输入、还原 raw、让等待中的迭代带着已分类失败退出、丢弃 transport 持有的引用、单次释放槽位。**它不取消或回滚已经交给业务服务的写入** —— 已开始的数据库事务与介质写入沿用既有语义，不保证被撤回。

部分 parse 已完成的 staging 不会发布：只有 raw 已还原且会话仍活跃时才发布一次 body 与可信结果。

## schema 标记不代表附件字节

文件字节位于请求私有上下文；进入 Contract validator 的 body 只保留 binary 字符串标记。handler 必须拒绝没有私有上下文的伪造标记。生成类型的字符串占位不能被 serializer 发上线，或被误当成已持久化文件。

## 证据

- `apps/server/src/http/shared/multipart-upload-lifecycle.ts`（共同生命周期、响应归属、注册表）、`apps/server/src/http/shared/multipart-counter.ts`（wire/header 预算与扫描 buffer 清理）、`apps/server/src/errors.ts`（`resolveErrorResponse` 共用安全映射）。
- `apps/server/src/modules/storage/api/transport.ts`（配置核验、前置认证、payload parser、可信 getter、错误分类与下载到期处理）。
- `apps/server/src/modules/storage/api/handlers.ts`（handler 侧核对可信解析上下文、拒绝伪造标记）。
- `tests/contract/storage.test.ts`：生成 Client 互通、原始 handler 输出、字节/头部及存储失败。
- `tests/contract/upload-lifecycle.test.ts`：接管状态码边界、Contract envelope 与 handler 原始返回值。
- `tests/contract/upload-lifecycle-sockets.test.ts`：存储上传的接管 envelope 与 content-type、CORS 保留、chunked wire 预算。
- `tests/contract/error-mapping.test.ts`：非上传 operation 错误输出在共用映射提取前后的逐字节一致性。
