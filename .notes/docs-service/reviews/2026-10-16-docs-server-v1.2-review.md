# Docs Server v1.2 独立复审报告（受影响范围）

日期：2026-10-16。审查人：Exre Reviewer（独立复审，非候选作者）。
结论：**PASS（v1.2 受影响范围）**。**R-01 已独立解决。** 这是窄范围结论，只覆盖本轮变化及其引出的新问题；v1.0/v1.1 的历史 FAIL 与指纹绑定保留原样。

## 1. 审查单元与版本绑定

本结论**只**绑定下列文件与摘要；任一变化即失效。

| 文件                                                                | SHA-256                                                            | 核对                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `.notes/docs-service/specs/2026-10-16-docs-server-v1.2-design.md`   | `a1d968e54dc71c71e2cd2bd71e413a0f9717ecd963284807757c30f6099ab8c1` | 附件 = 共享工程 = 公布值 |
| `.notes/docs-service/specs/2026-10-16-docs-server-v1.2-contract.md` | `146a716452c095872a3fd1b11d09a1b09897c13a34359207875962c01ab201e0` | 附件 = 共享工程 = 公布值 |
| `.notes/docs-service/specs/2026-10-16-docs-server-v1.2-content.md`  | `926c97bb3ada3f2dfa38bd12fd70edd435f33ceb3a5f437565484479ddecc28c` | 附件 = 共享工程 = 公布值 |
| 作者平台探针脚本 `2026-10-16-docs-server-v1.2-head-probe.mjs`       | `ed25486750c79364b6855d00661b99536532f308c618b2924fe64a82c9de3db9` | 与主设计 §14 记录一致    |
| 作者探针输出 `2026-10-16-docs-server-v1.2-head-probe.json`          | `d62e3298bfe4b8f3aa2fec15a9a8d203721f366acc0dbfb649667e346275a455` | 与主设计 §14 记录一致    |

对照材料指纹保持原样：v1.0 三份（`143549cf…840082`、`509d0e0f…cd82fc`、`58e3e17a…021c9d8`）、v1.1 三份（`5f4fa830…2190cc`、`4fb20b3e…d81fc2`、`65ceafbf…dd0bf`）、v1.0 报告 `b8902b2b…1a7482`、v1.1 报告 `1b76ebe8…d571314`。

审查者独立 `monica attachment download` 并重算全部摘要。这只证明候选一致性，不代表功能验收。

## 2. 复审范围与 NOT_EXECUTED

按 Lead 交接，复用未变化内容的可沿用证据，只刷新受影响部分：R-01 的 HEAD 接线、N-01–N-04、三份文档交叉引用，以及由差异引出的新问题。

**项目侧 NOT_EXECUTED 清单不变**：生产实现、Contract 生成/运行校验、类型检查、Docs 功能测试、构建、数据库与性能实验均未执行。

**本次运行的是平台行为探针，不是 Docs 实现或验收**：针对已安装的 Fastify 5.12.5 / Glue 4.11.4 在进程内执行（一律 `app.inject()`／`app.ready()`，**不监听端口、不连接数据库、不写入仓库**）。它们只能证明 Fastify/Glue 的既有组合行为，不能证明 Docs 实现正确。脚本置于 Agent 缓存目录，不属于本仓库。

未修改生产代码、`.ai/`、Git 索引、数据库或运行服务；本报告是本次唯一新增文件。仓库 `git status` 与开工前一致。

## 3. R-01 判定：已独立解决

### 3.1 先验证 Lead 点名的前提：探针清单对 v1.2 是否有效

探针脚本（`head-probe.mjs:19-20`）从 **v1.1** Contract 快照解析 12 个 GET 行。Lead 要求先确认它逐项等于 v1.2。我对 v1.1 与 v1.2 的 Contract 做了全量 operation 抽取比对（operationId + method + path + 认证列）：

- **30 个 operation 全量 diff：完全一致**（v1.1 = 30，v1.2 = 30）。
- **12 个 GET 子集 diff：完全一致**（`listDocsSpaces`、`getDocsSpace`、`getDocsTree`、`getDocsDocument`、`listDocsTrash`、`getDocsTrashedDocument`、`searchDocsDocuments`、`listDocsTemplates`、`getDocsTemplate`、`listDocsAttachments`、`getDocsAttachment`、`listDocsComments`），method/path/security 逐项相同。

**结论：探针的 v1.1 派生清单对 v1.2 有效，可以把结果绑定到 v1.2。**

### 3.2 独立复跑作者探针

按其记录的复现方式（tsx loader + `apps/server/tsconfig.json`）实际执行，输出：

```json
{
  "purpose": "Platform composition feasibility only; not Docs implementation or acceptance",
  "versions": { "node": "v22.22.1", "fastify": "5.12.5", "glue": "4.11.4", "tsx": "4.23.13" },
  "result": "PASS",
  "scenarios": 88,
  "docsHead": 40,
  "docsGet": 36,
  "nonDocs": 12
}
```

与作者记录逐项一致：88 场景 PASS，Docs HEAD 40 / Docs GET 36 / 非 Docs 12，版本组合相同。

### 3.3 审查人自建独立探针（不同夹具，含阴性对照）

为避免只依赖作者夹具，我另写了一个最小探针（2 个 Docs GET：1 公开 + 1 受保护，1 个非 Docs GET），导入**真实** foundation、真实 `NOT_FOUND_MESSAGE`、真实 Glue，按 Contract §5 的机制接线。实际结果：

| 核验点                                              | 实际结果                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 自动 HEAD 路由**仍会生成**                          | 是，3 个 GET 全部生成了 HEAD 分支（含非 Docs）                                                                                                |
| 自动 HEAD 是否携带 `schema.operationId` 与 `config` | 是，两条 Docs HEAD 均 `hasConfig: true` → operationId 分流可行                                                                                |
| `exposeHeadRoute` 在 onRoute 中可见值               | 全部 `null` → 独立复证 v1.1 R-01 根因（Glue 不透传）                                                                                          |
| Docs HEAD 状态 / 响应体 / `Cache-Control`           | **404** / 0 字节 / `no-store`                                                                                                                 |
| 请求 ID                                             | 服务端生成，未被调用方传入的 `x-request-id` 冒充                                                                                              |
| 404 envelope                                        | `{error:{code:'NOT_FOUND', message:NOT_FOUND_MESSAGE, requestId:<与响应头一致>}}` → 复用已安装 setNotFoundHandler，未用 `DOCS_NOT_FOUND`      |
| HEAD 是否执行 handler / 两级 preValidation          | 均未执行                                                                                                                                      |
| HEAD hook 轨迹                                      | `inherited-onRequest -> docs-head-404` → 追加的 route hook 在 inherited hook **之后**，印证 §5 L128「追加不等于抢在 inherited hook 前面执行」 |
| **受保护 Docs GET 的 HEAD**                         | **404（不是 401）**，且无 `glue-auth` 调用 → Lead 单独点名的验收项成立                                                                        |
| 同路径 GET 回归                                     | 200 + `no-store`，轨迹 `inherited-onRequest -> docs-get-onRequest -> inherited-preValidation -> docs-get-preValidation -> handler`            |
| 非 Docs 隔离                                        | HEAD 200 / GET 200，未触发 `docs-head-404`                                                                                                    |

**阴性对照在同一次运行中成立**：无拦截器的非 Docs 路径，其自动 HEAD 返回 **200**；Docs 路径的 HEAD 返回 404。这证明 404 由拦截器产生，而非来自其他因素。

### 3.4 源码级核验

| 声明                                           | 核验                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Contract §5 L123 的 `route.js:223/245/295/453` | 与本地一致（开关求值 / 浅拷贝 / onRoute / 自动注册）                                                              |
| §5 L127 `reply.callNotFound()`                 | 存在于 `fastify/lib/reply.js:477`                                                                                 |
| §5 L125／L128：foundation onRequest 不认证     | `apps/server/src/http/cors.ts:37-51` 只做请求 ID、CORS 与 OPTIONS 提前终结，无认证                                |
| §14 锁定的三个文件 SHA-256                     | `route.js` `eb46caeb…def1051`、`reply.js` `55c860c7…fdb1fb`、Glue `index.js` `c1b316eb…f293d58`，**实测全部一致** |

**R-01 判定：已独立解决。** 机制从「阻止隐式注册」改为「拦截自动 HEAD 分支并返回统一 404」，这是我 v1.1 报告推荐、Lead 裁定的方向，且已由作者探针与我的独立探针双重验证。

## 4. 规范表述已改正（R-01 的另一半）

v1.1 的过度表述已全部撤回，v1.2 准确区分了「路由生成」与「对外拒绝」：

- Contract §1 L7：「Docs 对外不支持 HEAD，同路径 HEAD 统一 404；**Fastify 仍可能自动注册 HEAD 路由，不能把协议限制描述为阻止了隐式注册**。」
- Contract §5 L110／L123：明确不通过 `exposeHeadRoute` 关闭生成，并记录 v1.1 机制撤回的理由。
- 设计 §1 L25、§13 D-07 行：同步撤回。
- 未新增 HEAD operation；30 个正式 operation、全局 `exposeHeadRoutes`、函数式 `serviceHandlers` 约定均保留（Contract §1 L9、§5 L99/L126、§7 计数已复核）。

## 5. N-01–N-04 处置

| 项   | 处置                                                                                                                                                                                  | 复审意见                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| N-01 | 保留 v1.1 已独立核验的委托方案，在 Contract §5 L154 补明「依赖 foundation 先注册」，由 `dependencies: ['http-foundation']` 与装配顺序保证                                             | **接受**。我原本只建议更简单的替代方案，属非阻塞；保留已核验方案并补明顺序依赖同样闭合了缺口                 |
| N-02 | deparse 引用统一固定 `REL_18_0`；Fastify 固定 `v5.12.5`；Glue 按已安装 4.11.4 文件摘要核验                                                                                            | **接受**。全量检索确认 v1.2 已无 `REL_18_STABLE`、`/latest/`、`blob/main` 等浮动引用                         |
| N-03 | §10 L301-305 拆成采集真实 deparse、逐字固化、反例三步，并明确「不预设 29 条约束的数量」                                                                                               | **接受**，且优于我的建议：我 v1.1 提的「29 条」是未经真实 migration 固化的数字，设计已按完整约束集合核对取代 |
| N-04 | Contract §5 L129 限定为 `apps/server/src/domains/docs/api/transport.ts` 内最小辅助函数，处理 undefined/function/array 三种形状并生成新数组，不 import 私有 `appendHook`、不改共享模块 | **接受**，符合 Lead 的「优先 Docs 内部最小实现」裁定                                                         |

**N-02 附带说明（信息性，非缺陷）**：我独立抓取 `REL_18_0` 的 `ruleutils.c` 复核，两个条件语句确实位于 `switch (conForm->contype)` 结束后的公共路径上，对外键生效——**实质结论成立**。但该文件约 389 KB，我的读取是部分的，无法独立确认设计标注的 `L2596–2599` 行号。这是文档精度的小问题，无实现影响：设计已强制要求以真实 PG18 deparse 结果固化签名，而非照抄行号。

## 6. 交叉引用与未变化部分的复用

- **三份文件一致**：Contract §5 L121-131（接线与安装顺序）、L135-148（12 路径矩阵）、L150（附加回归）；设计 §11 L339（测试矩阵）、§13 D-07 行、§14（响应与证据）；内容附录仅版本号与一段证据说明不同（`diff` 确认，内容语义与 v1.1 完全相同）。
- **12 路径矩阵自洽**：HEAD 一律 404/404/404；GET 按类别为核心公开 200/200/200、核心受保护 401/200/401、B 公开 501/501/501、B 受保护 401/501/401，与 B 类 501 及认证边界一致。
- **可复用而未重开的已核验结论**（对应文件未变化）：配额与迁出披露、完整定义比对覆盖延迟属性、错误委托与解析期重映射、恢复保序、投影 8 MiB 上界、四类 route config（12/4/13/1）、tableRow `*` 与 rowspan 网格、24 节点 + 8 Marks 与两层 parity、五表与树/回收语义、30 个无冲突 operation。

## 7. 新建议（非阻塞）

- **N-05（低，建议）**：HEAD 拦截依赖「自动 HEAD 继承 `config` 与 `schema.operationId`」这一 Fastify 内部行为，而非公开契约。升级 Fastify 后若该继承关系改变，分流会静默失效、HEAD 退回 GET 处理链。建议在 Docs transport 启动时断言「12 个 GET 标识各观察到一个 HEAD 分支」（作者探针已有等价断言 `registered.filter(HEAD).length === 12`），把它提升为 boot 期守卫，并纳入 §11 的升级回归。
- **N-06（低，信息）**：设计 §14 记录 PostgreSQL 源文件 SHA-256 `a6a61610…8a6fc1`。我未独立下载该文件校验该摘要，仅确认了 `REL_18_0` 中的实质代码。留待后续需要时核对。

## 8. 结论

**PASS（v1.2 受影响范围）**，绑定本报告第 1 节的整组指纹；**R-01 已独立解决**。

- R-01：已解决（作者探针 88 场景独立复跑一致 + 审查人自建探针含阴性对照 + 源码级核验 + 锁定的三个文件摘要实测一致）。
- N-01–N-04：全部接受，无遗留。
- 新建议：N-05（boot 期 HEAD 分支守卫，低）、N-06（PostgreSQL 源文件摘要未独立校验，信息性）。

未发现范围扩张或新的不一致：仍为五张表、单一 Fastify 领域、独立 `exre`、30 个正式 operation、无新服务/队列/通用框架、未授权前端或浏览器组件改动；需求基线一致性保持。内容附录除版本标识外无语义变化。

**证据边界**：本轮平台探针只证明 Fastify/Glue 的组合可行性与规范描述的接线成立，**不是** Docs 实现、Docs 功能测试或验收。第 11 节全部实施门禁（真实 HTTP/原始 handler、9 MiB wire、数据库零调用 spy、内容 parity、迁移/readiness/reset、性能实测）仍待获批后执行。

**交接**：本复审结果交回 **Exre Lead**。就本轮受影响范围而言，v1.2 已具备提交用户架构审批的条件；是否连同 v1.0/v1.1 的历史结论一并向用户说明，由 Lead 决定。Stage 1 保持 `in_progress`，`design_approval_status=not_submitted`、`implementation_authorized=false`。
