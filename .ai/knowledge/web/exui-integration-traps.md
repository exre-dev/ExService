# ExUI 的集成陷阱

**结论：`@exre/exui` 的几条契约违反了不会报错，只会静默失效；其中三条与 CSS 特异性有关，读我们自己的代码看不出来。**

_最后更新：2026-10-15_

## 已知陷阱

### 1. `style.css` 是「每个应用一次」，它已内含 Token 与字体 CSS

`@exre/exui/style.css` 指向 `dist/index.css`，其中已经包含 Token CSS（`dist/tokens/style.css` 的内容）与字体 CSS（`@fontsource-variable/outfit`）。

- 导入点固定在 `apps/web/src/main.tsx`，且必须排在 `apps/web/src/styles/index.scss` **之前**，应用样式才能覆盖库的默认值。
- 黑白品牌覆盖的唯一来源为 `apps/web/src/styles/website-theme.css`，顺序固定为 ExUI、品牌 CSS、应用 SCSS。根 `website-theme-profile` 与 `.website-theme-profile.dark` 限定两套覆盖；主题偏好继续由既有 reconciliation 与 ExUI provider 管理。
- 不得再导入 `@exre/exui/tokens/style.css` 或 `@exre/exui/tokens/font.css`——那是重复的 CSS，不会报错。
- 不得在 `packages/components` 内导入它：那是共享包，一旦被第二个入口引用就会出现第二个导入点。

### 2. `useTheme` 在 `ThemeProvider` 之外调用会抛错

这是 ExUI 的公开契约（`useTheme must be used within a ThemeProvider`），不是可选的防御。provider 挂在 `apps/web/src/main.tsx`，高于 `<BrowserRouter>`，因此所有路由都能用；但**不要**在可能没有 provider 的组件里调用它。

`ThemeProvider` 在渲染期读 `localStorage`，只能在浏览器挂载。本仓库是纯客户端 SPA（Vite，无 SSR），因此安全；将来若引入预渲染，这里会变成真实故障。

### 3. `color-scheme` 没人声明，必须由应用补

ExUI 的样式表**完全不声明** `color-scheme`；`ThemeProvider` 只做两件事——在 `documentElement` 上增删 `light` / `dark` 类（`src/components/theme-provider.tsx`）。

后果：如果应用不补，深色主题下页面是深色而原生滚动条、表单控件仍是浅色。

补法必须按同一组类选择器，且注意**特异性**：

```scss
:root {
  color-scheme: light;
} /* 伪类，特异性 (0,1,0) */
.dark {
  color-scheme: dark;
} /* 类，特异性 (0,1,0)，与 :root 相同 */
```

两者特异性相同，胜负由源码顺序决定，所以 `.dark` 必须写在 `:root` 之后。

另外，原来的 `color-scheme: light dark` 跟随**操作系统**偏好，与本应用「用户显式选择且持久化」的主题模型矛盾，已删除。

### 4. 库字体曾被应用的 `:root` 声明静默压掉

ExUI 在 `html` 上写 `font-family: var(--exui-font-family)`（`'Outfit Variable', …`）。`html` 的选择器特异性是 (0,0,1)，而 `:root` 是 (0,1,0)——**应用只要在 `:root` 上写 `font-family`，库自带的 Outfit 就永远不会生效**，且没有任何报错或可见提示。

`apps/web/src/styles/index.scss` 因此不再声明 `font-family`，字体完全交给 ExUI 的 Token。

同理需要注意：任何想在 `:root` 上覆盖的字体、行高类属性，都会压过 ExUI 写在 `html` 上的同名声明。

### 5. `NavigationMenu` 自己就渲染 `<nav>`，不要再套一层

ExUI 的 `NavigationMenu`（Radix）渲染出的是 `<nav aria-label="Main">`。把它包在自己的 `<nav>` 里会产生**嵌套的导航地标**，对辅助技术是噪音。

正确做法：外层只用一个普通容器，把中文标签直接传给 `NavigationMenu`：

```tsx
<div className={styles.nav}>
  <NavigationMenu viewport={false} aria-label="主导航">
    …
  </NavigationMenu>
</div>
```

`viewport={false}` 用于纯链接场景；有下拉内容时按需开启。

### 6. ExUI 的 `NavigationMenuLink` 用 `asChild` 接路由链接

不要写 `href`，把 react-router 的 `<Link>` 作为子元素传入，样式函数负责外观：

```tsx
<NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
  <Link to="/dispatch">Dispatch</Link>
</NavigationMenuLink>
```

### 7. 没有通用圆角 token

ExUI 有 `--exui-border-*`、`--exui-surface-*`、`--exui-text-*`、`--exui-shadow-*`、`--exui-control-*`，但**没有** `--exui-radius-*` 命名空间。圆角值分散在 `--density-control-radius` 与 `--exui-component-*-radius` 里。自定义容器需要圆角时，从这些值里取，或按 scaling rules 用 `rem`。

### 8. 按钮会自动给子图标定尺寸

`buttonVariants` 带 `[&_svg:not([class*='size-'])]:size-[var(…-icon-size)]`，所以 `lucide-react` 图标放进去不需要自己写宽高。反过来，**不要**给图标加 `size-*` 类，那会绕过这套尺寸。

### 9. 顶栏 1px 溢出：边框不计入放在内层的 `min-height`

如果内层元素设 `min-height: H`、外层只负责边框，外层实际高度是 `H + 1px`，而给页面用的「视口减去顶栏」仍按 `H` 算，页面就会多出 1px 并长出滚动条。

修法：把 `min-height` 放到**外层**并配 `box-sizing: border-box`，让边框计入这 `H`；外层同时用 `display: flex` 让内层撑满。

### 10. `Button` 没有显式的 `role` 属性

ExUI 的 `Button` 渲染 `<button>` 但**不写** `role="button"`（依赖隐式角色）。因此用 `[role="button"]` 查询它一定查不到，自动化断言要按标签名或 `data-slot` 查。`data-slot="button"` 在 `DropdownMenuTrigger asChild` 场景下会被 Radix 的 `data-slot="dropdown-menu-trigger"` 取代。

### 11. Canvas 配色需要解析 system 主题

`useTheme().theme` 可能为 `system`，不能只用 `theme === 'dark'` 决定 Canvas 的颜色。404 背景在 system 模式下订阅 `prefers-color-scheme`，跟随操作系统实时更新；显式 light/dark 优先于系统偏好。普通 DOM 样式直接继承 provider 在根节点应用的主题 token，避免页面局部强制 `.dark` 造成 Canvas 与组件主题不一致。

### 12. 居中导航需要同时处理滚动条占位与弹窗补偿

使用传统滚动条的浏览器中，短页与长页的可用宽度不同，会让居中的导航产生半个滚动条宽度的横向偏移。`apps/web/src/styles/index.scss` 在根节点设置 `scrollbar-gutter: stable`，保证页面切换时预留空间一致。

ExUI 弹窗的滚动锁定会给 `body[data-scroll-locked]` 添加滚动条宽度的右外边距。根节点已固定占位时，这会重复补偿，因此在支持 `scrollbar-gutter` 的浏览器中将该右外边距覆盖为零。必须同时验证短页、长页以及弹窗打开和关闭，不能只检查页面切换。

`tests/browser/navbar-geometry.mjs` 提供真实浏览器的坐标断言，接受 Browser Use 的 tab；这不是 Vitest/jsdom 测试，也不由 `pnpm test` 自动执行。使用桌面视口与传统滚动条运行 `assertNavbarGeometry(tab, baseUrl)` 和 `assertNavbarModalGeometry(tab, baseUrl)`；jsdom 没有布局计算，无法覆盖该问题。

### 13. `NativeSelect` 的弹层仍由系统绘制

ExUI `NativeSelect` 只包装原生 `<select>`；触发器有库样式，展开后的菜单仍随浏览器和操作系统。需要与网站主题一致的菜单时，使用公开的 `SelectField`、`SelectTrigger`、`SelectContent` 和 `SelectItem`，将标签、RHF ref、onBlur 和错误描述关联放在触发器上。

Radix 的 `SelectItem` 不接受空字符串值；可选字段通过独立的「不选择」菜单项把值还原成表单的空字符串，不能把清空项标识提交为 ClickUp option ID。支持反馈的绑定见 `packages/components/src/forms/ClickUpFieldInput.tsx` 和 `apps/web/src/pages/Support/feedback/FeedbackModal.tsx`。

### 14. `Textarea` 的 `rows` 不能单独保证初始高度

ExUI `Textarea` 启用 `field-sizing: content`，空值时按内容和最小高度计算尺寸，仅传 `rows` 可能仍得到较矮的输入框。需要明确主次层级时，在消费方 CSS Module 设置 `min-height`；支持反馈使用 `lh` 单位分别保留约八行和三行的空间，继续允许内容增长。实现见 `apps/web/src/pages/Support/feedback/FeedbackModal.module.scss`。

## 证据

- 已安装包内：`dist/index.css`（含 `body{background-color:var(--background);color:var(--foreground)}`、`html{font-family:var(--exui-font-family)}`）、`dist/tokens/style.css`（`:root` / `.dark` / `.pitch-black` 三个主题选择器）、`src/components/theme-provider.tsx`、`src/components/ui/{button,navigation-menu,dropdown-menu}.tsx`、`types/components/ui/*.d.ts`。
- `apps/web/src/main.tsx`、`apps/web/src/styles/index.scss`、`packages/components/src/SiteHeader.module.scss`。
- `.agents/skills/exui-usage/references/react-setup.md`、`theme-usage.md`、`icon-usage.md`、`guides/EXUI_SCALING_RULES.md`（本机保留、未纳入版本控制，见 `.gitignore`）。
