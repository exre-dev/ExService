# Runtime 架构优化任务记录

范围以 `.notes/gaol.md` 为准。基线为 `0cfa6df`；开始时仅目标文件未跟踪，已有 Outline 退役与 Common 迁移保持。无 `.codegraph/`、`TESTING.md`，测试按 `.ai/architectures/contract-tests/test-layers.md` 执行。

## 设计候选与审查

| 方向           | 设计文件                                         | 设计者 / 独立审查者                       | 候选             | 设计审查                             |
| -------------- | ------------------------------------------------ | ----------------------------------------- | ---------------- | ------------------------------------ |
| Hydra 错误契约 | `.notes/runtime-architecture/hydra/design.md`    | `hydra_designer` / `hydra_reviewer`       | v1               | APPROVED，无阻断                     |
| 整份身份配置   | `.notes/runtime-architecture/identity/design.md` | `identity_designer` / `identity_reviewer` | v1.1（兼容澄清） | APPROVED，无阻断；原 v1 已获用户确认 |
| 容器 proof     | `.notes/runtime-architecture/proof/design.md`    | `proof_designer` / `proof_reviewer`       | v1               | APPROVED，无阻断                     |

用户确认时的 v1 SHA-256：

- Hydra：`CD8F0C1F0DCE1919748FB8290E67FEFDBB146CB5E86DD3D85C3D3622A8B17B75`
- 身份配置：`BCAC309BBD4028845E904171C969A37BFE2D7FBE8B6F67C675AF4A780E2D9E87`
- proof：`BC0A07A024B3706267619B0561FA623F487B5BBFC2E2B04AB3718C737F85B284`

用户已于 2026-10-16 回复“同意”，确认上述三份已独立审查的候选 v1，以及按方案开发、独立代码复审、完整验证和验证后稳定 `.ai/` 知识更新范围。审批门槛已满足，进入串行实施；后续授权范围内的修复和验证自主推进。设计均不要求新增 ADR，原有边界继续适用。

## 已核验的基线

- PASS：`node --test packages/common/test/config.test.mjs packages/common/test/entry.test.mjs scripts/runtime/settings.test.mjs scripts/runtime/identity-runtime.test.mjs scripts/runtime/deployment.test.mjs scripts/runtime/retire-outline.test.mjs scripts/runtime/hydra-client.test.mjs`，147 项通过，0 失败、0 跳过。完整输出为临时目录中的 `exwebsite-runtime-architecture-baseline.log`。
- PASS：`pnpm exec vitest run tests/auth/identity-config.test.ts tests/auth/deployment-binding.test.ts tests/runtime/native-health.test.ts --maxWorkers 2`，3 个文件、19 项通过。输出为临时目录中的 `exwebsite-runtime-architecture-vitest-baseline.log`。
- 已复现：对当前 `verifyRuntimeHydraClient()` 注入旧英文 404 消息得到 `HYDRA_CLIENT_MISSING`，只把括号换为冒号即得到 `HYDRA_CLIENT_CHECK_FAILED`；该实验未访问真实服务。
- proof 旧算法固定摘要和完整 inspect 夹具已保存于 proof 设计，后续测试期望必须用字面值，不能调用新 helper 生成期望。

在架构确认待答复期间，又按目标顺序执行完整修改前基线，四个命令均退出 0：

| 命令             | 基线结果                                                     | 临时目录中的完整日志                                    |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `pnpm api:check` | PASS；3 条 schema composition 警告，生成结果一致。           | `exwebsite-runtime-architecture-api-baseline.log`       |
| `pnpm typecheck` | PASS；含 SDK 构建、workspace 和专项类型检查。                | `exwebsite-runtime-architecture-typecheck-baseline.log` |
| `pnpm test`      | PASS；Website 组 285.8 秒、runtime 组 128.1 秒，均成功退出。 | `exwebsite-runtime-architecture-test-baseline.log`      |
| `pnpm build`     | PASS；Contract、SDK、Web、Server 全部完成。                  | `exwebsite-runtime-architecture-build-baseline.log`     |

该轮测试仅在进程内将已安装的 Python 3.11 放到 PATH 前部，避免 WindowsApps Python 别名；未改项目配置。测试/构建另有既有 Vite 原生配置加载警告、Web chunk 体积警告及测试 validator 警告，命令未因警告失败。源码在执行前没有本次实现改动；执行后仍须保持 tracked source diff 为空。

上述结果均为修改前基线，不是重构后的验证或现场验收。

## 下一阶段交接与写入归属

已分别创建不同于设计者、审查者的 `hydra_developer`、`identity_developer`、`proof_developer`，按下表串行完成。每项代码由原独立 Reviewer 审查，三项均通过且无遗留问题。所有 Agent 保留并适配他人修改。

共享工作树的代码、文档和 Git 索引写入串行，建议 Hydra → 身份配置 → proof；同一时刻只向一位作者开放写入：

| 作者                 | 实现与主要测试归属                                                                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hydra_developer`    | `scripts/runtime/hydra-client.mjs`、`scripts/runtime/applications.mjs`、`scripts/runtime/hydra-client.test.mjs`、`tests/runtime/native-health.test.ts`；协调后修改 `scripts/runtime/settings.test.mjs`；如必要，局部调整 `scripts/runtime/output.mjs`。                                      |
| `identity_developer` | `packages/common/src/node/identity-config/index.mjs`、`packages/common/src/node/identity-config/index.d.mts`、`apps/server/src/modules/identity/config.ts`、`scripts/runtime/settings.mjs` 及设计列出的 Common/Server/runtime 行为测试；接续修改共享的 `scripts/runtime/settings.test.mjs`。 |
| `proof_developer`    | 新建 `scripts/runtime/container-proof.mjs`，迁移 `scripts/runtime/services.mjs`、`scripts/runtime/retire-outline.mjs` 及两端测试；最后接续修改 `scripts/runtime/settings.test.mjs`。                                                                                                         |

Hydra Reviewer 的实施建议：真实 HTTP 夹具直接经过 `verifyRuntimeHydraClient()` 和默认校验器，覆盖完整生产者到适配器路径；token 5xx 的兼容分类不能声称已确定秘密错误。身份 Reviewer 的实施建议：保留 local origin 冲突的 `IDENTITY_MODE`、runtime 身份密钥原诊断码，并固定空与非空客户端 receipt v2 字节。

## 完成门槛

| 要求                                                             | 当前状态与完成证据                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 三份设计独立审查及用户确认                                       | PASS；三份候选 v1 均 APPROVED、无阻断，哈希已核对；2026-10-16 用户回复“同意”。                                           |
| 三个独立开发者实施                                               | 三项实现 v1 均完成，已停止写入。                                                                                         |
| 三项独立代码审查、原作者修复与复审                               | 三方向 v1 均获各自原 Reviewer APPROVED，无遗留问题。                                                                     |
| 各方向行为验收                                                   | PASS；方向定向自动测试、原 Reviewer 独立复跑和最终完整测试均通过。                                                       |
| `pnpm api:check` → `pnpm typecheck` → `pnpm test` → `pnpm build` | 实现后四项全部 PASS、exit 0，严格顺序执行，日志和细节见 `.notes/runtime-architecture/verification.md`。                  |
| 稳定 `.ai/` 知识                                                 | PASS；已使用 `codebase-documenter` 更新两份现有边界文档，用户已授权，整合 Reviewer 确认事实与源码/测试一致，无结构变化。 |
| 最终报告与 Goal 完成审计                                         | 审计 PASS，无缺失必需项；证据、剩余兼容限制与验收边界见 `.notes/runtime-architecture/verification.md`。                  |

本任务不执行真实退役 apply，不修改现有配置、数据库、客户端登记、容器、卷、存储、头像或归属记录；自动数据库测试只使用隔离 Testcontainers。不提交、不推送、不创建 PR、不部署。浏览器、真实资源维护和部署验收均未执行。

## 实施交接（2026-10-16）

- 用户“同意”已解除原审批阻塞。九个指定角色已分别创建；开发写入依次 Hydra、身份配置、proof，后两位已完成只读准备。沿用本记录作为任务恢复入口，不额外创建重复 PRD/RFC 或提交。
- Hydra v1 READY_FOR_REVIEW：实现了六类局部结构化错误及适配器安全分类，五个文件的冻结差异保存在 `.notes/runtime-architecture/hydra/implementation-v1.diff`。开发者报告 red→green 已验证，最终 Hydra HTTP 16/16、settings 40/40、native health 3/3、diff check 均 PASS；待原独立 Reviewer 审代码，尚非方向验收完成。
- Hydra v1 独立代码审查 APPROVED，spec + quality 无阻断；冻结 diff SHA256 `30E678D3494C142D2029075A9087D557B59870E48FFB47625916C435A6850E46`。原 `hydra_reviewer` 独立运行 Node 56/56、native health 3/3 通过，`git diff --check` 通过。原有五个候选文件哈希与开发交接一致。身份配置接续写入后，最终整合检查仍需再次覆盖共同修改的 settings 测试。
- 身份配置 v1 READY_FOR_REVIEW：10 个归属文件的排序路径、NUL、原始内容、NUL 拼接 SHA256 为 `a236092e356e18045d97d2157dbfdc48c090cfd011203ea21a94b599620d71ce`，主 Agent 重算一致。冻结差异在 `.notes/runtime-architecture/identity/implementation-v1.diff`（包含 settings 中先前已审 Hydra 的上下文）。开发者报告 Common 63/63、auth Vitest 20/20、settings/identity-runtime/deployment Node 定向组、Server 与 server-types 类型检查、diff check 均 PASS；TDD 的缺少聚合入口和非法输入错误形状均先失败后通过。
- Ruling：基线中 runtime 和 Server 的 `websiteTarget` JSON 键顺序不同；分别冻结各端旧 v2 字节，跨端按现有消费者的完整绑定深相等/规范化 digest 验证一致性。保持 `createIdentityBinding()`、原字段顺序和 pin，不修改生产兼容契约；若判断有误，固定旧字节或跨端消费测试会拒绝。原设计者已核对实际代码并将三处表述澄清为 v1.1（SHA256 `A0D641EA33CB27C1A297F874347B0C50BE73D6843C61B9FE673B031E6657141A`），仅为基线事实纠正，无新增范围；由原 Reviewer 与代码一并复核。
- 身份配置 v1 代码及设计兼容澄清 v1.1 均获原 `identity_reviewer` APPROVED，无阻断/非阻断问题，无新增审批门槛。设计、diff、10 文件聚合 hash 审前审后一致。独立复跑 Common/identity-runtime/deployment Node 组、auth Vitest 20/20、settings 身份密钥诊断及 diff check 均 PASS。冻结 diff SHA256 `DAD01C5820FF0EC53A4959F49F0F44F6655C75A67A3C1F0DBFABAC568FDE529B`。下一阶段由 proof 开发者接续唯一写入权。
- proof v1 READY_FOR_REVIEW：新纯模块及四个消费者/测试文件的冻结 diff 分别为 `.notes/runtime-architecture/proof/implementation-v1.diff`（SHA256 `ED9D9E0FB21721DCE69D0194104212177F08DF69717AE36AD3A580F6D26FFEED`）和 `.notes/runtime-architecture/proof/container-proof-v1.diff`（SHA256 `0D8F4B8B695D77AE1DEAE8E2CD444280167B2F9B3C5DB3E53FBA4B5983D3AF74`）。开发者报告固定旧样本 red→green；settings 44/44、retire-outline 25/25、语法和 diff check PASS。完整日志为临时目录中的 `exwebsite-proof-settings-node.log`、`exwebsite-proof-retire-node.log`。保留容器和 Redis 漂移均在 fake mutation 前拦截并检查旧文件原字节；成功 apply 假体路径确实经过 proof 核验。当前交原 Reviewer 独立复审。
- 主 Agent 使用 `codebase-documenter`，根据已审实现、实际源码和方向测试，更新现有 identity/runtime 两份边界文档：纯身份聚合与适配分工、Hydra 稳定错误类别、receipt 比较语义、共享 proof 入口。无 `.ai/` 结构变化，不另建重复知识或 ADR；文档和最终整合候选待最终审查。
- proof v1 获原 `proof_reviewer` APPROVED，无阻断/非阻断问题；5 个代码文件审前审后 hash 不变。独立定向复跑 proof/owned stop/start/apply 假体 9/9 通过，diff check 通过。共享纯函数逐字保留旧摘要计算，生产与测试无旧方法/prototype 借用，完整归属核验和授权条件保持。
- 整合候选已冻结：tracked 差异 `.notes/runtime-architecture/integration-v1.diff`，新模块 diff 另见 proof 目录；20 个代码/测试/知识文件的逐文件 hash 和聚合 hash 存在 `.notes/runtime-architecture/final-candidate.json`。下一步整体只读复审与最终四项串行门禁；任务记录的后续更新不改生产候选。
- 整合 Reviewer 独立整体审查 APPROVED：未发现 P2 及以上问题或明确目标遗漏，两份知识文档准确；20/20 文件审前审后 hash 一致，聚合 `b37312e2c88aff83639ddeb125d8b9476db6e3861fb03ffc14d689d41d9f8e43`。
- 主 Agent 顺序完成最终 `pnpm api:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`，全部 exit 0；Website 组 294.5 秒、runtime 组 130.2 秒。生成、测试与构建未并行。随后再次核验 manifest 20/20、聚合 hash、精确变化范围和原 HEAD，均一致，diff check 与 staged diff 检查通过。保持 `refactor/docs` 的未提交工作树，不进行 Git 交付。完整逐项完成审计见 `.notes/runtime-architecture/verification.md`。

历史审批记录：设计交付后曾连续三轮缺少同一确认，独立工作及基线验证完成后按规则标为 `blocked`。2026-10-16 用户回复“同意”，解除审批门槛，随后完成上列实施、独立复审、整仓验证及完成审计。该历史阻塞已解除，未遗留待确认事项。
