# ExWebsite 全站消息提示设计

- 状态：已确认
- 日期：2026-09-24
- 模块：`.notes/archive/ex-message/`

## 目标与范围

在 ExWebsite 中提供一个全站可用的临时消息入口：应用挂载一次 `<ExMessage />`，其他位置通过 `ExMessage.info`、`ExMessage.warn`、`ExMessage.error` 和 `ExMessage.loading` 显示提示。全站可设置默认显示时长、位置及最大活动消息数；普通消息可按次覆盖时长。超量时关闭最早创建的活动消息。此能力只服务 ExWebsite，不改变 ExUI 的公开 API。

## 现有基础与放置决策

`@exre/exui` 已从同一实例导出 `Toaster` 与 `toast`；其 `toast` 已有 `info`、`warning`、`error`、`loading` 和按 ID 更新、关闭的能力。`Toaster` 跟随 `ThemeProvider` 的主题。ExUI 的 `Message` 是聊天消息布局组件，和本设计的全站临时提示不是同一概念。

`packages/components` 是 ExWebsite 的应用级共享 UI 包，因此由它公开 `ExMessage` 并封装 ExUI 的 `Toaster/toast`。`apps/web/src/main.tsx` 负责在现有 `ThemeProvider` 内、路由树旁挂载一次组件；页面和其他共享组件只从 `@workspace/components` 调用 `ExMessage`。不安装独立的 `sonner`，不另建提示容器、主题状态、样式 token 或通知存储。

比较过的替代方案：直接在各页面使用 ExUI `toast` 无法统一全站容量和 loading 生命周期；将 `ExMessage` 加入 ExUI 会把当前只有 ExWebsite 使用的调用约定加入通用组件库。

## 公开接口

```tsx
;<ExMessage duration={3000} placement="top-right" maxCount={3} />

ExMessage.info('资料已更新')
ExMessage.warn('请检查输入', { duration: 6000 })
ExMessage.error('保存失败')

const { onSuccess, onError, dismiss } = ExMessage.loading('正在保存')
onSuccess('保存成功')
// 或在失败路径调用 onError('保存失败')

ExMessage.loading('正在同步', { duration: 10000 })
```

| 参数                                                          | 语义                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `duration` 组件属性                                           | 普通消息及 loading 完成态的默认显示时长，单位毫秒，默认 `3000`。                                                         |
| `placement` 组件属性                                          | 全站位置，默认 `top-right`；允许 `top-left`、`top-center`、`top-right`、`bottom-left`、`bottom-center`、`bottom-right`。 |
| `maxCount` 组件属性                                           | 同时活动的最大消息数，默认 `3`，包含 loading 和完成态。                                                                  |
| 普通消息的 `options.duration`                                 | 覆盖该条消息的全站默认时长。                                                                                             |
| loading 的 `options.duration`                                 | loading 阶段的最长显示时长；省略时 loading 持续显示，不继承全站 3 秒。到期仅关闭消息，不自动调用 `onError`。             |
| `onSuccess(content, options?)` / `onError(content, options?)` | 将同一条 loading 更新为成功或失败消息，并从更新时开始按全站默认时长计时；`options.duration` 可覆盖完成态时长。           |
| `dismiss()`                                                   | 主动关闭该条 loading 或其完成态。                                                                                        |

提示内容为 React 可渲染内容，完成方法必须提供新的完成文案。普通消息方法返回底层消息 ID，供调用方识别；公开面不直接暴露 Sonner 的其他选项。`warn` 映射 ExUI 的 `toast.warning`。时长接受正的有限毫秒数，`maxCount` 接受正整数；无效数值抛出明确错误，不静默产生无限显示或无上限队列。

## 消息生命周期与容量

共享包维护一份仅用于容量和 loading 生命周期的活动消息登记表，按创建顺序保存 ID；实际渲染和主题仍由 ExUI 负责。新增消息前若已达到 `maxCount`，从登记表移除最早的一条并调用 `toast.dismiss(id)`，随后创建新消息。`Toaster` 同时使用 `visibleToasts={maxCount}` 限制可见数量，避免离场动画造成超量显示。消息自动关闭、用户关闭或主动关闭时同步从登记表移除。运行中降低 `maxCount` 时也按创建顺序关闭超额项。

loading 完成时用原 ID 更新消息，不创建新容量名额，也不改变其创建顺序。第一次调用 `onSuccess` 或 `onError` 决定终态；重复完成调用无效。显式 `options.duration` 为 loading 设置独立的截止计时；完成、关闭或因超量被挤出时清理计时器。消息结束之后调用其完成方法不再显示任何提示，也不抛异常。只调用 `ExMessage.loading` 而不保存返回值时，应传入 `duration`，否则它会一直显示直到被其他消息挤出；ExUI 的 loading 提示没有用户关闭按钮。无需完成提示的操作可使用返回的 `dismiss()`。

该包装器只管理自己创建的消息。全站业务代码应统一通过 `ExMessage` 调用，避免绕过容量登记表。组件在浏览器应用根部只挂载一次；卸载时清理包装器持有的计时器。消息不写入持久存储，也不跨页面刷新保留。

## 验证与边界

使用行为测试验证默认 3 秒与右上角、六个可选位置、普通消息的按次时长覆盖、`maxCount` 超量关闭最早消息及 loading 原位更新。用受控计时验证 loading 默认持续、显式超时自动关闭、成功/失败后的新时长，以及关闭或超量后完成方法不再创建消息。验证应用入口只挂载一个 `ExMessage`，并在现有 `ThemeProvider` 内正常显示。

本设计不涉及 HTTP Contract、数据库、服务端通知、跨标签同步、持久通知中心或 ExUI 发布。实现时保留当前工作区已有的其他未提交改动，不改动无关页面。
