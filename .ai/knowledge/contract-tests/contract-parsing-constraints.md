# Contract 测试对 Contract 形状的隐含约束

> 已退役：历史 Node/Fastify 实现记录。文中路径、命令和行为仅用于理解当时选择；现行 PHP/Webman 边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 与 `apps/php-server/TESTING.md`。

**结论：Server 与 Contract Test 通过中立 reader 读取 `api/generated/openapi.json`；源文件拆分和 JSON Pointer 由生成流程收敛，测试仍须明确选择要编译和断言的 schema。**

_最后更新：2026-10-11_

## 已知约束

### 1. path item 引用必须可解析

`apps/server/src/contract/document.ts` 的 `resolvePathItem()` 解析内部 path item `$ref`，再由 `listOperations()` 枚举 HTTP 方法。不存在的目标、循环引用、无效 JSON Pointer 转义或与引用目标冲突的同名字段会抛错。生成流程也会把解析后的 path item 写入统一 JSON。

这避免静默跳过 operation，防止双向覆盖检查漏报 handler。

### 2. 每个 operation 必须带非空 `operationId`

缺失、空字符串或重复时 `listOperations()` 抛错。没有唯一 `operationId` 的 operation 无法映射到 handler，也无法参与覆盖检查。

### 3. Draft-07 测试转换只重写组件 schema 引用

`tests/helpers/contract.ts` 递归遍历 `components.schemas` 中的 `$ref` 字段，将 `#/components/schemas/` 前缀重写为 `#/definitions/`，拼成自包含的 definitions 交给 Ajv。因此：

- schema 之间的 `$ref` 必须写成 `#/components/schemas/<Name>` 这一种形式。
- 指向其他位置（例如 `#/components/responses/...`）或外部文件的 `$ref` 不会被重写，Ajv 也就无法解析。
- 跨源文件引用须先由生成流程打包为统一 JSON；测试不直接解析拆分源文件。

### 4. 只有被显式编译的 schema 会参与校验

`compileComponentSchema(name)` 只编译调用方点名的 schema。新增 schema 时，如果不为它增加编译与对应断言，它既不参与正向校验，也不参与反向用例 —— 看起来「测试通过」，实际没有覆盖。

### 5. Ajv 以 `strict: false` 构造

未知关键字不会让测试失败。因此反向用例只证明「被断言的这几条语义生效」，不构成「schema 完全符合运行时校验器语义」的证明；后者由每次 `createApp()` 触发 Fastify 路由注册来兜底。

## 证据

- `apps/server/src/contract/document.ts`：`readContract()`、`resolvePathItem()`、`listOperations()` 与引用校验。
- `tests/helpers/contract.ts`：`toDraft07Definitions()` 与 `compileComponentSchema()`。
- `tests/contract/document.test.ts`：引用、operation 与失败路径的断言。
