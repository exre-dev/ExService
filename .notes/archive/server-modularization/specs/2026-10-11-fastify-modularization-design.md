# Fastify 模块化插件与统一 Contract 设计

- 状态：设计已确认；模块内聚、公共能力与具体业务分目录的修订已获用户同意，代码实现尚未开始。
- 日期：2026-10-11
- 模块根目录：`.notes/server-modularization/`
- 范围：Website Server 装配、模块插件、模块类型扩展和 OpenAPI 文件组织。

## 目标与已确认要求

将 `apps/server/src/app.ts` 中混合的服务注入、handler 登记、HTTP 基础配置、认证和传输配置拆为职责明确的模块。

已确认的要求：

1. 业务插件与 API 插件均使用 `fastify-plugin` 作为入口，并显式注册。
2. 业务插件通过 `decorate` 提供服务；API handler 调用这些服务。
3. 业务模块可以依赖其他业务模块，依赖方向、类型和加载顺序必须明确。
4. 每个提供 Fastify 扩展的模块维护自己的 `fastify.d.ts`，提供服务及方法的类型提示。
5. OpenAPI 独立于 Fastify 实现维护，模块化源文件统一打包为一份 JSON，供多人协作。
6. 保留现有 HTTP 行为、认证边界、上传限制和原始 handler 输出校验。
7. 公共能力放在 `apps/server/src/modules/{name}/`，网站具体业务流程放在 `apps/server/src/domains/{name}/`；各模块内部包含自己的 API 接入，统一 HTTP 装配放在 `apps/server/src/http/`。

本轮统一目录边界，同时迁移已有业务文件及其 import。新增 HTTP operation、数据库模型变化、依赖自动发现和部署不在本轮范围内。仓库根 `api/` 仍负责独立 OpenAPI Contract；Server 各模块内的 API 子目录负责 HTTP 实现，两者不混放。

## 当前证据

- `apps/server/src/app.ts` 创建实例，直接 decorate 所有服务，集中导入 handler，安装 HTTP hook，然后注册 Glue。
- `apps/server/src/auth/fastify.d.ts` 同时声明认证、资料、申请、邀请、存储、通知、OIDC 和请求身份字段。
- `apps/server/tsconfig.json` 包含整个 `src`，根配置开启 strict，但 `skipLibCheck` 当前为 true。
- `apps/server/src/server.ts` 管理配置、数据库身份与结构检查、业务对象组装、worker、监听和关闭。
- `JoinService` 已通过构造函数接收 `InvitationService`；跨模块依赖已有真实实现。
- join/storage transport 使用 `onRoute` 修改 Glue 生成的路由；迁移时必须保持可见作用域和安装顺序。
- `tests/contract/health.test.ts` 的 operation 枚举明确拒绝带 `$ref` 的 path item，不能直接把拆分后的根 YAML 交给旧枚举逻辑。
- 项目已安装 Redocly CLI，当前 lint 与类型生成直接读取单文件 `api/openapi.yaml`。

## 目录与职责

```text
api/
  openapi.yaml                    # 唯一 Contract 根入口
  paths/                          # 按 HTTP 分组，完整 path item 不拆散
  schemas/                        # 模块与公共 schema
  generated/openapi.json          # 单文件 Contract 生成物

apps/server/src/
  app.ts                          # 创建实例，显式装配业务及 HTTP 插件
  server.ts                       # runtime 配置、资源准备与生命周期
  create-services.ts              # 现有 Auth/Invitation/Join 综合工厂迁入应用组装层
  errors.ts                       # 既有统一错误实现
  plugins/
    http-foundation.ts            # fp：应用级错误、CORS、multipart
  contract/
    document.ts                   # 中立 Contract reader、路径与 API_PREFIX
  http/
    plugin.ts                     # fp + encapsulate:true：统一 HTTP 作用域，注册一次 Glue
    service-handlers.ts           # 聚合模块 operation 映射，拒绝重复
    handler-types.ts              # 从生成式 operations 派生请求及结果类型
    security-handlers.ts          # 聚合 security handler
    cors.ts                       # 应用级 HTTP 基础能力
    shared/
      request-normalization.ts
      query-coercion.ts
      multipart-counter.ts
    system/                       # health 的 plugin/handlers/operations
  modules/
    auth/
      plugin.ts                   # fp：提供 authServices
      fastify.d.ts                # authServices 的唯一声明
      service.ts
      crypto.ts
      api/
        plugin.ts                 # fp：依赖检查与 HTTP 配置
        handlers.ts
        operations.ts
        security.ts
        fastify.d.ts              # authSession 的唯一声明
    profile/                      # 业务 plugin/service/d.ts 与 api/plugin/handlers/operations
    identity/                     # OIDC/outbox/config；api 内声明 identityClientId
    storage/
      plugin.ts
      fastify.d.ts                # storageServices 的唯一声明
      factory.ts
      service.ts
      adapters/
      api/                        # plugin/handlers/operations/transport
    notifications/                # 业务 factory/service/repository/worker 与 api 接入
  domains/
    join/
      plugin.ts                   # fp：同时提供 joinServices 和 invitationServices
      fastify.d.ts                # 两个 service decorator 的唯一声明
      applications/               # 既有申请 service/records/校验/schema-check
      invitations/                # 既有邀请 service/mail
      api/                        # plugin/handlers/operations/transport
    community/                    # 既有 schema-check，不虚构服务插件
  db/
  cli/

tests/server-types/               # noEmit 类型验收
tests/server-plugins/             # Fastify boot、依赖及作用域验收
tests/contract/                   # 真实 HTTP 与原始返回值验收
```

已有 `apps/server/src/handlers/` 及 storage/notifications 中的 HTTP handler 移入所属模块的 API 子目录；join HTTP 接入和 transport 放在 `apps/server/src/domains/join/api/`，storage HTTP 接入和 transport 放在 `apps/server/src/modules/storage/api/`。认证 header 与请求身份接入放在 API 层；会话验证、OIDC 和密钥比较等可复用业务能力由业务模块提供。

业务模块声明其 service decorator；API 模块声明其实际新增的 request/reply 字段。每个字段只有一个拥有者。没有 decorator 的 system API 模块不创建无意义的空声明；只含就绪检查的 community 模块也不为目录统一而虚构服务插件。

依赖方向：模块内部 API → 业务服务；具体业务 → 公共能力；应用组装层 → 各模块及 HTTP 总入口。公共模块不得反向依赖具体业务，HTTP 公共工具不得依赖 HTTP 总入口或具体业务；业务模块之间按声明的无环依赖调用；业务模块不导入 API 接入层，不接收 FastifyRequest/FastifyReply。业务模块的 plugin.ts 可以依赖 Fastify，负责服务接入，其 service/factory 保持可独立使用。shared HTTP 工具不依赖具体业务模块，具体认证和错误适配由接入层完成。

## 插件装配与作用域

所有业务服务插件使用 `fp`，在应用服务作用域中共享自己提供的服务。插件的 name 唯一；dependencies 使用插件 name；decorators.fastify 使用实际字段名。依赖显式按顺序注册，Fastify 的 dependencies 只检查依赖，不负责自动加载或排序。

第一轮保留 `CreateAppOptions` 的服务注入能力及 `server.ts` 的资源所有权：插件接收已创建的服务，声明依赖并 decorate。现有 Auth/Invitation/Join 综合工厂迁至 `apps/server/src/create-services.ts`，保留创建行为及共享依赖，避免公共 auth 模块依赖 join 业务。JoinService 接收 InvitationService 的既有构造注入留在 join 领域内部；一个 join 业务插件暴露这两个服务，不为内部子功能另建 fp 插件。将来迁移某个模块的创建职责时，应在它的插件入口取得已注册依赖，再交给普通业务工厂；同一资源只能有一个生命周期所有者。

外层 API 插件使用 `fp(..., { encapsulate: true })`，隔离 API 专属 hook 和请求字段。外层插件内按顺序：

1. 安装 API 请求预处理及 query coercion。
2. 注册各模块的 API fp 插件。
3. 等待这些 API 插件完成初始化和依赖检查。
4. 注册一次 Glue，传入统一 JSON、显式 `/api` 前缀、聚合 handler 与 security handler。

模块 API 子目录的 plugin.ts 在统一 HTTP 作用域内使用默认 fp 行为，不额外创建兄弟隔离作用域；目录内聚不代表运行时逐模块封装。模块中的 `onRoute` hook 按 operationId 筛选，仅修改所属操作；join/storage hook 必须先于 Glue 安装。每个 API 插件显式检查它实际使用的业务服务。API 模块的 handler 映射作为普通 TypeScript 导出，`apps/server/src/http/service-handlers.ts` 只聚合，不再逐个导入所有 handler。

API 插件是模块 HTTP 接入入口；路径、method 和 schema 仍只由 Glue 从 Contract 注册。采用 fp 不代表每个模块自行手写一份路由定义。

应用级 HTTP 基础插件在 API 插件之前注册，维持现有 CORS、预检、multipart 和错误 envelope 行为。worker、数据库和监听生命周期第一轮继续由现有 runtime 入口管理。

## 跨业务依赖

业务逻辑保留普通 class/interface/factory，不接收整个 Fastify 实例。需要其他模块能力时，通过构造参数注入已声明的公共服务或其最小接口；插件入口或现有工厂负责接线。

已组装服务的类型选用现有接口，不用 any 或双重断言伪造插件可用性。插件依赖检查与业务构造注入是两种互补约束：前者保证应用接线，后者保证 service 可独立理解和测试。

依赖图保持无环。双向依赖通过上层流程服务或共同基础服务拆开。只有业务确实需要异步、可靠投递时才设计事件/outbox，不在本轮增加事件总线。模块之间不调用彼此的 HTTP endpoint，不依赖对方 repository 或私有实现。

## 模块类型扩展与提示

例如 `apps/server/src/modules/storage/fastify.d.ts`：

```ts
import type { StorageServices } from './factory.js'

declare module 'fastify' {
  interface FastifyInstance {
    storageServices: StorageServices
  }
}
```

模块文件含顶层 import/export，使用 module augmentation，不能把 Fastify 原模块重定义为空壳。NodeNext 相对类型 import 使用对应实现的 `.js` 路径。不得从运行时代码 side-effect import `fastify.d.ts`，构建后的 Node 不需要也不能加载声明文件。

所有模块 `.d.ts` 由 `apps/server/tsconfig.json` 的 src include 加载。测试的 TypeScript 配置必须包含相同扩展。当前 types:[node] 控制自动加载的类型包，不排除 include 已纳入的本地声明文件。未来若把模块发布为独立包，需另行配置包的 types/exports；本轮不设计插件发布。

插件实现声明为 `FastifyPluginAsync<ModulePluginOptions>`，再交给 fp；插件参数明确类型；复杂或复用参数可放在 plugin-options.ts，简单参数可以就地声明，不机械新增文件。业务声明放在所属公共模块或具体业务的 fastify.d.ts；API 层新增字段放在该模块内部的 API 子目录中，不为字段方便可见而重复声明。服务字段、方法参数和返回值从业务接口得到提示。编译期应拒绝拼错服务字段、不存在的方法和错误参数类型。

`authSession` 保留 `SessionIdentity | undefined`；`identityClientId` 保留 `string | undefined`；`oidcServices` 保留现有可选类型。受保护 handler 使用明确的会话检查进行收窄，不能通过声明非空字段绕过认证。模块只提供真实存在的扩展，不把每个接口的 Body/Params 写入全局 FastifyRequest。

HTTP 请求的 Body/Querystring/Params 和 JSON 返回类型从生成式 operations 按 operationId 派生，保留 OpenAPI 为唯一 DTO 来源。type-only 使用共享 Client 导出的类型，不引入其 Node 运行时。typed handler 必须与 Glue 适配边界兼容；multipart、二进制与空响应继续有各自准确的传输类型，不统一伪装为 JSON。适配边界不得放宽成 any 以换取编译通过。

重要限制：声明合并在 TypeScript 编译上下文中全局生效，与运行时 register、插件加载顺序和封装作用域不同。能补全 storageServices，不代表任意 Fastify 实例都有该服务。必须同时保留依赖元数据、插件边界上的运行时 decorator 检查，以及实际 boot 的负向用例。getDecorator 的泛型提供调用处类型，不会验证对象实现是否符合该接口。

## 统一 OpenAPI 与生成链路

`api/openapi.yaml` 是唯一 Contract 根入口，通过 `$ref` 引用模块 paths/schemas。它们共同组成一份逻辑 Contract。`api/generated/openapi.json` 是这份 Contract 的单文件生成结果，纳入版本控制，禁止人工编辑。

流水线为：源 Contract lint → bundle JSON → 生成 Client 类型 → Server/Contract tests 消费同一 JSON。打包不启动 Fastify、不连接数据库、不读取 runtime 秘密。继续使用 Draft-07 兼容的 schema 子集，保留现有 OpenAPI 版本、operationId、security、extensions、响应 header 与错误语义。

bundle 输出要求：所有文件引用收敛到当前文档；operation 可完整枚举；公共 schema 名称稳定。保持合法内部 `$ref`，不使用 blanket dereference 破坏递归 schema。对 schema 名称冲突和重复 operation 明确失败。

开发、测试和构建入口须调用同一生成流程；普通运行不自动安装依赖或改 lockfile。维护 CLI、服务配置和监听之前不得隐式执行数据库迁移。CI 检查重新生成后 JSON 和 schema.d.ts 与提交一致；现有服务持续使用稳定的 Contract 路径。

Contract 测试读取统一 JSON，并共享引用解析入口，准确枚举存在内部 path-item 引用的 operation。旧测试直接解析 YAML 的逻辑必须同步迁移，不允许跳过引用导致覆盖检查漏报。

`serviceHandlers` 从模块 maps 聚合，重复键报错；保留现有从 Server 包导出的访问方式，供测试校验原始结果。Contract 与 map 的双向一致性在启动验证和测试中检查，阻止 Glue 将缺失实现留到首个请求才返回 500。

## 错误、兼容与资源

HTTP 错误继续通过现有 errors 实现返回固定安全 envelope，不回显业务/数据库异常 message。缺失插件、字段、重复映射或 Contract 未实现属于启动装配失败，监听前暴露。

迁移只调整结构和接线，不新增 HTTP operation，不修改鉴权策略、字段归一化、schema 强制语义、multipart 限制或附件 header。数据库检查与显式迁移规则、头像和存储数据、worker 生命周期沿用现状。不得因模块拆分重复启动 worker 或关闭同一个连接池。

## 验收与交付顺序

1. 先完成模块声明拆分、插件参数与依赖元数据设计；类型测试覆盖真实字段、方法参数、返回类型和可选身份收窄。类型检查必须能发现冲突扩展，不能仅依赖 skipLibCheck:true 跳过声明检查。
2. 实现业务插件及 API 作用域装配；boot 测试覆盖正确顺序、缺服务、顺序错误和隔离可见性。检查 transport hook 能覆盖对应 Glue 路由且不修改其他 operation。
3. 将公共能力移入 `apps/server/src/modules/`，申请与邀请移入 `apps/server/src/domains/join/`，HTTP 文件移入所属模块的 API 子目录；综合服务工厂迁入应用组装层，同步全部 import 和类型配置引用；聚合 maps，保留公开导出；验证重复、漏登记和多余登记均被发现。检查业务代码未反向依赖 API 接入层。
4. 拆 Contract 源文件、生成统一 JSON、调整生成/读取入口；比较迁移前后 Contract 的语义与所有 operation 的实际注册路径。
5. 运行 api lint/generate、类型检查、现有 Contract/传输测试、pnpm test 与 pnpm build。数据库用例继续使用 Testcontainers，不连接开发库。自动检查与真实浏览器验收分别报告。
6. 根 AGENTS.md 已按用户要求记录迁移目标并保留现有入口的过渡说明；实现验证后，再根据最终行为更新相关 `.ai/` 架构/决策/知识位置及维护流程，避免把目标目录写成当前运行事实。

建议以两个相邻阶段交付：先完成插件与类型装配，再完成 Contract 源文件拆分；每个阶段都保证所有消费者使用同一有效 Contract。已有未提交改动可能覆盖 app、factory 和 handler，实施前必须确认这些修改的归属与合并方式。

回滚只回退本次接线、路径与生成流程，恢复其对应版本的 Contract 和 Client 类型，不执行数据库 reset 或删除持久数据。

## 方案取舍

选用显式 fp 插件、模块内聚及分层类型声明、公共能力与具体业务分目录、独立 Contract 和统一 JSON。它同时满足模块依赖、类型提示与多人协作，保留现有 Glue 和 Contract tests 的投资。

不再采用顶层集中 API 实现目录：用户最终选择按业务分工和集中查找模块相关代码，各模块内部包含自己的 API；公共 HTTP 处理和统一 Glue 装配仍集中维护。modules/domains 是本项目按公共能力与具体流程划分的目录约定，不声称是通用 DDD 标准；公共 auth/profile 也不因此自动成为可独立发布的通用包。未采用从 Fastify route schema 反向生成 Contract：协作者需要独立、可提前设计的接口定义。未采用按目录自动加载插件：显式依赖顺序更适合当前规模。未采用每个 API 模块都 encapsulate:true 后配合单个中央 Glue：兄弟作用域的 hook 无法修改中央生成的路由。

## 参考依据

- `apps/server/src/app.ts`、`apps/server/src/server.ts`、`apps/server/src/auth/fastify.d.ts`
- `apps/server/src/auth/create-services.ts`、`apps/server/src/modules/storage/factory.ts`、`apps/server/src/modules/notifications/factory.ts`
- `apps/server/tsconfig.json`、`tsconfig.base.json`、`packages/api-client/src/index.ts`
- `.ai/decisions/api/01-openapi-as-single-contract.md`
- `.ai/architectures/server/request-lifecycle.md`、`.ai/architectures/api/contract-layout.md`
- `.ai/knowledge/server/operation-registration-gaps.md`、`.ai/knowledge/server/serialization-masks-handler-regressions.md`
- `.ai/architectures/contract-tests/test-layers.md`、`tests/contract/health.test.ts`
- [Fastify TypeScript：插件与声明合并](https://fastify.dev/docs/latest/Reference/TypeScript/#plugins)
- [fastify-plugin：依赖与封装](https://github.com/fastify/fastify-plugin)
- [Redocly：bundle](https://redocly.com/docs/cli/commands/bundle)
