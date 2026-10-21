# 通知读取接受权与固定批量意图

_最后更新：2026-10-20_

PHP 通知接口的 `deliveredAt`、`readAt`、`serverTime` 与清理预览 `expiresAt` 均以 Unix 毫秒返回；它们不沿用邀请冷却字段的秒单位。Web 对时间差、期限和显示分别按字段处理，不能统一乘 1000。

## 读取生命周期

`notificationsConfig` 以 API 范围版本和账号 token 共同绑定身份 epoch，再结合写入 seq 判断响应是否仍属于当前状态。切换 root 即使 token 相同也会递增 epoch，清空计数、列表和偏好快照，使旧读取、保存与偏好私有请求锁失效；旧响应与完成回调不能覆盖新范围或释放它的保存锁。Controller 另以挂载状态、UI 代次、详情请求标识，以及每个列表视图的代次与请求标识拒绝迟到响应。关闭、换号、切换筛选、首屏重读和写入都可能让旧请求失去接受权；失效请求的 finally 不能释放后来请求的在途锁。

单项已读 PATCH 提交后，其结算和在途锁跟随身份与写代次，不随窗口关闭或筛选切换失效。关闭仅清理局部选择；同一身份再次打开时仍禁止第二次单项或批量写入，直到原请求结算。成功刷新当前筛选、未读列表及 summary；重新打开后仍在途的正文读取须替换为提交后的新读取，避免旧 revision 再次触发已读命令。局部失败提示仅回到原 UI 上下文；换号、退出、会话失效或卸载后的响应不能落地，旧请求的 finally 不能释放新身份的锁。

历史和未读列表每页 20 条，按 receipt ID 去重。同一游标在途时复用请求；已完成游标再次出现时停止自动分页，并提供从第一页重新加载的入口。续页失败保留已呈现条目、清掉旧游标；显式重试从第一页开始，成功后递增 resetVersion，让共享 UI 重置滚动。Popup 的未读加载与 Modal 未读列表共用状态，已就绪的 Modal 未读分页不会被 Popup 打开动作重置。

列表组件以自己的滚动区域作为 IntersectionObserver root，rootMargin 为 0。新页布局和 ResizeObserver 会再次检查哨兵，避免短页把哨兵一直留在可见范围时停止续页。关闭、手机正文模式、准备、确认、提交及分页错误时暂停自动加载。

## 确认与重试

普通批量动作只由全局 summary 的 ready 计数决定，不从当前列表是否为空推断；未知或读取失败时禁用。准备使用同步阶段锁，确认固定操作类别、数量、token 和 requestId。重新准备是新的意图；同一确认提交失败后的重试沿用原 body，不用轮询后的新 summary 覆盖旧 token。PHP Redis 幂等与命令范围见 `.ai/knowledge/notifications/command-idempotency.md`。

清理预览按服务器时间偏移判断期限；过期时禁止提交。空预览不发送清理命令，刷新列表与 summary，并通过 toast 告知没有可清理项。提交中不可关闭；成功刷新当前列表、未读预览和 summary，临时反馈使用全站 toast，持续错误保留在页面重试入口。

## 偏好即时保存是独立资源

Settings 通知分区只展示两项可选开关。用户切换时先由表单的 React Hook Form 与 Zod 校验整份值，再把「字段 + 目标值」交给偏好 module 调用现有 `PUT /api/notification-preferences`：请求体的 `expectedRevision` 与另一字段由 module 在取得单写锁的同一同步段内从最新规范快照读取，因此取得锁时的最新快照总是胜出；首读、快照同步和切分类不会自行提交。服务通知仍由 catalog 固定接收，设置面板不展示不可修改的开关。成功采用服务器返回的规范值且不显示“已保存”提示，保存中与持续错误仍可反馈。

归属：字段意图、每宿主的失败 slot、取得锁时的重基、409 之后的必要重读门控与 module 拥有的重读，以及跨宿主单写锁都属于 `apps/web` 的偏好 module；表单只保留 RHF/Zod 校验、字段与 root 错误呈现，以及按 `identityEpoch` 重建 RHF 所有者，避免旧 `handleSubmit` 的 finally 清掉新账号的提交状态。分类可见性是两处独立投影：设置面板直接把 `active` 传给表单决定渲染，设置体验把同一分类判断交给 module 作发送前资格，两者互不代替，也都不拥有保存状态。

页面设置和 Header 设置 Modal 可以同时挂载，因此偏好请求的 latest read、write version 和单写锁在控制器模块内共享。它们跟随身份 epoch，独立于收件已读与清理的 seq；两个资源的写入不会互相淘汰响应。已发送的 PUT 在关闭面板后仍持有共享锁，直到服务器返回，再更新同一身份的规范快照；关闭表单不能撤销服务器写入。卸载读取宿主会恢复缓存或提供读取重试，不让其他宿主一直等待。旧账号的响应与 finally 不能覆盖新身份或释放新写入。

普通失败只在当前宿主登记失败意图（标量 `id` + 字段 + 目标值），恢复最后确认值；重试重发该字段的原目标值，另一字段与 revision 同样按取得锁时的最新快照重基。失败意图不跨宿主共享，取得新锁会替代本宿主的旧意图。409 不是可重试的写失败：module 清掉全部宿主的旧意图、置起必要重读门控并自行重读规范值，界面展示新值并要求用户重新调整，不自动覆盖其他设备的修改；重读失败时保留冲突与读取重试，不把旧缓存当成可写状态。表单和控制器错误使用固定安全文案；成功不新增 toast 或提示容器。

## 证据

- `apps/web/src/notifications/notificationsConfig.ts`：身份与写代次、共享列表切片。
- `apps/web/src/notifications/useNotificationsController.ts`：列表与详情接受权、固定批量意图和提交阶段。
- `apps/web/src/notifications/useNotificationsController.test.tsx`：迟到响应、游标去重、失败重试、固定确认与换号回归。
- `packages/components/src/notifications/NotificationHistoryModal.tsx` 及其测试：实际滚动 root、短页重检、暂停与焦点恢复。
- `tests/browser/notification-experience.mjs`：隔离 UI props 的 Chromium 几何、滚动与焦点检查；不作为真实账号/API 或真实设备验收证据。
- `apps/web/src/notifications/useNotificationPreferencesController.ts` 及其测试：跨设置宿主请求归属、单写锁、每宿主失败 slot 与锁时重基、409 必要重读门控与 module 拥有的重读、规范返回值与换号隔离。
- `packages/components/src/notifications/NotificationPreferencesForm.tsx` 及其测试：用户开关事件即时保存、静默成功、字段与 root 错误呈现、按身份隔离 RHF 实例；失败回退与单字段重试的编排证据见上一条。
- `apps/web/src/settings/NotificationPreferencesExperience.test.tsx`：真实设置体验、设置面板、表单与偏好 module 的联动，覆盖跨宿主失败、关闭结算与 409 恢复。
