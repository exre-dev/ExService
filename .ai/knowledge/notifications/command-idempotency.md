# PHP 通知命令与幂等

PHP `NotificationController` 的 read-all 和 clear-all 都携带 requestId 与各自目的的 token。`NotificationService` 将结果按用户与 requestId 缓存在 Redis，保留十分钟；相同请求意图重试应沿用原 requestId 和 token。Web 在确认时冻结参数，失败重试不拿新 summary 或新预览覆盖原意图。Web 请求生命周期见 `.ai/knowledge/notifications/request-lifecycle.md`。

_最后更新：2026-10-20_

`readThroughToken` 限定全部已读的上界，`clearSnapshotToken` 限定清理范围；两种命令不能交换 token。PHP `app_notifications` 本人行保存状态和 revision，Redis 存短期幂等/状态版本；旧 Node `notification_mutations`、`notification_clear_batches` 和多表投影不属于现行模型。具体 TTL 与冲突行为以 `apps/php-server/app/common/services/NotificationService.php`、内部契约和 PHP 测试为准。
