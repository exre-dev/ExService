# RFC：精简通知恢复功能并统一响应式通知体验

日期：2026-10-09

状态：基于用户已批准的设计编写，完成文档自检；尚未实现或执行实现验收。

批准的范围来源：`.notes/notifications/specs/2026-10-09-notification-experience-design.md`。该文档在本次交接中保持原样。本 RFC 细化实现边界，不扩大其批准范围。

## 1. 决策与结果

移除 Website 通知的恢复记录与撤销能力，保留精确清理快照和命令幂等。通知历史采用 ExUI Modal、Tab、单个批量按钮和滚动自动分页；未选中正文显示居中的铃铛图标及短文案；Header Bar 的零未读 Tag 隐藏。

本次只调整已有持久通知。通知事件生产、投影、个人偏好、授权、正文安全策略和 Outline 保持各自已有职责。不引入通知路由、独立移动端 Sheet、分页协议、兼容 API 或新动画库。

## 2. 核对的系统事实

| 边界   | 当前依据                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP   | `api/openapi.yaml` 是唯一 Contract，当前 `info.version` 为 `0.5.0`；实际路由具有 `/api` 前缀。                                                                            |
| Server | `apps/server/src/app.ts` 的 `serviceHandlers` 显式登记 operation；通知 service/repository 位于 `apps/server/src/modules/notifications/`。                                 |
| Web    | `apps/web/src/notifications/useNotificationsController.ts` 持有请求与交互；`notificationsConfig.ts` 有身份/写代次、unread/history 切片及恢复批次状态。                    |
| UI     | `packages/components/src/notifications/` 接收值与回调，不访问 API；`NotificationsExperience.tsx` 把控制器接到铃铛和历史 Modal。                                           |
| ExUI   | 已安装 `@exre/exui` 0.8.0，公开 Modal 和 Tabs。Modal 的主体默认 `overflow:auto`，手机全屏使用小于 768px 的断点。                                                          |
| 存储   | receipts 清理状态、clear batches/items 与 mutations 同属独立 PostgreSQL `exre`；历史物理 schema 允许恢复字段与状态。                                                      |
| 验证   | `tests/contract/notifications.test.ts` 检查真实 HTTP 和原始 handler 返回值；`tests/notifications/service.test.ts` 使用隔离数据库验证服务行为。根目录未发现 `TESTING.md`。 |

批准的旧范围中 Popup 仍是最多 5 条的未读预览，自动分页只用于完整历史 Modal。设计引用的历史通知 spec 在当前 checkout 未找到，本 RFC 以现有源码和当前批准 spec 为依据。

## 3. Contract 0.6.0 与能力删除

按批准设计将 `info.version` 从 `0.5.0` 调整为 `0.6.0`，明确记录此次破坏性删除；不定义新的通用版本策略。

删除：

| 方法与 Contract 路径                                  | operationId                     |
| ----------------------------------------------------- | ------------------------------- |
| `GET /notifications/clear-batches`                    | `listNotificationClearBatches`  |
| `POST /notifications/clear-batches/{batchId}/restore` | `restoreNotificationClearBatch` |

同时删除 `NotificationClearBatchItem`、`NotificationClearBatchList`、`NotificationRestoreRequest`、`NotificationRestoreResult`，并清除它们的引用。更新保留的 clear-preview/clear-all summary 和 description，去除可恢复承诺。

保留其余现行 operation、请求字段和响应形状：列表、summary、详情、单项阅读状态、read-all、clear-preview、clear-all 和偏好。特别是 `NotificationClearResult.batchId`、clearSnapshotToken、clear revision 和 requestId 仍有实际用途，不随恢复 schema 一起删除。

Server 删除两个 operation 的 import/登记、handler 参数类型、`listClearBatches` 和 `restoreBatch` service、`listClearBatches`/`restoreClearBatch`/`restorableCount` repository 方法，以及删除后确认为无调用方的辅助方法。`findClearBatchForUpdate`、`applyClearBatch`、快照写入、过期预览回收及批次错误检查继续保留。

Contract 修改后运行 `pnpm api:lint` 和 `pnpm api:generate`；生成的 `packages/api-client/src/generated/schema.d.ts` 同步提交到后续代码变更，不能手改。Client、Server 和 Web 同步消费 0.6.0，无两个版本并行服务窗口。

删除后的 GET 批次路径可能匹配保留的 `GET /notifications/{notificationId}` 并因 UUID 参数校验失败返回 400。验收重点为 operation/登记不存在、路径不返回批次数据和不能恢复收件状态，不强制所有删除路径统一为 404，也不为此绕过 Contract 加入 tombstone 路由。

## 4. 数据完整性与历史兼容

本次没有 schema migration、backfill、物理删除或 reset。已执行 migration 和既有 rows 原样保留。

- batches/items 继续记录预览集合、expected/applied clear revision 和执行事实。
- receipt 的 clearedAt/clearBatchId/clearRevision 继续用于清理状态及并发核验。
- 数据库既有 `restored`、`restored_at`、mutation kind `restore` 的历史允许值仍保留；相应持久行类型可以继续描述历史数据。
- 新的命令写入入口和 `claimMutation` 的输入只接受 `read_through | clear`，不再提供恢复执行路径；历史 mutation 读取不能盲目收窄为这两个值，仍要识别旧 kind 并返回冲突。
- `findMutation` 继续按 `(userId, requestId)` 查，先比较 kind 和摘要；`lockUser → claimMutation → lockStream → receipts` 的锁序保持一致。同一 requestId 跨现存 kind 或与历史 restore kind 冲突时返回确定的 409。
- 仍有效的清理预览各自独立；回收仅删除不可再提交的过期 preview，不扩大为已执行批次清扫。

实现前先修改 `.ai/databases/data-model.md` 的清理语义、command 职责及历史兼容说明，再调整生产源码。移除业务功能不意味着更改历史清理记录；新的清理没有任何恢复 API 或 UI。

## 5. 共享组件接口

以下是拟议的视图接口变化，留在 `packages/components`，不导入生成 DTO 或 API Client：

| 接口                                                     | 调整                                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NotificationHistoryModalProps`                          | 删除 records；增加 `countState: NotificationCountState`，把全局计数明确传入 Modal。保留 open/onClose/selectedId/onSelect/list/detail/confirm/finalFocusRef。                                 |
| `NotificationListSlice`                                  | 保留现有筛选、items、status、hasMore、nextPageStatus 和回调；增加 `canAutoLoad: boolean`、`resetVersion: number`。onLoadMore 只负责有效游标续页；新增 onRetryPage 专门从第一页恢复失败分页。 |
| `NotificationBulkSlice`                                  | pending 收窄为 read-all/clear/null；增加 preparing: read-all/clear/null 和 error: string/null；保留 onReadAll/onClearAll。删除 message、lastClearedBatchId、onUndoClear。                    |
| `NotificationConfirmSlice`                               | 沿用 kind/count/pending/expired/onCancel/onSubmit；增加 error: string/null，在确认界面显示持续提交错误。                                                                                     |
| `NotificationRecordsSlice`、`NotificationClearBatchView` | 删除，包括 `packages/components/src/index.ts` 的导出。                                                                                                                                       |

`canAutoLoad` 由控制器结合第一页状态、nextCursor、在途保护、批量/确认状态推导；组件再与 open 和列表实际可见性合取。`resetVersion` 在已接受的第一页替换完成时递增，使组件明确何时恢复到列表顶部；它不是数据库状态版本。

`NotificationsExperience.tsx` 传入 countState，移除 records 接线。`notificationsConfig.ts` 删除 batches 及其类型/身份清理代码，但保留 epoch、阅读与偏好状态。共享文案删除 Popup footer、已加载计数、恢复/撤销文案与 formatClearBatchTime；清理前提示统一为“清理后无法恢复。之后到达的通知会保留。”。

## 6. 列表请求与自动分页

### 6.1 请求归属

现有 epoch/写 seq 只能识别身份变化和写操作，不能淘汰同一身份同一 view 的迟到第一页。控制器增加每个 view 的请求运行态，通过 ref 保管：列表代次、最新请求标识、在途 Promise/游标。不要放入可序列化的 Valtio view slice。

- 第一页主动刷新建立新列表代次；新代次废弃旧分页接受权。
- 相同代次同游标重复续页返回已有在途 Promise，不再发送 HTTP。
- 在途标记在任何 await 之前写入。finally 只能释放自己的 request 标识，不能解除新请求的锁。
- 每个响应落地前核验身份/写代次、view 的列表代次和 request 标识；失败响应也做同样核验。过期响应不更新 items、cursor、计数、状态或错误。
- 关闭 Modal、切 Tab、账号变化淘汰此前历史列表接受权；不依靠网络真正取消来保证正确性。
- Popup 和 Modal 的 unread 请求走同一个入口。Modal 的 unread 列表打开或已分页时，Popup 的常规读取不能悄悄把它刷新回第一页。
- 批量或单项写后，刷新 view 集合去重；当前 filter 为 unread 时只刷新 unread 一次，不并发发起 loadPage(unread) 与 loadUnread()。
- summary 请求拥有自身最新请求标识；批量/单项写代次照常淘汰此前计数读取。批量按钮只消费已接受的全局计数，不能从列表行数重新计算。

### 6.2 自动续页

组件在列表末尾设置 sentinel，使用 `IntersectionObserver`，root 指向 listScroll，rootMargin 为 0。到达底部且 canAutoLoad/open/listVisible 同时为真时调用 onLoadMore。

一次成功追加按 receiptId 去重并保留最新优先的列表顺序。下一页仍存在且 sentinel 持续可见时，在布局完成后再次核验加载条件并串行续页；不要等待新的阈值穿越。检测容器尺寸变化，以便 Modal resize 后未满一屏时继续加载。无 nextCursor 时停止。

首屏空/短页以及去重后高度未增长时以新 cursor 决定能否继续；相同 cursor 已完成过时不重复发起，进入可重试错误态，避免协议异常造成忙循环。

手机正文模式关闭观察触发；返回列表先恢复 scrollTop/焦点，再恢复 sentinel 观察。组件卸载释放 observer、尺寸观察与待执行的布局检查。

### 6.3 失败与重读

第一页初次失败显示列表错误；后续页失败保留所有 items，清空旧 cursor，设置 nextPageStatus=error 并暂停自动请求。末尾显示“通知暂时无法继续加载”和“重新加载通知”。

onRetryPage 使用新列表代次、cursor=null 和 keepItems=true；请求中保留旧列表，失败继续保留，成功替换第一页并递增 resetVersion。普通 onLoadMore 在无游标时直接返回，不隐式刷新第一页。

沿用 Server 的游标上界校验。分页期间个人序列增加可导致旧 cursor 被拒绝，进入上述显式重读路径，不自动重试旧 cursor 或修改 Server 分页语义。

## 7. 批量操作与全局按钮

按钮动作依据 countState，表格中的可靠计数必须来自已接受的全局读取：

| 状态                        | 显示与执行                                                      |
| --------------------------- | --------------------------------------------------------------- |
| ready 且 count > 0          | “已读全部”；点击启动 read-all 准备。                            |
| ready 且 count = 0          | “清理全部”；历史已可靠确认为空时禁用，否则服务端 preview 裁决。 |
| 没有可靠计数的 idle/loading | 禁用的“加载中…”。                                               |
| error 或准备/提交进行中     | 禁用；已有计数可用于保留原标签，但不能推断为零执行清理。        |

空的 unread Tab 不能禁用全局清理；仅本次有效的 history 第一页为空且无 nextCursor，或零项 preview，才证明全局可清理历史为空。

控制器使用一个批量阶段：idle → preparing → confirming → submitting → success/error。准备/提交的同步 ref 防重复进入；pending 不能仅在提交阶段才保护点击。选择操作后固定该确认的语义，轮询计数变化不会把打开的“已读全部”确认变成清理。

read-all 准备得到可靠 summary 后创建并保存 `{requestId, readThroughToken, count}`；提交与不确定结果的重试使用这份固定 body，不能从不断轮询的 summary 临时读取新 token。clear 准备保存现有 `{requestId, token, itemCount, expiresAt, clockOffset}`。重新预览是新意图，取消确认丢弃旧意图。token 到期时提示重新准备，不能使用旧 requestId 配新 token。

清理预览为零不打开提交确认、不执行 clear-all，刷新历史并反馈暂无可清理通知。否则确认“清理这 N 条通知？”，显示无法恢复说明。服务端执行只作用于预览精确集合，之后到达的通知不加入本次操作。

提交失败保留确认内容与意图，在确认中展示固定安全错误和重试入口；不乐观抹掉通知。准备失败回到 idle，在工具行旁显示持续错误及重新准备入口。普通结果反馈调用 ExUI ExMessage，复用 `apps/web/src/main.tsx` 中已有宿主；不增加 Toaster 或底部撤销区。

写成功先失效旧列表接受权，再应用写结果并去重刷新 summary/unread/当前 view；clear 成功清空所选正文。重放命令返回的旧计数只用于本次结果反馈，当前计数等待重新读取，不把历史结果作为当前 summary。

## 8. UI、响应式与焦点

### 8.1 Header Bar 与 Popup

`NotificationBell` 的 badge 条件变为：kind 为 loading/error 时沿用状态提示；kind 为 ready 时仅 count>0 渲染。ready/count=0 不渲染 span，而不是隐藏文本后留下空 Tag。铃铛保留点击能力和可读 aria-label。

删除 Popup footer 节点与仅服务它的 `.foot` 样式，不删除承载“查看全部”的 header 分隔。Popup 仍不自动标已读。

### 8.2 Tab 与正文

使用 ExUI `Tabs`、`TabsList`、`TabsTrigger`、`TabsContent`，受控 value 为 all/unread；TabsList 采用 line 变体。单按钮是工具行的独立右侧兄弟，不能嵌入 tablist。工具行用不换行 flex，Tab 和按钮按 token/紧凑尺寸适配 390px。

当前 Tab 的 TabsContent 包含列表滚动容器，不复制两份列表请求逻辑。切 Tab 清除选择并重置滚动。标题和按钮保持在列表滚动区域之外。

未选中正文使用 Bell（aria-hidden）与“点击通知查看内容”。正文列保持可收缩，空态设 align-self:stretch、flex:1、min-height:0，并使用居中布局；已选正文保持正常阅读布局。空态几何验收以正文实际可用区域为基准。

### 8.3 ExUI Modal

使用公开受控 `Modal`：title=通知历史、size=xl、height=min(48rem, calc(100dvh - 2rem))、padding=0、mobileFullscreen=true、closeLabel=关闭通知历史。不另建 DialogTitle，不改 ExUI 源码。

实例 class 在 CSS Modules 中通过局部约束下的 `:global(.ex-modal-body)` 设 display:flex、flex-direction:column、overflow:hidden；bodyClassName 指向 display:flex、flex:1、min-height:0 的通知主体。内部 grid 继续 flex:1/min-height:0，listScroll 和 detailColumn 各自滚动；原 `.dialog` 宽高/手机留白覆盖删除。不得把通知实例的 override 变成全局 Modal override。

CSS 的手机切换使用 width<768px，与 matchMedia 同一阈值；JS 初始化读取真实匹配值，避免从 Popup 进入手机正文时短暂闪回列表。窄屏根据主动选择显示正文；返回恢复列表 scrollTop，并聚焦所选行，行消失时聚焦当前 Tab。

跨断点只改变布局，不卸载 Modal；保持 selectedId，桌面继续展示两栏，重新缩窄时保持当前阅读选择。关闭清理手机详情模式。关闭返回铃铛，Popup→Modal 的交接禁止 Popup 另抢焦点。

批量 submitting 期间设置 dismissible=false；成功、失败与失效会话结束路径恢复可关闭。保留现行确认弹窗并核验其与外层 Modal 的焦点/关闭关系。`apps/web/index.html` viewport 增加 viewport-fit=cover，安全区留白沿用 ExUI。

## 9. 实施依赖与落地顺序

这些是交付依赖，不自动授权 commit、运行环境变更或部署：

1. 更新 `.ai/databases/data-model.md` 的清理行为语义；Contract 0.6.0 删除 operation/schema，lint 并生成 Client。
2. Server 移除恢复链路，调整对应 contract/service 测试。清理表与既有 migrations 原样保留。
3. Web 删除 batches/restore 状态与接线，完善列表代次、在途保护、固定批量意图及全局按钮输入。
4. 共享组件移除恢复 props/export，接入 ExUI Modal/Tab/自动分页，完成 Popup、空态和铃铛零 Tag。
5. 执行行为与几何验证，完成必要的持久知识同步；保留无关 `.monica/` 工作。

Website 与 Server 属于同一单实例开发交付，完整变更验证后一起启用；不允许只先移除 Server API 再让旧 Web 继续调用恢复。不改依赖来源或 lockfile，不运行隐式数据库迁移。

## 10. 验证矩阵

| 层         | 关键用例与落点                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component  | `NotificationBell.test.tsx`：zero badge 不存在、正数及 loading/error 状态、Popup footer 消失、铃铛仍可用。                                                                                                                                 |
| Component  | `NotificationHistoryModal.test.tsx`：Tab 可访问性与筛选回调、只有一个批量按钮、全局未读不依赖当前 items、空 unread 可清理历史、空态结构与恢复 UI 消失。                                                                                    |
| Component  | observer mock 验证到底触发、连续短页、没有 cursor 停止、手机正文暂停、失败只允许显式重读。DOM 测试不声称几何验收。                                                                                                                         |
| Controller | `useNotificationsController.test.tsx`：同时 observer 回调仅一次请求、第一页覆盖保护、Popup/Modal unread 刷新去重、切 Tab/关 Modal/账号变化迟到响应失效、恢复失败保留旧列表。                                                               |
| Controller | summary 为未知/失败时禁用；准备重复点击去重；read-all 重试 token 与 requestId 不变；轮询不改确认意图；零项清理不提交；新到通知不扩大范围。                                                                                                 |
| Contract   | `tests/contract/notifications.test.ts` 删除恢复 validator/调用，验证删除 operation 与登记；真实 HTTP 不返回批次数据/不能恢复，保留所有剩余 operation 的 HTTP schema 和原始返回值校验。                                                     |
| Service    | `tests/notifications/service.test.ts` 删除恢复业务测试，保留精确清理、有效 preview 独立、过期 preview 回收、本人授权、并发幂等和新到项保留。需恢复才能构造的 revision 变化测试改为隔离数据库 fixture 改变 clear revision，不恢复生产方法。 |
| Service    | 跨 kind 幂等测试改为 read_through/clear，并添加历史 restore mutation 行占用同一 requestId 的冲突用例；读取兼容不能导致命令重复执行。                                                                                                       |
| Browser    | 在 `tests/browser/` 新增通知体验几何验证，桌面、390px、767px、768px；空态中心、单行工具、Modal 满屏、两栏独立滚动、焦点往返、跨断点保留选择、light/dark 与 reduced-motion。                                                                |

自动门禁顺序：`pnpm api:lint`、`pnpm api:generate`、`pnpm typecheck`、`pnpm test`、`pnpm build`。先执行范围匹配测试，再执行必需完整门禁；DB 测试只用 PostgreSQL Testcontainers，Docker 不可用明确失败。

不修改运行账号或开发库来制造测试数据。真实浏览器验收需要现有授权会话或隔离验收 fixture；若不可用明确 NOT_EXECUTED，不能以 Mock 测试代替。真实 iOS/Android 的安全区和动态浏览器工具栏验收单独报告。

## 11. 风险、回退与完成条件

| 风险                                        | 对策与检测                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| 迟到第一页抹掉分页，重复回调发送多次请求    | 每 view 代次与同步在途 guard；用可控 Promise 的 controller 测试验证响应乱序。       |
| 已读重试换 token 导致同 requestId 不同 body | 固定批量意图；轮询期间重试测试比较完整提交 body。                                   |
| ExUI 默认主体滚动造成第三条滚动条或空态偏位 | 当前实例约束高度链，真实浏览器坐标和滚动容器验证。                                  |
| 删除恢复时误删快照、批次或历史允许值        | 保留表/锁序/历史读取类型；contract/service 与既有 schema 测试检查。                 |
| 动态路径接管删除的 GET 被误判为未删除       | 检查 Contract 与 serviceHandlers 双向集合、无数据响应和无恢复状态变化，不仅看 404。 |
| Server/Web 不同步                           | 本地完整验证后同时重建/启用；不留下保留接口或半升级流程。                           |

本阶段不部署。若后续本地启用出现错误，停止升级后的应用，修复或回退同一组 Contract/生成 Client/Server/Web 变更。无 schema migration，因此不需要数据还原。清理过的 receipts 仍然是 cleared，不因代码回退而主动复原；回退旧版本会重新暴露旧恢复能力，因此属于功能回退，需要明确标识，不能宣称符合本 RFC。

完成实现的条件：9 项用户需求全部通过行为/几何验收；不存在恢复 operation/执行路径/组件入口；批次快照和历史数据兼容仍成立；必需自动门禁通过，未执行的真实设备或会话验收明确列出。

## 12. 文档验证与交接状态

当前已核对批准 spec、Contract、控制器和状态切片、共享组件导出、ExUI 0.8.0 公共类型与 Modal 主体样式、Server repository、contract/service 测试及贡献约定。按 technical-design-doc-creator 的质量清单完成范围、契约、失败路径、数据与回退自检。

没有需要重新打开的批准设计决策，无 TBD。真实浏览器/设备效果和门禁结果属于后续实现验收，不是当前证据。本次只新增 RFC；原 spec 不变，没有修改业务代码、运行测试、提交或部署。
