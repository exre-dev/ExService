# Hydra 客户端校验的稳定错误契约

状态：候选 v1，待独立设计审查。

## 决定与现状

在 `scripts/runtime/hydra-client.mjs` 的校验模块定义局部结构化错误，由它判定失败类别；`scripts/runtime/applications.mjs` 只按类别生成现有中文运行诊断。`verifyHydraClient()` 仍只读，`ensureHydraClient()` 仍只在显式 `pnpm infra clients` 中登记。HTTP Contract、身份协议、数据库和已有运行命令均不变。

当前校验模块将非法配置、客户端缺失、配置冲突、凭据探测失败表示为普通英文 `Error.message`（`scripts/runtime/hydra-client.mjs`）。`verifyRuntimeHydraClient()` 用完整句子与正则识别这些错误（`scripts/runtime/applications.mjs`），本地启动与 native 健康检查共用该适配器。`scripts/runtime/settings.test.mjs` 和 `tests/runtime/native-health.test.ts` 还复制了英文句子。现有真实 loopback HTTP 夹具位于 `scripts/runtime/hydra-client.test.mjs`；网络诊断与中文恢复步骤位于 `scripts/runtime/output.mjs`。这些是当前源码事实；目标文件 `.notes/gaol.md` 所述文案变化导致分类退化，是本设计要消除的故障模式。

## 内部契约与分工

`hydra-client.mjs` 导出 `HydraClientCheckError`，其只供 Node runtime 消费，不成为 Website HTTP envelope 或通用错误框架。契约包含不可变、封闭集合的 `kind`，安全的固定 `message`，以及网络请求失败时可选的原生 `cause`。不得把请求 URL、配置值、密钥、Authorization、响应体或原始异常文案放入 `message`、公开诊断或日志。`cause` 只供运行适配器提取安全网络码，不能整体输出。适配器须同时核对 `instanceof HydraClientCheckError` 和合法 `kind`；同名属性的普通对象与未知 `kind` 按未知错误处理。非结构化原生网络错误仅可走下述安全码白名单。

| `kind`                    | 校验模块产生条件                                                                            | `verifyRuntimeHydraClient()` 的现有运行分类                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `CLIENT_MISSING`          | 只读 GET 指定 client 返回 404                                                               | `HYDRA_CLIENT_MISSING`                                                                        |
| `CLIENT_CONFLICT`         | 已有 client 的 ID、回调、scope、grant、认证方式、issuer、指纹或其他受控元数据与显式配置不符 | `HYDRA_CLIENT_CONFLICT`                                                                       |
| `CREDENTIAL_PROBE_FAILED` | token 探测得到有效 JSON，但结果不是预期的 HTTP 400 + `invalid_grant`                        | `HYDRA_CLIENT_CONFLICT`                                                                       |
| `INVALID_CONFIG`          | 显式 client、admin/public URL 解析或校验失败，且尚未请求 Hydra                              | `HYDRA_CONFIG_INVALID`                                                                        |
| `NETWORK_FAILURE`         | admin 或 token `fetch` 拒绝、超时                                                           | 仅安全白名单中的网络 `cause.code` 沿用现有 `diagnostic()`；其余为 `HYDRA_CLIENT_CHECK_FAILED` |
| `CHECK_FAILED`            | 非预期 admin HTTP 状态、响应 JSON 无效等无法确定 client 状态的结果                          | `HYDRA_CLIENT_CHECK_FAILED`                                                                   |

HTTP 404 只在只读 GET 指定 client 时证明“未登记”；POST 失败或其他 404 不得误报为缺失。`ensureHydraClient()` 仅在 GET 404 后 POST，POST 409 仍重新 GET 并按最终状态校验，不覆盖已有 client。GET 或 POST 的非预期状态归 `CHECK_FAILED`，不读取响应体来猜类别。凭据探测继续以随机无效 code 的 `400/invalid_grant` 证明秘密可用；任何其他有效 JSON 结果归 `CREDENTIAL_PROBE_FAILED`。这类结果可能来自无效凭据，也可能来自协议服务故障或 5xx，不能在诊断中声称已确定秘密错误。为保持已有运行分类与恢复步骤，该类别仍映射 `HYDRA_CLIENT_CONFLICT`；后续如需区分服务故障，须有独立证据和另行评审。无效 JSON 或意外解析错误归 `CHECK_FAILED`。

运行适配器保留 Hydra readiness 先于 client 校验、空客户端仍检查协议就绪的顺序；保留原有 `RuntimeError`，包括 readiness 的错误码。业务类别只由有效结构化错误决定，不读 `message`、HTTP 文案或正则。网络诊断仅从捕获异常的 `cause.code`（必要时含 Node `fetch` 的内层 `cause.code` 或 `errors[0].code`）取 `ECONNREFUSED`、`ENOTFOUND`、`EAI_AGAIN`、`ETIMEDOUT`、`ECONNRESET` 等既有安全码；传给 `diagnostic()` 的应是仅含已核准 code 的数据。为兼容现有 readiness/测试依赖，非结构化异常若仅含这些安全网络码，也按原网络诊断处理。无安全码的网络失败及任何未知错误均使用固定 `HYDRA_CLIENT_CHECK_FAILED`，不回显原始内容。配置键、中文提示和恢复步骤仍由 `applications.mjs` 与 `output.mjs` 负责。

## 影响、替代与风险

实现集中在 `scripts/runtime/hydra-client.mjs` 和 `scripts/runtime/applications.mjs`；对应行为测试在 `scripts/runtime/hydra-client.test.mjs`、`scripts/runtime/settings.test.mjs`、`tests/runtime/native-health.test.ts`。若需调整诊断白名单，`scripts/runtime/output.mjs` 只可做局部安全映射。`infrastructure.mjs` 的显式登记、`deployment.mjs` / `convert.mjs` / `retire-outline.mjs` 的只读调用方式与现有外部契约不改。无需迁移、双写、版本化或新 ADR：契约局限在同一 runtime 层，沿用既有身份和运行边界；若审查发现跨模块持久决策，再交主 Agent 判断是否另记 ADR。

替代方案一是集中英文文案常量，但消费者仍须解释文案，新增失败分支会继续产生隐式耦合。替代方案二是直接在校验模块抛 `RuntimeError`，会把中文运行提示、配置键与通用校验绑定，也让显式登记和只读调用共享不合适的呈现责任。局部 `kind` 契约把分类放在生产者、呈现放在适配器，接口规模仅为类别与可选网络 cause。

主要风险是 token 5xx 仍给出既有冲突类诊断；现有提示只说“配置不一致”，恢复步骤也禁止自动覆盖，不把它断言为秘密错误。用 5xx 夹具记录该兼容限制，后续改善须单独评审。另一个风险是原生异常对象可能包含敏感 URL 或响应内容；只读取经白名单核准的 code，测试公开诊断和持久日志中无配置值、秘密、原始响应。未知异常安全失败；不因分类失败而登记、覆盖 client 或扩大权限。

## 验证与落地顺序

先增加结构化错误及真实 HTTP 夹具断言，再改运行适配器和受影响测试。夹具应覆盖只读 GET 404、已登记但元数据冲突、token `invalid_client`、非预期 HTTP/坏 JSON、admin/token 网络拒绝与超时，并断言只读路径无 POST/PUT，显式 `ensure` 仍幂等且冲突不覆盖。至少一条用例使用真实 loopback HTTP 夹具调用 `verifyHydraClient()`，将其产生的错误交给 `verifyRuntimeHydraClient()`，证明生产者与消费者端到端一致；同一 `kind` 更换 `message` 后运行类别须不变。适配器另测安全 `cause.code`、未知 code/异常回退、原有 readiness `RuntimeError`、空客户端和 native 健康路径；检查终端诊断及日志不出现秘密、配置值、原始响应。

行为测试后按目标的仓库整体验证顺序执行 `pnpm api:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`，生成产物相关操作串行。该改动无持久状态；若回退，仅回退代码和测试，不刷新部署绑定、Hydra client 或运行资源。隔离 HTTP/Node 测试证明本仓库的错误分类，不替代真实 Hydra、浏览器或部署验收。
