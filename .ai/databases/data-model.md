# Website 数据模型职责

现行 PHP 服务使用 PostgreSQL 与 Redis；物理表、字段、外键和注释以 `apps/php-server/database/schema.sql` 为准，模型与业务校验以 `apps/php-server/app/` 为准。本页只记录 Website 相关数据职责和关系，不复制 SQL。PHP 安装、重置或测试资源操作遵守 `apps/php-server/README.md` 与 `apps/php-server/TESTING.md`；schema 文件含 DROP，不能按主仓库旧 `pnpm db:*` 指令操作。

_最后更新：2026-10-20_

| 数据           | 当前职责                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PHP 账号与会话 | `app_users` 保存账号资料，`app_auth_sessions` 保存 Website 会话及撤销状态；账号 ID 为 numeric。邀请注册、OAuth 客户端/授权、SSO 请求由各自 PHP 表和服务管理。                                                                         |
| 邀请注册       | PHP 的资格、验证码、一次性完成与账号创建遵守 Controller/Service 事务和过期规则；Web 不以资格检查代替邮箱归属或建号授权。                                                                                                              |
| 通知           | `app_notifications` 每行是本人 receipt，`uuid` 对外为 receiptId，`id` 也是个人分页 sequence；已读和清理状态含修订号。`app_notification_prefs` 保存可选类别的开关与 revision。通知清理只作用于本人记录，管理端发送批次与用户状态分开。 |
| 支持反馈       | `app_feedback_submissions` 用唯一 submissionKey 幂等关联 frozen form、area、kind、user_id、receiving/completed、revision 和独立 admin_status；`app_feedback_attachments` 保存声明/上传状态、大小、摘要与落盘 key。                    |
| 文件与头像     | PHP `StorageService` 管理 runtime/public uploads；头像由 PHP 账号代码及其资源目录管理。数据库保存引用与元数据，实际字节所在目录必须随 PHP 持久数据管理。                                                                              |

反馈的 user_id 保持实际提交者；Web 的匿名选项只影响展示/处理约定，不改变管理员可见账号的事实。新提交在所有声明附件上传并成功 advance 后才 completed；后台处理状态不参与用户侧接收完成判断。通知的 HTML 必须按现行白名单安全呈现，不能因为字段来自数据库而信任其任意标记。

旧 Node `auth_*`、`notification_events`、`support_feedback_*` 与独立 `exre` migration 是历史模型，不作为 PHP 当前表的名称或迁移来源。源码删除不意味着旧 PostgreSQL 库、头像或卷已迁移或清理。业务规则变动先评审本页和 PHP schema/model；纯索引或测试数据调整不必改写职责。
