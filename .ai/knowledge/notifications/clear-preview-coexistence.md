# 清理预览必须各自独立，只能清过期项

**结论：`previewClear` 不能合并、复用或替换仍在有效期内的清理预览。设计 9.2 要求先后/并发的两份预览各自独立 —— 旧预览要能提交，并对已变化的项记 `skipped`。写入侧的回收只能针对**已经无法提交**的过期预览。**

_最后更新：2026-10-09_

## 为什么不能「每人只留一份在途预览」

修 M1（反复点开「清除全部」会线性累积 preview 批次）时，最直觉的两种写法都会破坏设计语义：

| 直觉写法                                 | 破坏点                                                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建预览前删掉旧预览（或原地改写旧批次） | 旧 token 指向的批次不存在了，或更糟 —— 原地复用时旧 token 会**静默作用到一份它从未预览过的集合上**（`clearSnapshot` 只按 `batchId` 取批，不复核 token 里的 `n` / `s`） |
| 快照未变就复用同一批次                   | 两份预览变成同一个 `batchId`，提交其中一份后，另一份不再独立有效，退化成 `NOTIFICATION_TOKEN_INVALID`                                                                  |

旧预览必须跳过 `clearRevision` 已变化的项。恢复能力已从 Contract 0.6.0 删除，历史字段与版本核验继续保留；测试通过隔离数据库 fixture 改变版本，不保留生产恢复入口。
`tests/notifications/service.test.ts` 的 `skips a receipt whose clear revision changed after the preview`
直接断言了这一点（旧预览提交后 `affectedCount=0` / `skippedCount=1`）。

## 如何应用

- 回收只清 **已过期** 的 preview 批次：`preview_expires_at < now`。
  这些行的 token 在 `verifyToken` 里就已经抛 `NOTIFICATION_TOKEN_EXPIRED`，再也不会被任何请求读到，
  清掉它们不改变任何用户可见错误码。实现见 `repository.ts::discardExpiredPreviewBatches`。
- 已 `applied` 的批次和历史 `restored` 批次保存执行事实，不在预览回收范围内。批次与 item 表继续支撑精确快照和幂等，并不提供恢复能力；历史兼容规则见 `.ai/databases/data-model.md`。
- 快照写入用一次 `unnest` 完成，不要逐条 INSERT：快照没有 LIMIT，逐条会把它变成 N 次往返，
  而整段都跑在已持有 user/stream 行锁的事务里。
- 残留量**不是 0**：回收是 user-scoped 且只在新建预览时触发，所以**每个用户最后一个有效期窗口内的
  preview 扫不掉**。残留 = 该用户最后一个窗口内的点开次数，而不是点开总次数。
  （`tests/notifications/service.test.ts` 的 `does not let abandoned previews accumulate across repeated windows`
  期望值 `2` 本身就是这个残留：20 次点开跨 10 个窗口，残留等于最后一个窗口的点开次数。）
  对活跃用户是每窗口有界，对全库不是 —— 想做全局清扫需要 `(status, preview_expires_at)` 索引，
  现在只有 `notification_clear_batches_user_idx (user_id, created_at DESC, batch_id)`，
  去掉 `user_id` 谓词会退化成全表扫。当前取舍在实现层面是合理的，但**不要以为残留是 0**。

## 证据

- `tests/notifications/service.test.ts` 的 `sweeps a preview that can no longer be submitted and keeps the live one`
  （同一时刻的两份预览都保留、越过有效期后旧的那份随下次预览清掉、过期 token 仍报 410 而不是 404）
- `tests/notifications/service.test.ts` 的 `does not let abandoned previews accumulate across repeated windows`
  （20 次点开跨 10 个窗口，残留等于一个窗口的 2 份，不是 20 份）
- `tests/notifications/service.test.ts` 的 `keeps live previews independent and preserves executed batches during expiry cleanup`
  （两份有效预览各自可提交，旧预览跳过已经变化的项，过期回收保留执行历史）
