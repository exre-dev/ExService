# Contract-first 前端与本地 Backend Sandbox 脚手架设计

> 迁移说明（2026-09-29）：本文件保留当时的业务与实现决定；其中旧 `apps/mock-server/` 路径、本地 SQLite Mock 与未来 PHP/MySQL 接管的基础设施描述，已由 `.notes/archive/server-promotion/specs/2026-09-29-server-promotion-design.md` 和 `.notes/archive/server-promotion/rfcs/server-postgresql-migration-rfc.md` 取代。当前唯一 Server 位于 `apps/server/`，使用独立 PostgreSQL `exre`；正文中的旧路径和目标仅作历史记录。

- **日期：**2026-09-16
- **状态：**已批准；已交接实施型 RFC
- **模块根目录：**`notes/backend-sandbox/`
- **确认范围：**创建一个 pnpm workspace 脚手架：React/Vite/SCSS/Valtio/Framer Motion 前端、Fastify/SQLite/Drizzle 本地 Mock Server，以及以 OpenAPI 3.1 为唯一 API Contract 的类型安全客户端链路。

## 1. 背景与目标

PHP 后端尚未完成时，前端需要可运行、可保存状态的本地后端实现，而非固定 JSON。未来 PHP 服务按同一份 API Contract 实现后，前端仅通过配置切换 API base URL，不修改业务调用代码。

首版的目的不是提供示例业务，而是验证后续业务开发必须遵循的基础设施：

1. OpenAPI 是所有 HTTP API 的唯一事实来源。
2. 前端只经由生成类型支撑的共享 API Client 访问接口。
3. Fastify 从 OpenAPI 注册并实现路由，SQLite 只服务于本地 Mock 环境。
4. 数据库变更可通过 migration 管理、显式执行和可预测地重置。
5. 一个命令可并行启动前端与 Mock Server。

## 2. 已确认决策

| 主题          | 决策                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------- |
| 代码组织      | `pnpm workspace` 单仓，分为 web、mock server 和 API client 三个工作区包。                         |
| API 设计      | OpenAPI 3.1，首版使用单文件 `api/openapi.yaml`，业务复杂后才拆分 `paths/` 与 `schemas/`。         |
| API Client    | `openapi-typescript` 生成类型，`openapi-fetch` 提供类型安全请求客户端。                           |
| 前端          | React + Vite + TypeScript + Sass + Valtio + Framer Motion；首屏为极简空壳，不预置业务或交互演示。 |
| 本地后端      | Fastify + SQLite + Drizzle ORM；不是静态 JSON Mock。                                              |
| 数据库        | Drizzle migration 加受控的 `db:reset`；不在服务启动时生成或修改 schema。                          |
| 认证          | 首版不包含登录、Token、用户、角色或权限 Mock。                                                    |
| 首个 Contract | 无认证 `GET /api/health`，用于验证完整客户端、代理、服务端和 Contract 测试链路。                  |

## 3. 范围与非目标

### 包含

- 工作区、共享 TypeScript 配置及根命令。
- OpenAPI lint、类型生成和最小 Contract Test。
- Vite 开发代理及可配置 API Base URL。
- Fastify 的 Contract 路由注册、统一错误格式和健康检查处理器。
- SQLite 连接、初始 migration 基线、显式迁移和本地数据库重置。
- 前端的 SCSS 基础入口和 API Client 启动期连通性检查。
- 面向 AI 开发的 `AGENTS.md` 规则。

### 明确不包含

- 业务资源、业务表、CRUD、种子业务数据或业务 UI。
- 登录、刷新 Token、授权、权限模型和模拟用户。
- React Query/TanStack Query、服务端状态缓存或离线策略。
- 文件上传、SSE、WebSocket、队列、邮件或第三方集成。
- PHP/MySQL 实现、PHP Contract Test、部署和 CI。
- 自动从数据库 Schema 推导 API；OpenAPI 不由 Drizzle 或 Fastify 反向生成。

## 4. 总体架构

```text
                              api/openapi.yaml
                           OpenAPI 3.1 Contract
                                      |
                 +--------------------+--------------------+
                 |                    |                    |
                 v                    v                    v
       openapi-typescript     Fastify OpenAPI Glue      future PHP backend
                 |                    |                    |
                 v                    v                    v
       packages/api-client      Fastify handler         MySQL (out of scope)
                 |                    |
                 v                    v
 React/Vite app -- /api proxy --> Mock Server --> Drizzle --> SQLite
```

`api/openapi.yaml` 先定义 API，再由消费者实现：

- `packages/api-client` 从 Contract 生成并导出 TypeScript 类型与客户端工厂。
- `apps/mock-server` 使用 `fastify-openapi-glue` 将 Contract 中的 operation 注册为 Fastify 路由，并将 `operationId` 映射到显式 handler。路由本身、输入校验与响应 schema 不在 Fastify 中手写为另一份 API 定义。
- 未来 PHP 后端独立实现相同 Contract；它不依赖 Node、Drizzle 或 SQLite 代码。

## 5. 工作区结构

```text
.
├── api/
│   └── openapi.yaml
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── api/client.ts
│   │   │   └── styles/index.scss
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── mock-server/
│       ├── src/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── handlers/health.ts
│       │   ├── errors.ts
│       │   └── db/
│       │       ├── client.ts
│       │       ├── migrate.ts
│       │       └── reset.ts
│       ├── drizzle/
│       │   ├── 0000_baseline.sql
│       │   └── meta/_journal.json
│       ├── data/.gitkeep
│       ├── drizzle.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── api-client/
│       ├── src/
│       │   ├── client.ts
│       │   ├── index.ts
│       │   └── generated/schema.d.ts
│       ├── tsconfig.json
│       └── package.json
├── tests/
│   └── contract/health.test.ts
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── redocly.yaml
└── .gitignore
```

### 5.1 各目录责任

| 路径                   | 责任                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| `api/`                 | API Contract；除该目录的规范文件外，不保存服务端或前端实现。                    |
| `apps/web/`            | 前端入口、样式、Vite 配置和对共享 Client 的适配；不得直接调用浏览器 `fetch`。   |
| `apps/mock-server/`    | 运行 Fastify、维护 handler 与本地数据库；不拥有独立 API schema。                |
| `packages/api-client/` | 仅保存可复用的 API 类型和调用封装；不引入 React、Valtio 或业务状态。            |
| `tests/contract/`      | 以真实 Fastify app 的 `inject()` 请求验证 HTTP Contract，而不是只单测 handler。 |
| `AGENTS.md`            | 将 Contract-first 工作流显式提供给人类和 AI 协作者。                            |

生成的 `packages/api-client/src/generated/schema.d.ts` 由 `api:generate` 写入并纳入版本控制；禁止人工编辑。Contract 修改应同时提交其对应生成结果，以便代码审阅能看到 API 类型变化。

## 6. API Contract

首版 `api/openapi.yaml` 使用 OpenAPI 3.1.1，并声明 `servers[0].url: /api` 作为客户端 API base URL；因此 OpenAPI 路径写作 `/health`，前端实际请求为 `GET /api/health`。`servers` 只描述客户端地址，不承担 Fastify 路由前缀职责。

为与 Fastify 默认 Ajv 校验保持一致，首版的 OpenAPI 3.1 schema 限制为 JSON Schema Draft-07 兼容子集。允许使用 `type`、`const`、`enum`、`required`、`properties`、`additionalProperties`、数组和 `$ref` 等通用关键字；不得使用 Draft 2020-12 专有关键字或语义。未来如需完整 OpenAPI 3.1 / Draft 2020-12 特性，必须先单独设计并配置 Fastify 的 2020-12 validator 与 serializer compiler，不能只修改 Contract。

### 6.1 健康检查

```yaml
paths:
  /health:
    get:
      operationId: getHealth
      summary: Read mock server liveness
      responses:
        '200':
          description: Mock server is running
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
        default:
          $ref: '#/components/responses/ErrorResponse'
components:
  responses:
    ErrorResponse:
      description: Safe application error response
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
  schemas:
    HealthResponse:
      type: object
      additionalProperties: false
      required: [status]
      properties:
        status:
          type: string
          const: ok
    ErrorEnvelope:
      type: object
      additionalProperties: false
      required: [error]
      properties:
        error:
          type: object
          additionalProperties: false
          required: [code, message, requestId]
          properties:
            code:
              type: string
            message:
              type: string
            requestId:
              type: string
```

该接口代表本地 Mock Server 已运行且完成其启动前置检查；不引入用户、数据库表或业务状态。服务启动会要求由 `db:migrate` 或 `db:reset` 已创建的本地数据库文件存在，因此成功响应不会掩盖缺失的本地数据库初始化。

### 6.2 错误约定

首版在 OpenAPI 中定义统一的 JSON 错误 envelope，并由 Fastify 的错误与 404 handler 返回：

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "A concise safe message",
    "requestId": "fastify-request-id"
  }
}
```

- Handler 不泄露堆栈、SQLite 路径或内部错误详情。
- Fastify 的请求 ID 作为 `requestId` 返回并写入日志关联。
- 后续业务 operation 必须在 OpenAPI response 中引用此 envelope（或先定义明确版本化的替代结构），再由实现返回。
- 未声明的路径由宿主的 404 handler 使用同一 envelope；它不是可供前端调用的“隐藏接口”。

## 7. 前端设计

### 7.1 页面和样式

`apps/web` 是 Vite React TypeScript 应用，只有一个最小 `App` 根组件和 `styles/index.scss` 全局样式入口。它显示静态的脚手架就绪内容，不包含业务实体、数据列表、按钮流程或交互式状态演示。

安装并在工作区声明以下依赖：

- `sass`：Vite 的 `.scss` 编译支持。
- `valtio`：后续客户端 UI 状态的统一选项；首版不创建虚构 store。
- `framer-motion`：后续动画的统一选项；首版不为验证依赖而制造演示动画。

### 7.2 API 使用与环境配置

`packages/api-client` 导出：

```ts
createApiClient({ baseUrl: string })
```

它基于 `openapi-fetch` 和 `openapi-typescript` 生成的 `paths` 类型创建客户端。`apps/web/src/api/client.ts` 唯一负责从 `VITE_API_BASE_URL` 读取 base URL，缺省值为 `/api`。

- 开发时，Vite 将 `/api` 代理到 `http://localhost:8080`。
- 前端启动时，在 `import.meta.env.DEV` 条件下使用共享 Client 请求 Contract 中的 `GET /health`；失败只输出明确的开发错误，不渲染业务或健康检查仪表盘。
- 生产切换 PHP 时，将 `VITE_API_BASE_URL` 配置为 PHP 实现的 API 前缀（例如 `https://service.example.test/api`）；业务调用点不改变。
- 前端源码禁止直接调用 `fetch`、硬编码新端点或重复定义 API DTO。

## 8. Mock Server 与数据库设计

### 8.1 Fastify 应用

`src/app.ts` 创建可测试的 Fastify 实例；`src/server.ts` 负责读取运行时配置、在监听前检查本地数据库文件，并监听端口 `8080`。Contract Test 导入 `app.ts` 并调用 `inject()`，不绑定固定端口；由于 `/health` 不访问业务数据库，测试不会依赖或修改开发数据库文件。

`fastify-openapi-glue` 忽略 OpenAPI 3.x 的 `servers[].url` 作为路由前缀，因此 `app.ts` 必须明确且只在注册时设置一次 prefix，并显式提供 operation handler 映射：

```ts
fastify.register(openapiGlue, {
  specification: openapiPath,
  prefix: '/api',
  serviceHandlers: { getHealth },
})
```

这使 `/health` 实际注册为 `/api/health`，并将 `operationId: getHealth` 映射到 `handlers/health.ts` 导出的 handler。Contract 的 method、path、operation ID、输入校验和响应 schema 先于 handler 存在；handler 只实现行为并返回 `{ status: 'ok' }`。

应用层集中配置：

- 与 OpenAPI 对应的 request/response validation。
- JSON 错误 handler、404 handler 和请求 ID 关联日志。
- 启动时的本地数据库文件存在性检查及可执行的修复提示：`pnpm db:migrate` 或 `pnpm db:reset`。

不在 route 文件中手写 `app.get()` 来绕过 Contract，不从 Fastify schema 反向生成 OpenAPI，也不提供静态 JSON mock 路由。

### 8.2 SQLite 与 Drizzle

- 本地开发数据库固定为 `apps/mock-server/data/mock.sqlite`。
- `data/` 提交 `.gitkeep`，但忽略 `mock.sqlite`、`mock.sqlite-wal` 和 `mock.sqlite-shm`。
- Drizzle 使用 `better-sqlite3` 访问该文件；该实现仅用于本地 Mock，不连接生产 MySQL 或 PHP 数据库。
- 首版保留一个空的、已记录的 `0000_baseline.sql` migration 与 Drizzle journal。`db:migrate` 因此创建数据库和 Drizzle migration 元数据；首个业务表出现时，后续 migration 必须由 Drizzle 生成，而不是修改 baseline。
- 首版不定义业务表和 seed 数据。数据库存在的价值是验证迁移、文件位置与未来 CRUD 的生命周期，而不是伪造业务模型。

### 8.3 数据库命令

| 命令              | 行为                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:migrate` | 创建所需的 `data/` 目录和 SQLite 文件，并按 Drizzle journal 应用尚未执行的 migration。                                  |
| `pnpm db:reset`   | 仅删除固定的 `apps/mock-server/data/mock.sqlite` 及其 WAL/SHM 伴随文件，然后立即执行 `db:migrate`。不接受任意路径参数。 |

`db:reset` 不会删除目录、源码、migration 或工作区内的其他文件。Mock Server 在启动时不创建表、不生成 migration，也不隐式重置数据。

## 9. 依赖选择

依赖按运行边界声明，避免前端、共享 Client 与 Mock Server 相互泄漏实现细节：

| 工作区                | 生产依赖                                                           | 开发/构建依赖                                                                                                                       |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 根目录                | 无                                                                 | `typescript`、`vitest`、`concurrently`、`@redocly/cli`、`openapi-typescript`、`ajv`（以 Draft-07 兼容配置验证 Contract response）。 |
| `apps/web`            | `react`、`react-dom`、`valtio`、`framer-motion`                    | `vite`、`@vitejs/plugin-react`、`sass`。                                                                                            |
| `packages/api-client` | `openapi-fetch`                                                    | 无额外运行时生成器；生成类型来自根命令。                                                                                            |
| `apps/mock-server`    | `fastify`、`fastify-openapi-glue`、`drizzle-orm`、`better-sqlite3` | `drizzle-kit`、`tsx`、相关 TypeScript 类型包。                                                                                      |

版本由 `pnpm-lock.yaml` 固定。根 `package.json` 设置 `packageManager` 字段以约束使用 pnpm；Node 使用所选 Fastify 版本支持的 LTS 版本。首版不引入 ESLint、Prettier、React Query 或 Valtio 以外的状态管理库。

## 10. 根脚本与开发流程

根 `package.json` 统一暴露以下命令；包级脚本可被根脚本转发，但不改变行为。

| 命令                | 行为                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`          | 并行启动 Vite `:8081` 与 Fastify `:8080`；不执行 migration 或 reset。            |
| `pnpm api:lint`     | 使用 `@redocly/cli` 解析并检查 OpenAPI 文档、引用和约定。                        |
| `pnpm api:generate` | 使用 `openapi-typescript` 更新 `packages/api-client/src/generated/schema.d.ts`。 |
| `pnpm typecheck`    | 对每个 workspace 包执行无输出的 TypeScript 类型检查。                            |
| `pnpm test`         | 运行 Vitest Contract Test。                                                      |
| `pnpm build`        | 构建前端并编译需要发布/运行的 TypeScript 工作区代码。                            |
| `pnpm db:migrate`   | 运行 Mock Server 的 Drizzle migration。                                          |
| `pnpm db:reset`     | 受控重置本地 Mock SQLite 数据库。                                                |

一个新环境的初始化顺序为：

```bash
pnpm install
pnpm api:lint
pnpm api:generate
pnpm db:migrate
pnpm dev
```

之后日常开发使用 `pnpm dev`。修改 API 时，顺序固定为：修改并 lint OpenAPI → 重新生成类型 → 实现 Mock Server handler → 使用共享 Client 调用 → 运行类型检查与 Contract Test。

## 11. 测试与校验策略

### 11.1 Contract Test

Vitest 通过 `createApp()` 创建真实 Fastify 应用，并请求 `GET /api/health`。测试断言：

1. HTTP 状态码为 `200`。
2. `content-type` 为 JSON。
3. 响应体满足 `api/openapi.yaml` 中 `HealthResponse` 的 JSON Schema，而非只比较手写对象。
4. 不包含 Contract 未声明的字段。

测试从 OpenAPI 3.1 文档加载其 Draft-07 兼容 schema，并使用与 Fastify 兼容的 Ajv 配置执行响应验证；测试 schema 的来源始终是 `api/openapi.yaml`。每次测试也会创建 Fastify app，因此不兼容的 schema 会在路由注册阶段失败。这共同捕获 handler 返回字段、类型或 schema 兼容性偏离 Contract 的问题。

### 11.2 其他检查

- `api:lint` 防止 Contract 无法解析、引用失效或违反项目规范。
- `api:generate` 的输出被 TypeScript 编译消费，确保前端和共享 Client 对真实 Contract 类型化。
- `typecheck` 覆盖 web、api-client 和 mock-server 的跨包类型边界。
- `build` 验证 Vite、SCSS 和前端依赖可以产出可部署构建。
- 没有业务时不创建虚假的业务单元测试、数据库种子测试或端到端场景。

## 12. AI 协作规则

`AGENTS.md` 记录并要求以下规则：

1. 不得臆造 endpoint、HTTP 方法、请求字段或响应字段。
2. 实现任何 API 调用前，必须读取 `api/openapi.yaml`。
3. API 变更先修改 OpenAPI；随后执行 lint 和类型生成。
4. 前端仅使用 `@workspace/api-client`，不直接调用 `fetch` 或本地复制 DTO。
5. Mock Server 只实现 Contract 中有 `operationId` 的接口，且 handler 不能自行新增 HTTP 路由。
6. Mock 数据仅位于本地 SQLite，不提交数据库文件。
7. OpenAPI 3.1 schema 必须保持在 Fastify Ajv 的 Draft-07 兼容子集；引入 Draft 2020-12 特性前必须先更新并确认运行时校验设计。
8. 破坏性 Contract 变更必须明确审查与版本化；首版不引入版本策略或兼容层。

## 13. 验收标准

完成脚手架后，以下事项必须成立：

1. 安装依赖、生成类型、执行迁移后，`pnpm dev` 同时启动 `http://localhost:8081` 前端和 `http://localhost:8080` Mock Server。
2. Vite 的 `/api` 请求可代理至 Mock Server；前端的开发期健康请求来自共享 Client，非原生 `fetch`。
3. `GET /api/health` 返回精确的 `200` JSON：`{ "status": "ok" }`，并由 OpenAPI 的 3.1 schema 定义和 Contract Test 验证。
4. `pnpm api:lint`、`pnpm api:generate`、`pnpm typecheck`、`pnpm test` 和 `pnpm build` 成功。
5. `pnpm db:migrate` 创建/升级固定 SQLite 文件；`pnpm db:reset` 只重建这个本地 Mock 数据库。
6. 前端拥有可编译的 React、SCSS、Valtio 与 Framer Motion 基础依赖，但没有未经需求确认的业务或演示功能。
7. `AGENTS.md` 能指导后续 AI 在 Contract-first 流程内扩展接口。

## 14. 实施顺序

1. 初始化 pnpm workspace、根配置、共享 TS 配置、忽略规则和 `AGENTS.md`。
2. 写入 OpenAPI 3.1 单文件、Redocly 配置和 API 类型生成脚本。
3. 建立 `api-client` 包，导出生成类型和 `createApiClient`。
4. 建立 Drizzle/SQLite 基线、迁移/重置脚本和 Fastify 应用。
5. 将 Contract handler 映射到 Fastify，添加健康检查和统一错误处理。
6. 建立 Vite React 空壳、SCSS 和 `/api` 代理，接入共享 Client 的开发期健康请求。
7. 编写 Contract Test，执行所有验收命令并修正问题。

## 15. 风险与后续演进

| 风险或边界                                | 处理方式                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| OpenAPI 与实现偏离                        | Contract 先行、OpenAPI Glue 路由注册、生成类型和真实 HTTP Contract Test 共同约束。                                |
| 随意重置数据                              | `db:reset` 使用固定路径且无路径参数；仅操作 mock SQLite 文件及其 SQLite sidecar 文件。                            |
| 未来 PHP 接管时产生前端重写               | 所有业务调用经共享 Client，API URL 由环境变量配置；PHP 必须按同一 Contract 实现。                                 |
| 过早预设业务模型                          | 首版只定义 `/health`；任何业务资源从 OpenAPI 开始，单独设计。                                                     |
| OpenAPI 文档复杂后难维护                  | 当前保持单文件；只在真实业务规模需要时拆分 `paths/` 和 `schemas/`，仍聚合为一个 Contract。                        |
| OpenAPI 3.1 与 Fastify 默认校验语义不一致 | 首版限制到 Draft-07 兼容子集，并由 Fastify app 创建和 Ajv Contract Test 同时验证；完整 2020-12 支持需要单独设计。 |

未来可以在不改变当前边界的情况下增加业务资源、认证、分页、过滤、文件上传、实时通信、PHP 合规测试与 CI；每项均应先扩展 Contract 并独立确认其设计范围。

## 16. 自审结论

- 无 `TODO`、`TBD` 或未决定的技术路线。
- Contract、Client、Fastify 与测试均以 `api/openapi.yaml` 为来源，不存在由实现反向定义 API 的路径。
- 文档范围仅覆盖通用骨架；未将认证、业务 CRUD 或 PHP 实现隐性带入首版。
- 数据库初始化、服务启动与重置行为已明确区分，避免启动期意外修改本地数据。
