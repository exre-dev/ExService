# 支持中心重构验收记录

日期：2026-10-15。范围依据 `.notes/support-center/specs/2026-10-15-support-feedback-redesign-design.md` 与 `.notes/support-center/rfcs/support-feedback-redesign-rfc.md`。

## 候选与独立审查

最终候选摘要：`97169edbb9b8b26600d3ee91fa9daf4e7bd6ab3d2da3cc328bab2ac9b2317288`。摘要由本次任务相对开工快照的 53 个路径及其 SHA-256 组成；其中最后一项为既有 Windows Job 测试竞态修复，不改生产实现。摘要不代表仓库所有已有未提交改动。另对开工快照的 459 个文件逐一比对，本次候选范围之外没有额外字节改动。

独立 Code Review：候选 4 APPROVED，53 个路径哈希匹配。关闭确认、冻结任务载荷回读、TaskType 故障隔离、字段 JSON 构建校验、文本保真、HTTP 与原始 handler 覆盖、迁移计数等发现已修复并复审；Windows Job 测试竞态的最后增量也已独立复审，实际清理断言未被弱化。

## 自动验证

| 检查                            | 结果                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm api:lint`                 | 退出 0；既有 Join Contract 的 3 条警告保留。                                                                     |
| `pnpm api:generate`             | 退出 0；两份生成产物 SHA-256 前后相同。                                                                          |
| `pnpm typecheck`                | 退出 0。                                                                                                         |
| `pnpm test`                     | 退出 1；API 与 Website 阶段通过，runtime / Docs 为 92 / 93，Outline 因 fail-fast 未执行。                        |
| runtime / Docs 相同清单独立重跑 | 退出 0，93 / 93；没有修改源码或测试。                                                                            |
| Outline 原清单独立补跑          | 退出 0，12 / 12 阶段（前端 3、服务器 9）通过。                                                                   |
| 首次 `pnpm test --verbose`      | 退出 1；Website 148 / 148 文件、1650 / 1650 测试通过，runtime / Docs 为 92 / 93，精确定位 Windows Job 测试竞态。 |
| `pnpm build`                    | 退出 0；含 SDK、Website Web / Server、Outline 前端 / 国际化 / Server。                                           |
| 候选 4 `pnpm test --verbose`    | 按用户要求在 Website 阶段 Ctrl-C 中断，退出 1 属人为停止；本轮没有完整汇总，不能报告全量通过。                   |

候选 4 使用原 runner 支持的 `pnpm test --verbose` 复验完整清单，保留逐例原始输出；不跳过用例、不改清单或超时。用户随后要求先停止测试，已中断本轮执行。测试进程和临时 Testcontainers 容器已退出，开发页面与 API 保持运行；未再启动测试或构建。最终全量验证尚未完成，等待用户明确恢复。

首次 runtime 失败的原 reporter 没有保留具体用例名。同清单独立重跑通过，但详细全量复验明确定位到 `scripts/docs-integration/ownership.test.mjs` 的 Windows Job 子进程清理用例：Job 及时清理后，首次身份观察可能已经返回 `null`，继续调用 `identityAlive(null)` 会抛 `MODE_OWNER_AMBIGUOUS`。此前该测试与实现均相对 HEAD 未变。

候选 4 仅修正此处测试：确认夹具发出有效后代 PID、根进程退出码为 7，在 Job drain 完成后直接确认 PID 不存在。仍在后代残留时失败，生产身份与清理策略保持不变。真实 Windows Job 聚焦用例 1 / 1、相关两条路径 2 / 2 均通过。历史全量命令的失败状态保留，不能写成一次全绿。

完整测试清单覆盖 Website、runtime 与定制 Outline，数据库测试仅使用 Testcontainers。原始记录位于 `.local/support-redesign-validation/` 的 `api-lint.log`、`api-generate.log`、`typecheck.log`、`test-first-failure.log`、`test-final-verbose.log`、`runtime-diagnostic.log`、`outline.log`、`build.log` 与 `test-candidate4-full.log`。

## 浏览器验证

使用 Chrome 验证真实组件的明暗主题与桌面、390 × 844 窄屏布局，确认无横向溢出、表单可滚动且操作区可达。

- 两张入口与六类选择；Bug 无部门、无 Category，仅功能显示部门；各类字段符合 Spec。
- 不同类型的草稿隔离并可往返恢复；同一 Modal 内的关闭确认可继续编辑、放弃或通过 Escape 返回；放弃后重新打开为空草稿。
- 文件选择、文件列表、类型切换时附件草稿保留；大文件信息开关关闭与再打开保留当前草稿。
- 隔离传输夹具中完成 Bug 与宣传活动的提交流程，核对附件声明、摘要和多行文本原样保留。夹具没有向 ClickUp 写入。
- 原地址 `http://127.0.0.1:9001/support` 恢复真实 API 连接和已有登录状态；实际加载六类选项与 Bug、资源表单。
- 真实资源表单仅禁用缺少 Tag 的新增、修改、删除操作，其他仍可用。

临时端口 9011 的隔离验收服务与页面已关闭；原页面及本站 API 保持运行。

## 显式开发库迁移

已执行用户批准的 `pnpm db:migrate`，退出码为 0。连接身份为独立 `exre`，迁移记录共 5 条，新增 `task_payload_json` 与 `task_payload_sha256` 列存在。迁移前后账号为 2、会话为 14、通知回执为 0；旧支持反馈与附件均为 0。没有整库 reset，也没有改写根环境配置。

## 外部验收边界

目标 ClickUp Space 尚缺少“新增 / 修改 / 删除”三个操作 Tag。用户提交流程不会自动创建这些 Tag。

本次只读核对了 TaskType 与 Tag 元数据；尚未进行六类真实任务创建、Tag 写入、真实附件上传、网关或部署验收。自动测试、隔离浏览器传输及本地运行均不替代这些外部验收。

未创建 commit、push、PR 或部署。
