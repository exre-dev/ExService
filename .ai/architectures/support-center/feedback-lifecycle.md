# 支持反馈提交与核对边界

支持首页有「功能和需求」「投诉和建议」两个正式入口，复用一个按 area 配置的 Modal。development 提供 `bug`、`feature`、`asset`、`request`、`content`、`campaign`；community 提供 `suggestion`、`complaint`。正文使用 Tiptap 的纯 GFM 预设，大文件补充信息仍为普通多行文本。前后端通过 `@workspace/common/feedback-content` 共用按格式选择的正文校验、Bug 组合、大小限制与 MIME 规范化。提交编号追加和 ClickUp 正文回读结构核对位于 `apps/server/src/domains/support/markdown.ts`，不进入浏览器共享入口。字段矩阵与交互规则见 `.notes/archive/support-center/specs/2026-10-15-support-feedback-redesign-design.md`、`.notes/archive/support-center/specs/2026-10-15-complaints-and-suggestions-design.md`；Markdown 体验依据为 `.notes/archive/support-center/specs/2026-10-16-feedback-markdown-design.md`。

## Markdown 与历史正文

新表单显式发送 `contentFormat: markdown`；缺省标识继续使用原纯文本规则。内容规则版本与表单版本的关系集中在 `.ai/databases/data-model.md`。`normalizeStoredPrepare` 保留旧字段形状和字节，读取时按冻结格式重新计算正文；不能给旧记录补标识或重新解释 Markdown 标记。历史纯文本恢复使用保留空白的只读文本显示，不经过编辑器节点预算，避免合法旧记录因行数较多而显示为空。

`FeedbackMarkdownField` 位于已有 lazy FeedbackModal 内，组合共享 GFM preset、原生 EditorContent 和 interactions。RHF 保存导出的 Markdown 和转换错误，Zod 阻止实时文档导出失败后提交上一次值；外部 reset 使用显式替换，类型切换按字段重新挂载。页面不添加顶部工具栏、源码模式或图片上传；文件仍经 FileUploader。Markdown 纯文本粘贴通过初始化选项启用，网页/Word 粘贴沿用安全降级；页面不展示降级与规范化通知。

共享 GFM 分析使用无 DOM 的 unified/remark parser，正文按 64 KiB、Bug 单项按 16 KiB 控制，并限制 AST 节点与深度。拒绝代码以外的原始 HTML、脚注和非法链接；代码中的 HTML 保持字面内容。通过追加探测段核对固定提交编号能成为独立块，防止未闭合代码围栏吞掉后缀；Bug 组合另核对每个固定节标题的 AST 位置。Markdown 记录的远端正文使用 GFM AST 核对表格、任务状态和删除线等语义；旧纯文本继续使用原 parser 和原自动链接兼容规则。

## 单元与依赖

`apps/server/src/modules/clickup/` 提供固定官方 API 的通用适配，不依赖反馈业务。`apps/server/src/domains/support/` 固化需求桶、六类任务类型与字段映射，依赖 ClickUp 与 Profile 公开能力；业务服务由构造参数注入，通过具名插件暴露。HTTP 使用 `api/paths/support.yaml` 的六个 operation，前端经共享 Client 调用。`ClickUpFieldInput` 与 `FileUploader` 是 `packages/components/` 中的受控表单组件，不访问 API 或保存提交状态。

`apps/web/public/clickups/fields/` 中 Type、Domain、额外文件链接三个 UUID 命名 JSON 是公开字段定义的唯一编辑来源；Server 构建时校验并打包同一份配置。修改字段名称、选项或顺序后需重新构建并重启。options 与 prepare 按实际 ClickUp 字段、option ID 和任务类型适用范围核对，可用性按依赖的反馈类型给出；缺少操作 Tag 仅使对应操作不可用。字段身份、类型或业务关系变更仍需修改受控映射。当前目标 Space 未确认存在「新增」「修改」「删除」Tag；真实提交前须显式准备并复核，不在提交流程中自动创建。

字段身份清单和纯 JSON 解析由 `scripts/support-field-definition.mjs` 统一提供，原生 Node 构建复制与 Server 的 `field-config.ts` 共用同一实现。构建在三份定义全部通过后复制原字节；运行加载逐文件捕获失败，仅移除不可用字段。解析负责选项排序和归一化，文件路径、复制与降级仍由各自适配器负责；编译后的 Server 仍从仓库根 `scripts/` 加载该纯模块。

`CLICKUP_TOKEN` 从根配置与受支持进程变量进入 Server，不能进入 Web、Outline、Hydra 或构建环境。缺少或非法 token 不阻止其他 Website 功能；全部反馈 operation 仍注册，options 返回安全不可用状态。外部错误正文与凭据不进入响应。接收 wire 预算参与 Nginx 配置计算。

options 的 `area` 默认 development，两个 area 的元数据缓存和故障隔离；服务端 preflight 按 form kind 派生真实目标，客户端不能覆盖列表或状态。community 使用固定「反馈/投诉」列表、Feedback TaskType、待处理状态，按 kind 写「反馈」「投诉」Tag；只依赖用户和大文件字段，不要求 Type/Domain。Tag 仅在显式准备阶段创建，用户提交时缺失只禁用对应类型。旧 development v2 的远端 Tag 核对保留原操作 Tag 集合，不把新的社区分类当作旧任务的冲突。

仅 complaint 接受 anonymous boolean。匿名载荷省略用户字段，保留内部账号关联；服务端不为匿名提交读取昵称用于对外发送。冻结与重放包含匿名状态，远端核对拒绝匿名任务出现非空身份字段。ClickUp 适配不保留复杂用户对象，但以安全存在标记保留不可核对值的事实，避免将被丢弃的对象当作空值。数据版本与账号归属规则见 `.ai/databases/data-model.md`。

## 不可变提交与单步推进

新提交经 `normalizePrepare` 校验 `FeedbackPrepare` 的 intake 条件；持久记录经 `normalizeStoredPrepare` 校验 `FeedbackForm` 的快照形状，并共用正文与附件规范化规则。新增必填条件不能使已有冻结记录失效；具体分类规则见 `.ai/databases/data-model.md`。

prepare 固化带版本的表单、昵称快照、生成的正文、附件清单，以及包含目标 List、TaskType、状态、字段 ID／值／类型和操作 Tag 的创建载荷及摘要。后续推进和回读使用冻结载荷，不依据当前目标常量或更新后的字段 JSON 重新计算。服务端核验字段、任务类型和归属；Bug 不含 Domain，仅 `feature` 可含 Domain，所有类型均不写 Category。`feature` 创建标准 Task（`custom_item_id=0`）；仅 `asset`、`content` 接受操作值，其中新增、修改、删除映射同名中文 Tag，「其他」及其余类型不写操作 Tag。数据职责见 `.ai/databases/data-model.md`。逐文件上传在认证及归属检查后消费字节，复用公共 multipart 生命周期，并核对实际长度、SHA-256、文件名和 MIME。

`apps/server/src/domains/support/frozen-payload.ts` 统一验证历史载荷并核对远端任务，读取、推进和维护共用验证结果。v2 保留冻结目标与字段映射的历史兼容；v3 以追加保留的历史 profile 与当前写入 profile 核验目标和字段，具名身份及大文件字段必须来自同一条 profile。切换目标或字段前保留原 profile；匿名远端核对拒绝全部已知历史及当前用户字段中的非空或不可解析值，不能从匿名载荷缺少字段推断身份字段已经安全。摘要用于损坏检测，不是防止数据库写入者重算摘要的签名。

大文件补充信息是可选多行原始文本，最多 16 KiB UTF-8，允许多个链接、提取码与说明；只有非空白内容才随表单提交，保留已提交文本的首尾空白和换行。它不触发下载或解析链接。完整大小限制和输入规则见上述 Spec。

浏览器依次接收附件、推进创建、推进附件同步，每次 advance 至多一个外部写请求。expectedRevision 小于当前值时只返回状态，不能把重放应用到下一步骤。父行锁和 attempt UUID 在发送前固化认领，外部调用在短事务外执行；结果提交核对 attempt、boot ID 和状态，防止迟到响应覆盖维护裁决。

`apps/server/src/domains/support/lifecycle.ts` 在父行锁下统一应用正常推进与人工维护的结果，负责完成条件、revision、attempt/failure 清理及附件字节释放。正常结果使用 attempt 与 boot 栅栏，维护结论使用 attempt 与预读 revision；过期或旧 boot 的在途尝试通过独立 reconcile 条件转为核对。外部调用与维护证据验证留在各自入口。创建已保存任务 ID 后不能按明确未写入处理；附件上传虽已有任务 ID，明确拒绝且未保存附件远端 ID 时仍可失败并保留字节供显式重试。

创建请求一并传入操作 Tag，不另加补 Tag 写步骤。创建响应的 task ID 先保存，再只读核对远端类型、List、标题、状态、用户字段、填写字段、操作 Tag 和正文。任务与全部附件都保存成功结果才 completed。成功附件释放暂存字节，失败和未知结果保留原任务与字节。外部明确拒绝才允许用户重试；超时、断线、5xx 或无法解析的成功结果进入 verification_required，不依据“没查到”重新写入。

ClickUp 的 Markdown 回读会将显式 hard break 改为文本内换行；正文核对保留每个换行并合并相邻 text 节点，其他内联与块结构仍须一致。按已确认的自动链接规则，远端 HTTP／HTTPS 链接仅在全部子节点为 text、无 title、文字与目标逐字符相同且 URL 无凭据、空白、控制字符或反斜杠时还原为原 URL 文字参与完整 AST 核对；不做 URL 同化。其他链接或 HTML、标题等格式变化保留已知任务 ID 并进入 verification_required。不能用 description 的纯文字相同绕过此核对，也不能为继续上传而重新创建任务。产品规则见 `.notes/archive/support-center/rfcs/support-feedback-rfc.md` 第 8 节。

GET、HEAD 和 lookup 不认领、清理或写远端。过期在途读取只派生 verify；显式 advance、启动恢复或维护操作才持久化核对状态。监听前恢复旧 boot 尝试，关闭时拒绝新推进并等待当前步骤收尾；没有后台重投队列。

## 浏览器恢复与维护

`apps/web/src/pages/Support/feedback/` 使用 RHF/Zod 与 ExUI Dialog。`App` 路由树外的 `FeedbackProvider` 按需加载并保留两个入口的反馈表单，统一认领进行中的命令；站内切换页面只隐藏弹窗，不卸载提交任务。各类型草稿在所属 `FeedbackModal` 内分别留存；返回类型选择不混入别的类型字段或附件。关闭有内容且尚未提交的草稿先在同一 Dialog 确认继续填写或放弃，确认放弃后清空草稿。prepare 开始后类型和匿名状态锁定；提交期间可通过关闭按钮、Esc 或遮罩直接关闭，原提交和附件继续推进。重新点击任一反馈入口时只用 toast 提示正在上传，不打开弹窗。

同目录 `kind-rules.ts` 集中八类 kind 的 area、字段适用性与展示文案，Modal、Zod 和恢复流程共同消费。未知 kind 不按非社区补集推断 development；表单序列化与还原继续按生成 Contract 的判别 union 保留明确形状。该规则属于 Website 反馈流程，不进入 Common。

提交期间仅原主按钮显示 Spinner 与「提交中」，不渲染进度 Block、提交编号或常驻 loading 通知。任务和全部附件完成后通过 toast 提示成功、清空表单并关闭弹窗；已关闭的弹窗不会因失败重新打开。明确失败保留原提交并提供「重试」；超时、断线或远端结果待确认时提示核对，并只提供「核对进度」，不能直接再次写入。缺失附件仍可重新选择并核对摘要；恢复后的可继续步骤使用同一个主按钮。

development 的 sessionStorage key 保持 `exwebsite.feedback.v2`，community 使用 `exwebsite.feedback.community.v1`，仅保存提交 key／ID；两个入口分别保留原提交并拒绝错入口表单与快照。冻结 prepare、正文与 File 留在当前 SPA 内存；关闭弹窗或站内导航不清理进行中的任务。刷新或关闭浏览器不能保证任务继续执行，重新进入后读取原记录并按需重新选择附件。只有 key 时的 404 不能自动生成新 key；已确认可重试的 prepare 沿用原 key 和冻结载荷，未知结果只能只读 lookup。

反馈流程以 `sessionScopeRevision()` 和 token 共同确定归属。实际切换 API root，即使 token 字符串相同，也销毁已挂载的反馈表单、清空 pending、File 与快照，并释放命令认领；等价的规范化 root 保留草稿。Modal 的挂载 key 包含范围版本，切换后同批更新内立即重开也会创建新表单并读取新 root 的选项。

每个流程阶段在发送前和接收结果后核对 epoch、API 范围与会话，选项读取和页面成功/失败分支也拒绝旧范围结果。范围检查直接参与 Flow 的有效性判定，不依赖 React 卸载完成；旧 prepare 或附件响应不能在新 root 继续上传或 advance，也不能覆盖新会话指针、显示旧账号的结果或释放新任务的认领。停止命令不代表撤回已经发出的远端写入。

维护入口为 `pnpm --filter @workspace/server support-feedback`，具体命令参数见 `.notes/archive/support-center/rfcs/support-feedback-rfc.md` 第 9 节。CLI 只显式运行，支持安全 inspect、任务/附件回填、有限未执行证据确认和过期接收清理计划。回填要求精确 attempt 和远端归属；附件还须校验维护者提供的下载文件字节。清理默认只读，应用需显式确认，只能删除未开始外部同步的过期 receiving。

当前读取六类 development v2 与两类 community v3 记录；v3 增量迁移仅扩展约束，不清理 v2 反馈或附件。早期 Request/Bug v1 退役规则仍属于历史迁移，不能在新增类型时再次清理已接收记录。普通启动不执行迁移；具体兼容与隐私核对见 `.notes/archive/support-center/rfcs/complaints-and-suggestions-rfc.md`。

自动测试使用 fake transport 与隔离 PostgreSQL，浏览器可核对本站流程；这些不代表真实 ClickUp 显示、六类任务／Tag／附件上传或公网部署已经验收。外部 Tag 准备、真实写入和开发库迁移仍需分别显式执行。
