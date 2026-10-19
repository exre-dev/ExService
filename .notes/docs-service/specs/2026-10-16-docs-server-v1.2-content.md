# Docs Server v1.2：完整 Tiptap 内容附录

日期：2026-10-16。状态：**DESIGN_REVIEW_REQUIRED**。与主设计、Contract 附录组成同一 v1.2 候选。本文件确定 Node 校验 profile，不将现有浏览器转换器视为已经可用的服务端实现。

v1.2 本附录仅更新候选版本标识，内容语义与 v1.1 完全相同；不重开内容 profile、预算、网格或 parity 设计。v1.1 复审对这些语义的有效源码证据可复用，服务端内容实现与验收仍 NOT_EXECUTED。HEAD 接线变化及 R-01、N-01–N-04 响应见同版本主设计第 14 节及 Contract 第 1/5 节。

## 1. 内容事实来源与版本

正文为 Tiptap JSON 对象，`contentSchemaVersion=1` 对应本仓库当前完整富文本预设，锁定 Tiptap **3.32.0**。不接受 Markdown、MDX、HTML 字符串、Yjs 数据或浏览器 Editor 对象作为正文。`null` 不是空正文；空 doc 和空 paragraph 都是合法输入，规范化后至少一个 paragraph。

当前 `packages/components/src/tiptap/extensions/index.ts` 的完整预设、`packages/components/src/tiptap/conversion/validate.ts`、`packages/components/src/tiptap/conversion/policy.ts`、`packages/components/src/tiptap/conversion/table-validation.ts` 是源码依据；`.ai/knowledge/components/tiptap-content-boundaries.md` 是已读边界。GFM 是另一套 preset，本服务不接受它专属的行内 Image 或 H5/H6。使用完整预设支持的全部节点与 Marks，不能将“富文本”缩成段落、标题和列表。

本次还通过官方 tag 源码核对 [Details](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-details/src/details.ts)、[Summary](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-details/src/summary/details-summary.ts)、[Mention](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-mention/src/mention.ts)、[Link](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-link/src/link.ts)、[Image](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-image/src/image.ts)、[Cell](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-table/src/cell/table-cell.ts)和[Header](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-table/src/header/table-header.ts)。Summary 的内容是 `text*`，不能误写为任意 inline；表格单元格包含 align 属性；Link 还包含 title。宿主配置对上游默认属性的覆盖以本地源码为准。

`contentSchemaVersion` 是持久内容协议版本，不等于文档 `version`、Tiptap npm 版本或历史记录。未来新增节点/属性或放宽策略时新增 profile，明确升级和旧内容读取规则；本期只实现 profile 1。未知版本明确拒绝，不猜测转换，不修改旧文档来迁就新运行时。

v1.1 另核对官方 3.32.0 的 [TableRow 源码](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/extension-table/src/row/table-row.ts#L27)，子内容确为零或多个 cell/header；v1.0 的 `+` 是规格错误，改为 `*`。此处不是为新能力修改浏览器预设。

## 2. Node 校验实现边界

在 `apps/server/src/domains/docs/content/` 保留纯 `schema`、`validation`、`policy` 和文本投影函数；Server 显式依赖与组件锁定相同的 `@tiptap/pm@3.32.0`，只导入其 `model` 子入口。使用纯 ProseMirror `Schema`、`nodeFromJSON`、`Node.check()`；不创建 Editor，不导入组件包根、React、CSS、NodeView、HTML/Markdown 转换器、jsdom 或 parse5。

该子路径已从[官方 3.32.0 package exports](https://github.com/ueberdosis/tiptap/blob/v3.32.0/packages/pm/package.json)静态核对，包含 `./model` 的 ESM/CJS 及声明导出；这不替代安装后在纯 Node 环境的真实 import 验证。本次未安装依赖或执行导入实验。

本期选择领域内的最小 NodeSpec/MarkSpec，而不为一次使用建立新共享包或搬迁浏览器模块。它只描述持久文档语法与默认属性，不复制 HTTP endpoint 或 DTO。HTTP 的节点/属性 union 仍唯一维护于 `api/schemas/docs.yaml`。以下两层测试分别约束结构与值域，不能互相替代：

- **schema parity**：在 jsdom 测试中固定使用 `packages/components/src/tiptap/extensions/index.ts` 导出的 `createTiptapExtensions({purpose:'conversion'})`，通过官方 `getSchema` 提取；不能使用 GFM 工厂或裸上游 Image/Details 扩展。比较 24 个 node 和 8 个 mark 的名称集合/顺序、Mark rank，以及 `content/marks/group/inline/atom/selectable/draggable/code/whitespace/defining/definingAsContext/definingForContent/isolating/inclusive/excludes/spanning/linebreakReplacement/tableRole` 与 attrs 名称/默认值。缺省字段按同一规则处理，DOM parse/render、commands、plugins、NodeView 不比较。现有 `packages/components/src/tiptap/conversion/foundation.test.ts` 已验证三个 purpose 的 schema 一致与扩展不重名，不另加仅重复该实现的测试。
- **值域/策略 parity**：Server 领域 policy 有本地有限规则，不在运行时 import 组件内部文件。测试才从 `packages/components/src/tiptap/conversion/validate.ts`、`packages/components/src/tiptap/conversion/policy.ts` 读取浏览器验证能力，用同一组有效/无效边界样本分别验证 Server 和完整预设，并核对 Contract 中的枚举/范围。至少覆盖 heading 1–4、对齐、跨度/列宽、图片尺寸、orderedList.type、language、颜色/字号、URL、Link target/rel、Mention 和 Admonition。Schema 的默认数字属性不会验证这些值域，schema parity 通过不等于值域已通过。

需要在 Server 侧显式维护并由上述测试绑定的规则为：Admonition tip/info/warning/error、orderedList 1/a/A/i/I、cell align left/center/right、textAlign 再含 justify、Link target/rel、heading/尺寸/跨度等数值边界、hex/字号和 URL 规则。自研 Admonition 不来自上游 npm 包，必须对照本仓库扩展及 `ADMONITION_TYPES`；这些是有测试绑定的本地实现，不是自动共享的单一常量。已知 Docs 加严项是累计表格网格、严格原始 JSON 字段及 Unicode 存储门禁，另有零宽表错误分类差异；在成对策略测试中显式列出差异，不用无差别接受范围相等掩盖它们。

Server 的 Node 测试另在没有 `window/document` 的进程中导入并验证组合正文；jsdom 测试不得进入生产依赖。heading `level:5` 即使通过 ProseMirror schema，也须在值域层按 profile 1 拒绝，不能指望 schema parity 找到该错误。

输入经过以下顺序，不能先让 ProseMirror 丢弃字段再检查：

1. Docs 按 operation 的 onRequest 前置认证及 wire 限额先执行。JSON 解析后、默认递归 AJV 前，迭代检查深度、节点/Mark 数及值类型；拒绝循环引用的直接 service 输入，不对未经检查的深对象先调用递归 stringify。
2. 根据下表的有限节点/Mark/属性，拒绝未知字段和值类型，检查 Unicode、地址、样式和表格跨度预算。Contract 也提供封闭递归 union；两者不能用 permissive object 替代。
3. 在独立快照上填充声明的默认属性并执行有限规范化，空 doc 变为 paragraph，末尾不是 paragraph 时追加空 paragraph。每个新增节点计入预算。
4. 调用纯 Schema 读取，执行 `Node.check()` 并验证所有表格的完整逻辑网格。禁止 `createAndFill` 或自动表格修补掩盖失败。
5. 得到最终 JSON 后重新检查全部内容预算与 Contract 形状，提取文本投影，再在业务事务中一起写入正文、profile、投影和版本。失败不写入任何候选或部分投影。

JSONB 可以改变属性键顺序；要求保留文档语义，不要求保留 HTTP 字节排版或对象键顺序。输出使用独立深层快照，不能把可修改的 attrs 引用暴露给调用方或测试，不能将丢弃未知字段称为规范化。

## 3. 完整节点与属性

根节点 schema 名为 `DocsTiptapDocument`，固定 `type: doc`；它的 content 引用非 doc 节点 union，禁止嵌套 doc。节点对象只允许 `type/attrs/content/marks/text` 中适用于该节点的字段，属性对象也封闭。除 text 外禁止 text 字段；text 必须为非空字符串，不能有 attrs/content。叶节点不能有子内容。Mark 对象只允许 type/attrs。

每个非 doc 节点分支与每个 Mark 分支均显式 `required:[type]`，在 properties 中使用其唯一 `type: {const:<名称>}`；分支及 attrs 均 `additionalProperties:false`。非 doc union 的 23 个分支和 Mark union 的 8 个分支采用 `oneOf`，通过不同的 type const 互斥，不依赖可选字段集合判别。根 doc 单独定义。测试逐类型正例、未知 type、混合分支字段和额外 attrs，防止多分支同时匹配。`tableRow.content` 允许长度 0，不能在 Contract 又用 minItems:1 抵消已修正的 Node schema。

下表的默认值在缺省时填入；“无”表示没有持久属性，不能以任意 attrs 绕过。子内容表达式由 Node schema 强制检查；Contract 的递归 union 约束 shape，不能单靠它假装已经验证父子语法。

| 节点                        | 子内容语法                           | 属性与默认值                                                                                                                                                      |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doc`                       | `block+`，输入空数组先规范化         | 无；根不允许 marks/text/attrs。                                                                                                                                   |
| `paragraph`                 | `inline*`                            | `textAlign=null`，可为 left/center/right/justify。                                                                                                                |
| `heading`                   | `inline*`                            | `level=1`，只允许 1–4；`textAlign=null`。                                                                                                                         |
| `text`                      | 叶；inline                           | `text` 非空；可带合法 Marks。                                                                                                                                     |
| `hardBreak`                 | 叶；inline                           | 无；可保留合法 inline Marks。                                                                                                                                     |
| `blockquote`                | `block+`                             | 无。                                                                                                                                                              |
| `bulletList`                | `listItem+`                          | 无。                                                                                                                                                              |
| `orderedList`               | `listItem+`                          | `start=1`，正安全整数；`type=null`，可为 1/a/A/i/I 的字符串。                                                                                                     |
| `listItem`                  | `paragraph block*`                   | 无。                                                                                                                                                              |
| `taskList`                  | `taskItem+`                          | 无。                                                                                                                                                              |
| `taskItem`                  | `paragraph block*`，允许嵌套任务     | `checked=false`，只接受 boolean。                                                                                                                                 |
| `codeBlock`                 | `text*`，无 Marks                    | `language=null`，非空时匹配 ASCII `^[A-Za-z0-9_+\-]*$`，可为空串；保留代码空白。                                                                                  |
| `horizontalRule`            | 叶；block                            | 无。                                                                                                                                                              |
| `image`                     | 叶；block                            | `src` 必填安全地址；`alt=null,title=null,width=null,height=null`。尺寸非空时为 1–8192 整数。                                                                      |
| `mention`                   | 叶；inline/atom                      | `id` 必填非空白字符串；`label=null` 或字符串；`mentionSuggestionChar='@'`。它是内容身份，不是授权凭据。                                                           |
| `details`                   | 恰好 `detailsSummary detailsContent` | `open=false`，boolean；Node profile 固定包含 open。                                                                                                               |
| `detailsSummary`            | `text*`                              | 无；可格式化文本，不接受 hardBreak、Mention 或 block。                                                                                                            |
| `detailsContent`            | `block+`                             | 无。                                                                                                                                                              |
| `table`                     | `tableRow+`                          | 无；不保存 DOM colgroup、View 或布局按钮。                                                                                                                        |
| `tableRow`                  | `(tableCell\|tableHeader)*`          | 无；零或多个单元格，最终还须通过逻辑网格策略。                                                                                                                    |
| `tableCell` / `tableHeader` | `block+`                             | `colspan=1,rowspan=1,colwidth=null,align=null`。span 为 1–10,000 的安全整数；align 可为 left/center/right；colwidth 非空时数组长度等于 colspan，每项整数 0–8192。 |
| `admonition`                | `admonitionTitle block+`             | `type='info'`，只允许 tip/info/warning/error。                                                                                                                    |
| `admonitionTitle`           | `inline*`                            | 无；可以保留受支持的文本、Mention、hardBreak 与 Marks。                                                                                                           |

`inline` 为 text、hardBreak、mention；image 属于 block。块容器的 marks 规则与完整预设一致，不能把块图片变成行内 Link 或放入 heading。共享浏览器预设的 Placeholder、History、Slash、Emoji picker、拖柄和表格控制器没有持久节点，不进入 profile。Emoji 持久化为普通 Unicode 文本。

`details.open` 在上游由扩展选项 `persist` 条件注册；本仓库完整预设固定 `persist:true`，所以 Docs profile 1 的 Node schema **始终包含 open，默认 false**。`persist` 本身不是文档属性，不能出现在 attrs、Contract 或 JSONB 正文；它不允许由请求切换。缺省 open 只补默认值，提交 persist 字段明确拒绝。

### 空 tableRow 与完整网格

ProseMirror 的 `tableRow` 允许零个子节点，这与“文档必须有完整网格”是两层规则。上方单元格的 rowspan 可以覆盖后续行的全部逻辑列，因此该行没有新 cell/header 也合法，不能仅因 `childCount=0` 拒绝。以首行正宽度为基准，迭代将每个单元格放到当前行首个未占据列；最终所有逻辑槽必须恰好占据一次。以下写入候选的第二行为空，但由第一行的 rowspan 完整覆盖，可以接受并往返读取：

```json
{
  "type": "doc",
  "content": [
    {
      "type": "table",
      "content": [
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableCell",
              "attrs": { "rowspan": 2 },
              "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "A" }] }]
            }
          ]
        },
        { "type": "tableRow", "content": [] }
      ]
    }
  ]
}
```

没有前方跨度覆盖的空行留下缺格，或出现重叠/越界，是写入 400 `DOCS_INVALID_CONTENT`。零宽表也按 Docs 结构错误 400，而不是资源超限；现有浏览器 validator 把零宽归为 limit-exceeded，这是显式错误分类差异。虚拟网格乘积/累计超过预算才是 413。Server 保存前已完成该检查，所以合法的被覆盖空行不应在 GET 变成 500；只有存量 profile 1 内容真实损坏、违反结构/值域/网格约束时读取返回固定 500，不能静默修补。以上是设计与源码推演，本次没有运行编辑器或数据库实验。

## 4. Marks 与有限值

共 **8 类 Mark**；单个 inline 节点最多各一种。重复 Mark、互斥组合和错误位置都拒绝，不靠合并或丢弃修复。排列可按 schema rank 规范化，不改变它们覆盖的文字与空白。

| Mark                                    | 属性与规则                                                                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bold`、`italic`、`strike`、`underline` | 无属性。                                                                                                                                                                                                          |
| `code`                                  | 无属性，沿用完整预设的排他规则，不与其他 Mark 混用。                                                                                                                                                              |
| `link`                                  | `href` 必填安全地址；`target=null` 或 _self/_blank；`rel=null` 或仅由 noopener/noreferrer/nofollow 组成；`class` 只能为 null；`title=null` 或字符串。_blank 必须补入 noopener/noreferrer，去重并固定 token 顺序。 |
| `highlight`                             | `color=null` 或受支持的 hex 颜色。                                                                                                                                                                                |
| `textStyle`                             | `color=null,backgroundColor=null,fontSize=null`；不允许 fontFamily/lineHeight 或任意 style/class。                                                                                                                |

hex 颜色只接受 `#rgb/#rgba/#rrggbb/#rrggbbaa`，统一小写并展开短格式；不接受 CSS var、url、命名颜色或 JSON 中的任意 CSS。字号只接受 px/rem，转换为 0.75–3 rem 的有限数值；不接受 NaN、Infinity、calc、百分比或执行性文本。不能将默认属性未列出的新样式保存后悄悄丢掉。

URL 采用当前完整预设的有限策略：非空；拒绝控制字符、空格、反斜杠、协议相对 `//` 和含凭据的地址；允许单个 `/` 开头的站内相对地址，或无用户名/密码的绝对 HTTP(S)。Link 另允许有目标的 mailto；Image 不允许 mailto。Docs profile 1 **关闭全部 Data URL**，也不接受 SVG Data URL、blob、javascript、file 或其他协议；不运行网络探测、不抓取外部图片。

图片 alt/title 的空字符串可规范化为 null，其他文字、连续空格、Tab、换行、代码内容、Mention id/label、任务状态、尺寸和结构必须保留。对所有字符串拒绝 PostgreSQL JSONB 不能保存的 NUL 与未配对 surrogate；不以 replacement character 掩盖失败。

## 5. 预算与 wire 一致性

| 预算               | profile 1 的值与计数方式                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 正文输入/最终 JSON | `Buffer.byteLength(JSON.stringify(content),'utf8') <= 8,388,608`（8 MiB），输入和规范化后分别检查。                                   |
| 文档节点           | 含 doc 根、所有 block、inline 和 text 叶，最多 10,000。Mark 不计为正文节点，但每节点最多 8 类且不可重复。                             |
| 内容深度           | doc 为 0，每层 content 子节点加 1，最大 32；attrs 与 Mark 不增加这项语义深度。                                                        |
| 表格网格           | 每表 `width*height <= 10,000`，整篇所有表累计虚拟格也不超过 10,000。先检查 span、乘法和累计值，再分配网格；缺格、重叠或越界一律 400。 |
| JSON 结构预检      | 迭代检查 JSON 容器最大嵌套 96，给 32 层内容的对象/数组和属性结构留足空间；未知键/类型在进入复杂处理前拒绝。                           |
| 正文相关请求 wire  | `9,437,184`（9 MiB），涵盖 8 MiB 正文及有界 metadata/envelope。使用 route.bodyLimit 实际设置，不扩大普通 API 的全局 4 MiB。           |

整篇表格累计网格是 Docs 的额外资源边界；现有浏览器代码逐表检查，尚未提供此累计门禁。Server 必须明确 413，不能通过删表/合并单元格来接受。未来消费方应展示服务器失败而保留本地正文。本候选没有授权改浏览器组件。

8 MiB 定义为解码后 JSON 的标准紧凑 UTF-8 表示，不是 JS 字符数、文本长度、HTTP Content-Length 或 PostgreSQL jsonb 的物理大小。普通 `JSON.stringify` 发送的受限元数据加合法正文能装入 9 MiB。调用方添加大量空白或把 Unicode 全部改为长转义后仍可能越过 wire 限额；此时明确 413，不承诺所有等价 wire 表示都能通过。

默认属性、末尾空 paragraph、颜色/字号/Link rel 等规范化增加的字节和节点都算最终预算。原始输入刚好达到限额但规范化越界也返回 413。正确的“刚好 8 MiB 可保存”测试必须构造已经满足默认属性/末尾 paragraph 的完整快照，而不是让隐藏的规范化溢出被误报为传输缺陷。

预算超限统一 `DOCS_LIMIT_EXCEEDED`；结构或值非法 400；未知节点/Mark/属性明确拒绝。请求最终成功时，Server 保存和返回同一份规范化正文，不能只存截断 text_content 或不完整 JSON。

## 6. 验证清单与证据状态

实施必须证明以下三组证据，而不能仅以 TypeScript 类型通过代替：

- **Node 纯运行**：无 DOM 导入；组合全文包含所有 24 种节点及 8 类 Marks；完整默认属性/语法和浏览器完整预设 parity。数据库读出的 profile 1 内容重新验证失败时返回固定 500，不在 GET 时静默修复或回写。
- **保真与安全**：样式、Link title/rel、Mention 身份、Details 状态、任务、复杂表格、嵌套 Admonition、图片尺寸与中英文/Emoji/代码空白往返保持语义；rowspan 覆盖整行的空 row 往返不失败，未覆盖空行/零宽/重叠/越界写入拒绝；未知字段、H5/H6、行内 Image、错误 Summary、选区字段、坏 Unicode、危险 URL、重复/互斥 Marks 均明确失败且原数据库正文/版本不变。schema parity 和独立值域样本按第 2 节分别验证，包含 persist 非属性、heading=5 schema 合法但策略拒绝等反例。
- **有限预算与真实传输**：输入及最终字节各自 ±1、节点/深度边界、Mark 上限、多个跨度表累计预算；真实 Fastify 大于 4 MiB 且不超过 8 MiB 的完整正文成功；9 MiB wire ±1、chunked 和缺失 Content-Length；其他 API 仍执行原 4 MiB；所有失败均为固定 envelope。

当前只完成内容 profile 的源码核对和设计自检，尚未建立 Node validator、schema parity 测试或真实 HTTP 结果，状态 **NOT_EXECUTED**。实施方不得把现有 jsdom 转换测试报告为本附录的服务端验证已通过。
