# 页面与内容区的 AsyncBoundary

_最后更新：2026-10-19_

`packages/components/src/AsyncBoundary.tsx` 经 `@workspace/components` 导出 `AsyncBoundary` 和泛型 `AsyncBoundaryProps<T>`，统一大页面与大内容区的等待、加载失败和后代 React 渲染失败。共享层组合已安装 ExUI 的 Empty、Spinner、Button 和 Alert，不访问 API、不定义路由、不导入全局 CSS。

## 使用与状态归属

自动模式执行 `loader(signal)`，成功后才挂载普通 JSX，或将结果传给渲染函数；结果可以是 void。重试重新执行 loader 并创建新的后代树。`resetKey` 表示内容身份；改变它会重新加载并清除旧的渲染错误，单独改变 loader 函数引用不会重新请求。

```tsx
<AsyncBoundary loader={loadContent} resetKey={contentId}>
  {(data) => <Content data={data} />}
</AsyncBoundary>
```

已有 hook 或控制器持有请求时，使用受控模式，避免重复请求。`loading` 优先于 `error`；`error` 为 null/undefined 表示没有加载错误，其他值表示失败。调用方的 `onRetry` 负责重新请求并更新这些状态。两种模式在类型层面互斥。

```tsx
<AsyncBoundary
  loading={state.status === 'loading'}
  error={state.status === 'error' ? state.error : undefined}
  onRetry={retry}
  resetKey={contentId}
>
  {state.status === 'ready' && <Content data={state.data} />}
</AsyncBoundary>
```

不传请求状态时仍可以直接包裹 JSX，组合 Suspense 等待与 React 错误边界。边界捕获后代渲染和生命周期错误，包括结果渲染函数的异常；普通事件处理、独立异步回调和 SSR 错误不属于它的捕获范围。自动 loader 自己通过 try/catch 接收 Promise 失败。

请求更换、重试和卸载时中止旧 AbortSignal，并隔离旧结果；即使 loader 不响应取消，其迟到结果也不会覆盖新内容。StrictMode effect 重放按同样规则清理。

## 布局与反馈

默认 `layout="section"` 保留 18.75rem 最小高度。`layout="page"` 使用 `--async-boundary-page-height`，缺省为 100dvh。`className` 与 `as="main" | "div"` 只作用于等待/错误替代区；成功内容不增加额外地标。

`apps/web/src/routes/PageAsyncBoundary.tsx` 负责 Web 页面几何：默认扣除 `--site-header-height`，`pageLayout="standalone"` 占满视口；默认 main，已有 main 的退出确认页传 as="div"。适配器默认以 pathname 作为 resetKey，也允许显式覆盖。身份与会话检查期间不提前显示完成态标题。

等待先保留空 status 区域，150ms 后向同一容器插入标题、可选说明和装饰图标；卸载立即清理计时器，没有最短展示时长，不移动焦点。`loadingTitle` 默认为「正在加载…」，`loadingDescription` 可选。减少动态效果模式停止 Spinner 旋转。布局来源许可见 `packages/components/src/AsyncBoundary.LICENSE.md`。

错误默认只显示简短文案及「重试」。可选 `homeUrl` 在其后提供边框「返回首页」链接。说明中的「查看错误」链接直接展开下方 Alert，再次点击收起；不打开 Dialog。Alert 整体最高 240px，标题和复制按钮固定，仅正文滚动并可通过键盘进入。复制取完整报告，不受可见高度影响；成功以按钮「已复制」反馈，失败使用既有 ExMessage。

详情只显示 Error 的 name/message/stack、React 组件堆栈或字符串，不序列化任意业务对象，内容由 React 按纯文本转义。不要把秘密放入错误消息；它们会成为用户主动查看与复制的内容。

## Web 内容接入

About/Support 页面模块经 PageAsyncBoundary 的 loader 导入；SupportAccess 保持在它外侧，未认证时不启动 Support 模块加载。正文 useContent 保留实际失败原因，AboutBody 与 Support 错误文章通过受控模式显示。原生 import 的缓存恢复、正文 store 与成员弹窗范围见 `.ai/architectures/web/content-rendering.md`。

`packages/components/src/AsyncBoundary.test.tsx` 覆盖等待、双模式、渲染异常、重试、取消与错误详情；`apps/web/src/content/useContent.test.tsx` 覆盖真实错误保留与旧请求隔离。浏览器几何、键盘、复制、主题及真实 App 模块失败恢复检查位于 `tests/browser/async-boundary.mjs`，独立运行，不由 Vitest 自动执行。
