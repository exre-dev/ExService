# 前端 Form 开发规则

适用于 `apps/web/` 和 `packages/components/` 中新建或修改的 React Form，包括登录、注册、验证码等表单。

## 必须遵守

1. 使用 **React Hook Form** 管理字段值、错误、校验状态和提交状态。Form 组件内不要用 React `useState` 管理这些状态；需要的非表单流程状态由外层组件负责。
2. 使用 **Zod** 定义表单输入规则。直接使用 React Hook Form 的表单通过 `@hookform/resolvers/zod` 接入；ExUI `Form` 的 schema 配置式入口使用 `schema`、`defaultValues`、`fields`，实例配置式入口使用同包 `useForm` 创建的 `form` 与 `fields`，两种输入源互斥。组合式使用 ExUI `form`、`onSubmit` 与子节点，绑定字段用 `FormField`。不得传入外部 React Hook Form 实例。字段间约束也写在 Zod schema 中，不编写独立的手写校验函数或在提交事件里逐项校验。
3. 直接使用 React Hook Form 时，提交入口使用 `handleSubmit`；Form 使用其 `onSubmit` 和 `form.submit()`。只有通过完整 Zod schema 校验的值才能传给提交回调；服务端返回的字段错误通过所属表单实例的 `setError` 显示。
4. 表单界面沿用 `@exre/exui` 的 `Field`、输入控件和错误展示组件，不为表单状态引入另一套 UI 组件。HTTP 请求仍遵守仓库的 API Client 边界。

本规则适用于后续开发；现有登录、注册与验证码表单已迁移到上述方式，不要重新引入 `useState` 字段状态或手写提交校验。
