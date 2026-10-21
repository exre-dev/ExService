# PHP 通知清理预览

PHP `/api/notifications/clear-preview` 返回绑定用户与快照上界的短期 `clearSnapshotToken`；`/api/notifications/clear-all` 使用该 token 与 requestId 执行清理。Web 在服务器给出的 `expiresAt` 前允许确认，过期则重新预览；清理只作用于相应用户的有效记录，令牌和命令实现见 `apps/php-server/app/common/services/NotificationService.php`。

_最后更新：2026-10-20_

PHP 以签名令牌表示十分钟内的预览上界，Redis 保存命令幂等结果，以 `app_notifications` 保存个人 receipt 的清理时间与 revision。旧 Node 持久 preview batch/item 表、`clearRevision` 行快照与自动回收细节已退役；不能把旧测试里两份预览独立持久化的保证移植为 PHP 的现行承诺。Web 固定确认意图和迟到请求隔离见 `.ai/knowledge/notifications/request-lifecycle.md`。
