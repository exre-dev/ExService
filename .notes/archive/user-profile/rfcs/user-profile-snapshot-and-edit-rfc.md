# 用户资料 snapshot、设置与头像上传 RFC

> 迁移说明（2026-09-29）：本文件保留当时的业务与实现决定；其中旧 `apps/mock-server/` 路径、本地 SQLite Mock 与未来 PHP/MySQL 接管的基础设施描述，已由 `.notes/archive/server-promotion/specs/2026-09-29-server-promotion-design.md` 和 `.notes/archive/server-promotion/rfcs/server-postgresql-migration-rfc.md` 取代。当前唯一 Server 位于 `apps/server/`，使用独立 PostgreSQL `exre`；正文中的旧路径和目标仅作历史记录。

状态：待评审  
来源：[已确认的用户基础资料设计](../specs/2026-09-23-user-profile-design.md)  
关联：[通用社区身份组 RFC](default-community-group-rfc.md)

## 决策摘要

把现有 `GET /auth/me` 扩展为登录用户本人的资料 snapshot，新增经过认证的资料设置与头像上传 operation，并用 Contract 声明一个公开读取头像图片的 operation。QQ、FiveM ID 和头像引用进入基础用户表；本地 Mock 将头像文件写入固定磁盘目录，未来 PHP 实现改用腾讯云 COS。两条实现遵守同一份 HTTP Contract。

这份 RFC 只处理本人资料。QQ、FiveM ID 和头像按已确认规则属于可公开展示的资料，但本期没有按用户 ID 查询他人资料或公开资料页；`email` 只出现在本人 snapshot 中。社区身份组和权限不属于本 RFC。

## 现状与约束

`auth_users` 当前仅保存 `id`、`email`、`nickname`、`password_hash`、`created_at`。`GET /auth/me` 已通过 Bearer 认证返回 `CurrentUser`，网页 `AuthContext` 用它恢复登录态及顶栏名称。仓库没有资料设置 operation、头像文件解析器或资料页面。`api/openapi.yaml` 是唯一 HTTP Contract；新增 operation 必须由 OpenAPI Glue 注册，前端经 `@workspace/api-client` 调用。

本地 Mock 数据通常只存在 SQLite；头像二进制文件写盘是用户已选定的例外。实施时需同步修订仓库说明，明确 `apps/mock-server/data/avatars/` 的归属、忽略规则及清理边界。数据库文件和头像文件均不得提交。

## 拟定 HTTP Contract

下面的路径、字段与状态是本 RFC 的**提议**；实施时先写入 `api/openapi.yaml`，通过 `pnpm api:lint` 和 `pnpm api:generate` 后，Mock、Client、网页与测试才可依此开发。实际服务路径仍由 Glue 加 `/api` 前缀。

| Operation                                               | 认证   | 请求与成功响应                                       | 关键失败                                               |
| ------------------------------------------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------------ |
| 现有 `GET /auth/me` / `getCurrentUser`                  | Bearer | `200` 返回扩展后的 `CurrentUser` snapshot。          | `401` 会话无效。                                       |
| 新增 `PATCH /auth/me` / `updateCurrentUser`             | Bearer | JSON 局部设置资料；`200` 返回更新后的完整 snapshot。 | `400` 字段无效；`401` 会话无效。                       |
| 新增 `POST /auth/me/avatar` / `uploadCurrentUserAvatar` | Bearer | JSON 图片上传；`200` 返回更新后的完整 snapshot。     | `400` 图片无效；`401` 会话无效；`413` 图片或请求过大。 |
| 新增 `GET /avatars/{avatarId}` / `getAvatarImage`       | 无     | `200` 返回图片字节和对应 `image/webp` 类型。         | `404` 引用不存在或文件缺失。                           |

`CurrentUser` 保留 `id`、`email`、`nickname` 原字段，并增加 `qq`、`fivemId`、`avatarUrl`。更新后的 Mock 对未设置的三项返回 `null`；Contract 使用 Draft-07 兼容的 `type: [string, 'null']`，并将新字段声明为可选，以便旧读取方只依赖原字段。`avatarUrl` 有值时是由服务端构造的完整公开 URL，不接受用户输入的 URL。本地 Mock 根据 `server.ts` 固定的 `127.0.0.1:8080` 和 Glue 的 `/api` 前缀生成 `http://127.0.0.1:8080/api/avatars/{avatarId}`；测试可注入同一基址配置。不得从任意请求 `Host` 头拼接。未来 PHP 实现返回 COS 自定义 HTTPS 域名的公开链接。

`PATCH /auth/me` 的 JSON 只允许 `nickname`、`qq`、`fivemId` 和 `avatar`：字段缺席表示不修改；`qq: null`、`fivemId: null` 清空对应资料；`avatar: null` 清除头像；`nickname` 必须为非空字符串，不能清空。空对象作为无操作返回当前 snapshot。不得接受 `id`、`email`、组或权限字段，也不得接受目标用户 ID。服务端从已验证会话确定当前用户，仅更新实际提交的列，避免不同字段的并发修改互相覆盖。

`nickname` 复用现有 `Nickname` 规则；QQ 以文本保存并只接受 1–20 位十进制数字，保留前导零；FiveM ID 以文本保存，接受 `^fivem:[0-9]+$` 且总长不超过 64 个字符。两者均不加唯一约束，FiveM ID 仅是未经验证的用户声明，不参与登录、组归属或权限判断。清空值统一为数据库 `NULL`，不把空字符串当作已设置资料。

头像上传请求为 `application/json`，包含 `imageBase64` 与 `mediaType`；网页仍通过文件选择器上传本地图片，再由 Client 传输其字节，用户无需粘贴 URL。该方式兼容当前 Client 的 JSON 请求路径，并使 Glue 的请求体校验保持由 Contract 驱动。允许 PNG、JPEG、WebP 源图，解码前限制二进制大小为 2 MiB；解码后限制原图像素总量为 1600 万，最长边不超过 8192 像素。服务端验证实际文件内容，将头像等比缩放至最长边不超过 512 像素，并重编码为不含原始元数据、大小不超过 512 KiB 的 WebP；无法满足输出限制时拒绝上传。Mock 的 Fastify 请求体上限设为 4 MiB，并在业务层检查解码后的 2 MiB 上限。拒绝 SVG、GIF、伪装 MIME、损坏图片和超限图片。字段错误与存储错误都走现有安全错误 envelope，不回显文件路径或处理库错误。

公开图片 operation 的 `{avatarId}` 是服务端生成的不透明标识，不能包含路径分隔符。Contract 将成功响应声明为 `image/webp` 二进制内容。设计阶段用当前仓库安装的 Fastify/OpenAPI Glue 做了独立探针：Contract 声明图片响应时，handler 返回 Buffer 可得到 `200`、`image/png` 和原始字节；可空字符串的请求和响应也通过独立探针。这些只验证 Glue 的关键机制，不代表正式头像实现或 Contract Test 已通过。正式实现仍须为 WebP 路由做端到端测试。图片响应使用 `Cache-Control: no-store`，避免删除或替换后的旧图片继续被浏览器长期缓存。

## 数据与文件一致性

在更新 `.ai/databases/data-model.md` 并评审 SQLite 与未来 MySQL 的业务规则后，为 `auth_users` 增加可空的 `qq`、`fivem_id`、`avatar_key` 字段，并对内部 `avatar_key` 建立唯一索引以防两个用户引用同一上传对象。`nickname` 与 `email` 的现有语义不变；用户提供的 QQ 和 FiveM ID 不要求唯一。使用新的 Drizzle 增量 migration；旧账号三项默认为 `NULL`，不重写既有 migration，不重置数据库。图片字节不存入 SQLite；`avatar_key` 只保存服务端生成的文件标识，不保存绝对路径或用户提供的文件名。

Mock 文件固定存于 `apps/mock-server/data/avatars/`，上传时生成随机标识与临时文件名，验证及重编码完成后原子改名为正式文件。然后在 SQLite 事务中读取该用户当前 `avatar_key` 并写入新标识；数据库写入失败时删除新文件，成功后再尝试删除旧文件。清空头像同样先提交数据库空引用，再删除旧文件。进程崩溃可能留下孤立文件，但不能留下指向尚未写完文件的数据库引用；孤立文件可以由后续显式清理工具处理，启动和 `db:reset` 均不递归删除头像目录。

Mock 侧由独立的资料服务封装账号资料查询、局部更新、图片处理与固定目录读写；handler 只负责会话、Contract 输入输出与状态码。这样 `AuthService` 的注册/登录事务不承担头像文件操作。`GET /auth/me` 在认证成功后读取数据库当前行，而不是返回会话建立时缓存的名称，保证设置资料后的下一次 snapshot 可见。

公开读取先确认 `{avatarId}` 仍是某个用户当前引用的 key，再从固定目录读取；未引用或文件缺失返回统一 `404`，文件缺失同时记录服务端错误以便排查。所有文件路径只能由固定目录和服务端生成的标识组合，不能来自请求的原始路径片段。上传和替换的并发事务在 SQLite 中读取最新旧 key；最后提交的操作成为当前头像。文本资料只更新请求包含的列。

COS 阶段沿用“用户表保存头像引用、snapshot 返回公开 URL”的业务规则，但上传、对象键、公开域名及清理流程由 PHP 实现。不能把本地文件路径或 Mock URL 写入生产用户数据。

## 网页接入

在站点布局中增加 `/account/profile` 资料编辑页，并从站点顶栏提供入口。页面先通过共享 Client 调用 `GET /auth/me` 填入表单，再调用 `PATCH /auth/me` 保存文本资料，选择头像时调用 `POST /auth/me/avatar`；移除头像通过 `PATCH` 的 `avatar: null` 完成。无登录态时进入现有登录流程，服务器仍以 Bearer 会话为唯一身份来源。保存成功后刷新 `AuthContext`，使已修改的 `nickname` 与头像预览同步；不要把旧 session snapshot 当作长期缓存。

表单遵守 `.ai/rules/frontend-forms.md`：React Hook Form 管理字段、错误和提交状态；Zod 校验；ExUI 提供输入与错误展示。网页不得直接 `fetch`，也不得手写与生成 Client 并行的 DTO。图片展示可使用 snapshot 中由服务端给出的公开 `avatarUrl` 作为 `<img>` 资源地址；资料 API 调用仍通过共享 Client。

## 取舍与风险

| 选择                             | 原因与代价                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 扩展既有 `GET /auth/me`          | 已有登录态读取链路，原字段保留；需要同步更新 `CurrentUser` 及所有实现。                                                       |
| `PATCH` 只更新提交字段           | 用户可单独设置 QQ、FiveM ID 或用户名，减少并发覆盖；需要明确缺席与 `null` 的区别。                                            |
| JSON Base64 图片上传             | 不依赖新增 multipart 解析和 Client 序列化路径；Base64 增加传输体积，必须设置双重大小限制。                                    |
| 本地文件 + SQLite 引用           | 满足当前磁盘试用与未来 COS 替换；无法把文件系统与 SQLite 纳入同一原子事务，需按写文件→写引用→清旧文件的顺序降低悬空引用风险。 |
| 本人 snapshot 与公开头像读取分离 | 本人可获得邮箱，公开图片可通过链接使用；未来公开资料 API 须单独设计，避免泄露邮箱。                                           |

### 主要风险

| 风险                               | 处理与发现方式                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 文件写入与 SQLite 提交不能原子完成 | 先落盘后写引用；失败删除新文件，替换后清旧文件；测试磁盘/数据库故障与崩溃后孤立文件。                 |
| 恶意或超大图片耗尽资源             | 请求体、解码字节、像素数、输出尺寸和输出字节五层限制；测试伪装格式、损坏文件、超限和解码失败。        |
| 非本人获取邮箱或修改他人资料       | snapshot 和设置均依赖 Bearer 会话，不接受目标用户 ID；匿名只可读取图片；以双用户 Contract Test 验证。 |
| 旧 `CurrentUser` 消费方受影响      | 保留原字段，新增字段在 Contract 中可选；现有登录态恢复测试和生成 Client 的类型检查必须通过。          |
| 本地头像目录与数据库失配           | 图片读取先查当前引用；文件缺失返回统一 `404` 并记录服务端异常；显式核对孤立文件，不在启动时隐式删除。 |

## 验证与交付顺序

1. 先更新并评审 `.ai/databases/data-model.md`，同步修订 Mock 头像文件例外与本地数据清理说明。
2. 先改 `api/openapi.yaml`，运行 `pnpm api:lint`、`pnpm api:generate`，核对生成类型与旧 `GET /auth/me` 调用兼容。
3. 新增 Drizzle schema 和迁移，验证已有数据库增量升级后原账号、会话与注册数据可用，新增字段为 `NULL`。
4. 实现资料读取、局部更新、图片处理/存储与公开读取，登记所有新 `operationId`；用真实 Fastify app 的 Contract Test 同时检查 HTTP 响应和注册 handler 的原始输出。
5. 增加资料页面及行为测试：本人只能改自己；邮箱与组字段不能经设置入口改变；文本字段设置、清空及并发更新；成功上传、替换、清除及公开读取；畸形图片、过大请求、无会话、数据库失败、磁盘失败、缺失文件均有预期行为。
6. 执行 `pnpm typecheck`、`pnpm test`、`pnpm build`；网页交互另做真实浏览器检查。通过这些门槛后才可称为本地 Mock 实现完成；不把它等同于未来 PHP/COS 验收。

## 启用与回退

先显式执行 `pnpm db:migrate`，再启动使用新列的 Mock Server；未迁移时服务应在监听前报出明确的迁移提示，不能在启动中补表或补列。上线本地资料页前检查新 Contract、文件目录权限与公开 API 基址。存储或迁移检查失败时停止启用资料写入，不使用 `db:reset` 修复现有数据。

回退应用代码时保留新增可空列和已经上传的文件；旧代码仍可读取原账号字段，但不会管理新资料。若需恢复旧数据库，使用迁移前备份会丢失备份后的资料写入。头像文件需按实际数据库引用单独核对，不因代码回退递归删除整个目录。未来 COS 切换及生产回退需要单独方案。

## 后续范围

按用户 ID 读取他人的公开资料、公开资料页、邮箱变更、FiveM 身份验证、社区组及权限管理均不在本 RFC。它们不能复用包含邮箱的本人 snapshot 作为公开响应。

本 RFC 范围内没有待用户决定的接口或数据规则；具体图像编解码依赖可在实施时按上述行为约束选择，并以 Windows 本地测试验证。
