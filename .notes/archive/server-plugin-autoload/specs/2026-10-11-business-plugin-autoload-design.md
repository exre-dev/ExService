# 业务插件目录自动加载设计

- 日期：2026-10-11
- 状态：用户已确认业务插件自动加载的范围；本文件细化注入、加载和验收契约，供具体版本审查。
- 模块根目录：`.notes/server-plugin-autoload/`
- 交付方式：当前仓库本地设计与评审，不进入 Monica。

## 决策与范围

使用 `@fastify/autoload` 自动注册 `apps/server/src/modules/<module>/plugin.ts` 和 `apps/server/src/domains/<domain>/plugin.ts`。编译产物中对应加载 `plugin.js`。`apps/server/src/app.ts` 只表达业务加载阶段、HTTP 基础和统一 API 的装配顺序。

本轮包含业务入口发现、具名服务参数、启动前元信息检查、安全启动诊断、启动失败清理、Server 构建清理，以及源码和编译产物的验收。保留 `CreateAppOptions` 的调用形式、同步返回实例的 `createApp()`、服务 decorator 名称、资源所有权和 HTTP 行为。

`apps/server/src/http/foundation.ts` 与 `apps/server/src/http/plugin.ts` 继续显式注册。API 插件和 `serviceHandlers` 继续显式汇总；不改变 OpenAPI、生成 Client、业务 service/factory、数据库模型、worker 业务算法或 Outline。`server.ts` 的必要调整限于固定分类诊断和准备失败资源回收，worker 由 runtime 在监听成功后启动。不会把业务对象创建移入自动加载入口，也不引入运行中插件安装或卸载。

新增只依赖已有能力的业务插件，可以仅增加自己的入口、实现、声明与测试。新增外部配置或注入服务时，仍须更新应用服务组装及相应类型；新增 HTTP operation 时，仍须按现有 Contract-first 流程维护 API 汇总。自动加载承诺减少插件注册清单，不承诺取消所有应用接线。

## 现有证据

- `apps/server/src/app.ts` 显式注册六个业务插件，各自接收不同内容的 `services`；随后注册 HTTP 基础与 API 总入口。
- `apps/server/src/modules/identity/plugin.ts` 声明依赖 `business-auth` 和 `authServices` decorator。现有业务插件均由 `fastify-plugin` 包装。
- `apps/server/src/http/plugin.ts` 使用 `encapsulate: true`；内部 API 插件共享 request 字段，检查 Contract 覆盖后注册一次 Glue。
- `apps/server/src/http/service-handlers.ts` 保留每个 handler 的具体类型，并拒绝重复 operation；Contract 测试直接调用该映射。
- `apps/server/src/server.ts` 负责资源创建、准备检查、worker、监听和关闭。当前插件只接入已创建对象，但通知 worker 在监听前启动，失败 catch 只关闭数据库；通用 catch 会将插件错误变成数据库准备提示。这两点需要随本轮改造补齐。
- `apps/server/package.json` 与 `scripts/runtime/build.mjs` 的 Server 构建没有清理旧 `dist`。`apps/server/tsconfig.json` 编译整个 `src`。
- `scripts/runtime/server.mjs` 的开发入口为 `node --import tsx --watch src/server.ts`。
- `tests/server-plugins/boot.test.ts` 验证业务注入、缺失依赖、直接注册乱序失败、API 字段隔离、完整路由集合及重复 operation。
- `tests/server-types/types.fixture.ts` 直接使用业务插件 options 类型，须同步调整具名参数断言。

本次通过 npm registry 只读核对，`@fastify/autoload` 候选版本为 `6.5.1`；已读取该版本发布包及 `fastify-plugin@6.0.0` 发布包。前者读取 `Symbol.for('plugin-meta')`，按插件名存储元信息并排序；同名元信息可能覆盖。后者在同一 symbol 上保存 name/dependencies，并通过 `Symbol.for('skip-override')` 表达封装行为。读取发布包不等于真实工程兼容性验收。

## 装配与边界

应用装配顺序固定为：

1. `createApp()` 创建 Fastify 实例，取得只含业务服务字段的注入快照。
2. 在业务加载插件内发现并预检两个根目录的全部候选入口。
3. 加载公共 `modules` 业务插件，完成这批注册。
4. 加载具体 `domains` 业务插件，完成这批注册。
5. 显式注册 `httpFoundation`。
6. 显式注册 `websiteApi`；其内部保持现有 hook、API 插件、覆盖检查和 Glue 顺序。

`apps/server/src/business-plugins.ts` 是应用装配层的加载入口，使用名为 `application-business-plugins` 的 `fastify-plugin`，保持应用作用域可见性。该入口可以包含发现和预检辅助函数，不创建另一套插件框架。

Autoload 负责同一批业务插件的依赖排序。预检只检查声明和图的合法性，不实现另一套注册排序。公共模块可以依赖公共模块；具体业务可以依赖公共模块或同批具体业务；公共模块不得依赖具体业务。两批间由固定阶段顺序保证，不能依赖两个 autoload 调用之间的自动排序。

业务插件继续使用 `fp` 在应用作用域暴露服务。Autoload 保持 `encapsulate: true`，由每个业务入口自身的 `fp` 决定跨封装可见性；不通过全局 `encapsulate: false` 改写所有插件行为。HTTP 总入口仍使用自己的封装作用域，业务扫描不包含任何 API 插件。

每次应用启动使用独立的发现结果、图与注册状态。模块顶层不得保存本次服务对象或应用实例；多个 `createApp()` 实例的注入对象必须互不污染。

## 服务注入契约

在 `apps/server/src/business-services.ts` 提取现有业务服务类型，定义 `BusinessServices`。`CreateAppOptions` 在类型上复用该接口，保留现有字段及必选/可选关系；调用方继续传当前扁平对象。

加载器向业务插件传递一个仅包含以下服务字段的浅层只读快照。不会把 `identityKeys`、logger、CORS、代理或整个运行配置传给所有业务插件。快照保留服务对象身份，不冻结或复制服务实例。

| 业务入口      | 插件 options 中使用的具名字段        | 提供的 decorator                     |
| ------------- | ------------------------------------ | ------------------------------------ |
| auth          | `authServices`                       | `authServices`                       |
| profile       | `profileServices`                    | `profileServices`                    |
| identity      | 可选的 `oidcServices`                | `oidcServices`                       |
| storage       | `storageServices`                    | `storageServices`                    |
| notifications | `notifications`                      | `notifications`                      |
| join          | `joinServices`、`invitationServices` | `joinServices`、`invitationServices` |

各业务插件 options 接口只声明自身需要的具名字段，不导入 `CreateAppOptions` 或应用服务总接口，不依赖全局字符串服务字典。入口读取的必需服务缺失时拒绝 boot，使用固定诊断及字段名，不输出对象或配置值。identity 的 `oidcServices` 保持可选；关闭 OIDC 时仍创建值为 `undefined` 的 decorator，与现有行为一致。

这种方式调整了六个内部业务插件 options 接口。直接注册的 boot 测试与类型 fixture 一并更新。业务 service 方法、构造注入、应用调用接口、HTTP DTO 与 handler 类型均保持现有契约，不增加旧 `services` 参数兼容分支。

## 发现契约

- 根目录从加载器自己的 ESM URL 解析，随源码或编译产物所在位置选择对应 `modules`、`domains`，不依赖 cwd 或固定指向源码。
- 仅检查两个根目录的直接子目录，模块名使用小写 kebab-case。只接受对应运行模式的单个 `plugin.ts` 或 `plugin.js`。
- 同一候选目录同时存在两种入口扩展时拒绝；不在不同运行模式间回退。不加载声明文件、测试、其他脚本或模块内部子目录。
- 没有业务入口的目录跳过，例如当前 `domains/community`；不为其制造空插件。
- 根目录与候选目录必须是普通目录，不接受符号链接或 junction 入口；发现和 Autoload 使用同一已验证候选路径集合。两个扫描根目录本身不允许包含 `package.json`，避免改变其加载和包类型语义；候选目录内的 package 类型须为 ESM 或继承 Server 的 ESM，不能自行定义 CJS 业务入口。
- 候选路径排序后交给预检，避免诊断随文件系统枚举顺序变化。这个排序不替代依赖排序。
- Autoload 使用 `maxDepth: 1`、业务入口 `indexPattern`、候选集合的 `matchFilter`、`dirNameRoutePrefix: false`、`autoHooks: false`、`forceESM: true`。另从同一候选集合生成 `ignorePattern`：按相对于扫描根目录的首个路径段，只允许已验证候选目录，阻止进入其他目录。没有候选时跳过该批 Autoload。这样无业务入口但含 `package.json` 的目录也能跳过，不能仅依赖发生在目录解析之后的 `matchFilter`。不启用目录路由参数、自动 hook 或自动前缀。
- 生产只扫描编译目录，开发只扫描源码目录。测试辅助函数可以接受测试拥有的目录；这个能力不加入公开 `CreateAppOptions`，也不从环境、HTTP 或用户数据读取插件路径。

自动发现只在 Fastify boot 执行一次。新增模块后重新启动应用才属于本轮保证；当前 Node watch 对新文件的监视行为不作为保证，也不为这次改造重写跨平台 runtime watcher。

## 加载前检查与失败处理

在调用任何 Autoload 之前，按候选集合 import 两批业务入口，取得 default 插件函数并检查元信息。Autoload 后续 import 同一 ESM URL，利用模块缓存；两个步骤不能使用不同过滤规则。

所有候选必须：

1. default 导出为函数，具有 `fastify-plugin` 元信息和应用级共享行为。
2. 使用显式的 `business-` 命名空间插件名，后缀为小写 kebab-case；两个根目录合并后名称唯一。
3. dependencies 为字符串数组，依赖都能在这两批业务候选中找到，满足公共到业务的依赖方向限制且无循环。
4. 同时检查 ESM namespace 的具名导出和 default 函数属性，不允许任何一处设置 `autoload: false`、非 undefined 的 `autoConfig`、`autoPrefix` 或 `prefixOverride`，避免静默跳过、另一份注入参数和隐式路由配置。

预检通过才允许 Autoload 注册。decorator 是否实际提供仍由 Fastify 检查，元信息不能替代运行时 decorator 依赖验证。缺入口导致已声明依赖缺失时必须失败，不能跳过该依赖继续启动。

元信息读取集中在加载入口一个适配函数内，不散布到业务代码；这是对锁定 `fastify-plugin@6.0.0` 的有限内部结构依赖。依赖升级时回归该适配器和发布包行为；结构不符合预期时拒绝启动，不降级为无依赖的普通插件。

在 `apps/server/src/business-plugin-errors.ts` 定义 `BusinessPluginLoadError` 与安全 formatter。错误类别固定为入口冲突、非法入口、重复名称、缺失依赖、错误依赖方向、循环依赖、入口 import 失败和业务 boot 失败。附属上下文只允许已验证的插件名、模块相对位置或 `modules`/`domains` 阶段；不包含注入对象、秘密、堆栈或底层异常消息。目录读失败归为非法入口；动态 import 失败包装为入口 import 失败；非自定义业务注册异常包装为该阶段 boot 失败，不解析第三方任意 error.message。

`server.ts` 的顶层 catch 在通用数据库提示之前识别该安全错误类型，以 formatter 输出固定分类和允许的定位信息。不能直接打印 error.message、cause 或原生异常对象。现有 Identity/Storage/CORS 分支保留各自契约。`createApp()` 不变成 async，错误通过 `ready()`、`inject()` 或 `listen()` 暴露。诊断可以 debug 记录已验证的插件名称和数量。

预检 import 阶段只允许声明入口，不能连接数据库、创建文件、启动 worker 或监听端口。插件不关闭调用方注入的资源；`server.ts` 继续持有关闭职责。

### runtime 启动失败清理

资源准备通过后创建 app，先安装 `onClose`，再 `await app.ready()`，然后 `await app.listen()`；只有监听成功才启动通知 projection 和可选 identity outbox worker，并立即记录各自 stop handle。这样入口和依赖检查失败时尚无 worker；监听失败时也不会创建定时任务。

这段启动逻辑提取到 `apps/server/src/start-application.ts` 的 `startApplication()`。它接收 app 创建函数、runtime 拥有的数据库、监听配置、通知 worker 启动函数与可选 outbox 启动函数，返回已启动的 `Promise<FastifyInstance>`。这些输入均由 `server.ts` 准备；helper 不读取环境、不创建数据库，也不包含业务工厂。公开 `createApp()` 仍保持同步。

数据库所有权转移边界必须明确：`server.ts` 的准备 try/catch 只覆盖数据库校验、配置和业务对象准备，准备失败时关闭数据库；`startApplication()` 的调用位于这段准备 try/catch 之外，从调用开始接管 app 创建、监听及关闭责任。顶层只格式化错误，不再无条件关闭已经移交的数据库。这样 app 创建函数抛错也由 helper 收尾，不遗漏资源，也不由两个 catch 重复关闭。

helper 使用一次性的资源清理函数，由 `onClose` 与启动失败 catch 共用。它先调用已记录的 stop handles，再关闭该 runtime 拥有的数据库；即使一个停止步骤抛错，也尝试剩余停止步骤及数据库关闭。清理 promise 每个 runtime 只创建一次，避免 `app.close()` 触发 hook 后，catch 再次调用 `pool.end()`。

任一 app 创建、ready、listen 或 worker 启动步骤失败，catch 在有 app 时尝试 `app.close()`，并在 finally 中调用上述清理函数以覆盖未安装或未执行 close hook 的情况。失败清理不能覆盖最初的启动异常；清理错误只输出固定安全提示，原始启动分类仍可见，进程返回非零。worker 启动成功后另一 worker 启动失败，也必须停止已启动者、关闭已监听 app 和数据库。

本轮仅使用既有 worker stop 接口，不改变认领、重试或 lease 算法。正常关闭时继续通过相同 owner 停止 worker、关闭 app 及数据库。不要把加载器的测试 app 关闭行为和 runtime 资源关闭混同：注入测试 app 自身仍不拥有调用方数据库。

## 构建与依赖

`apps/server/package.json` 新增精确版本 `@fastify/autoload@6.5.1`，通过 pnpm 更新对应 lockfile。安装和兼容性检查属于实现阶段；不运行日常启动来改变依赖树。

Server 的独立 build 和根 build 都须在编译前清理固定的 `apps/server/dist`。清理脚本为 `scripts/clean-server-build.mjs`，不接受调用方目标路径；执行前验证目标解析为 Server 包自身的 `dist`，并拒绝符号链接/junction 目标。清理失败即停止构建。清理不会访问 `apps/server/data`、根环境、数据库、Outline 或其他 package 输出。

构建顺序为 Contract 生成、Server dist 清理、`tsc`、现有 import 重写。Server 的 build 命令包含清理，所以通过根入口和直接过滤 Server 的构建都获得相同保证。构建失败后不启动不完整产物；生产 start 仍只消费构建产物，不生成文件或改写数据。

源码中的普通 service/factory 不增加框架依赖。若未来需要完整自动汇总 operations，再单独比较动态字典和构建时静态注册生成；本轮不预建生成器或扩展接口。

## 备选方案

| 方案                    | 收益                                                  | 代价与本轮决策                                                          |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| 继续显式注册            | 当前类型及顺序直观，无目录扫描                        | 未来每个公共模块都修改中央 import/register 清单；用户已确认减少该维护点 |
| 限定业务入口的 Autoload | 新业务入口自行加入，保留 Fastify 插件生态和 HTTP 边界 | 需要有限预检、具名参数和干净构建产物；本轮采用                          |
| 构建时生成静态注册      | 可保留静态 import，并扩展到有类型的 handler 汇总      | 引入生成、校验与开发监听流程；当前仅业务插件不需要该工具链              |

## 验收与实施顺序

先同步业务参数接口、加载入口和源码 boot 测试，再接入 Autoload 依赖与干净构建，最后检查编译后的真实 boot。落在同一逻辑改动中，不能先交付扫描而缺少 dist 清理。

| 验收             | 需要的证据                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 自动发现         | 在测试拥有的根目录增加合法业务插件，无中央名称清单即可提供新 decorator；无入口目录及含 package.json 的无入口目录安全跳过；扫描根目录自身含 package.json 明确拒绝 |
| 精确筛选         | 在被排除的 service、测试和 API 文件中放置 import 哨兵，boot 不触发；同时存在 ts/js 入口明确失败                                                                  |
| 依赖与名称       | 文件顺序与依赖顺序相反仍可启动；跨批合法依赖成功；同名、缺失、循环、公共到具体业务依赖均失败                                                                     |
| 元信息与参数     | 普通函数、封装业务入口失败；具名导出/default 属性两处的跳过和自动配置均受检查；必需注入缺失失败，OIDC 未启用行为保持                                             |
| 多实例与所有权   | 两个 app 使用各自服务对象；关闭 app 不关闭外部注入资源；预检失败不执行插件初始化                                                                                 |
| API 隔离         | 复用 `tests/server-plugins/boot.test.ts` 的 root-probe、request 字段、路由集合和原始 handlers 断言                                                               |
| 类型             | 更新 `tests/server-types/types.fixture.ts`，验证具名参数、必需服务错误类型及完整 Fastify 声明图                                                                  |
| 删除和重命名     | 在测试工作区先构建插件再删除/重命名源码，重建后旧产物消失，编译 app 不加载旧模块                                                                                 |
| 构建清理边界     | 同级 data/环境哨兵保留；symlink/junction dist 明确拒绝；清理失败不进入编译                                                                                       |
| 三种执行环境     | 工程实际 Vitest、开发 `--import tsx` 和不带 TS loader 的编译 JS boot，均使用同一候选集合与参数契约                                                               |
| 实际启动诊断     | 带秘密哨兵的 import/注册异常不会回显；重复名和缺依赖分类到达启动输出，不变成数据库提示                                                                           |
| runtime 失败清理 | ready 与 listen 失败不启动 worker；第二个 worker 启动失败时停止第一个并关闭 listener；close hook 与 catch 合计只关闭一次数据库；清理步骤异常不遮盖原始启动分类   |
| 现有行为         | 类型检查、相关插件及 Contract 测试通过；必要的全量测试和 build 最终退出成功                                                                                      |

直接向 Fastify 乱序 register 的旧失败测试保留，证明 Fastify 本身不替调用者排序；新增经过 Autoload 的乱序成功测试，证明本轮新增的排序能力。不要将这两种路径混为同一预期。

优先执行 `pnpm exec vitest run tests/server-plugins/boot.test.ts tests/server-plugins/declarations.test.ts --maxWorkers=2` 和新增发现/构建用例，再运行 `pnpm typecheck`、`pnpm test`、`pnpm build`。新用例遵循现有测试目录和隔离习惯；需要数据库的回归仍使用 Testcontainers，Docker 不可用明确失败。

编译 boot 使用注入假服务与临时目录、拒绝所有数据库查询的夹具，不读取开发配置、不监听固定端口。runtime 启动失败回归使用测试拥有的 app、数据库和 worker 替身；`server.ts` 调用上述同一 `startApplication()`，测试不能另写一份启动逻辑，并覆盖准备失败、app 创建函数抛错及所有权移交后的失败路径。格式化错误的顶层分支也使用同一安全 formatter。至少用子进程证明插件 boot 失败能够非零退出且不持续运行定时 worker。

Vitest 与 tsx 测试必须实际覆盖动态 import 和路径别名，不能以 Autoload 上游支持这两个工具的声明代替工程验证。测试临时目录、清理和 Server 构建写入串行，避免与其他任务输出互相覆盖。

代码修改后执行独立代码复审，刷新受影响验证结果再交付。提交与推送沿用用户明确授权，本设计批准不自动授权 Git 发布或部署。

## 回退与审查状态

回退为当前显式业务注册，并恢复内部插件 options 接口及测试；服务对象、数据库、HTTP Contract 和持久文件无迁移。回退后仍执行干净重建，不能复用改造前后的混合输出。构建清理可以作为独立安全措施保留，但不能依靠旧目录残留充当模块兼容。

本轮没有需要用户选择的功能开关、数据库决定或热加载策略。具名内部参数、有限元信息适配和 runtime 失败清理是本文件提出的实现选择，需在具体设计版本审查中确认。启动清理是独立评审发现的必要补齐，不能把原有只关闭数据库的 catch 当作完整验收依据。

当前证据为现有代码和发布包只读核对；本文件不是实现验收。源码/编译 boot、测试、build 和浏览器验收尚未执行。自动检查、实际浏览器与部署结果分别报告，当前阶段不部署上线。

## 外部参考

- [Fastify Autoload 说明](https://github.com/fastify/fastify-autoload#readme)：目录发现、选项、依赖排序和 Fastify 5 兼容范围。
- [Autoload 发布版本元信息](https://registry.npmjs.org/@fastify/autoload/6.5.1)：版本和发布包来源；本次核对发布包的入口实现。
- [Fastify Plugin 发布版本元信息](https://registry.npmjs.org/fastify-plugin/6.0.0)：本项目元信息适配的锁定版本。
- [Node watch 说明](https://nodejs.org/api/cli.html#--watch)：默认观察入口和已导入模块，不作为新增业务入口实时加载的保证。
