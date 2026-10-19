# Application readiness locality — v1.1

**DESIGN_REVIEW_REQUIRED；推荐维持现状，本候选不包含生产重构或测试修改。** 当前两种 adapter 的阶段入口已经隐藏大部分检查细节。将同阶段规则集中到新 module 能集中两条 CLI 调用，却没有实证降低运行调用方必须掌握的跨阶段知识。保留独立评审与用户核对；结论被接受后才由 Lead 决定是否结束本探索。

## 候选与证据边界

- 模块：`application-readiness`；材料根：`.notes/application-readiness/`。按 `brainstorming --handoff --module=application-readiness` 采用 architectural 路径，交付最终设计供独立审查。
- 候选：`application-readiness-v1.1`，2026-10-11。源码基线：`cf6a81ac5b814faac40dd1ccee3f793a42c83b20`。五个候选入口相对扫描基线 `82f0ac9` 无差异；无候选入口工作树修改。
- 文件摘要见 `.notes/application-readiness/specs/evidence-v1.1.json`：设计正文与证据源码的 SHA256；附件可用于跨工作区核对同一版本。
- 依据：本工程 `AGENTS.md`、`.ai/README.md`、`README.md`、`.ai/architectures/runtime/runtime-boundaries.md`、`.ai/architectures/monica-team/workflow.md`、`apps/outline/AGENTS.md`、`.ai/architectures/docs-integration/integration-boundaries.md`；相关已接受 ADR 为 `.ai/databases/decisions/03-database-changes-only-by-explicit-command.md`、`.ai/databases/decisions/07-independent-postgresql-exre-database.md`、`.ai/decisions/server/04-safe-error-messages.md`。ADR 索引没有独立 readiness ADR；运行架构与源码是当前依据。早期 ADR 的配置命令不替代当前根配置入口。
- 已通过 Monica 下载并读取原架构扫描 HTML：附件 `01a12b00-e012-74c9-ae15-6f1d3fe5d0ab`，只将 application-readiness 条目作为候选来源，未视为批准。
- 静态检查能证明控制流与潜在收益，不能证明真实环境已就绪、实际重检捕获过故障或 Linux/公网验收成功。本轮不运行应用、数据库 CLI 或测试。
- 审批：`implementation_authorized=false`、`design_approval_source=none`。未确认内容仅保留在 `.notes/`，不写入 `.ai/` 的既定事实。

## v1 → v1.1 修订记录

原 v1 正文与 `.notes/application-readiness/specs/evidence-v1.json` 原样保留。独立评审评论 `01a12b5c-e506-7306-b37f-703c715d0f80` 对 v1 给出 **PASS（3 项轻微发现）**、支持 `keep_current`；本版只修订三项证据表述，不重做方案或改变实施边界：

1. 统一为三处只读 readiness 双 CLI 序列；枚举 `scripts/runtime/infrastructure.mjs:93,102` 的显式 prepare 路径与管理员参数，说明排除原因，新增该文件摘要。
2. 明确真实 C0 所在阶段、失败回收的条件性静态判断，以及真实 C0/C0 回收/完整成功 native start 的测试覆盖缺口；不将尚未验证的行为写成测试保证。
3. 补齐 local 锁/signal/log 初始化引用 `scripts/runtime/applications.mjs:49–53`。

本轮 HEAD 仍为上述 `cf6a81a`；v1 的 19/19 个源码摘要全部匹配，未发现受评审源码变化；新增 `scripts/runtime/infrastructure.mjs` 与 HEAD 一致。v1 正文 SHA256 为 `bad34c061c91b498c1770bedcfd6ef1657aa88c5d92583c7ac597494d8f5c213`；v1.1 正文及 20 个源码摘要见 `.notes/application-readiness/specs/evidence-v1.1.json`，其中保留 prior_candidate 与沿用评审来源。v1 未受影响部分的独立评审证据保留，v1.1 三项变更及新摘要仍待独立复核；用户尚未接受维持现状结论。

## 真实调用方与 module 边界

| Module / interface                                                                 | 真实调用方                                                                                                 | 所隐藏的知识                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `applications.mjs` / `verifyApplications(state, options)`                          | `runDevelopment`，由 `entry.mjs` 的 dev 分支经生成 Contract 后进入                                         | foundation、Website CLI、Outline CLI、Hydra 校验与 local 安全诊断；支持受控依赖注入    |
| `native.mjs` / `NativeApplications.start()`                                        | `entry.mjs` 的 start 分支                                                                                  | PM2 inventory、启动阶段、失败回收与最终 online 核对                                    |
| `native.mjs` / `verifyNativePreflight`、`verifyNativeClient`、`verifyNativeHealth` | `NativeApplications` 默认 preflight/client/health seam；health 另有直接测试调用方                          | 分别隐藏启动前身份/CLI、Hydra ready 后 client、启动后 HTTP/身份/CLI/client             |
| `deployment.mjs` / `validateDeployment(state, options)`                            | native preflight/health；直接 validate/prepare CLI；`infrastructure.mjs` 显式 init/migrate 的 prepare 路径 | identity pin、历史目标、数据库身份、Outline issuer marker；普通 validate 还校验 client |
| `hydra-client.mjs` / `verifyHydraClient`                                           | runtime 包装器、deployment validate 等                                                                     | 固定 client 的 grants/回调/issuer/metadata/secret 与协议可用性，禁止 provision         |

依赖方向保持：entry → local 或 PM2 adapter → 阶段检查 → 现有数据库、CLI、HTTP adapter。native 当前复用 applications 的 `cliSpecification` 与 `verifyRuntimeHydraClient`，并依赖 deployment；applications 不依赖 native/deployment。Services 独立拥有依赖资源的 proof、锁、历史证明和回收，已有 depth，本探索不改变它。

## local 顺序与只读范围

| 阶段        | 顺序、来源                                                                                                                                                                | 拒绝与重检理由                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 配置与生成  | `entry.mjs` 读取根配置并为 dev 生成 Contract，再进入 `runDevelopment`                                                                                                     | 配置拒绝与生成保持独立；生成不是 readiness 的只读承诺                                                                                                                                                                             |
| 应用预检    | 应用锁/signal/log 初始化 → `verifyApplications`：foundation → Website `integration:check` → Outline `integration-check` → Hydra client；`applications.mjs:37–42,49–53,58` | foundation 校验 Outline/Hydra 库、owner/角色、migration、结构、marker；Website CLI 校验 exre 与本站结构/配置；Outline CLI 校验自身 marker、账号/工作区/provider 关联。Hydra 依赖已由显式 service:start 准备；不在本路径启动 Hydra |
| 端口与交接  | public/web/api/outline/outlineVite 五个端口检查 → signal 检查 → supervise；`applications.mjs:59–62`                                                                       | 任一占用拒绝，不接管已有 listener；预检失败释放锁                                                                                                                                                                                 |
| 启动后 HTTP | server `/api/health`；outline `/_health` 与 Vite client；web 公共 `/`；全量模式另核对公共 `/api/health`、`/docs/`；`applications.mjs:69–79`                               | 依 service 选择执行，单服务启动仍执行全套预检及端口检查。公共代理与内部应用是不同可达路径，不互相替代；local 没有 PM2 的启动后完整身份/CLI 重检                                                                                   |
| 成功/失败   | supervise readiness 成功、保存 ready 后才 onReady；失败清理本代 children                                                                                                  | `httpReady` 默认 120 秒每地址，观察必需 child 退出；不停止后台依赖。监督与归属协议保持不变                                                                                                                                        |

local 预检没有 deployment identity pin；不补入 deployment 语义。应用预检读数据库与身份状态，可能启动短命检查进程；锁、日志和监督记录仍会写入。所谓“只读”约束是不得改变持久业务/身份/准备状态，不是整个启动命令无文件写入。

## PM2 顺序与阶段契约

| 阶段                  | 顺序、来源                                                                                                                                                         | 拒绝、只读规则与重检理由                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 归属与 foundation     | 取得应用锁 → configuration inventory/previous → foundation `{bootstrap:true}`；`native.mjs:53–58`                                                                  | 同名/脚本/cwd/args/配置摘要冲突拒绝；不通过重启吸收配置。foundation 使用 READ ONLY，只检查 Outline/Hydra                                                                                             |
| 启动前身份与 CLI      | `verifyNativePreflight`：`validateDeployment` 注入 no-op client → Website CLI → Outline CLI；`native.mjs:59,99–103`                                                | pin 必须已有并匹配；核验 exre/outline 库、Outline issuer。明确跳过此处 Hydra client，因为 Hydra 尚可能未启动；这不是 readiness 成功证明                                                              |
| 启动前 artifact       | 两个应用编译入口 → Hydra binary 存在和版本 → 已有 process 都 online；`native.mjs:60–68`                                                                            | 缺 artifact/binary 或原 process stopped 拒绝，不隐式 build/restart                                                                                                                                   |
| Hydra 就绪后的 client | 仅启动缺失 Hydra → `/health/ready`（30 秒）→ client 校验；`native.mjs:69–71,105–107`                                                                               | C0 位于 Hydra 启动之后、缺失 Website/Outline 启动之前。静态控制流表明其失败不进入缺失应用启动；新 Hydra 的回收取决于 catch 中 inventory/删除成功，原进程不在删除选择中。这些 C0 行为尚无对应测试覆盖 |
| 应用启动              | 只启动缺失 Website/Outline；`native.mjs:72–73`                                                                                                                     | 不重新启动已有应用，不停止后台依赖                                                                                                                                                                   |
| 启动后真实健康        | Website HTTP → Outline HTTP → Hydra HTTP（各 30 秒）→ deployment identity/db/marker + client（H1）→ Website CLI → Outline CLI → client（H2）；`native.mjs:111–119` | pin/数据库/marker 在启动窗口后再观察；HTTP 成功不替代身份及 CLI。H1 是 deployment validate 的完整成功条件，H2 在两项 CLI 后再次观察 client                                                           |
| 最终 process 核对     | health 成功后 configuration inventory，三个 process 都 online、有 pid；`native.mjs:75–79`                                                                          | PM2 online 单独不能报成功；配置在启动窗口后再次核对。失败按 verified inventory 删除本轮新 pm_id；previous 保留；finally 释放锁                                                                       |

identity pin 由 `deploymentBinding` 摘要比较网站目标、issuer、publicOrigin、client secret 和 delivery key；普通 validate 不写 pin。prepare 的排他写入以及 ensure client 属显式维护，不能被启动或重检调用。无 pin 时仍可能先做只读数据库检查，最后报 `DEPLOYMENT_BINDING_MISSING`；不为“尽早失败”改变顺序。历史旧身份/pending 查询发生于缺 pin 时，不应描述为每次健康都扫描历史。

### 三个 client 检查点的语义

完整成功 native start 按静态控制流会经过 C0/H1/H2：C0 = `scripts/runtime/native.mjs:71` 的 `this.client()`，默认函数体 `:105–108` 先等待 Hydra `/health/ready` 再校验 client，位于仅启动缺失 Hydra（`:69`）之后、启动缺失应用（`:73`）之前；启动后 `verifyNativeHealth` 内 H1、H2 是另外两次。`tests/runtime/native-health.test.ts:64–79` 仅直接调用 health 并断言两次，未经过 C0；这不代表整个 start 总共两次，也不是完整成功 start 的已执行测试证据。

C0 防止在 Hydra client 尚未准备或发生冲突时启动 Website/Outline。H1 证明当前 deployment validation 在启动后仍成立；H2 位于两个 CLI 之后，可发现 CLI 耗时窗口内 client 被外部操作者改变或协议服务失效。三者都执行 admin GET 与 public `/oauth2/token` POST：使用随机无效 authorization code，要求 400 `invalid_grant`，证明 secret 可用但不签发有效 token。只读是不会创建/覆盖 client、账号或身份，不意味着只使用 HTTP GET。

H2 的时序位置支持上述防漂移解释；源码没有原始决策记录、真实故障或“最后一次检查是原子全系统快照”的证明。所有检查都是顺序观察，仍存在最后检查之后变化的窗口。不能据此声称 H2 绝对冗余或绝对必要。本候选保留三个检查点和 `tests/runtime/native-health.test.ts:71` 次数断言。

若未来提议删除次数断言，须先以阶段行为测试明确承接其重检语义：仅 H1 前就绪/H2 前变冲突时必须拒绝，且 H2 确实晚于 Outline CLI；另测 C0 拒绝不启动应用。只有批准改变观察窗口、并提供等价安全论证时，才考虑删除某个检查本身。不能把“改成行为测试”当作省略重检的许可。

### C0 与完整成功 start 的测试证据缺口

静态检索 `scripts/` 与 `tests/` 的 `NativeApplications`、`verifyNativeClient` 和 start 调用，现有两个 start 层用例都未执行真实 C0：`scripts/runtime/settings.test.mjs:432–443` 将 preflight/client/health、foundation/binary 和 inventory/PM2 打桩，最终由 health 桩抛错；`:446–451` 的 preflight 桩先抛错，根本未进入 client。另两处 NativeApplications 测试只调用 PM2 wrapper 或 stop。未见完整成功 native start、成功输出“应用已就绪”或最终 `PM2_PROCESS_NOT_ONLINE` 分支的测试断言。因此这里的覆盖缺口包括真实 C0 顺序与拒绝、C0 失败后的回收，以及成功 start 的全部阶段串接。

源码 `scripts/runtime/native.mjs:69–86` 表明：新启动 Hydra 时先置 `changed=true`；C0 抛错会在缺失应用启动前进入 catch；仅在 `changed` 时重新取得 inventory，过滤 `previous` 外的 process 并删除其 pm_id，finally 释放锁。如果 Hydra 原已存在且本轮未改动，`changed=false`，不进入删除。inventory 或 delete 本身仍可失败。这是静态控制流判断，不是 C0 回收的已执行测试保证；`:432–443` 中 health 桩失败后的回收断言不能替代 C0 失败用例。本轮及 v1 独立评审均未运行自动测试，现有测试源码中的断言也不被报告为本轮测试 PASS。

## 失败诊断兼容性

- local Website/Outline CLI 失败分别包装为 `WEBSITE_NOT_READY`、`OUTLINE_NOT_READY`，并经 onLog 提供固定检查项。native 两处 CLI 使用 `runOwned` 默认选项，非零退出为 `PREPARATION_CHILD_FAILED`；不能在提取共享 helper 时顺便改为 local 文案或声称 native 已有同等日志上下文。
- runtime Hydra 包装器将缺 client、配置/secret 冲突、参数无效映射为 `HYDRA_CLIENT_MISSING`、`HYDRA_CLIENT_CONFLICT`、`HYDRA_CONFIG_INVALID`，未知失败为 `HYDRA_CLIENT_CHECK_FAILED`；网络已知 code 使用固定分类。
- H1 在 `validateDeployment` 内执行，其 catch 将 client 异常包装为 `DEPLOYMENT_HYDRA_NOT_READY`；H2/C0 直接使用 runtime Hydra 分类。相同底层失败在不同检查点有不同对外分类，这是现有观察契约，不擅自统一。
- deployment pin、库身份、Outline issuer/未准备、缺 binding 保留 `DEPLOYMENT_*` 固定错误。HTTP 超时报 `APPLICATION_NOT_READY`，local child 退出报 `APP_EXITED_DURING_START`。未知异常经统一输出隐藏原始消息；不回显 secret、SQL、连接串或 stderr。
- native rollback 的 inventory/删除本身可能拒绝，不能将“只回收新进程”扩展为绕过归属检查的强制清理保证；本探索不修理或重构该协议。

## 方案比较与收益判断

| 方案                      | Interface / depth                                                                                                                                                                 | Leverage / locality                                                                                     | 决策                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A 维持现状                | local 一次预检调用；native 三个阶段 seam；deployment 已隐藏 SQL/pin/client 细节                                                                                                   | 阶段内已有集中点；各 adapter 拥有其特有启动顺序                                                         | **推荐**。无生产迁移，避免把低收益候选转成重构任务     |
| B 集中同阶段规则          | 新只读 module 提供 `verifyLocalPreparation`、`verifyDeploymentPreflight`、`verifyDeploymentClient`、`verifyDeploymentHealth`；deployment pin/prepare 仍独立；adapter 保留启动时序 | 约能共用 Website→Outline CLI 序列；local 额外 foundation/Hydra，native 额外 pin/重检/诊断，仍需不同入口 | 有实现集中收益，但未证实调用方阶段知识减少；不推荐实施 |
| C 全部 readiness 编排合并 | 单入口以 profile/phase/service/children 驱动完整顺序                                                                                                                              | 模式分支、生命周期与策略配置增长；启动边界跨 module，通用 probe 框架压力增大                            | 不推荐，违反保留 adapter 独立顺序的方向                |

B 是用于比较的具体 interface 草案，不是批准方案。若选择 B，依赖应是 adapter → readonly module → deployment identity interface、既有 CLI/HTTP/client adapter；readonly module 不依赖 applications/native 的生命周期。`cliSpecification`、`hydraOptions`、runtime client 安全分类须一并移到无生命周期依赖的内部位置，避免 readiness → applications → readiness 循环；不能仅换 import 名字就声称架构深化。保持现有入口作兼容委托会增加转发层，删入口则改变测试 seam；两者均有成本。

### 前后调用方所需知识

| 调用方                       | 当前必须知道                                                                                                                                  | B 之后仍必须知道                                                     | 能删除的知识                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| local adapter                | 全套预检在端口/child spawn 前；service 选择的 HTTP 路径与 public proxy 核对                                                                   | 同样的启动边界与 service/children 条件；新预检入口                   | 若连 HTTP 表迁入，只隐藏 local 专属路径表；未获得第二真实复用方 |
| PM2 start adapter            | foundation 在 mutation 前；preflight → artifact → Hydra start → client → apps start → health → final inventory                                | 所有这些 mutation 边界仍须保留；调用新阶段入口                       | 没有删除关键阶段顺序知识；只是替换三个函数名                    |
| 阶段 implementation 的维护者 | 三处只读 readiness 的 Website→Outline 双 CLI 序列；local 与 native 诊断不同；deployment validator 含 client、preflight 用 no-op、health H1/H2 | 共享 CLI helper 及诊断选项；独立 pin/client 路径与重检原因；阶段条件 | 两条 CLI 的重复排序文本可以删除；错误与时序仍需多入口理解       |

计数依据是控制流入口，不是 LOC 或性能承诺：local 已只调用一个预检 interface；native 已只调用三个阶段 interface（另有 foundation），B 不减少这三个阶段或其先后约束。当前三处只读 readiness 双 CLI 序列分别位于 local preparation（`scripts/runtime/applications.mjs:40–41`）、native preflight（`scripts/runtime/native.mjs:102–103`）、native health（`scripts/runtime/native.mjs:117–118`），最后一个跨启动窗口；它们不是三个可互换阶段。尚无第二 PM2 health 调用方、第二 local HTTP 模式或实际变更造成的跨文件维护故障。deployment CLI 与显式 prepare 是另一消费边界，不能为了减少文件数混入启动 module。

### 显式 prepare 序列为何不共享

还有一处同源的 Website→Outline check 顺序位于 `bootstrapInfrastructure`（`scripts/runtime/infrastructure.mjs:84–104`），不计入上述三处只读 readiness。`:93` 的 Website `integration:check` 与 `:102` 的 Outline `integration-check` 都额外携带 `--admin-user-id <UUID>`，分别针对用户选择的已有 active 管理员进行校验；它们不是相邻的双 CLI 调用。中间依次执行端口核对、临时 Website 启动（`:94–98`）、HTTP ready（`:99`）、`ensureHydraClient`（`:100`）、带相同 UUID 的 Outline `integration-bootstrap`（`:101`），finally 再回收临时进程（`:104`）。deployment 下前面还可能显式准备 pin（`:92`）。

这两个 check 自身属于校验，但整个编排属于有写入的显式 prepare：可登记 client、准备 Outline 身份和 pin；管理员参数、临时进程与写入前后观察窗口不能由普通 readiness 推断或合并。将它包装进只读双 CLI helper 会跳过或重新排序中间步骤；扩大 helper 来容纳这些步骤又会混入管理员授权和维护生命周期。保留 `cliSpecification` 的参数复用即可，不把此路径算作只读共享的第四个调用方。此排除加强 `keep_current`，没有扩大本设计的维护范围。

### Deletion test

- 删除 `verifyApplications` 会将 foundation、双 CLI、Hydra 与错误分类移回 local；其现有集中具有价值。
- 删除 `verifyNativeHealth` 会把专属健康序列移回 native start；没有多个生产调用方的共享 leverage。将它移到新文件并未消除 adapter 的阶段知识。
- 删除假想 B 的 facade，仅把各模式的专属检查放回原阶段入口，mutation 顺序仍相同。真正丢失的共同规则主要为双 CLI helper，成本低于新增整个 readiness module。
- 删除 deployment pin/Services proof 会散失复杂身份与资源保护；这两个已具 depth，不属删除或简化目标。

## 迁移步骤与实施边界

推荐 A 的交付步骤：独立 Reviewer 核对本候选及源码摘要 → Lead 将确切 `application-readiness-v1.1` 与维持现状理由交用户核对 → 记录用户决策来源及范围 → 由 Lead 决定是否结束探索。没有代码、Contract、生成类型、数据库、配置、lockfile 或 Outline submodule 迁移。用户接受维持现状不自动授权开发 B。

若用户要求深化 B，必须形成 v2 并再次审查批准；可评估的迁移序列为：先补阶段观察测试并记录原诊断 → 拆分 deployment 只读 identity 与含 client validation 的内部边界、保留 CLI/prepare 原行为 → 移动 CLI/client 小能力，解除 readiness 对生命周期的依赖 → 分别迁移 local 与 native 的阶段内部规则 → 核对两个 adapter 顺序、三个 client 点、错误分类及资源回收 → 同源码头独立复审与适用验证。不允许先写这些测试或 scaffold 来绕过当前设计门禁。若 v2 仍仅减少重复文本，应放弃 module 提取。

范围外：Services proof/锁/回收/历史证明、PM2 配置摘要、资源归属、账号准备、client 登记、migration/reset、issuer 迁移、通用 probe 框架、上线部署。没有交互变化，无 Demo 需求。

## 阶段测试方案与现有证据

本轮只静态阅读，以下均为未来获准改动时的方案，不能报成已通过。根 `TESTING.md` 不存在；采用当前 `scripts/runtime/tests.mjs`、`test-manifest.mjs` 与隔离测试约定，Docker 不可用须失败，不回退开发库。

| 验证项              | 已有源码覆盖                                                                                                         | 若改动阶段 interface，需要补充/保持的行为                                                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 固定安全诊断        | `settings.test.mjs:80–113` 分类/脱敏；`output.test.mjs` 统一输出                                                     | 各阶段未知秘密错误不泄露；local/native CLI 分类差异、H1/H2 分类差异；HTTP 未 ready 时固定服务/目标/下一步，无隐式修复                                                                                                                                                      |
| pin/配置身份冲突    | `deployment.test.mjs` 旧 pending、secret drift、并发 pin；`settings.test.mjs:446–451` preflight 拒绝无 PM2 start     | pin issuer/key/target/publicOrigin 变化、missing pin、wrong db、Outline marker 冲突均拒绝；PM2 摘要/归属冲突不启动不接管；验证真实阶段函数，不能只有 stub 失败                                                                                                             |
| client 顺序         | `native-health.test.ts:64–79` 仅直接测试 health 的 HTTP 列表、两次 client、两个 CLI，无全局交错 trace；未覆盖真实 C0 | C0 在 Hydra ready 后、apps start 前；H1 在 HTTP+identity 后、CLI 前；H2 在两个 CLI 后；H1 成功后外部 client 漂移让 H2 失败；保持原次数断言直到行为语义完整承接                                                                                                             |
| 身份冲突测试名局限  | `settings.test.mjs:446` 标题含 client-before-app                                                                     | 实际只让 preflight 抛错并断言 calls 空，未执行 client 或成功 start；不能将标题当顺序证据                                                                                                                                                                                   |
| HTTP 真实健康       | native health 测试 mock HTTP；local httpReady 的既有真实 HTTP deadline/child 退出测试位于 Docs 脚本测试              | PM2 online 但任一 HTTP/身份/client 失败不得成功；local 单服务与全量 public/internal 路径依原顺序；保持 Host、TLS、redirect、总 deadline 与 child 退出逻辑                                                                                                                  |
| 只读                | deployment prepare 的 pending 测试只断言 READ ONLY/ROLLBACK/SELECT；Website/Outline 的真实 readiness CLI 隔离测试    | ordinary validate/preflight/health 不写 pin、不调用 ensure、不迁移；成功及失败前后持久状态一致；HTTP token POST 仍仅无效 code，不能请求有效授权；锁/日志可写需区别业务写入                                                                                                 |
| 失败回收/原进程保留 | `settings.test.mjs:432–443` online+health failure，删除新 pm_id 9/8，保留原 7；`470–479` 精确 stop IDs               | 拟补充验证：新建 Hydra 后 C0 失败且回滚 inventory/删除成功时只删除本轮新 Hydra，保留 previous；C0 失败回收目前无测试覆盖。H1/H2/CLI/HTTP 失败保留 previous；部分 existing/missing 组合与无新进程时不删除；local 失败清理本代 children、不停 Services；归属失败时拒绝不强杀 |
| Services 归属回归   | `settings.test.mjs:255–370` proof、DNS/mount 表示与真实漂移、启动期间变化；370 起 listener 阻止依赖 stop             | 原样保留整个用例（listener 用例至 382），不得移动/精简以支持 readiness；相关 application-lock 回归保留                                                                                                                                                                     |

若实施得到明确批准，先运行受影响的 Node runtime 测试及 `tests/runtime/native-health.test.ts`，再经根 `pnpm test` 隔离流程核对 readiness CLI；执行命令与实际环境记录由 Tester 按当时规则确认。自动测试、实际本机生命周期、真实浏览器和部署分别报告；本候选无需部署证据来作静态设计比较。

## 假设、风险与重新开启条件

最小可逆假设：当前真实调用方就是源码搜索得到的 local/dev 与 deployment/start，不为尚未出现的第三 adapter 预建框架。无需改变数据模型或 HTTP Contract。

风险与证据缺口：未执行自动测试或真实启动；静态检索未见真实 C0、C0 失败回收或完整成功 native start 的测试；现有测试还没有完整交错顺序、末次重检漂移或每个阶段失败的回收矩阵。PM2 健康路径存在 no-op client 绕过与不同错误包装，但当前没有越过门禁启动或错误泄密的实证。本候选将其列为需保留的语义与未来验证项，不定性为缺陷。

可重新开启的证据：新增真实 adapter 复制同阶段策略；出现同规则变更需多处同步且已造成遗漏；隔离行为测试证明可移除某阶段知识且保持必要观察窗口；用户明确要求另行改善 native 诊断。单纯重复次数、LOC、移动文件或未来部署设想不满足深化门槛。

本轮状态：源码/测试静态核对 **PASS**；v1 独立评审 **PASS（3 项轻微发现）**；v1.1 三项修订的独立复核 **待执行**；用户设计核对 **待完成**；自动测试、真实浏览器、部署 **NOT_EXECUTED**。没有生产代码或测试改动，没有 Git 提交/推送/PR；设计文件未提交，由 Monica 附件与文件摘要提供可复审候选。
