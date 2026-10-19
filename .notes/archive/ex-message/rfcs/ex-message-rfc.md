# ExWebsite 全站消息提示技术 RFC

- 状态：待技术评审
- 日期：2026-09-24
- 来源：已确认的 ExMessage 设计 `.notes/archive/ex-message/specs/2026-09-24-ex-message-design.md`

## 决策摘要

在 `packages/components` 公开 `ExMessage`，把 ExUI 已导出的 `Toaster` 与 `toast` 组合成 ExWebsite 全站唯一的提示入口。`apps/web/src/main.tsx` 在现有 `ThemeProvider` 内挂载一次 `<ExMessage />`。默认时长为 3000 毫秒、位置为右上角、最大活动数为 3；各次普通提示可以覆盖时长。容量由包装层主动关闭最早消息，loading 由包装层管理超时与完成句柄，实际显示及主题沿用 ExUI。

## 现状、目标与边界

- `.ai/decisions/components/01-app-level-shared-component-package.md` 把 `packages/components` 定位为站点级共享 UI，现有公开入口 `packages/components/src/index.ts` 直接导出源码。该包已依赖 `@exre/exui`，不依赖 API Client。
- 应用入口 `apps/web/src/main.tsx` 已在路由上方挂载 `ThemeProvider` 并一次性导入 ExUI 样式；新增提示宿主应放在同一根节点内，覆盖包括登录页在内的全部路由。
- 当前安装的 ExUI 公开 `Toaster`、`toast`；`toast` 与 `Toaster` 使用同一份 Sonner 状态。ExUI 的 `Message` 是聊天行组件，本 RFC 的 `ExMessage` 是临时全站提示。
- 底层 `visibleToasts` 只隐藏超额项，没有按最早创建顺序关闭；底层 loading 不启动自动关闭计时，即使传入 `duration`。这两条均需要本包实现，不能把底层属性当作已满足的行为。

验收目标是：任意已挂载的前端页面可调用 `info`、`warn`、`error`、`loading`；组件默认和单次时长生效；位置可在六个支持方位中全局设置；活动消息数不超过 `maxCount`，超额时最早消息关闭；loading 可完成、超时或主动关闭，结束后不可复活。

不修改 HTTP Contract、数据库、路由、认证状态、ExUI 源码或 ExUI 发布。消息只存在于当前浏览器内存；页面刷新后不保留。`packages/components` 不导入 ExUI 全局样式，不引入独立 Sonner 副本。

## 模块与公开契约

建议由 `packages/components/src/ExMessage.tsx` 承担 React 宿主与公开静态 API，由同目录的内部控制模块管理活动 ID、配置和 loading 计时；从 `packages/components/src/index.ts` 只导出 `ExMessage` 及其公开类型。应用入口在 `ThemeProvider` 中、`App` 之前渲染一个宿主。不要求页面引入 Provider、Context 或业务状态。

```ts
type ExMessagePlacement =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

type ExMessageProps = {
  duration?: number       // 默认 3000 毫秒
  placement?: ExMessagePlacement // 默认 top-right
  maxCount?: number       // 默认 3
}

type MessageOptions = { duration?: number }
type LoadingHandle = {
  onSuccess(content: React.ReactNode, options?: MessageOptions): void
  onError(content: React.ReactNode, options?: MessageOptions): void
  dismiss(): void
}

// ExMessage 同时是 React 组件与以下静态方法的出口：
ExMessage.info(content: React.ReactNode, options?: MessageOptions): string | number
ExMessage.warn(content: React.ReactNode, options?: MessageOptions): string | number
ExMessage.error(content: React.ReactNode, options?: MessageOptions): string | number
ExMessage.loading(content: React.ReactNode, options?: MessageOptions): LoadingHandle
```

```tsx
;<ExMessage duration={3000} placement="top-right" maxCount={3} />

ExMessage.info('资料已更新')
ExMessage.warn('请检查输入', { duration: 6000 })
const { onSuccess, onError } = ExMessage.loading('正在保存')
// 任务结果确定后，只调用其中一个：
onSuccess('保存成功')

// 无需保留句柄的 loading 应提供截止时间：
ExMessage.loading('正在同步', { duration: 10000 })
```

`duration` 单位均为毫秒，必须是正的有限数；`maxCount` 必须是正整数。无效数值以明确错误拒绝，避免静默变成永久提示或无界数量。`placement` 由公开联合类型限制。普通方法调用 ExUI 同名方法，`warn` 映射 `toast.warning`。全站配置影响之后创建的消息；修改 `maxCount` 时立即关闭超额活动项。完成态在调用 `onSuccess/onError` 时读取当时的默认时长。底层其他 Sonner 选项不进入本站公开接口。

## 状态与生命周期

内部登记表按初次创建顺序保存活动 `{id, phase, timer?}`，其中 `phase` 为 `ordinary | loading | completed`。控制模块对所有创建、完成、关闭操作同步更新登记表，不从 DOM 反推活动状态。普通消息及完成态在调用 `toast` 时传入已解析的单条 `duration`；这样运行时改变宿主默认时长不会改写既有消息的计时。`Toaster` 设置 `position={placement}` 和 `visibleToasts={maxCount}`；后者只承担视觉上限，实际容量仍由登记表决定。

创建新消息时先按创建顺序关闭并移除超额的最老活动项，再通过 ExUI `toast` 创建和登记新 ID。loading 转为完成态使用相同 ID 调用 `toast.success` 或 `toast.error`，不新增容量名额，也不改变先后顺序；第一次完成决定结果，之后的完成调用无效。`dismiss` 和容量驱逐先把该 ID 标为已结束、清理 timer，再通知 ExUI 关闭。ExUI 的自动关闭和用户关闭回调也只做幂等清理。这样异步任务的迟到回调无法让已结束的消息重新出现。

loading 不继承全站 3 秒。仅当 `ExMessage.loading` 的 `options.duration` 存在时，包装层为 loading 阶段建立截止计时；到期关闭该消息，不自动转为失败。`onSuccess/onError` 若先发生，则清理 loading 计时并以相同 ID 显示完成文案，完成态使用当前全站默认 3 秒或其方法参数中的覆盖时长。完成方法在已超时、被驱逐、被关闭或已经完成时为空操作。仅调用 `ExMessage.loading(...)` 而丢弃句柄且不传时长，会留下持续显示的 loading，调用方应避免这种用法；底层 loading 没有用户关闭按钮。

组件是单宿主契约：应用在根部挂载一次。静态调用需要已挂载宿主；过早调用应得到明确错误，不依赖底层 Sonner 对挂载前消息的处理。宿主卸载时关闭包装层创建的活动消息，并清理计时器与登记表；React StrictMode 的开发期挂载/卸载循环不能留下重复宿主、孤儿消息或悬空计时器。重复挂载第二个宿主属于配置错误，应明确拒绝，避免同一消息显示两次。

## 失败模式与验证

| 风险或场景                                          | 设计处理                                               | 验证                                                         |
| --------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| 用 `visibleToasts` 误当容量控制，旧消息仍在底层排队 | 登记表按创建顺序主动 `toast.dismiss`，同时设置视觉上限 | 连续发送超过 `maxCount` 条，断言最早 ID 被关闭且不会重新出现 |
| loading 的底层 `duration` 被忽略                    | 包装层独立计时，完成和驱逐时清理                       | 假计时器分别验证默认持续、显式截止、提前完成                 |
| 异步完成晚于截止或容量驱逐                          | 结束态幂等检查，完成方法不再调用 ExUI                  | 驱逐、超时和手动关闭后调用两种完成方法，断言无新消息         |
| 快速连续调用及运行时降低 `maxCount`                 | 同步登记和驱逐，完成态不重新排序                       | 连续调用与变更属性后检查活动 ID 顺序及数量                   |
| 重复宿主或开发期 StrictMode 重挂载                  | 单宿主检查与清理                                       | 挂载、卸载、重挂载及重复挂载测试                             |
| 包装层和 ExUI 使用不同 Sonner 实例                  | `Toaster`、`toast` 均从 `@exre/exui` 根入口导入        | 真实组件测试确认静态调用出现在宿主 DOM 中                    |

在 `packages/components/src/ExMessage.test.tsx` 使用 jsdom 和受控计时验证公开 API、生命周期与容量；必要时分离控制模块单测，但关键路径仍需经过真实 `ExMessage` 宿主和 ExUI 显示。验证 `apps/web` 根入口只挂载一个宿主，主题切换后显示仍跟随现有 `ThemeProvider`。执行仓库现有的 `pnpm typecheck`、`pnpm test`、`pnpm build`；若既有工作区失败，分别报告本变更的验证结果与已存在的失败。

## 落地顺序与回退

先在共享包完成组件、控制模块、公开导出及行为测试，再在 `apps/web/src/main.tsx` 挂载一个宿主；所有新调用都经共享包导出。没有迁移数据、兼容窗口或额外依赖。若本次集成需回退，移除根宿主和新增公开调用/导出即可；现有 ExUI 主题及页面不依赖该能力。交付前按本地测试和浏览器中的多消息、loading 完成路径验收。

## 取舍与待决项

采用 ExWebsite 薄封装，保留 ExUI 的样式、主题和底层提示实现；代价是本站承担容量登记及 loading 截止计时。各页面直接调用 ExUI `toast` 虽简单，但会绕过全站 `maxCount` 与 loading 句柄规则；修改 ExUI 则会把单站点 API 约定推广到公共库。目前没有阻塞实现的待决项。
