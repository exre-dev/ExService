# 前端通知开发规则

适用于 `apps/web/`、`packages/components/` 和 Browser SDK 的临时通知，包括操作结果、警告、失败和异步操作进度。

## 统一入口

1. 全站临时通知统一从 `@exre/exui` 导入 `toast`，宿主也使用同包的 `Toaster`，共享库内通知 store；不另装 Sonner 或新增通知封装层。
2. 全站宿主只在 `apps/web/src/main.tsx` 的 `ThemeProvider` 内挂载一次，位于路由之外。页面、布局和弹窗只调用 `toast`，全局呈现配置统一在根宿主调整。
3. 通知调用放在已挂载页面的事件处理或后续 passive effect 中，不在模块初始化或 React render 中发送。宿主默认配置和生命周期边界见 `.ai/knowledge/components/toast-host-lifecycle.md`。
4. 字段错误继续在所属 Form 字段显示，持续错误和重试入口由页面状态承载。聊天消息与持久通知中心不属于临时通知。

## 场景与方法

| 场景                         | 使用方式                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| 普通反馈或无需等待的操作结果 | `toast.info(content, options?)`                             |
| 提醒用户注意或检查输入       | `toast.warning(content, options?)`                          |
| 操作失败                     | `toast.error(content, options?)`                            |
| 异步操作进度                 | `toast.loading(content)`，保留返回 ID                       |
| 异步操作完成                 | `toast.success/error(content, { id, duration })`，更新原 ID |
| 关闭自己的通知               | `toast.dismiss(id)`                                         |

现有普通成功反馈继续使用 `info`。文案说明结果或下一步操作，不直接显示原始异常、堆栈或服务器内部信息。

## 异步操作与时长

- 同一任务用原 ID 更新完成态，并显式给完成态设置有限 `duration`；不要在 `finally` 中立即关闭刚显示的完成反馈。
- Loading 任务的取消、超时与卸载清理由应用负责，普通消息的 `duration` 不代替业务请求超时。
- 任务取消、超时或完成后先使任务状态失效，再处理后续回调，避免重复或迟到结果重建消息。关闭提示与取消业务请求分别处理。
- 清理仅作用于自己拥有的 ID。可取消或可卸载的任务同时清理自己的计时器、订阅和通知。

以下例子仅用于无需中途取消、也不绑定页面卸载的任务；其他任务须额外管理有效性和清理：

```ts
import { toast } from '@exre/exui'

async function runWithFeedback(task: () => Promise<void>): Promise<boolean> {
  const id = toast.loading('正在保存')
  try {
    await task()
    toast.success('保存成功', { id, duration: 3000 })
    return true
  } catch {
    toast.error('保存失败，请重试', { id, duration: 3000 })
    return false
  }
}
```

修改时核对唯一根宿主、通知来源和 loading 的所有结束路径。业务接线回归见 `apps/web/src/invitations/InvitationRegistrationFlow.test.tsx`，隔离浏览器夹具见 `tests/browser/exui-v1-overlays-fixture.tsx`。
