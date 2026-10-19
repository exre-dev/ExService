# 普通 pnpm dev 的公共文档与统一身份设计

日期：2026-10-04。

状态：交互设计已确认，书面规格待用户审阅；尚未实施或完成运行验收。

模块根目录：`.notes/archive/docs-integration/`。后续 RFC 目录：`.notes/archive/docs-integration/rfcs/`。

## 1. 问题与已确认范围

用户在 `http://127.0.0.1:8080/` 登录后，进入 `http://127.0.0.1:8080/docs/` 仍看到 Outline 的“Continue with Email”。普通开发入口当前只代理 Outline，没有建立统一身份和公共目录流程。

本轮已确认：普通 `pnpm dev` 应提供完整的公共阅读与 Website 身份复用，继续使用上述入口和热更新。保留 Website 当前账号数据库；将现有 Outline 集成实现与当前开发版本衔接；配置、迁移、首个文档管理员初始化均由显式准备命令执行。

本规格补充 `.notes/archive/docs-integration/specs/2026-09-30-docs-integration-design.md`，改变其中普通开发入口不启用完整集成的边界。身份、公开授权和会话撤销继续沿用原设计，以及 `.notes/archive/docs-integration/rfcs/identity-and-session-lifecycle-rfc.md`、`.notes/archive/docs-integration/rfcs/outline-public-access-rfc.md`。本轮不新增身份协议，也不改变文档角色模型。

确认范围为一个完整的本地开发流程：启动与准备、固定入口配置、Outline 集成衔接、访客阅读、自动登录、退出与权限边界及浏览器验收。公网部署、旧 Outline 工作区迁移、React 升级、认证重写、开放客户端注册和无关 UI 改造不在范围内。

## 2. 经源码核对的现状

- `package.json` 与 `scripts/dev-app.mjs` 启动 Website Web、Server 和普通 Outline `dev:watch`。Website 入口为 8080，Vite 为 8081，API 为 8082；`apps/web/dev-entry.ts` 与 `apps/web/vite.config.ts` 提供开发代理。
- 完整集成编排位于 `scripts/docs-integration/command.mjs`，使用 `dev:watch:integration` 和集成环境配置，公共入口为 `http://exwebsite.test:8090`。
- Website 已有 `apps/web/src/pages/IdentityPage/IdentityStatusPage.tsx` 和 `apps/web/src/pages/IdentityPage/OidcPage.tsx`，分别检查主站会话及通过生成 Client 完成 OIDC challenge。身份 HTTP operation 已在 `api/openapi.yaml` 中声明。
- 已交付的 Outline 集成代码包含 `apps/outline/app/scenes/WebsitePublic.tsx`、`apps/outline/app/components/WebsiteSessionProbe.tsx`、`apps/outline/server/commands/publicAccess.ts` 及会话核验实现；当前开发检出缺少这些集成能力，不能仅靠代理复用主站身份。
- `apps/server/src/server.ts`、`scripts/docs-integration/hydra-client.mjs`、集成版 `apps/outline/server/identity/websiteOidc.ts` 和 `apps/outline/server/scripts/integration-bootstrap.ts` 存在固定 8090 入口或 issuer 的假设，必须一致调整。
- 集成 bootstrap 要求空的 Outline 工作区数据库，或与已有 issuer 和初始管理员一致的集成记录；普通旧工作区不能直接初始化为该集成工作区。

这些是源码证据；本轮尚未获取已登录浏览器的实际请求链路，不能据此宣称运行问题已经解决。

## 3. 方案选择

采用既有 OIDC 集成，增加一致的普通本地开发配置，使 `pnpm dev` 成为完整流程的启动入口。

另一个可行方案是为普通开发模式单独实现身份桥接。它会产生第二套登录、会话关联和撤销实现，也无法自动获得已有公共授权能力，因此不采用。

直接把 `pnpm dev` 重定向到现有 8090 集成入口不满足要求：8080 与 8090 的浏览器 origin 不同，现有 localStorage 会话不会自动共享。必须让主站页面、身份适配 UI 和文档页面继续位于 8080 的同一 origin。

## 4. 启动与配置边界

### 4.1 启动契约

完成一次显式准备后，用户运行一个 `pnpm dev` 即可启动 Website、Outline 以及配置所需的本地身份服务，保留前后端热更新。无需另开 `integration:dev` 才能获得已确认行为。

启动编排先验证配置、依赖能力和准备状态，再启动所管理的进程与服务。缺少配置、数据库迁移、OIDC 客户端或工作区初始化时，明确指出缺失项和相应准备命令，不退回原生 Outline 邮箱登录。

`pnpm dev` 不创建数据库、不执行 migration/reset、不登记新客户端、不创建管理员。它可以启动已经准备好的基础服务；启动不应通过数据库容器首次初始化来隐式完成数据库准备。服务已存在时核对身份和配置后复用；模式或端口冲突则报错，不停止无关进程。

退出时终止本次管理的应用进程并释放运行记录；不删除持久卷、附件、头像或数据库，不停止此前独立运行的外部服务。

### 4.2 地址与身份配置

默认公共 Website origin 固定为 `http://127.0.0.1:8080`，文档挂载点为 `/docs`。Website 身份适配页面、OIDC 回调、退出回跳、状态探测和附件公开地址都从同一份经过校验的配置派生。

Hydra issuer 使用预先配置的固定绝对根 URL，须从浏览器和宿主机应用均可达；不能从请求 Host 或任意转发头推导，也不能将 `/docs` 当作 issuer 路径。具体身份服务端口和 Compose 覆盖文件由后续 RFC 固化，要求不依赖新增系统 hosts 项即可使用默认入口。

Website Server、Outline OIDC 验证、Hydra 自我声明和客户端登记必须使用同一个 issuer；客户端回调精确匹配 `http://127.0.0.1:8080/docs/auth/oidc.callback`。客户端继续受控登记，不增加任意回调或宽泛通配授权。

现有 8090 完整容器和集成开发模式保留。8080 配置不能默默改写其 issuer、工作区标记、客户端或持久数据。已有集成记录与所选配置冲突时要求显式处理；不迁移或重写旧 issuer/sub 关联。

用户通过默认 8080 地址登录和访问文档。`localhost`、8081 或其他 origin 上的既有会话不作为默认入口的登录依据；不通过复制浏览器 token 实现跨 origin 登录。

### 4.3 代理与子模块

保留现有开发代理职责，并补齐集成约束：`/api` 交给 Website，`/docs` 及其静态资源、回调、附件和实时连接交给对应 Outline 服务。内部身份和管理路径不得从公共代理访问；CSRF Cookie、Origin 校验和前缀规则沿用既有集成契约。

将既有 Outline 集成实现与当前开发版本合并衔接，保留当前样式、Logo 返回主站、挂载工具和热更新修正。不能用重置或整库覆盖代替衔接。Outline 继续使用 Yarn、自己的版本历史和数据库，Website 继续使用 pnpm；不将 Outline 纳入 Website workspace。

## 5. 用户访问与会话流程

| 情况                                | 预期行为                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 未登录访问 `/docs/`                 | 展示公开空间目录和统一登录入口，不展示独立邮箱登录表单。没有公开内容时展示空状态。                      |
| 未登录访问公开文档                  | 直接阅读当前已发布内容，保留搜索、导航和安全的附件读取能力。                                            |
| Website 已登录，Outline 尚无会话    | 同源状态探测确认主站身份后自动发起 OIDC，完成后回到原目录或文档，不再次要求输入密码。允许短暂整页跳转。 |
| Website 和 Outline 均有有效关联会话 | 按现有文档授权直接进入，不重复发起登录。                                                                |
| 未登录访问需要身份的入口            | 使用 Website 统一登录，成功后恢复经过校验的原文档路径。                                                 |
| 主站会话无效                        | 按匿名身份继续公开阅读；需要身份的操作要求统一登录。                                                    |
| 身份服务运行中不可达或超时          | 公共阅读继续；受保护操作显示可重试的服务不可用状态，不循环跳转或伪造登录成功。                          |

公共页复用 `WebsiteSessionProbe` 和同源 `/identity/status`。探测仅交换带 nonce 的粗粒度状态，校验 origin、source 和 nonce；不交换 Bearer、用户资料或 OIDC token。探测最多等待一秒；每次导航最多自动尝试一次，失败后保留公共页与手动登录入口。

OIDC challenge 仍由 Website 前端通过 `@workspace/api-client` 验证本地 Bearer，由 Server 接受；Outline 经已验证 issuer/sub 与本站会话建立关联，不以邮箱自动合并账号。已有主站会话只解决身份，不赋予额外文档权限或管理员身份。

Website 或 Outline 退出应撤销当前浏览器的关联会话；其他设备继续有效。账号切换不能继承旧 Outline 身份。受保护 HTTP 请求同步核验主站会话，实时连接沿用最多五秒内停止受保护操作的目标，匿名阅读不依赖此核验。

## 6. 数据与首次准备

Website 继续使用当前已配置的独立 `exre` 数据库、账号和头像目录，不因普通开发集成改用另一套空的 Website 数据库。必要 migration 由显式命令执行。

Outline 文档、附件及身份记录仍属于独立的 `outline` 数据库与存储；Hydra 使用自己的数据库。显式配置核对连接目标，不能修改 Website 业务库来保存 Outline 文档。

首次准备采用现有配置、初始化、迁移和 bootstrap 命令体系，增加普通开发配置的选择能力。命令名称、参数和执行顺序由后续 RFC 固化，不在实现中隐式调用旧初始化命令并切换 Website 数据源。

若所选 Outline 库已经符合本地集成配置，可复用；若是普通旧工作区或 issuer 不匹配的既有集成库，保留其全部数据，要求显式选择并准备独立的集成目标。旧工作区迁移不包含在本轮，也不能清库获得空库。

首个文档管理员由用户显式指定一个存在且启用的 Website 账号。普通首次访问不能抢占管理员；重复准备应幂等，参数冲突明确报错。应用启动读取并核对已准备的记录。

## 7. 实现边界

本轮主要涉及 `package.json`、`scripts/dev-app.mjs`、`scripts/docs-integration/`、`compose.yaml` 及必要的模式覆盖配置，Website 开发代理和 `apps/server/src/server.ts` 的身份配置，以及 Outline 集成代码与普通开发配置的衔接。

优先复用已有 `/auth/oidc/*`、内部 session check、Identity 页面和公共阅读实现。预计不新增 Website HTTP operation；实际发现 Contract 必须调整时，先按 `api/openapi.yaml` 的 Contract-first 流程设计、生成并验证，不能添加旁路路由或手写生成类型。

不在设计阶段修改 `.ai/` 已记录的现状。实施并验证后，再依仓库规则更新证据支持的运行与身份边界。设计与 RFC 保留在本模块目录。

## 8. 验证与验收

先按 `TESTING.md` 及 Outline 自身测试约定执行适当自动检查；测试数据库使用隔离容器，不回退本机开发数据库。启动和配置测试应证明 origin/issuer/回调一致、准备缺失时拒绝启动、不会隐式迁移或替换数据源、模式冲突和退出清理边界。

身份与公共阅读测试覆盖状态探测、challenge 验证、原路径恢复、一次自动尝试、权限和依赖失败。随后用真实 `pnpm dev` 入口完成以下浏览器验收：

| 编号 | 场景及通过条件                                                                   |
| ---- | -------------------------------------------------------------------------------- |
| D01  | 清洁浏览器未登录打开 `/docs/`，看到公共目录或空状态，无原生邮箱登录墙。          |
| D02  | 在 8080 主站登录后进入 `/docs/`，无需重复输入密码，文档显示相同关联身份。        |
| D03  | 已登录直接访问公开文档深链接，自动关联后回到同一文档；刷新有效。                 |
| D04  | 匿名可读取公开已发布内容和合法附件；私有空间名称、草稿和私有附件不可见。         |
| D05  | 从主站或文档退出，当前浏览器受保护操作失效；另一设备仍有效，公共页仍可阅读。     |
| D06  | 文档服务运行中停止身份服务，公共阅读继续，受保护操作失败且无自动登录循环。       |
| D07  | 重启 `pnpm dev`，账号、文档、附件及配置保留；热更新、HMR、两类实时连接路径有效。 |
| D08  | 无效准备、已有普通工作区或 issuer 冲突得到明确提示，原数据保持不变。             |
| D09  | 切换账号后不再使用旧文档身份；旧会话撤销后实时受保护操作最多五秒内停止。         |

分别报告 PASS、FAIL、BLOCKED、NOT_EXECUTED。单测、构建和 Mock 通过不能替代浏览器验收。现有 8090 模式需完成受配置修改影响的回归验证；不扩大为公网验收。

## 9. 风险、落地与回退

主要风险是合并时丢失已有 Outline 修改、遗漏固定 8090 字符串、不同 issuer 共用错误工作区、启动时意外替换 Website 数据源，以及自动登录失败形成循环。对应控制为按模块衔接、配置集中校验、持久记录一致性检查、准备与运行分离，以及有上限的状态探测和浏览器负向验收。

实施顺序为 Outline 集成衔接与配置统一、显式准备适配、普通开发编排接入、身份和公开阅读联调、自动检查与浏览器验收。后续以一个 RFC 承载完整流程，不为每个端口或页面拆分独立项目。

回退代码和启动配置时保留已产生的数据库、账号关联、附件及密钥；不执行破坏性数据库回退，也不自动把集成工作区切回原生宽松认证模式。配置不兼容应停止相应服务并给出恢复步骤。

## 10. 自审与后续交接

已核对本规格与现有身份、公共授权和数据库边界一致；明确默认 origin、访客与登录行为、故障处理、数据保留和验收条件。无未完成占位项；本轮范围为单一普通开发集成流程。

用户审阅并批准本文件后，调用 `technical-design-doc-creator`，以本文件为来源，在 `.notes/archive/docs-integration/rfcs/` 编写一个实施 RFC。RFC 固化运行端口、受控配置来源、准备命令及参数、模式隔离、具体改动边界和验证步骤，保留本规格与既有三份 RFC。

本设计阶段不修改实现、不提交或推送；未获得提交授权。
