# RFC：通用错误面板与邀请注册反馈收敛

日期：2026-10-10。状态：实施提案；来源设计已获用户确认，RFC 已完成源码核对与自查，代码尚未实现。

来源：`.notes/error-panel/specs/2026-10-10-error-panel-design.md`。原设计文件保持不变；本 RFC 将已确认的 B 方案、可选 Action 和高度约束细化为实现契约。

## 决策与验收目标

在 `packages/components/` 新增无业务状态的 `ErrorPanel`，以柔和表面、细边框、小型红色图标和主题文本呈现错误。首次接入邀请注册页面及弹窗，共用现有注册流程。

组件支持本次结果的多条错误、整个面板的高度上限和可选 Action。标题与 Action 固定，仅错误列表滚动；不传 Action 时，整个底部区域、分隔线及留白均不存在。注册错误只在所属字段或流程面板展示一次。

可验收的结果：

- 未申请邮箱在邮箱控件后、“继续”前出现一个面板，可执行“申请加入”；无重复顶部 Alert 或错误通知。
- 多条长错误在 160、240、320 px 上限内均能读到最后一条；无 Action 时列表获得释放的空间。
- 所有现有入口、验证、重发与完成注册失败仍可见；锁定、冷却、迟到请求防护、StrictMode 和成功跳转行为保留。

本次不修改 HTTP Contract、服务端、数据库、依赖及锁文件、运行配置、Outline 或其它业务页面。多条错误是 UI 能力，不新增注册输入或 API 错误数组。

## 当前实现与约束

已核对的源码事实：

| 位置                                                         | 当前行为与问题                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `apps/web/src/invitations/InvitationRegistrationFlow.tsx`    | `checkFailure` 同时写入本地 `error`、表单 `root.server` 并调用 `ExMessage.error`；外层再渲染 Alert。        |
| 同一流程的限流分支                                           | 429 在上述输出之后只覆盖外层文案，导致不同位置反馈不一致。                                                  |
| 同一流程的自动验证与重发                                     | 自动验证先切换到验证码步骤；`[step, error]` effect 将所有错误同步为验证码字段错误，重发失败也会被错误归属。 |
| `packages/components/src/auth/InvitationForms.tsx`           | 三个独立 RHF 表单已有字段错误及 `root.server` Alert，均暴露 `AuthFormHandle`。                              |
| `apps/web/src/pages/AuthPage/InvitationRegistrationPage.tsx` | 页面容器使用共享流程；弹窗也使用该流程，无需另建反馈逻辑。                                                  |
| `packages/components/src/ContentAreaState.tsx`               | 是带必需重试回调的页面状态组件，保留现有职责。                                                              |

表单规则以 `.ai/rules/frontend-forms.md` 为准，临时通知以 `.ai/rules/frontend-notifications.md` 为准。持久错误保留在 RHF，成功通知继续使用 ExUI `ExMessage`。API 请求继续经 `@workspace/api-client`，保持现有 `alert: false`。

共享 UI 使用 CSS Modules、ExUI 公开组件与 token、`lucide-react`。全局样式仍只在应用入口导入。已安装 ExUI 的 Alert 默认有 `role="alert"`，且 AlertAction 为右上角定位；实现必须显式覆盖播报角色，底部区域使用普通容器，不使用 AlertAction。

## 通用组件契约

以下为新增的 UI 接口，从 `packages/components/src/index.ts` 导出组件及类型：

```ts
import type { ReactElement } from 'react'

export interface ErrorPanelItem {
  id: string
  message: string
  description?: string
}

export interface ErrorPanelProps {
  errors: readonly ErrorPanelItem[]
  title?: string
  maxHeight?: number
  action?: ReactElement | null
  id?: string
  className?: string
}
```

| 输入或状态         | 规范行为                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| 空 `errors`        | 返回 `null`，无容器、边框、间距或播报。                                                                   |
| 非空 `errors`      | 按传入顺序展示完整列表；调用方保证 `id` 唯一稳定、`message` 非空。不积累历史，不按文案去重。              |
| 单条 / 多条        | 单条无编号或数量；多条有轻量序号和条目分隔线。只有提供标题且多条时显示数量。                              |
| `description`      | 可选的修正说明；缺省不留占位。全部文案按文本渲染，不接收 HTML 或异常对象。                                |
| `title`            | 缺省不渲染标题区。提供时使用小图标及主题主文本；正文与说明使用主、次文本色。                              |
| `maxHeight`        | 整体 border-box 的像素上限，默认 240。有限且至少 160 的数值直接生效；缺省、非有限或小于 160 均回退 240。  |
| `action`           | 调用方提供现有 ExUI Button 或路由控件。`undefined` / `null` 时完全不渲染 footer，含其分隔线、提示和留白。 |
| `id` / `className` | 透传根元素；`id` 可供输入的描述关联使用。调用方样式不得破坏高度、滚动及可访问性契约。                     |

组件不访问 API、不导入业务路由、不映射状态码、不管理错误来源，也不自动执行 Action。

### 布局、滚动与可访问性

基于公开 ExUI Alert 组合，使用默认中性色变体；CSS Module 将根容器明确设置为纵向 flex、`box-sizing: border-box` 和生效的 `max-height`，消除原组件的网格与默认内边距对高度的干扰。标题和 footer 不收缩，列表设置 `min-height: 0`、纵向 `overflow: auto`；不设置固定高度或面板最小高度。标题下无装饰分隔线，footer 分隔线只随 footer 存在。

正文约 13 px、说明约 12 px，按项目 16 px 基准转换为 rem；高度 API 的数值明确使用 CSS px。表面、边框、圆角与文本直接引用当前 ExUI 公开 token，不新增本地 token 层。长文本使用换行及 `overflow-wrap`，不省略错误正文；滚动链使用 `overscroll-behavior` 隔离，支持窄屏与弹窗。

面板使用一个 `aria-live="polite"` 区域，覆盖 Alert 默认角色为适合命名区域的角色，避免保留隐含 assertive 播报。标题存在时关联标题，无标题时提供“错误信息”的可访问名称；条目使用语义列表，装饰图标和视觉序号隐藏于辅助技术。不给每个条目另设 alert 或 live 区域，不自动抢焦点。

溢出列表可通过 Tab 聚焦，再用方向键、PageDown 或 End 阅读；无溢出时不增加无意义的 Tab 停靠。以 DOM 尺寸测量并监听容器尺寸变化维护此状态，清理观察器。内容变更后重新测量；只在条目的 `id`、`message`、`description` 有实际变化时将列表 `scrollTop` 归零，新数组但内容相同、倒计时重渲染以及 Action 有无切换均不主动归零。

注册邮箱控件同时保留字段 FieldError 的描述关联；有邮箱流程面板时追加面板 ID，错误清除时移除相应 ID。其它表单级错误不把全部输入标成无效。Action 使用可聚焦的实际控件和正常焦点样式。

## 注册适配与错误归属

### 表单为唯一持久状态源

通用组件只接收 `errors`。注册表单将自己的 `root.server` 适配成一条 `ErrorPanelItem`；现有字段错误仍使用 FieldError。当前接口每次提供单个根错误，不为未来数组需求提前修改 HTTP Contract 或 RHF 模型。

新增注册专用语义类型与 handle；保留登录等现有 `AuthFormHandle` 的契约：

```ts
export type InvitationFormErrorKind =
  | 'entry-invalid'
  | 'application-not-found'
  | 'not-eligible'
  | 'check-failed'
  | 'rate-limited'
  | 'send-failed'
  | 'completion-expired'
  | 'complete-failed'

export interface InvitationFormErrors extends AuthFormErrors {
  formKind?: InvitationFormErrorKind
}

export interface InvitationFormHandle {
  setServerErrors(errors: InvitationFormErrors): void
  clearServerErrors(): void
}
```

`AuthFormErrors` 复用现有字段及 `form` 文案类型。`formKind` 仅在同时有 `form` 文案时有效，存入 `root.server.type`，文案存入 `root.server.message`；不得另用 React state 镜像错误。缺少 kind 时使用普通根错误呈现。共享注册适配函数只映射语义 kind 到标题、说明及已有回调，不解析 HTTP 状态或网络异常；这些由应用流程处理。

邮箱根错误面板放在邮箱 Field 之后、提交按钮之前；验证码根错误放在验证码 Field 之后、重试和重发控件之前；资料根错误放在昵称和密码字段之后、提交按钮之前。错误清理继续由 RHF 执行。新增 kind 时必须同时声明流程来源、展示位置及测试；不建立通用异常注册中心。

### 分支映射

| 分支                              | 唯一展示位置             | 文案与操作                                                                                                         |
| --------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| URL 入口参数无效                  | 邮箱 `root.server`       | “注册入口参数无效，请重新填写邮箱”；无 Action。                                                                    |
| 邮箱检查 400                      | 邮箱 FieldError          | “请输入有效的邮箱地址”；无流程面板。手动与自动入口遵循同一映射。                                                   |
| 邮箱检查 404                      | 邮箱 `root.server`       | 标题“暂时无法注册”；正文“未找到该邮箱的申请。”；说明“请先申请加入，获批后再回来注册。”；Action 调用已有 `onJoin`。 |
| 邮箱检查 409                      | 邮箱 `root.server`       | “该邮箱暂不符合注册条件，请确认申请已通过且邀请仍有效”；无强制 Action。                                            |
| 邮箱检查 429                      | 邮箱 `root.server`       | 有有效正数等待时间时“检查失败，请在 N 秒后重试”，否则“检查失败，请稍后重试”；映射一次，不先输出通用错误。          |
| 邮箱检查网络或其它失败            | 邮箱 `root.server`       | “检查失败，请重试”；重试使用现有“继续”，无需 footer。                                                              |
| 手动 / 自动验证码无效、过期或锁定 | 验证码 FieldError        | 保留现有固定文案、重试状态及锁定计时；不复制到面板。                                                               |
| 重发失败                          | 验证码表单 `root.server` | “发送失败，请重试”；不标记验证码字段无效，使用现有重发控件。                                                       |
| 完成注册验证授权失效              | 资料表单 `root.server`   | “验证已过期，请返回邮箱重新验证”；使用现有返回控件，无须重复 Action。                                              |
| 完成注册其它失败                  | 资料表单 `root.server`   | “注册失败，请重试”；使用现有提交控件。                                                                             |

等待时间沿用响应的 `retryAfterSeconds`，展示前验证为有限正数。只展示固定的用户文案，不回显异常 `message`、堆栈、验证码或完成授权。锁定剩余时间是控件状态提示，与错误正文职责不同；保留现有计时与操作禁用规则。

### 自动链与挂载交接

移除流程的 `error` 字符串 state、外层错误 Alert、同一失败的 `ExMessage.error` 和将任意 `error` 同步到验证码的 effect，前提是以下交接已完成：

1. 流程提供一个错误投递入口，接收目标步骤、请求 generation 和上述 `InvitationFormErrors`。有效 generation 且目标表单已挂载时，直接写入该表单。
2. 尚未挂载的目标表单使用单个待投递 ref，记录 `{ targetStep, generation, errors }`。它只用于跨挂载交接；已显示错误的真值始终在 RHF，不在流程中保留第二份持久状态。
3. 初始入口错误进入该交接入口。自动邀请链的验证失败必须先指定目标 `code`，不能在 `setStep('code')` 后立即对尚属邮箱表单的 ref 写入验证码错误。
4. 表单挂载后、对应步骤的 effect 中投递；重新核验 mounted、generation、当前步骤与目标步骤一致。投递后消费 ref，StrictMode 重放不会重复写入。
5. 修改邮箱、返回、加入导航、成功、卸载或 generation 失效清空待投递项；旧请求结果不得写入新表单。重试前清除当前 RHF 错误，新结果替换旧结果。

统一手动和自动邮箱检查失败的映射，保留现有自动请求链复用、pending 防重入、请求 generation 校验、真实卸载清理、URL 验证码移除、完成授权 ref 及成功计时跳转。交接 ref 不存储验证码、密码或完成授权。重发成功与注册成功的 `ExMessage.info` 保留。

## 文件与依赖边界

| 拟新增或修改位置                                                                           | 责任                                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `packages/components/src/ErrorPanel.tsx`、`packages/components/src/ErrorPanel.module.scss` | 纯展示、可访问性、可选区域及滚动。                              |
| `packages/components/src/auth/invitationFeedback.ts`                                       | 注册专用错误类型、根错误到展示数据的静态适配。                  |
| `packages/components/src/auth/InvitationForms.tsx`                                         | 三个表单的 root 面板、注册专用 handle、描述关联及 Action 回调。 |
| `packages/components/src/index.ts`                                                         | 新公开导出；不改变既有登录导出。                                |
| `apps/web/src/invitations/InvitationRegistrationFlow.tsx`                                  | 单次错误映射、挂载交接、移除重复输出。                          |
| 组件、表单及注册流程测试                                                                   | 验证展示契约与生命周期分支。                                    |
| `tests/browser/error-panel-fixture.tsx`、`tests/browser/error-panel.mjs`                   | 独立组件真实布局验收，复用现有浏览器测试运行方式。              |

使用现有 React、RHF、Zod、ExUI、lucide、Vitest 和浏览器测试工具，不新增依赖。组件导入 ExUI 的公开包入口；安装包实现核对不意味着允许深层 import。页面与弹窗通过共享流程同时获得修复。

## 备选方案与风险

| 方案                    | 取舍                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| 所有错误都放字段下      | 简短字段错误清晰，但难以归属跨字段、重发或流程失败，也无法满足通用多条错误能力。字段专属错误仍保留此方式。 |
| B：柔和、限高的通用面板 | 满足多条、可选操作与复用；需要处理真实滚动、可访问性及表单交接。已获用户确认。                             |
| 改为独立加入引导状态    | 可突出申请操作，但会改变注册步骤结构，且无法统一临时失败和后续多条错误。                                   |

主要风险及验证：

- 删除外层 Alert 后遗漏入口或重发失败：先完成全分支归属与跨挂载交接，再删除旧输出；逐分支测试可见错误。
- 旧请求或 StrictMode 重放写到错误步骤：交接绑定 generation 和目标步骤，消费后清空；保留并扩展现有异步测试。
- ExUI 默认布局、角色或 Action 定位影响面板：显式处理默认布局和角色，自建 footer；真实浏览器测量整体高度及固定区域。
- 无 Action 仍保留留白，或正文被高度限制隐藏：DOM 断言整个 footer 缺席，真实浏览器检查尺寸、窄屏换行、键盘最后一条可达。标题及调用方 Action 应保持紧凑，长错误放列表中。
- 非错误的重发或注册成功反馈丢失：保留对应 `ExMessage.info`，继续验证成功及单次跳转。

## 验证与完成条件

仓库当前无 `TESTING.md`，沿用现有 Vitest 和独立浏览器脚本。以下为实施后的验证要求，本 RFC 编写阶段未运行生产测试。

### 自动行为验证

`packages/components/src/ErrorPanel.test.tsx` 覆盖空列表、单条、多条、相同文案不同 ID、可选标题和说明、Action 为元素 / null / 缺省、有效及非法高度。无 Action 断言 footer 容器与分隔线不存在；确认单一 polite 区域、文本安全渲染、内容实际变化才重置滚动。DOM 尺寸与观察器按需模拟，不能以 jsdom 证明真实布局。

`packages/components/src/auth/InvitationForms.test.tsx` 覆盖注册专用 handle 写入 root kind、字段与根错误分离、邮箱面板位置、关联 ID 随错误移除、已有加入回调触发以及清理行为。

`apps/web/src/invitations/InvitationRegistrationFlow.test.tsx` 保留现有 StrictMode、自动链、前导零验证码、显式重试、锁定、冷却、迟到请求、卸载、页面和弹窗成功跳转测试。将 404 / 409 “通知一次”预期改为“持久错误一次且无错误通知”；补充两种容器的手动失败、429、网络失败、入口错误、自动失败交接、重发失败不污染验证码字段、完成注册失败及重试清理。

先运行聚焦验证：

```powershell
pnpm exec vitest run packages/components/src/ErrorPanel.test.tsx packages/components/src/auth/InvitationForms.test.tsx apps/web/src/invitations/InvitationRegistrationFlow.test.tsx --maxWorkers 2
pnpm --filter @workspace/components typecheck
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web build
```

交付时运行适用的根级检查 `pnpm typecheck`、`pnpm test`、`pnpm build` 并报告实际范围。根脚本还涉及服务端、runtime、Docs 与 Outline，遇到环境阻塞应分别报告，不将聚焦 UI 检查表述为整仓通过。

### 真实浏览器验收

独立 fixture 沿用 `tests/browser/notification-experience.mjs` 的 Vite 与 Playwright 运行方式，不改 Outline 源码或安装新的浏览器实现。自动测量与截图至少覆盖：

- 0 / 1 / 3 / 8 条错误，有无标题、说明和 Action；160 / 240 / 320 px 上限。
- 根元素总高度不超过上限，标题与 footer 在列表滚动前后位置不变；无 Action 时 footer 不存在、列表可用高度增加。
- Tab 能进入溢出列表，End 能读到最后一条；非溢出列表不额外截留 Tab，更新不会抢焦点。
- 长中文及连续字符无横向溢出，明暗主题、窄屏和弹窗容器下清晰可读；普通重渲染和倒计时不重置滚动。

随后在实际 `/register` 和注册弹窗用真实接口复现未申请邮箱，确认只有一个面板、加入操作正确、重试与关闭后无迟到错误。独立 fixture 不替代此业务验收。设计预览已验证部分布局，但此前 `127.0.0.1:8080/register` 无法连接；实施后需重新核验运行状态。

## 落地顺序、回退与交接

先新增共享 ErrorPanel 与行为测试，确认可选区域及高度契约；再增加注册专用适配及挂载交接，覆盖全部失败后移除旧输出；最后完成自动检查、独立浏览器与真实页面验收。无需功能开关、数据迁移或服务端发布。

回退时一起撤销注册接线与共享组件新增导出，避免消费方引用残留；仅涉及应用 UI，不更改账号、申请、验证码或持久数据。本阶段不部署上线。

无阻塞设计问题或待定值。实施者负责代码及验证，验收结果须区分自动检查、独立组件浏览器、真实注册页面与部署。源设计与 RFC 保留在 `.notes/error-panel/`，不自动提交或同步到 `.ai/`；稳定结论的沉淀按仓库规则另行确认。
