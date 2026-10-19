# 用户设置面板技术 RFC

> 迁移说明（2026-09-29）：本文件保留当时的业务与实现决定；其中旧 `apps/mock-server/` 路径、本地 SQLite Mock 与未来 PHP/MySQL 接管的基础设施描述，已由 `.notes/archive/server-promotion/specs/2026-09-29-server-promotion-design.md` 和 `.notes/archive/server-promotion/rfcs/server-postgresql-migration-rfc.md` 取代。当前唯一 Server 位于 `apps/server/`，使用独立 PostgreSQL `exre`；正文中的旧路径和目标仅作历史记录。

- 状态：待技术评审
- 日期：2026-09-24
- 来源：已确认的设置面板设计 `.notes/archive/backend-sandbox/user-settings/specs/2026-09-24-user-settings-panel-design.md`

## 决策摘要

在 `apps/web` 增加应用级设置控制层与 Valtio `settingsConfig`，在 `packages/components` 增加不依赖 API、路由或 Valtio 的设置界面。已登录用户菜单打开设置 Modal；现有 `/account/profile` 用页面容器承载同一设置主体。首版分类固定为通用、个人资料、账号。`AuthContext` 的实现、接口及权责保持现状：设置保存后使用现有 `refreshProfile()` 更新顶栏，退出和会话失效仍调用现有方法。

头像选择后由 `react-easy-crop` 提供 1:1 裁剪，浏览器导出 512×512 图片，经已有上传 operation 提交。Mock Server 使用已安装的 Sharp 对**所有新上传**强制输出 512×512 WebP。无新增 HTTP operation、字段、数据库迁移或旧头像文件批量改写。

## 现状与边界

- `api/openapi.yaml` 已定义 `GET/PATCH /auth/me`、`POST /auth/me/avatar`、`POST /auth/logout` 和公开头像读取；`CurrentUser` 是本人资料 snapshot，FiveM ID 是可空文本。设置 UI 不产生第二份 DTO 或 endpoint 定义。
- `apps/web/src/pages/ProfilePage.tsx` 自行读取和修改资料，`packages/components/src/ProfileEditor.tsx` 为整张表单。用户菜单的“设置”尚未接线，“个人资料”当前导航到页面。新设计将字段拆为单项编辑，同时保留旧路径。
- `apps/web/src/auth/AuthContext.tsx` 管理登录状态、匹配 token 的失效处理、资料刷新和退出；`logout()` 对外返回 `void`，失败时置 `unavailable`。设置控制层只消费这些现有方法，不重构该 Context。
- `.ai/decisions/web/03-exui-as-component-and-theme-source.md` 要求主题由 ExUI 管理。`settingsConfig.general.theme` 只是读取投影，不持久化，也不反向驱动 ExUI。
- `apps/mock-server/src/profile/service.ts` 当前按 `fit: inside` 且不放大处理，不能保证正方形或固定像素；输入上限 2 MiB、输出上限 512 KiB、像素与边长限制、会话写入检查、旧文件清理均已有实现。
- 表单必须遵守 `.ai/rules/frontend-forms.md`：React Hook Form + Zod + ExUI。`packages/components` 不导入 API Client、Valtio、路由表或 ExUI 全局样式。

## 目标与非目标

验收结果：两个入口分别打开默认分类正确的同一 Modal；旧页面路径可用；三类设置可读写；资料加载覆盖整个内容区并可重试；设置缓存不跨账号泄漏；头像新上传结果恒为 512×512 WebP；顶栏资料在保存后同步。键盘、焦点、窄屏及失败路径应可在真实浏览器中验证。

本 RFC 不增加邮箱、密码、通知或隐私设置，不验证 FiveM 身份，不更改 `AuthContext`，不修改 Contract 或数据库结构，不把未来文档内容页接入本次交付。已有非 512×512 头像文件维持原状；只约束本次上线后的新上传。

## 组件和依赖

```text
RootLayout ── SettingsModal（初始分类） ─┐
ProfilePage ── SettingsPage（默认个人资料） ├─ SettingsController（apps/web）
                                        │    ├─ settingsConfig（Valtio，仅设置缓存与状态）
                                        │    ├─ AuthContext（原接口）
                                        │    ├─ ExUI useTheme
                                        │    └─ @workspace/api-client
                                        └─ SettingsPanel / ContentAreaState / 编辑与裁剪 UI
                                             （packages/components，props + 回调）
```

`RootLayout` 在认证用户菜单的两个条目上设置本地 Modal 初始分类，不再让该菜单的“个人资料”执行路由跳转；直接访问 `/account/profile` 仍渲染页面容器。Modal 的开关、分类选择、编辑对话框、裁剪坐标和缩放值都是局部状态。Modal 关闭时卸载内部编辑/裁剪 UI，清理文件预览的 object URL；页面与 Modal 共用 `SettingsController`，不复制网络调用。

`SettingsPanel` 负责分类导航和内容区域。左侧分类顺序为个人资料、通用、账号，退出登录作为侧栏底部的 ExUI `ghost` 按钮，以透明背景和红色文字显示；“设置”入口默认通用，“个人资料”入口及旧页面默认个人资料。右侧以当前分类标题作为显著的 Title；通用和账号用分组标题和平面设置行展示内容，每行左侧为字号大于说明文字的 Label 和可选说明，右侧为当前值或操作控件。主题等选项设置使用 ExUI Select；可编辑的纯文字值使用透明背景、无描边、有左右留白并带右箭头的按钮。个人资料页改为居中的独立头像与用户名区域：Avatar 加 `ex-glass`，无头像时放大 fallback 字，头像下方的名字按钮打开现有单项编辑 Dialog，点击头像打开上传和移除操作；不渲染头像或用户名设置行。QQ 迁入账号“关联信息”，与 FiveM ID 共用单项编辑机制。共享包内的设置行、单项编辑 Dialog 和裁剪 Dialog 只接收显示用标量值及操作回调；由 `apps/web` 将生成的 `CurrentUser` 类型映射为这些 props。Modal 顶部没有可见标题，但保留可访问名称。共享包不导出与 `CurrentUser` 同形的 DTO。`react-easy-crop` 由 `packages/components` 声明依赖；`valtio` 保留在已有的 `apps/web` 依赖中。

Modal 使用宽度 `clamp(42rem, 72vw, 64rem)`、高度 `clamp(32rem, 72dvh, 48rem)`，再以视口四周 2rem 留白约束最大值。宽度不超过 38rem 或高度不超过 34rem 时改为 `100vw × 100dvh` 全屏；手机顶部分类菜单包含退出操作，中间内容区 `overflow-y: auto` 且网格轨道允许收缩。动态视口高度用于跟随移动浏览器工具栏变化。

`ContentAreaState` 使用互斥的公开 props：`{ status: 'loading'; skeleton: ReactNode }`、`{ status: 'error'; errorMessage: string; onRetry: () => void }`、`{ status: 'ready'; children: ReactNode }`。它填满宿主分配的内容区域，加载时渲染传入的骨架和可访问状态文本，错误时渲染错误与按钮，成功时渲染子内容；它不请求数据。设置提供标题及平面设置行骨架。未来文档页可传入自己的骨架，不修改组件状态语义。通用分类仅依赖主题，始终直接进入 `ready`。

## 全局设置读取模型

`settingsConfig` 在 `apps/web` 维护 `general.theme` 只读投影，以及 `profile.snapshot: CurrentUser | null`、`profile.status: idle | loading | ready | error` 和安全的读取错误文案。`ready` 必有 snapshot；重开刷新时即使旧 snapshot 尚在内存，`loading` 仍显示整块骨架；刷新失败时 `error` 显示整块错误，而不展示过期资料。当前分类、表单草稿、操作进行中与退出进行中不进入全局对象。设置资料仅存内存；token 不写入 Valtio、日志或 UI props。主题以 `useTheme()` 为来源：适配层观察其值并同步投影，所有主题修改仍调用 `setTheme()`。设置面板使用 ExUI `useTheme()`；顶栏继续使用 `AuthContext`。

设置动作内部保留当前 token 所属会话标识与请求代次。打开 Modal 或进入页面时读取当前 token；首次进入个人资料/账号若无 snapshot 则请求 `GET /auth/me`，Modal 重开时重新请求。刷新时当前内容区显示骨架；失败时显示整块错误与重试。两个资料分类共用一次读取状态。每个请求完成前检查 token 是否仍相同且代次仍有效；设置写操作开始时使较早的读取结果失效。token 改变、会话明确失效或 `AuthContext` 转为 `anonymous` 时清空缓存并使在途请求失效；仅临时 `unavailable` 且 token 未变时保留缓存供重试。监听已有 token 的 storage 事件并在当前标签主动执行会话动作后同步检查，使账号切换先于迟到请求写入。

同一时刻只允许一个本人资料写操作。单项文本编辑在共享包用 React Hook Form + Zod 校验，使用已有 `nickname`、`qq`、`fivemId` 规则；每次 `PATCH /auth/me` 仅发送被编辑的一个字段，QQ/FiveM ID 清空映射为 `null`。邮箱只读，FiveM ID 始终显示“未验证”，不作为认证或权限依据。写成功时用返回的完整 snapshot 更新设置缓存，再调用现有 `auth.refreshProfile()`；若顶栏刷新失败，服务器写入仍视为成功，不回滚或重复提交写请求。此时 `AuthContext` 可能转为 `unavailable`：若 token 未变，已打开的设置容器仍可显示缓存中刚保存的结果及顶栏刷新失败提示，并提供现有 `auth.retrySession()`；在认证恢复前禁用后续资料写入。若打开设置时 `AuthContext` 已不可用且没有当前 token 的缓存，则显示认证错误与重试。写失败时保留草稿与 Dialog，允许重试。`SESSION_INVALID` 调用现有 `auth.invalidateSession(requestToken)`，关闭设置并清空其缓存；其他网络错误不删除 token。

桌面侧栏底部和手机顶部菜单的退出操作调用现有 `auth.logout()`，不直接调用退出 operation，且从任意分类都可使用。点击后禁用重复操作；由于该方法返回 `void`，设置层观察随后出现的 `unavailable` 并在仍打开的 Modal 中显示 AuthContext 的错误文案与重试；`anonymous` 时关闭设置，成功时由现有页面刷新结束界面。该观察方式和现有退出路径必须在集成测试中验证。

## 头像处理

头像选择表单复用现有格式与 2 MiB 源文件校验。通过 `handleSubmit` 后打开裁剪 Dialog；`react-easy-crop` 用 `aspect={1}` 提供拖动和缩放，裁剪区域给出正方形预览。确定时依裁剪像素坐标绘制到 512×512 Canvas，导出 WebP Blob；若浏览器未产生 WebP，则按实际 Blob 类型使用 Contract 允许的 JPEG/PNG。再次校验导出结果的 MIME 与 2 MiB 大小，转 base64 后通过现有 `POST /auth/me/avatar` 上传。取消不发请求；导出或上传失败保留裁剪状态与源文件供重试。裁剪 Dialog 不使用改变容器尺寸的缩放入场动画，并确保 object URL 在取消、成功和卸载时释放。

Mock Server 中的 Sharp 在已有格式、大小、像素、单页检查后，继续应用 EXIF 方向旋转，再对所有输入使用 512×512 的 `cover` 居中裁剪并按需放大，编码为已有的 WebP。保留输出字节上限、临时文件写入、会话再次确认、数据库引用更新与旧文件清理。前端提交已裁剪的正方形不会再次改变取景范围；绕过前端直接调用 API 的非正方形图片由服务端居中裁剪。服务端仍是最终像素尺寸的保障，现有 `GET /avatars/{avatarId}` 媒体类型和错误 envelope 不变。

## 失败、安全与可访问性

| 场景               | 处理与验证                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| 读取失败           | 结束骨架，整块显示错误与重试；重试只重发读取请求。                       |
| 保存失败           | 保留单项草稿或裁剪状态，解除提交锁；展示安全错误，不回滚其他成功项。     |
| 请求迟到或账号切换 | token 与请求代次双重检查；旧响应不得写入设置缓存或覆盖新会话。           |
| 会话失效           | 只让 `AuthContext.invalidateSession` 移除匹配 token；设置缓存随之清除。  |
| 退出失败           | Modal 保留错误与重试入口；不复制退出 API 调用。                          |
| 头像异常           | 服务端继续验证真实格式与资源上限；过大、伪装或损坏输入不得生成头像引用。 |

设置中只有当前已认证用户可读取本人邮箱。`settingsConfig` 不持久化个人信息，退出和账号切换时清空。Modal 与内部编辑/裁剪 Dialog 需有可访问名称；Escape 先关闭最上层 Dialog，焦点返回触发行，关闭外层 Modal 后返回用户菜单触发点。窄屏内容区滚动时按钮和错误信息应可达。较小源图按需放大可能模糊，裁剪预览应呈现其结果。

## 替代方案与取舍

| 方案                                    | 取舍                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| 只保留现有 `ProfilePage` 状态与整张表单 | 改动少，但 Modal 和页面会产生两套请求及校验流程，不能支撑已确认的单项编辑与全局设置缓存。 |
| 让 `AuthContext` 直接持有全部设置资料   | 可减少一次本人资料缓存，但改变现有 Context 权责及接口，违背已确认的边界。                 |
| 只在浏览器裁剪头像                      | 用户能预览取景，但直接 API 上传仍可存非标准尺寸。                                         |
| 只在服务端居中裁剪头像                  | 能保证尺寸，但用户无法控制取景范围。                                                      |

选定方案的成本是设置缓存与顶栏资料可能短暂不一致，需通过保存后 `refreshProfile()` 和错误提示处理；头像既有浏览器裁剪又有服务端规范化，需验证不会二次改变正方形取景。

## 落地顺序与兼容性

1. 在现有 Contract 下调整 Sharp 输出与头像 Contract Test，使直接 API 上传的横图、竖图、小图均为 512×512 WebP，同时保留原有失败与文件清理测试。
2. 加入纯展示的 `ContentAreaState`、设置分组与单项/裁剪 Dialog；在共享包内复用表单校验并接入 `react-easy-crop`。
3. 加入 `settingsConfig` 与应用级设置控制层，统一资料读取、单项写入、头像操作、主题投影和会话清理；将 `/account/profile` 切到页面容器。
4. 接通用户菜单的设置与个人资料 Modal 入口，验证状态同步、焦点和窄屏布局。

每一步维持可构建，最终以 `pnpm typecheck`、`pnpm test`、`pnpm build` 和真实浏览器检查作为交付验证。没有数据库迁移或 API Client 重新生成。应用回滚可恢复旧 UI 和旧 Sharp 缩放策略；已生成的 512×512 WebP 仍可由既有公开头像读取 operation 服务，无需数据回滚。旧头像不自动改写，若未来要求所有历史头像统一像素，需另立迁移设计。

## 验证重点

- 组件测试：入口默认分类、单项提交与 `null` 清空、FiveM 未验证文案、整块骨架/错误/重试、取消裁剪无请求、保存失败保留草稿、退出失败保留 Modal。
- 设置控制层测试：同一资料 snapshot 被两分类共用；重开刷新；写成功后调用现有 `refreshProfile()`；在途读取与写入、账号切换、`SESSION_INVALID` 的迟到响应均不能污染缓存；`AuthContext` 接口不变。
- Contract Test：通过真实 Fastify app 上传正方、横向、纵向及小于 512 像素的受支持图片，再读取公开头像并检查 Sharp metadata 为 512×512 WebP；保留伪装格式、超限、会话撤销、文件/数据库故障断言。
- 浏览器检查：桌面和窄屏 Modal/页面布局、主题切换生效、裁剪 Dialog 的尺寸稳定、键盘与焦点回退、Escape 顺序、输出预览与实际头像一致。当前仓库如无 `TESTING.md`，遵守现有测试惯例。

## 待决事项

无阻塞待决事项。文档内容页只预留复用 `ContentAreaState` 的接口，本次不实现。生产 PHP 后端未来若需要同样的 512×512 输出行为，应按同一产品规则实现；本 RFC 只改当前 Mock Server。
