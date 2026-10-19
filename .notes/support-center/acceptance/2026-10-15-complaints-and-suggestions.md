# 投诉和建议验收记录

- 日期：2026-10-15。
- 设计：`.notes/support-center/specs/2026-10-15-complaints-and-suggestions-design.md`。
- RFC：`.notes/support-center/rfcs/complaints-and-suggestions-rfc.md`。
- 状态：实现、独立复核和分段回归验证完成。

## 已确认行为

- 支持中心「投诉和建议」打开两类表单，分别使用 Message、Danger 图片，沿用功能和需求的卡片、骨架、输入与上传交互；没有底部关闭按钮。反馈和建议图标按后续确认由 Send 改为 Message。
- 标题、内容必填，附件和大文件信息选填。投诉与建议使用不同的内容提示。
- 只有投诉显示「匿名提交」，默认关闭；切换类型保留投诉草稿的匿名值，放弃草稿后恢复关闭。开关位于提交按钮左侧，包括 390px 窄屏。
- 匿名投诉冻结匿名选项，省略 ClickUp 用户自定义字段，不自动写入昵称或用户 UUID；站内仍以登录用户维护归属、限流和进度。
- 两个首页入口独立恢复进度；会话切换清除内存中的旧用户表单，旧请求不能覆盖新用户的恢复指针。
- 新类型保存为 v3，旧六种类型的 v2 记录、附件与恢复语义保留。

## 自动验证

| 检查                                    | 结果                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Contract lint / generate                | 通过；lint 保留既有 Join 的 3 条 oneOf 警告                                                             |
| 根目录 `pnpm typecheck`                 | 通过，日志 `.local/community-typecheck.log`                                                             |
| 根目录 `pnpm build`                     | 通过，日志 `.local/community-build.log`                                                                 |
| 最后界面调整后的 Web typecheck / build  | 通过，日志 `.local/community-web-final.log`、`.local/community-web-layout-build.log`                    |
| 后端支持流程、适配器、Contract 定向测试 | 115/115 通过                                                                                            |
| 前端反馈与支持路由定向测试              | 54/54 通过                                                                                              |
| 最终数据库迁移与前端定向复测            | 5 文件、76/76 通过，日志 `.local/community-final-focused.log`                                           |
| 后续完整 Outline 测试阶段               | 12/12 组通过，前端 141 项、服务端 15 个指定场景通过，退出码 0；日志 `.local/community-outline-test.log` |
| 独立复核                                | 架构、后端、前端、最终及最后三处小调整的增量复核通过；已确认问题均修复                                  |

完整 `pnpm test` 首轮的 Website 阶段为 148 文件通过、1 文件失败，1680 项通过、3 项失败。失败均来自迁移测试写死旧 journal 数量 5；新增 0005 后为 6。测试已改为读取 journal 条目数，三个历史迁移场景在最终 76 项复测中通过。

后续 runtime 阶段为 92/93 通过，跨进程互斥测试首次未观察到预期日志；未修改相关脚本，单独原样重跑 1/1 通过。原始日志与重跑日志分别为 `.local/community-remaining-test.log`、`.local/community-runtime-retry.log`。这些分段复测不能表述为原始 `pnpm test` 命令退出成功。

## 浏览器

在 `http://127.0.0.1:9001/support` 的真实浏览器验证了：入口与图片、两个表单、匿名默认值及切换/放弃、空表单校验、浅色/深色、390 × 844 视口。窄屏 Modal 未超出视口，匿名开关位于提交按钮左侧。验收后已取消视口覆盖，并将主题恢复为原来的「跟随系统」。

未提交有效表单，没有通过浏览器创建远程测试任务或上传附件。恢复状态下同时显示「核对进度」「继续提交」的窄屏页脚尚未单独做浏览器验收。

## 本地数据库与外部准备

显式执行 `pnpm db:migrate`，核验实际数据库为 `exre`，journal 从 5 增至 6。前后 users=2、submissions=1、attachments=0，数据未清理，运行检查为 READY。证据：`.notes/support-center/acceptance/2026-10-15-community-migration.json`。

ClickUp 目标 Space 的「反馈」「投诉」Tag 已创建并读取确认。编码失误产生的临时 Tag 经用户明确授权后删除，最终读取已无该 Tag。证据：`.notes/support-center/acceptance/2026-10-15-community-tags.json`。

本次没有在真实 ClickUp 创建任务或上传附件，因此不宣称真实任务投递、附件上传或部署验收通过。没有创建 Commit、推送或部署。
