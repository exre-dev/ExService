# 共享容器归属 proof 纯入口设计

状态：候选 v1，待独立设计审查。

## 决策与范围

在 `scripts/runtime/container-proof.mjs` 提取 `containerProof(item)`，接收一份 Docker inspect 容器对象并返回现有 `{ id, service, digest }`。`scripts/runtime/services.mjs` 的启动、停止归属核验与 `scripts/runtime/retire-outline.mjs` 的计划、执行复核直接导入它；相关测试也直接导入。删除 `Services.proof()` 及所有 `Services.prototype.proof.call({}, item)`。两个生产消费者都在 `scripts/runtime/`，目前没有放入 `packages/common/` 的跨包需求。

这是现有计算的搬移，不改 proof 格式、摘要算法、归属记录版本、退役计划格式、错误码、锁或操作授权。没有 HTTP Contract、数据库或身份协议变更，也不包括完整退役计划入口的 adapter 重构。

## 现状与接口

`scripts/runtime/services.mjs:88` 的 `Services.proof(item)` 不使用 `this`，退役流程在 `scripts/runtime/retire-outline.mjs:91` 借用其 prototype，测试在 `scripts/runtime/retire-outline.test.mjs:136` 重复此写法。日常服务的 `verifyProofs()`、`start()`、`stop()` 和退役计划的原记录检查、保留容器检查、Redis 删除前检查都以同一摘要为归属判据。

拟定唯一导出：

```js
export function containerProof(item) // { id: string, service: string, digest: string }
```

入口不读取环境、Docker 或文件，不持有实例状态，也不修改 `item`。它保持当前字段与计算顺序：

```js
const host = { ...item.HostConfig }
for (const key of ['Dns', 'DnsOptions', 'DnsSearch']) {
  if (host[key] === null) host[key] = []
}
return {
  id: item.Id,
  service: item.Config.Labels['com.docker.compose.service'],
  digest: digest({
    image: item.Image,
    config: item.Config,
    host,
    mounts: [...item.Mounts].sort((a, b) => a.Destination.localeCompare(b.Destination)),
  }),
}
```

`Mounts` 只复制数组再按 `Destination` 使用现有比较器排序；每个 mount 的全部原字段参与摘要。只有 `HostConfig.Dns`、`DnsOptions`、`DnsSearch` 的 `null` 转为 `[]`；未出现的属性、非空数组、其他 `HostConfig` 属性以及其他容器字段不归一化。`digest()` 继续使用 `scripts/runtime/local-config.mjs`：对象键递归排序后 `JSON.stringify`，数组顺序保留，再作 SHA-256 十六进制摘要。不可增加字段、默认值、额外排序键或序列化包装。

以下固定旧行为样本由提取前的 `Services.proof()` 计算。回归测试须保留完整输入与**字面期望**，不能通过新入口生成期望：

```js
const item = {
  Id: 'container-1',
  Image: 'sha256:img',
  Config: {
    Image: 'repo@sha256:manifest',
    Labels: { 'com.docker.compose.service': 'hydra' },
    Env: ['A=1'],
  },
  HostConfig: {
    Dns: null,
    DnsOptions: null,
    DnsSearch: null,
    Privileged: false,
    PortBindings: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '15432' }] },
  },
  Mounts: [
    {
      Type: 'volume',
      Name: 'vol-b',
      Source: '/var/lib/docker/volumes/vol-b/_data',
      Destination: '/b',
      Driver: 'local',
      Mode: 'rw',
      RW: true,
      Propagation: '',
    },
    {
      Type: 'bind',
      Source: '/host/a',
      Destination: '/a',
      Mode: 'ro',
      RW: false,
      Propagation: 'rprivate',
    },
  ],
}
const expected = {
  id: 'container-1',
  service: 'hydra',
  digest: 'ac4538fe791ed70f9571fb6c45be27b6ad87adb867433971f1b979998d2f52cf',
}
```

## 调用顺序与安全不变量

`Services` 仍先核对完整 inventory 与保存的 exact ID/proof，再允许 Compose 或 Docker stop；启动后保存前和停止后再次核对。已拥有的容器沿用已保存 proof，只有本次新建的容器生成新 proof。停止成功路径在前后全对象摘要相等后继续按当前方式写回等价 proof；漂移时不写回或重新建立 proof。归属记录缺失而 inventory 非空时拒绝启动，未知容器不得按名称接管。

退役计划构造仍要求原 `dependencies.json` 覆盖每个 inspect 容器，然后固定 PostgreSQL、Hydra 与可选 Redis 的 proof。执行时继续以原计划复核保留资源和待删 Redis；容器、卷、数据库、环境与 receipt 的其他检查及 ledger 顺序不变。不能从当前 inspect 刷新旧计划或旧归属记录来通过拒绝，也不能改变 stop/delete 的现有授权条件。设计与测试不得执行真实 `--apply` 或改变现场资源。

## 替代与风险

直接从 `services.mjs` 导出函数虽可消除 prototype 写法，却仍让退役模块依赖日常服务管理实现；独立纯模块让两个调用者共享最小计算入口。搬入 Common 会增加子入口、Node/browser exports 及跨包验证，但目前没有实际跨包消费者。主要风险是实现与测试同时改变摘要输入而形成假阳性，因此固定字面摘要与旧记录兼容测试是落地门槛。

## 验证与落地顺序

1. 先增加固定旧样本及等价性测试，再提取纯入口，依次改 `Services`、退役流程与两处测试。静态搜索确认生产和测试均无 `prototype.proof.call`，也无残留 `Services.proof()` 调用。
2. 纯入口验证固定字面 proof；分别把 Mounts 换序、三个指定 DNS 属性在 `null`/`[]` 之间改变，proof 须相同。分别改变非空 DNS、任一 mount 字段、其他 `HostConfig`、`Config`、`Image`，`digest` 须不同；改变 `Id` 时 `id` 须不同，即使 `digest` 不变，全对象 proof 仍须不同。输入对象保持不变。
3. `scripts/runtime/settings.test.mjs` 经真实 `Services.start()`/`stop()` 路径使用旧归属记录：合法 Docker 表示变化允许启动/停止，停止前后 `proofs` 与旧值深相等；每种实质漂移均在 Docker mutation 前拒绝，记录文件内容不变。缺失记录、未知资源及 Compose 期间漂移的现有拒绝用例继续通过。
4. `scripts/runtime/retire-outline.test.mjs` 经 `applyRetirementPlan()` 的注入 Docker、数据库与锁假体检验保留容器：合法表示变化通过原计划复核，实质漂移在任何退役 mutation 前拒绝且计划、归属文件不变；可选 Redis proof 漂移阻止 `rm`。测试仅用假体，不调用真实退役 apply。
5. 先运行相关 Node 行为测试，再交由主 Agent 按目标文件顺序执行 `pnpm api:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`，并接受独立代码审查。测试与静态检查仅证明本地行为，不表示现场容器退役或部署验收。

独立设计审查通过且满足仓库适用确认要求后实施。本设计没有新持久契约或跨模块架构选择，暂不需要 ADR；若审查发现旧记录兼容性矛盾，应先解决再开发。
