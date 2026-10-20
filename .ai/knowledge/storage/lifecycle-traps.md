# PHP file 上传与 SDK 生命周期

现行 SDK 上传只走 PHP file 介质。`packages/sdk/src/storage/core.ts` 请求 `/api/storage/uploads/prepare`，再以原生 multipart FormData 请求 `/api/storage/uploads`，从 `response.data.url` 返回地址；资源根与 token 变化时停止后续阶段。上传字节、长度、内容类型和 key 仍由 PHP `apps/php-server/app/storage/StorageController.php` 与 `apps/php-server/app/common/services/StorageService.php` 校验。

_最后更新：2026-10-20_

`medium: 'cos'` 的 prepare 明确返回 503；`/api/storage/uploads/complete` 当前也固定返回 503。SDK 把 COS prepare 的 503 映射为 `UNAVAILABLE`，不会改用 file。complete 不是当前 file 上传步骤。网络、超时、取消、HTTP 状态和凭据变化分别保持稳定错误边界；失败不继续上传或重试。

PHP file 字节位于 PHP 管理的 runtime/public uploads，数据库引用和实际磁盘文件应按 PHP 数据备份与维护规则一起核对。主仓库旧 Node file adapter、COS 浏览器直传和 Nginx 上传生命周期知识属于历史实现，不能拿来推断当前 Workerman socket 行为。PHP 进程内 HTTP 夹具验证了真实 multipart 字节、文件下载及响应头；socket、反向代理与部署行为仍需独立验证。
