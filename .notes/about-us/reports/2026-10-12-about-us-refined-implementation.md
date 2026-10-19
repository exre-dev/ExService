# About 首页品牌叙事实施记录

状态：实现及检查通过，存在原生浏览器缩放验收限制。用户已确认新版 Demo；本记录不代表上线或部署验收。

## 结果

首页采用文字 Hero、宽幅社区主视觉、项目与理念并列、横向团队区、Media 与历程并列。首页不显示 About 导航、面包屑或 Hero 操作按钮，不挂载 Canvas 或加载旧 renderer。首页完整 MDX 保留在理念区；五个栏目提供稳定图片占位和可选 ImageRef。

新增 hero.lead、entryHeadlines、cardImages 的 strict 元数据及浏览器类型。链接从现有注册表解析，子页导航、成员弹窗和 Media 筛选保持原行为。真实浏览器发现长页进入短页时原恢复钩子 cleanup 把位置压缩覆盖；最小修复移除 cleanup 再保存，保留 scroll 事件、location key、hash 和 ready 机制。回归复现从 1239px 错误恢复到 140px，修复后恢复为 1239px。

## 文件范围

下列路径覆盖本轮设计预览、获批设计记录、源码、测试及文档。未提交工作区中的其他改动保留，旧 Hero/GPU 文件未删除。

- `apps/web/build/about/schema.ts`
- `apps/web/src/content/about/types.ts`
- `apps/web/content/about/index.mdx`
- `apps/web/src/pages/AboutUs/AboutUs.tsx`
- `apps/web/src/pages/AboutUs/AboutUs.module.scss`
- `apps/web/src/pages/AboutUs/AboutUs.test.tsx`
- `apps/web/src/pages/AboutUs/AboutHome.tsx`
- `apps/web/src/pages/AboutUs/AboutHome.module.scss`
- `apps/web/src/pages/AboutUs/AboutHome.test.tsx`
- `apps/web/src/pages/AboutUs/useReadingPosition.ts`
- `apps/web/src/pages/AboutUs/useReadingPosition.test.tsx`
- `tests/content/about.test.ts`
- `tests/browser/about-home-refined.mjs`
- `tests/browser/about-home-failures.mjs`
- `.ai/architectures/web/content-rendering.md`
- `.ai/knowledge/web/content-authoring.md`
- `.notes/about-us/specs/2026-10-12-about-us-refined-design.md`
- `.notes/about-us/rfcs/about-us-refined-rfc.md`
- `.notes/previews/about-us/about-us-neutral-prototype.html`
- `.notes/previews/about-us/about-us-refined-prototype.html`
- `.notes/previews/about-us/about-us-neutral-demo-server.mjs`
- `.notes/about-us/reports/2026-10-12-about-us-refined-implementation.md`

浏览器截图与诊断输出位于忽略的 `output/playwright/`，不是生产代码。设计源文件及早期 RFC 保留。

## 验证

| 检查                                                                                                | 结果                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm exec vitest run tests/content apps/web/src/content apps/web/src/pages/AboutUs`                | PASS，11 个测试文件、63 项测试                                                                                                                                                 |
| `pnpm --filter @workspace/web content:check`                                                        | PASS，10 篇公开正文                                                                                                                                                            |
| `pnpm --filter @workspace/web typecheck`                                                            | PASS                                                                                                                                                                           |
| `pnpm --filter @workspace/web build`                                                                | PASS，产物不包含旧 renderer chunk；保留既有大 chunk 警告                                                                                                                       |
| `playwright-cli -s=about-live-acceptance run-code --filename=tests/browser/about-home-refined.mjs`  | PASS，1440/768/390/320px 浅深色、无横向溢出、移动端顺序、长文案/根字号、reduced motion、五入口、焦点、hash、后退滚动、成员弹窗、Media 筛选；无旧 renderer 请求、WebGL 调用为 0 |
| `playwright-cli -s=about-live-acceptance run-code --filename=tests/browser/about-home-failures.mjs` | PASS，真实生产组件加载有效测试图片、图片失败后同尺寸占位；真实正文 chunk 失败、重试与文档重新加载恢复                                                                          |
| `git diff --check`                                                                                  | PASS                                                                                                                                                                           |
| 原生浏览器工具栏 200% 缩放                                                                          | NOT_EXECUTED；双倍根字号和长文案已检查，二者不能等同                                                                                                                           |
| 根目录完整测试/构建、数据库、Outline、部署                                                          | NOT_EXECUTED；本次只修改静态 About/Web 内容                                                                                                                                    |

失败态浏览器脚本只替换测试输入和网络边界，不替换生产 registry adapter、组件或 useContent。正式内容没有填入测试图片、Apple 素材或现有社区照片。

## 评审与交付

独立 `code-review working-tree --paths` 首轮覆盖 20 个路径，补充轮覆盖含新增浏览器失败态脚本的完整 21 路径，均无 P0–P3 finding 或阻塞问题。评审读取完整文件及相邻上下文，结合实际验证证据，未独立重跑测试。

本地实页为 `http://127.0.0.1:8188/aboutus`。现有 Server 8080 未启动引起 API health 502，是基线环境限制，本次未修改 Server 或启动数据库。素材仍为占位；没有请求提交，未 stage、commit、push 或部署。
