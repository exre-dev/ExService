# ExUI toast 宿主的生命周期边界

_最后更新：2026-10-20_

`toast` 与 `Toaster` 必须同从 `@exre/exui` 导入，才能共享库内 Sonner store。应用只在 `apps/web/src/main.tsx` 的 `ThemeProvider` 内挂载一个稳定宿主，位于路由之外。未指定独立 theme 时，它跟随 ExUI 主题。

根宿主显式设置 `position="top-right" duration={3000} visibleToasts={3}`，分别保留位置、普通消息时长与可见数量。`visibleToasts` 不淘汰旧记录；ExUI 1.1 已移除旧 ExMessage 容量管理和 loading 句柄，没有兼容层。

`toast.loading` 返回通知 ID。完成态用 `toast.success/error` 携带同一 `{ id, duration }` 更新，取消显示用 `toast.dismiss(id)`。Loading 的截止计时、业务取消、重复或迟到结果防护以及清理均由任务所有者负责；关闭通知不能取消请求，携带旧 ID 的迟到更新仍可能重建通知。

卸载 Toaster 不会清空 store。页面或任务清理只关闭自己持有的 ID，不调用无参数的全局 dismiss。宿主跨路由保留，业务提示从页面事件或挂载后的 effect 发送。

业务规则见 `.ai/rules/frontend-notifications.md`。证据为 `apps/web/src/main.tsx`、`packages/sdk/src/browser.ts`、`tests/browser/exui-v1-overlays-fixture.tsx` 与当前 ExUI 1.1 公开的 Toaster、toast 声明和实现。
