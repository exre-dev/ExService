# 提交前格式化边界

格式化属于仓库的 Git 提交流程，由 `.husky/pre-commit` 调用 lint-staged，任务登记在 `.lintstagedrc.json`。不同 Agent Runtime 和人工提交共用此入口，日常使用方式见 `README.md`。

`.gitattributes` 将 `.husky/` 下的脚本固定为 LF，避免 Windows 的 `core.autocrlf` 把 shell Hook 检出成 CRLF。

## 安装与工作树

根 `package.json` 的 `prepare` 执行 `.husky/install.mjs`。普通 checkout 将 Husky 路径写入本仓库配置；linked worktree 启用 `extensions.worktreeConfig`，只将 `core.hooksPath` 写入该工作树的 `config.worktree`，避免改变其他工作树的 Hook 入口。已经启用此扩展的普通 checkout 也使用自己的 `config.worktree`。

安装器拒绝替换其他 `core.hooksPath`，避免丢失既有检查；需要先显式整合现有 Hook。启用工作树配置前若共享配置包含 `core.worktree` 或 `core.bare=true`，安装失败并要求先迁移这些配置。CI、production 和 `HUSKY=0` 环境跳过开发 Hook 安装；没有 Git 工作树的源文件归档也跳过。

## 格式化范围与失败

lint-staged 使用默认的备份、失败回退和部分暂存文件保护，只把格式化后的暂存内容加入提交。不要改成直接按工作区文件执行格式化后再全部暂存，否则可能把未暂存改动带入提交。Prettier 配置和排除规则分别只维护在 `.prettierrc.json`、`.prettierignore`。

`api/generated/`、`packages/sdk/src/generated/`、字体子集构建产物、Drizzle 的元数据和 `pnpm-lock.yaml` 保持各自生成器的输出格式，Hook 不改写它们。SDK 生成声明的来源与消费路径见 `.ai/architectures/api/contract-layout.md`。

不支持的文件类型由 `--ignore-unknown` 跳过；支持类型的语法错误仍导致非零退出并中止提交。Hook 不运行数据库测试或启动服务。`tests/tooling/pre-commit.test.mjs` 通过临时 Git 仓库验证真实提交、部分暂存、错误回退和工作树隔离，不在项目工作树创建提交。
