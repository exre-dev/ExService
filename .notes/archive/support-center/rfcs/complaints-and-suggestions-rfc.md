# 投诉和建议实现 RFC

> 2026-10-16：所有反馈表单增加可选 `contentFormat: markdown`；Markdown 与纯文本均保持内容规则 1，只按冻结表单中的格式标识选择正文语义，不新增数据库迁移。表单版本与匿名行为保持原约定。接入依据见 `.notes/support-center/specs/2026-10-16-feedback-markdown-design.md`。

- 状态：用户已确认产品设计；实现方案按本 RFC 执行并独立复核。
- 日期：2026-10-15。
- Spec：`.notes/support-center/specs/2026-10-15-complaints-and-suggestions-design.md`。

## 1. 决策

扩展现有支持反馈流程，新增 `suggestion`、`complaint` 两种表单。复用附件、不可变提交和单步推进；通过显式 `area` 区分入口的 options 与浏览器恢复，服务端按表单类型选择可信目标。采用扩展现有业务域的方案，避免复制完整状态机；相比独立投诉服务，其代价是必须覆盖既有六类回归。

## 2. Contract

新增 `FeedbackArea`：`development | community`。`GET /support/feedback/options` 增加可选 query `area`，默认 `development`，保持旧调用返回六类选项；`community` 返回两类选项。`FeedbackOptions.kinds` 允许 2–6 项，`actions` 允许 0–4 项；community 返回空 actions 和仅大文件补充字段。两个区域独立读取和缓存远端元数据，某一区域故障不能使另一入口不可用。

新增两种封闭对象，加入 `FeedbackForm` 和 `FeedbackSubmissionForm`：

```ts
type SuggestionForm = {
  kind: 'suggestion'
  title: string
  contentText: string
  largeFileInfo: string | null
}
type ComplaintForm = {
  kind: 'complaint'
  title: string
  contentText: string
  largeFileInfo: string | null
  anonymous: boolean
}
```

只有 complaint 接受且要求 boolean `anonymous`；suggestion 和原六类对象拒绝额外匿名属性。快照回传原始匿名状态，客户端提交后不可修改。沿用现有 prepare/get/lookup/upload/advance operations、错误码、限额及归属规则。生成 Client 不得手改。

## 3. 目标和匿名载荷

新增固定 community 目标：Workspace `90181517066`、Space `90186006983`、List `1100500000004310`、TaskType `1003`、状态「待处理」。suggestion 对应 Tag「反馈」，complaint 对应 Tag「投诉」，标题不加前缀。原 development 目标不变。

按 form kind 选择目标列表、状态、TaskType 和 Tag；不接受客户端覆盖。community 不依赖 Type/Domain，不写 Summary；复用大文件字段 JSON。用户字段保持服务端受控，不公开整份探测 JSON。

匿名 complaint 的 custom_fields 完全省略用户字段；不在系统生成的 Markdown 中添加昵称和用户 UUID。prepare 仍保留内部 user_id，但不要求为匿名载荷读取 Profile。冻结载荷、摘要及 readRecord 校验必须支持零个自定义字段或仅大文件字段。远端核对除匹配发送字段外，还检查匿名任务的用户字段没有非空值。community 冻结载荷将「投诉」「反馈」纳入受控集合，返回错误或互相冲突的分类 Tag 不得被当作成功；development v2 继续原受控操作 Tag 集合，不能因新增社区分类而改变旧任务上无关 Tag 的核对语义。

## 4. 元数据与失效

新增按 area 隔离的 metadata 实例/缓存，沿用 60 秒缓存与并发 refresh 合并。公开 options 只显示所属 area 类型。preflight 从 form kind 派生 area，核验实际列表、状态、Feedback TaskType、字段适用范围及对应 Tag。缺少某个 Tag 只禁用对应 kind；现有冻结记录继续按其冻结载荷恢复，不被当前 options 阻断。

在实施准备阶段只读核对并一次性创建缺失的「投诉」「反馈」Tag，创建后 GET 验证；运行时不创建 Tag。创建颜色若接口要求，使用中性默认色，不引入业务语义。

## 5. 数据和兼容

原六类维持 `form_version=2`；suggestion/complaint 使用 `form_version=3`，`content_rule_version=1`。`support_feedback_form_check` 扩展为两组 kind/version 的析取，增量迁移只替换约束，不删除/重写数据。同步 Drizzle metadata、结构签名及 readiness。匿名昵称快照使用空字符串，不存储用于对外身份的昵称；内部 user_id 外键仍必需。

readRecord 仍校验完整归一化表单、附件、摘要、正文与冻结载荷。新记录按匿名策略验证字段，原 v2 null Bug 分类继续可读。prepare 的 form_version 和 target_list_id 从规范化表单及冻结目标生成，不能固定为旧列表。幂等摘要包含 anonymous，改动该值重放同一 key 必须冲突。原有全局用户额度继续生效。

回滚应用不能回滚掉新记录；需要先停止新入口写入并保留支持 v3 的读取/恢复代码。不得通过删除数据或缩回约束来掩盖不兼容。

## 6. 前端

`FeedbackModal` 接受 `area`（默认 development），首页两个入口均使用该组件。类型配置按 area 分组，community 两张卡片使用 Send/Danger，其余视觉沿用既有卡片。表单复用 title/contentText/FileUploader；匿名为投诉草稿中的 RHF boolean，在 footer 提交按钮左侧显示 ExUI Switch，使用独立 ID、标签和解释。未填写内容时默认关闭，放弃后重置；关闭确认、恢复、冻结和账号切换沿用原规则。

`getFeedbackOptions(area)` 只经生成 API Client 调用。`FeedbackFlow` 在保留既有 delay 参数的同时增加可选 area 参数：development 保持 `exwebsite.feedback.v2`，community 使用 `exwebsite.feedback.community.v1`。每个 Flow 仅接受所属 area 的 form/snapshot，拒绝损坏或错入口指针，而非在错误入口展示/推进原记录。浏览器不持久化正文和 File。

Footer 保留提交/推进操作，没有底部关闭按钮；匿名投诉底部左侧保留匿名控制。读取使用骨架，背景色 Hover，桌面/窄屏及 light/dark 按现有主题 token 工作。

## 7. 验证和交付

后端覆盖真实 HTTP 与原始 handler：两个新表单、错误匿名类型/跨类型注入、options 分区、失效 Tag 局部禁用、匿名任务/附件完整提交、远端身份异常、摘要冲突、重开恢复、老 v2 读取和增量迁移。前端覆盖两个入口、卡片图标、必填、匿名仅投诉/默认关闭、草稿隔离、关闭确认、提交冻结、错入口恢复拒绝。

执行 API lint/generate、针对性测试、typecheck、完整测试和 build。真实浏览器验证两个主题与窄屏。Tag 创建允许外部写；真实投诉任务或附件验收如需创建测试内容，需有专门授权。数据库迁移文件与隔离测试不等于已修改本地开发库，应用现有库的显式迁移另行核对。

## 8. 实施顺序

先增量更新数据规则与 Contract，生成类型，再实现服务端/迁移和前端。各任务有独立测试与代码复核，最后整体验证。没有未决产品选择；测试发现的技术细化按 Spec 约束作最小修正并记录。
