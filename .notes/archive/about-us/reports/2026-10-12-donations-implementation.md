# About 捐赠栏目实施记录

用户要求新增捐赠栏目和首页 Card，并确认捐赠者内容为昵称、日期等信息。实现采用仓库内容手动维护：不新增支付处理、Server 接口或数据库。

## 行为

首页在历程之后增加全宽捐赠卡片，进入 `/aboutus/donations`。桌面与手机栏目导航同时包含捐赠。详情展示捐赠介绍、渠道和捐赠者名单；未提供实际资料时显示整理中状态，不填写虚构渠道或昵称。

介绍由 `apps/web/content/about/donations.mdx` 维护；渠道和名单位于 `apps/web/content/about/donations/items.yaml`。渠道支持名称、说明、HTTPS 链接及二维码 ImageRef，链接和二维码至少一个。捐赠者记录唯一 id、非空 nickname 和有效 YYYY-MM-DD date，按作者顺序展示；不包含留言或金额排名。

各条目可设 draft。实际构建复现表明，若把子条目放在 MDX frontmatter，即便注册表已过滤，Fumadocs 仍会导出原始 frontmatter。独立 YAML meta 集合沿用当前禁用 Macro 的链路，公开投影过滤后才提供给浏览器；新增实际 Fumadocs/Vite 构建测试确认所有正文 chunk 和公开数据均不包含草稿昵称、渠道或草稿独占二维码。

## 文件范围

- `apps/web/build/about/schema.ts`
- `apps/web/build/about/definition.ts`
- `apps/web/source.config.ts`
- `apps/web/src/content/about/types.ts`
- `apps/web/content/about/index.mdx`
- `apps/web/content/about/donations.mdx`
- `apps/web/content/about/donations/items.yaml`
- `apps/web/src/pages/AboutUs/AboutHome.tsx`
- `apps/web/src/pages/AboutUs/AboutHome.module.scss`
- `apps/web/src/pages/AboutUs/AboutHome.test.tsx`
- `apps/web/src/pages/AboutUs/AboutNavigation.tsx`
- `apps/web/src/pages/AboutUs/AboutUs.tsx`
- `apps/web/src/pages/AboutUs/AboutUs.test.tsx`
- `apps/web/src/pages/AboutUs/Donations.tsx`
- `apps/web/src/pages/AboutUs/Donations.module.scss`
- `apps/web/src/pages/AboutUs/Donations.test.tsx`
- `apps/web/src/content/donations.integration.test.ts`
- `tests/content/about.test.ts`
- `tests/browser/about-home-refined.mjs`
- `tests/browser/about-home-failures.mjs`
- `tests/browser/about-donations.mjs`
- `.ai/architectures/web/content-rendering.md`
- `.ai/knowledge/web/content-authoring.md`
- `.notes/about-us/reports/2026-10-12-donations-implementation.md`

此前的 About 布局、用户未提交改动、旧 GPU 文件及历史设计记录保留，不进行整体 restore/reset。

## 验证

| 检查                                                                                                | 结果                                                                                                     |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 改动前相关测试                                                                                      | PASS，63 项                                                                                              |
| `pnpm exec vitest run tests/content apps/web/src/content apps/web/src/pages/AboutUs`                | PASS，13 文件、79 项测试                                                                                 |
| `pnpm --filter @workspace/web content:check`                                                        | PASS，11 篇公开正文                                                                                      |
| `pnpm --filter @workspace/web typecheck`                                                            | PASS                                                                                                     |
| `pnpm --filter @workspace/web build`                                                                | PASS；保留既有大 chunk 警告                                                                              |
| `playwright-cli -s=about-donations --raw run-code --filename=tests/browser/about-home-refined.mjs`  | PASS，六入口、首页进入捐赠页、导航状态、既有焦点/hash/返回滚动/成员/Media 行为和四宽度浅深色             |
| `playwright-cli -s=about-donations --raw run-code --filename=tests/browser/about-donations.mjs`     | PASS，生产组件展示测试昵称/日期、HTTPS 链接、有效二维码，1440/768/390/320px 浅深色无溢出，恢复实际空清单 |
| `playwright-cli -s=about-donations --raw run-code --filename=tests/browser/about-home-failures.mjs` | PASS，首页图片失败和正文恢复，六入口保持可用                                                             |
| `git diff --check`                                                                                  | PASS                                                                                                     |
| 实际捐赠渠道与名单验收                                                                              | NOT_EXECUTED，资料未提供                                                                                 |
| 原生浏览器工具栏 200% 缩放                                                                          | NOT_EXECUTED；仅既有双倍根字号与长文案检查已通过                                                         |
| 全仓库、数据库、Outline、部署                                                                       | NOT_EXECUTED，本次静态 About 修改无此运行依赖                                                            |

浏览器测试仅拦截测试输入与网络边界，不替换生产内容适配器或展示组件；测试资料不会写入正式内容。现有 Server 8080 未启动导致的 API 502 为既有环境限制，与静态捐赠页分开报告。

本次未 stage、commit、push 或部署。真实页面为 `http://127.0.0.1:8188/aboutus/donations`，内容填写约定见 `.ai/knowledge/web/content-authoring.md`。
