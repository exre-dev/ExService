# 业务插件自动加载 RFC

- 日期：2026-10-11
- 状态：由用户已批准的设计派生，供实施；实现验收尚未执行。
- 设计来源：`.notes/server-plugin-autoload/specs/2026-10-11-business-plugin-autoload-design.md`。
- 批准依据：用户在修订设计独立复审通过后回复 `y`，确认该具体版本。
- 模块根目录：`.notes/server-plugin-autoload/`；RFC 目录：`.notes/server-plugin-autoload/rfcs/`。
- 本任务只在当前仓库本地处理，不使用 Monica。

## 决策与目标

以 `@fastify/autoload@6.5.1` 发现和注册公共模块、具体业务的业务插件。应用保持分阶段装配，HTTP 基础与统一 API 继续显式注册。通过具名注入、加载前预检、干净 Server 构建和可靠的启动失败清理，减少中央插件清单维护而保留现有运行边界。

新增只依赖已有能力的业务模块，只需增加自身入口、实现、声明和测试即可参与 boot，不增加中央名称清单。新增服务注入、配置、worker 或 HTTP operation 仍遵循现有应用组装和 Contract-first 工作流。本 RFC 不自动生成 API、改变业务对象创建职责、提供运行中插件安装，或接管 Outline。

外部契约保持：`createApp(options)` 同步返回 `FastifyInstance`，现有 `CreateAppOptions` 字段和必选关系不变；service decorator、HTTP 路径、请求字段作用域、OpenAPI、生成 Client、handler 类型、数据库模型和持久文件均保持现有契约。

## 实施涉及的文件

| 路径                                                                              | 实施职责                                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/server/src/business-services.ts`                                            | 提取已有业务服务类型及只读注入接口，不建立字符串服务字典                       |
| `apps/server/src/business-plugins.ts`                                             | 发现候选入口、检查 fp 元信息和依赖图，按阶段调用 Autoload                      |
| `apps/server/src/business-plugin-errors.ts`                                       | 固定错误分类及安全 formatter                                                   |
| `apps/server/src/app.ts`                                                          | 删除六个业务入口的显式 import/register，调用业务总入口，保留两项 HTTP 显式装配 |
| `apps/server/src/modules/{auth,profile,identity,storage,notifications}/plugin.ts` | 改为各模块自身的具名服务参数，保留 decorator 及 fp 名称/依赖                   |
| `apps/server/src/domains/join/plugin.ts`                                          | 具名注入 join 与 invitation 服务                                               |
| `apps/server/src/start-application.ts`                                            | 管理 app 创建、ready、listen、worker 与一次性资源清理                          |
| `apps/server/src/server.ts`                                                       | 准备资源后移交 helper；识别安全业务加载错误，保留已有配置与就绪检查            |
| `scripts/clean-server-build.mjs`                                                  | 固定目标、拒绝链接的 Server dist 清理                                          |
| `apps/server/package.json`、`pnpm-lock.yaml`                                      | 精确 Autoload 依赖与编译前清理接线                                             |
| `tests/server-plugins/`、`tests/server-types/types.fixture.ts`                    | 更新直接注册类型与 boot 测试，增加发现、失败清理和产物回归                     |

`http/plugin.ts`、`http/service-handlers.ts` 和所属模块 API 文件沿用现有装配；修改仅限必要的消费者适配，不启动 API 自动发现。服务核心不导入应用注入接口、加载器或 HTTP 类型。共享工作区修改和构建写入串行，实施前核对重叠改动并保留其他任务工作。

## 业务注入接口

`BusinessServices` 提取 `CreateAppOptions` 现有服务字段，由后者在类型上复用；不要改变调用方传参形状。所有字段在总接口中只读，但服务实例自身不冻结、不复制。

| 插件名                   | 自身 options 接口需要的字段                                          | decorator         |
| ------------------------ | -------------------------------------------------------------------- | ----------------- |
| `business-auth`          | `authServices: AuthService`                                          | `authServices`    |
| `business-profile`       | `profileServices: ProfileService`                                    | `profileServices` |
| `business-identity`      | `oidcServices?: OidcService`                                         | `oidcServices`    |
| `business-storage`       | `storageServices: StorageServices`                                   | `storageServices` |
| `business-notifications` | `notifications: NotificationModule`                                  | `notifications`   |
| `business-join`          | `joinServices: JoinService`、`invitationServices: InvitationService` | 两个同名字段      |

`app.ts` 仅选取这七个字段形成浅层只读快照。Autoload 的 `options` 指向这份快照，不包含 `identityKeys`、logger、代理、CORS 或进程环境。每个业务插件保留自身 options 类型，只读取自己拥有的具名字段。必需服务未提供时在插件入口明确拒绝 boot，固定校验文案只列字段名，不序列化参数对象。

OIDC 关闭时，identity 插件仍注册 `oidcServices` decorator，值允许为 `undefined`。直接调用业务插件的测试统一改用具名字段，不支持旧 `services` 参数分支。新增无需外部注入的模块可从已注册 decorator 获取依赖，再传给其普通工厂；service/factory 本身继续用构造参数接收直接依赖。

## 发现、预检和注册

### 阶段与作用域

`createApp()` 注册名称为 `application-business-plugins` 的 fp 入口，再注册 `httpFoundation` 和 `websiteApi`。业务入口依次完成：全部候选预检、公共模块 Autoload、具体业务 Autoload。阶段以 Fastify boot 完成为边界，不能并行触发两批注册。

业务入口与具体业务插件在应用作用域共享服务。Autoload 使用 `encapsulate: true`；具体业务插件必须已通过 fp 设置应用级共享，不统一关闭封装。`websiteApi` 保留 `encapsulate: true`，auth request 字段和归一化 hook 不进入根作用域。

### 候选集合

加载器以自身 `import.meta.url` 为基准，定位同层 `modules` 与 `domains`。源文件模式选择 `plugin.ts`，编译模式选择 `plugin.js`，不依赖 cwd，不跨模式回退。生产不扫描 `src`。

两个根目录及候选目录必须是普通目录；拒绝 symlink/junction 入口。根目录自身不允许 `package.json`；候选目录若有 package 文件，须为 ESM 或继承 Server ESM，不能声明 CommonJS。模块目录名为小写 kebab-case。

只发现直接子目录中的入口。没有任何业务入口的目录跳过；只有另一种扩展的目录不跨模式加载；同时存在 ts/js 入口时拒绝。`api/`、service、factory、测试和声明文件均不参与候选集合。每批候选按模块相对路径排序用于确定性诊断；排序不替代依赖图。

### Autoload 选项

| 选项                       | 约束                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `dir`                      | 当前批次的已验证根目录                                           |
| `maxDepth`                 | `1`，不进入模块内部子目录                                        |
| `indexPattern`             | 精确匹配当前模式的 `plugin.ts` 或 `plugin.js`                    |
| `matchFilter`              | 精确接受预检确定的相对入口集合，规范化路径分隔符                 |
| `ignorePattern`            | 按相对根目录首个路径段，仅允许本批候选模块目录，提前排除其他目录 |
| `dirNameRoutePrefix`       | `false`                                                          |
| `autoHooks`、`routeParams` | `false`                                                          |
| `forceESM`、`encapsulate`  | `true`                                                           |
| `options`                  | 本次应用的业务服务只读快照                                       |

`ignorePattern` 和 `matchFilter` 从同一集合派生，无候选时不调用该批 Autoload。带 `package.json` 的无入口目录必须在 Autoload 进入之前排除；不能依赖稍后发生的 `matchFilter`。不传自动前缀或额外 route 配置。

测试发现函数可接受测试拥有的根目录，但不将路径覆盖能力加入公开 `CreateAppOptions`，不从环境或请求读取插件位置。每次 boot 构造自己的集合和图，不缓存服务对象或 app。发现仅执行一次，新增模块后重启应用；跨平台 watcher 和热插拔不在范围内。

### 元信息和依赖图

按候选集合 import 所有业务入口，在任何业务插件初始化前完成预检。与随后 Autoload import 使用相同 ESM URL，利用缓存，避免两份过滤逻辑。

元信息读取集中在一个适配函数，匹配锁定 `fastify-plugin@6.0.0` 的 `Symbol.for('plugin-meta')` 及 `Symbol.for('skip-override')`。结构不符即拒绝，不降级加载。检查：

1. default 为函数，拥有 fp 元信息，且应用级共享行为成立。
2. name 为显式 `business-` 加小写 kebab-case，两个阶段名称全局唯一。
3. 未声明 dependencies 视为空数组；已声明时必须为字符串数组，目标名称合法且存在于这两批业务候选。
4. 公共模块只依赖公共模块；具体业务可以依赖公共模块或具体业务。整体无环。
5. ESM namespace 和 default 函数属性两处均不得配置 `autoload: false` 或非 undefined 的 `autoConfig`、`autoPrefix`、`prefixOverride`。

预检检查图的合法性；Autoload 排序同一批的注册，固定阶段处理跨批依赖。Fastify 继续验证 decorator 是否实际存在，不因名称存在而省略检查。禁止业务模块依赖 API 或 HTTP 基础插件。

入口 import 本身只进行声明，不连接数据库、写文件、启动 worker 或监听。这个约定由代码审查和 import 哨兵测试验证，加载器不宣称能沙箱化任意模块顶层副作用。

## 错误与启动输出

`BusinessPluginLoadError` 只携带固定 code 与白名单上下文。内部 code 细化如下，不属于 HTTP Contract：

| code                                           | 触发                                             |
| ---------------------------------------------- | ------------------------------------------------ |
| `BUSINESS_PLUGIN_ENTRY_CONFLICT`               | 候选目录同时出现两种入口扩展                     |
| `BUSINESS_PLUGIN_INVALID_ENTRY`                | 非法目录、包类型、导出、元信息、配置或目录读失败 |
| `BUSINESS_PLUGIN_DUPLICATE_NAME`               | 跨两个业务根目录重复 name                        |
| `BUSINESS_PLUGIN_MISSING_DEPENDENCY`           | 已声明目标不存在                                 |
| `BUSINESS_PLUGIN_INVALID_DEPENDENCY_DIRECTION` | 公共模块依赖具体业务                             |
| `BUSINESS_PLUGIN_CYCLIC_DEPENDENCY`            | 业务依赖环                                       |
| `BUSINESS_PLUGIN_IMPORT_FAILED`                | 指定候选入口 import 失败                         |
| `BUSINESS_PLUGIN_BOOT_FAILED`                  | 必需服务缺失，或未知的业务注册/初始化异常        |

非法 dependencies 类型归入非法入口。定位上下文限于已验证的插件名、依赖名、模块相对位置、`modules`/`domains` 阶段，以及必需服务缺失时的 `missingServiceFields`；不合语法的名称不回显。禁止将底层异常的 message、cause、stack 或对象转成对外文案。

业务插件入口发现必需字段为 `undefined` 时，通过共享安全错误工厂抛出 `BUSINESS_PLUGIN_BOOT_FAILED`，携带已验证插件名和 `missingServiceFields`。后者在类型上限定为 `keyof BusinessServices`，运行时也只允许上表七个字段名；错误工厂与 formatter 均按此白名单校验，不序列化服务值。formatter 对这种已知错误输出固定缺失服务文案及字段名，未知 boot 异常只输出固定批次失败文案。Autoload 边界保留已识别的安全错误及字段上下文，不重新包装丢失字段；所有分支都不读取原始异常消息。业务插件自身 options 仍保持独立类型，普通 service/factory 不依赖该错误工厂。这是缺失检查的诊断契约，不增加运行时服务对象形状校验。

目录/import 异常在边界处包装；Autoload 注册阶段未知异常包装为对应批次 boot 失败，自定义安全错误保持原分类。formatter 由 code 选择固定文案，不能使用继承的 `Error.message` 作为模板。

`server.ts` 顶层在通用数据库错误分支前识别该类型并调用同一个 formatter，确保插件错误不再变成迁移提示。Identity/Storage/CORS 原有安全分支保持。其他异常仍沿用现有未知异常策略。debug 日志仅可包含已验证的插件名及数量。

## runtime 生命周期与所有权

`startApplication()` 是仅处理启动与回收的 helper，输入为 app 创建函数、runtime 拥有的数据库、Fastify 监听配置、通知 worker 启动函数、可选 outbox 启动函数，以及输出固定清理失败提示的回调。返回 `Promise<FastifyInstance>`。它不读取环境、打开数据库或构造业务服务；worker 启动函数使用现有同步返回 stop handle 的接口。

`server.ts` 先在准备 try/catch 中完成数据库验证、配置和所有业务对象准备。准备失败由该 catch 关闭数据库并保留原始准备异常。helper 调用放在该准备 try/catch 之外：从调用时开始，helper 接管 app 创建、监听和数据库关闭，顶层 catch 只报告错误。

启动次序为 app 创建、安装 `onClose`、`await app.ready()`、`await app.listen()`、启动 projection、启动可选 outbox。每个 stop handle 在其启动函数返回时立即保存。ready 或 listen 失败不启动任何 worker；后一个 worker 启动失败则停止前一个，并关闭已监听 app。

helper 内部每个 runtime 只有一个清理 promise，由 close hook 与失败 catch 共同使用。它逐个尝试 stop handles，然后尝试关闭数据库，任何一步抛错也继续后续步骤。即使发生重入或并发关闭，数据库也只关闭一次。不得在上层 catch 再调用 `pool.end()`。

任何启动失败都先尝试 `app.close()`（若 app 已创建），再在 finally 中等待同一个资源清理 promise，以覆盖 hook 未安装或未运行的情况。清理失败只调用固定提示回调，不回显异常对象，也不取代首次启动异常。app 创建函数同步抛错仍关闭数据库；成功返回后，调用方通过 `app.close()` 触发同一清理。

普通注入测试的 `createApp()` 不使用这个 runtime helper，app 自身仍不关闭外部数据库。worker 的认领、重试、lease 算法和 stop API 不变。此处只改变 runtime 启动时机和失败清理。

## 构建一致性

Server 精确增加 `@fastify/autoload@6.5.1` 直接依赖，通过 pnpm 生成 lockfile。保留现有 Fastify 和 `fastify-plugin` 版本，避免顺带升级。

`scripts/clean-server-build.mjs` 只清理 Server 包固定的 `dist`，不接受路径参数。以脚本位置解析 Server 包根目录，删除前验证绝对目标位于该包内并且就是其 `dist`；通过 lstat 拒绝目标 symlink/junction，缺失目标视为无需清理。验证或删除失败立即停止构建。不会触及 `data`、环境文件、数据库、Outline 或其他 package 的输出。

Server build 的顺序为 Contract 生成、固定 dist 清理、`tsc`、现有 alias 重写。清理放在 Server 自己的 build 中，使直接过滤构建和根 build 都生效。重建删除/重命名后的模块时，旧入口不得残留并再次注册。

生产 start 只消费已有编译产物，构建失败不启动不完整输出。此改造不新增 runtime 文件生成、隐式迁移或部署动作。

## 验收与实施顺序

作为一个相互配套的改造交付，不能先落扫描后补构建清理。先落实内部具名参数、元信息适配和失败分类，再完成业务发现/注册与 runtime 清理，最后接入依赖、干净构建和编译环境验证。步骤是本 RFC 的依赖顺序，不是独立的实现计划或 Git 提交授权。

| 证据组         | 必需验证                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 发现           | 新入口无中央登记即可提供 decorator；无入口目录（含 package 文件）跳过；根目录 package 文件拒绝；排除文件 import 哨兵不执行                                     |
| 模式和文件系统 | ts/js 双入口拒绝、无跨模式回退、任意 cwd 下路径一致、链接根/候选拒绝、候选 CommonJS 包拒绝                                                                     |
| 图和元信息     | 同批乱序成功、跨批合法依赖成功，重复/缺失/循环/反向依赖失败；namespace/default 两处违规均失败；无 dependencies 的现有入口正常加载                              |
| 注入和隔离     | 运行时拒绝必需服务字段为 undefined；OIDC undefined 保持；两个 app 的服务身份独立；app 不关闭注入资源                                                           |
| HTTP 回归      | 根作用域无 API 字段/hook；完整路由集合、隐式 HEAD、重复 operation、覆盖检查与原始 handler 输出保持                                                             |
| runtime 失败   | 准备失败、createApp 抛错、ready/listen 失败及第二个 worker 失败；监听关闭、stop 调用、数据库单次关闭；清理失败不遮盖原错误；子进程非零退出，无持续 worker 重试 |
| 安全诊断       | 插件分类及缺失服务的白名单字段名到达实际启动输出；带秘密哨兵的 import/boot/cleanup 异常不出现在日志中；非法名称及非法服务字段名不回显                          |
| 构建           | 删除/重命名前后重建，旧入口消失；data/环境哨兵保留；dist 链接与清理失败拒绝；根/独立构建均先清理                                                               |
| 实际执行环境   | Vitest、开发 tsx、编译 JS 无 TS loader 三种路径实际 boot，覆盖动态 import 和 alias                                                                             |

已有直接 Fastify 乱序注册失败用例保留；它与经过 Autoload 的乱序成功用例验证不同路径。更新 `tests/server-types/types.fixture.ts`，保留完整声明图、精确 decorator/handler 类型及错误参数编译失败的检查。服务参数错类型由这些 TypeScript 编译检查拒绝，与运行时必需字段缺失检查分别验收。

优先运行已有插件用例及新增发现、启动和构建回归，再执行 `pnpm typecheck`、`pnpm test`、`pnpm build`。现有插件命令为 `pnpm exec vitest run tests/server-plugins/boot.test.ts tests/server-plugins/declarations.test.ts --maxWorkers=2`。需要数据库的回归继续使用 Testcontainers 与隔离 schema，Docker 不可用明确失败。

编译 boot 使用假服务、临时目录、拒绝查询的数据库替身和随机本机端口，不启动携带开发配置的真实 `server.ts`。启动失败测试调用生产 helper 与 formatter；至少一项子进程验证实际退出，不能只断言 promise reject。真实启动输出的接线也须验证，不能只测一个未被入口调用的 formatter。

所有临时目录由用例创建并核对清理范围。运行涉及输出目录的用例与实际 build 时串行，避免与其他任务互相覆盖。代码实施后做独立复审，再收集最终退出码和适用验证；自动测试、浏览器和部署结果分开报告。

## 风险、备选方案与回退

| 风险                                  | 控制与检测                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| 目录存在就参与启动，误加载未完成模块  | 只有约定入口参与；元信息预检、import 哨兵和代码审查；不把目录存在视为完整业务上线 |
| Autoload 同名元信息覆盖               | 进入任何 Autoload 前做跨批唯一性检查                                              |
| 元信息适配依赖 fp 内部结构            | 单一适配器、精确依赖版本与升级回归；结构异常拒绝启动                              |
| 动态 import 在测试或产物中不同        | 工程实际三种环境验证，保留 API 静态 handler 类型                                  |
| 已删除产物仍参与加载                  | 每次 Server 构建先清理，删除/重命名回归                                           |
| boot 失败遗留 worker 或重复关闭连接池 | 监听成功后启动、单 owner、共享清理 promise、子进程失败退出证据                    |

保留显式注册仍可行，当前成本较小，但不满足用户已确认的插件清单维护目标。构建时生成静态注册适合将来同时汇总有类型的 operations，此轮引入会增加不必要的生成/监听流程。

回退时恢复显式业务 import/register、内部 options 和相应测试，执行干净重建。业务数据、HTTP Contract 和持久文件没有迁移，不需要数据回滚。不得以混合旧输出作为兼容层；构建清理可以独立保留。若退回启动接线，仍需明确该版本的失败清理证据，不能默认原有数据库 catch 足够。

## 交付与剩余验证

本 RFC 忠实细化已批准设计，没有需要重新选择的架构分支或数据决定。具体错误 code、未声明 dependencies 归一为空数组、helper 清理提示回调属于该方案的实现契约。

当前产物为本地、未提交的设计与 RFC。未修改生产实现、安装依赖、执行 boot、运行测试或 build，不声明运行验收通过。下一执行者依据本 RFC 实施，并保留当前工作区已有修改。提交、推送和发布需要已有明确授权；本阶段不部署上线。

相关工程知识以 `.ai/architectures/server/request-lifecycle.md`、`.ai/architectures/contract-tests/test-layers.md`、`.ai/knowledge/server/operation-registration-gaps.md` 为准；实现完成后再按工程规则更新经验证的长期知识，不提前把本 RFC 的目标记为现有行为。

外部依赖的发布包依据及目录加载说明见批准设计的外部参考。实施时以精确锁定版本回归，不把上游兼容声明当作本工程的测试结果。
