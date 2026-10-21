# Package/Common 包规则

- 按实际复用需求新增通用模块，通过 `@workspace/common/<module>` 独立子入口消费；不开放包根，不用深层源路径或别名绕过 `exports`。
- 通用模块保持平台无关，不读取环境变量，也不在导入时执行 I/O。本站 HTTP DTO 与请求管线留在 `packages/sdk/`，UI 留在 `packages/components/`。
- 当前公开入口是 `@workspace/common/feedback-content`。PHP 子模块独立使用 Composer，不通过 Node-only Common 身份配置入口共享运行配置。
- 新增入口时测试 Node 解析、未公开路径拒绝和真实浏览器打包边界。
