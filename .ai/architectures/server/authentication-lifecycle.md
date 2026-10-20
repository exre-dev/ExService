# Server 认证与邀请注册生命周期

> 已退役：历史 Node/Fastify 实现记录。文中路径、命令和行为仅用于理解当时选择；现行 PHP/Webman 边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 与 `apps/php-server/TESTING.md`。

本文件说明认证、加入申请、邀请与资料服务之间的控制边界。HTTP 形状以 `api/openapi.yaml` 为准；表职责和状态规则见 `.ai/databases/data-model.md`。

_最后更新：2026-10-15_

## 组合与依赖

`apps/server/src/server.ts` 连接独立的 PostgreSQL `exre`，检查迁移和必需结构，校验验证码密钥与邮件链接配置，再向 `createApp()` 注入认证、资料、申请和邀请服务。显式 `IDENTITY_ENABLED=true` 时还组装 Hydra OIDC 服务、内部身份调用方密钥及撤销 outbox worker，根 runtime 启用该能力；独立 Server 未启用时保持身份 operation 不可用。启动只检查，不迁移或登记客户端。`apps/server/src/create-services.ts` 组装服务并共享 ScryptPasswordHasher；认证与资料属于 `apps/server/src/modules/`，申请和邀请属于 `apps/server/src/domains/join/`，各自的 `api/` 处理 HTTP 接入。密码计算和邮件发送留在事务外。跨服务身份流程见 `.ai/architectures/identity/integration-boundaries.md`。

JoinService 与 InvitationService 共享数据库访问边界。业务事务内查询使用同一个 PostgreSQL 客户端；跨多语句的只读状态查询使用一致快照。申请、审核、邀请和完善注册仍依赖数据库约束、行锁与条件更新处理并发。细节与测试范围见 `.notes/archive/server-promotion/rfcs/server-postgresql-migration-rfc.md`。

受保护 operation 的 Bearer security handler 等待异步会话校验，才把身份写入请求。退出、SSO 会话确认与异步头像处理在写入前复查会话；邀请完善只使用自己的短期凭证，不能用本站会话 token 代替。密码队列最多并行两项、等待十六项，仍由共享组装边界协调。

## 申请、资格与完善

申请不创建正式账号。完整申请的 multipart 传输与语义验证完成后，申请、邮箱登记、表单和附件在一个事务中写入。审核先提交状态、邀请及投递尝试，再调用邮件适配器；投递失败不回滚审核。详情读取根据验证码版本选择投递结果，避免迟到旧尝试覆盖新码。

资格和申请状态查询只读一致快照，跳过惰性清理与投递，不签发凭证；独立的内存 IP 计数仍可能变化。验证和完善都重新检查实际资格。验证码验证消费码并交付完善凭证；完善阶段在异步密码哈希后进入事务复查授权与邮箱唯一性，创建账号并完成邀请。同凭证在期限内仅允许得到原结果，不覆盖既有账号。

## 邮件、SSO 与头像

邮件链接使用校验后的 `SERVER_PUBLIC_WEB_BASE_URL`，不从请求 Host 推断。本地适配器在终端输出开发期邮件。事务先提交 pending 投递尝试；适配器结束或超时后只能更新仍 pending 的同一次尝试。失败窗口计数须在事务提交后再把业务错误返回客户端，避免回滚防猜测计数。错误 envelope 入口是 `apps/server/src/errors.ts`，不记录或回显秘密与数据库异常。

普通登录签发固定期限本站会话；原 token 只交给浏览器，数据库保存摘要，使用不续期。SSO 请求由显式 CLI 创建，HTTP 接收端检查并确认，不创建普通会话。当前仍没有生产发起方或轮询协议。

账号停用、恢复与会话撤销的持久化规则见 `.ai/databases/data-model.md`。集成模式通过独立受控 CLI 停用或恢复账号；登录、SSO 接收、OIDC 接受和内部会话核验都复查停用事实。恢复后不会复活原会话。

头像先写入 `apps/server/data/avatars/`，随后在会话复核和数据库事务中更新引用，最后清理旧文件。失败时清理新文件；孤立旧文件留待显式核查。新上传头像经 Sharp 归一化为 512×512 WebP，公开 URL 使用 `SERVER_PUBLIC_AVATAR_BASE_URL`。图片验证码仍是占位能力，没有服务端挑战验证；当前临时审核也不构成公网权限方案。
