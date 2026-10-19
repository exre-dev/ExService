# 集中整份身份配置纯校验（候选 v1.1）

状态：原 v1 已获用户确认；v1.1 仅澄清既有兼容事实、无新增范围，待独立复审。

## 决策与依据

在现有 `@workspace/common/node/identity-config` 子入口增加一个接收显式值的纯聚合函数，由它验证并组装一份启用后的身份配置。Server 和 runtime 各保留来源、运行拓扑及输出适配。这样调用者只需提供原始身份值，不再分别维护根 URL、密钥、客户端和投递目标的完整拼装顺序。

当前 `packages/common/src/node/identity-config/index.mjs` 已实现 URL、密钥、客户端、cleanup-only 目标解析，现役与历史目标组合，以及 receipt v2 投影（第 34–235、237–296 行）。但 `apps/server/src/modules/identity/config.ts:20` 和 `scripts/runtime/settings.mjs:114` 各自编排整份配置；Server 另检验 local 三个 origin 互异，runtime 先检验端口与监听拓扑。现有测试没有证明两端已出现合法输入的语义冲突；此变更是控制后续漂移。

目标是同一份合法身份输入在两端得到一致的身份语义和部署绑定，并保留 `IDENTITY_ENABLED=false`、默认空客户端、cleanup-only 权限隔离、冻结结果及现有诊断。HTTP Contract、数据库、OIDC 协议、环境来源和运行资源均不变。

## 共享契约与职责

提议在 `packages/common/src/node/identity-config/index.mjs` 与对应的 `index.d.mts` 同步公开：

```ts
parseIdentityConfiguration({
  mode,                    // 输入可为 unknown；结果限 local | deployment
  publicOrigin,            // 原始 SERVER_PUBLIC_WEB_BASE_URL 或 runtime 计算值
  publicOriginVariable,    // 'SERVER_PUBLIC_WEB_BASE_URL' | 'PUBLIC_ORIGIN'
  issuer,                  // HYDRA_PUBLIC_URL
  hydraAdminUrl,           // HYDRA_ADMIN_URL
  bootstrapKey, flowKey,   // 原始身份密钥
  clientsJson,             // IDENTITY_CLIENTS_JSON，可省略
  cleanupTargetsJson,      // IDENTITY_OUTBOX_TARGETS_JSON，可省略
}): Readonly<IdentityConfiguration>
```

`publicOriginVariable` 只为保留两端原有错误配置键；入口仅接受上述两个固定标识，不能从任意调用方字符串拼出诊断。所有输入由调用者显式提供；Common 不读 `process.env`、`.env.local`、receipt、数据库或网络，导入也不产生 I/O。

聚合函数先校验 mode 和三个根 URL：public origin 转为 `URL.origin`，issuer 与 Hydra admin 保留现有根 URL 规范化；local 要求三者 origin 两两不同。随后用现有 `parseIdentityKey()`、`parseIdentityClients()`、`parseIdentityDeliveryTargets()`、`composeIdentityClients()` 校验并组合。返回冻结的 `{ mode, publicOrigin, issuer, hydraAdminUrl, keys: { bootstrap, flow }, approvedClients, cleanupTargets, integrationClients, deliveryTargets }`，其中所有嵌套对象、客户端 scope 数组和撤销目标也保持冻结。省略的两个 JSON 值仍分别表示 `[]` 和 `{}`；cleanup-only clientId 只进入投递目的地，不获得批准客户端或内部接口调用权。同名现役与 cleanup-only 目标必须逐项一致，不从现役配置补齐历史目标。

非法输入只抛现有 `IdentityConfigError(variable)`，`code` 与 `message` 形式不变，错误不包含 URL、JSON、密钥或底层解析消息。未预期异常由适配器安全处理，不将原始异常写入运行诊断。原有细粒度公开函数保留，供 Hydra client 校验、显式旧配置转换及现有消费者使用；它们的解析规则仍是聚合函数的唯一实现来源。

Server 的 `parseIdentityConfig(env)` 保留 `IDENTITY_ENABLED` 的严格 `true`/`false` 开关、默认禁用且不检查其余身份字段的行为，以及 `NodeJS.ProcessEnv` 读取。启用后一次调用聚合函数，并仅附加 `{ enabled: true }`；既有 `IdentityConfig` 字段和 `IdentityConfigError` 转发保持兼容。`apps/server/src/modules/identity/deployment-binding.ts` 继续从实际 `DATABASE_URL` 求 Website target，并在 worker 启动前比对 receipt。

runtime 的 `readRuntimeConfiguration()` 保留根文件和受支持进程变量覆盖、`RUNTIME_PROFILE`、通用 URL/端口/监听拓扑、数据库连接、Website/Hydra 非身份密钥、`RuntimeError` 诊断、service 专属环境和 Web 白名单。根入口通用密码学密钥预检维持原顺序；对身份两键先用现有 `required()` 保留缺失时 `CONFIG_REQUIRED`，再调用 Common 的 `parseIdentityKey()` 并映射格式错误为 `CRYPTO_KEY_INVALID`，不在 runtime 保留第二份身份 hex 正则。聚合结果投影到现有 `state.clients`、`state.cleanupTargets`、`state.identity`、`state.config` 和 `state.secrets` 形状；其余身份错误仅按 `IdentityConfigError.variable` 映射为 `RuntimeError('IDENTITY_CONFIG_INVALID')`，不回显输入。`environmentsFor()` 继续只把身份 JSON 与密钥投影给 Server；Web 环境没有任何身份秘密。

`scripts/runtime/convert.mjs:97` 是显式旧配置与原目标核验，不是普通运行时的整份配置入口；它仍可调用已有细粒度解析及组合函数，不改变历史转换边界。

## 兼容、顺序与替代方案

`createIdentityBinding()` 的字段、插入顺序、排序、SHA-256 输入和 v2 JSON 形状均不改。Server 与 runtime 仍以各自求得的实际 Website database target 调用它；聚合函数不生成 receipt、不读 pin、不刷新已有绑定。现有 runtime 与 Server 的 `websiteTarget` 字段插入顺序不同，跨端原始 `JSON.stringify` 字节本来就不相同；各端分别保持自身变更前的 v2 字节。对同一份 runtime 投影到 Server 的配置，`issuer`、`publicOrigin`、Hydra admin、两把密钥、现役与 cleanup-only 目标及完整绑定字段须按深度相等或现有规范化 digest 比较为一致，不为统一原始字节重排字段或重建 pin。身份路由或秘密真实变化仍按原机制拒绝旧 pin。

先修改 Common 实现与 `.d.mts`，再改 Server adapter，随后串行改 runtime settings 与相关测试。此顺序让类型和消费方始终对齐；开发时须协调 `scripts/runtime/settings.test.mjs` 的其他方向写入。回退仅还原源码与测试，不迁移数据或处理现有 pin。若固定 receipt 对照或投影等价失败，停止该方向集成并修复，不能以重新 prepare 绕过差异。

保留现状会让两端继续掌握整份配置的组合规则；另建 Server/runtime 共用的环境读取器则会把根配置来源、拓扑和 Web 投影带进 Common。选择现有 Node 子入口中的显式值聚合，可集中共同不变量，同时保持两个适配器的职责。

## 影响文件与验证

实现影响 `packages/common/src/node/identity-config/index.mjs`、`index.d.mts`、`apps/server/src/modules/identity/config.ts`、`scripts/runtime/settings.mjs`。主要测试在 `packages/common/test/config.test.mjs`、`packages/common/test/entry.test.mjs`、`tests/auth/identity-config.test.ts`、`scripts/runtime/settings.test.mjs`、`scripts/runtime/identity-runtime.test.mjs`、`tests/auth/deployment-binding.test.ts` 与 `scripts/runtime/deployment.test.mjs`；`scripts/runtime/tests.mjs` 已列出 Common 与 runtime 测试，无需增加新测试入口。

| 验证面                    | 必须证明                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common 纯入口             | 空客户端和有效 local/deployment 配置、不可变返回；非法 URL/密钥/重复客户端、同名投递目标冲突均按固定变量失败且无秘密；无环境读取或 I/O。                                                                                                  |
| Server 与 runtime adapter | 禁用 Server 不解析其他字段；runtime 根来源和拓扑诊断不变；身份两键缺失/格式错误保留 `CONFIG_REQUIRED`/`CRYPTO_KEY_INVALID`；runtime Server 环境投影经 `parseIdentityConfig()` 后，身份字段与权限映射逐项相等。                            |
| 权限与绑定                | cleanup-only 不成为批准客户端或 integration caller；现役/历史同名目标不一致拒绝；用变更前固定 v2 JSON 夹具分别对照各端原始字节，跨端以全字段深度相等或规范化 digest 对照；空与非空客户端均不要求刷新 pin，秘密不出现在 receipt/Web 环境。 |
| 包边界                    | 标准 Node 导入新聚合导出成功；根入口和未公开深路径拒绝；Node `browser` 条件拒绝；`packages/common/test/entry.test.mjs` 的真实 Vite 浏览器构建对该 Node 子入口仍明确失败。                                                                 |

方向行为测试通过后，按目标文件执行 `pnpm api:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`，共享生成产物的阶段串行。自动测试只证明源码与隔离夹具行为；真实浏览器应用流程、现场身份服务和部署另行报告。

## 风险与待审事项

- runtime 通用 URL/密钥预检可能先于聚合函数报错：保持既有顺序与错误码，并以无密钥泄露的反例测试核对。
- `publicOriginVariable` 若允许任意字符串会污染诊断：类型与运行时都限制为两个固定配置键。
- 聚合结果若改变 URL 规范化或客户端顺序，会触发旧 receipt 拒绝：各端固定字节夹具与 runtime→Server 全字段语义比较作为集成门槛。

无需要另建 ADR 的新跨模块原则：现有 Common Node 子入口、身份路由 pin 与 runtime 边界均沿用。设计审查需确认上述纯入口和诊断兼容后，再按仓库要求由主 Agent 汇总请求适用的用户确认。
