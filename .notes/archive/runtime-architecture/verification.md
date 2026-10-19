# 完成审计

目标为 `.notes/gaol.md` 的全部三方向；本表不以修改前基线替代实现后的验证。最终代码、测试与知识文档共 20 个文件，版本由 `.notes/runtime-architecture/final-candidate.json` 固定，聚合 SHA256 为 `b37312e2c88aff83639ddeb125d8b9476db6e3861fb03ffc14d689d41d9f8e43`。

## 需求与证据

| 目标要求                                                                                 | 当前证据与结论                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 三份简短设计、不同的设计/开发/审查 Agent                                                 | 三个方向目录各有 `design.md`；九个指定角色分别创建并履职，作者与 Reviewer 分离，交接见 `.notes/runtime-architecture/status.md`。PASS。                                                                                                                                                                                              |
| 独立设计审查、适用用户确认                                                               | 三份 v1 均 APPROVED；用户于 2026-10-16 回复“同意”。身份 v1.1 只澄清既有 JSON 键顺序差异，由原设计者修改、原 Reviewer 再次 APPROVED，无新增决策。PASS。                                                                                                                                                                              |
| Hydra 生产端拥有稳定分类，适配端不解释英文                                               | `scripts/runtime/hydra-client.mjs` 的封闭、不可变 `HydraClientCheckError.kind`；`scripts/runtime/applications.mjs` 的合法实例/类别映射。原 Reviewer 与整合 Reviewer 均 APPROVED。PASS。                                                                                                                                             |
| 缺失/冲突/凭据/非法配置/网络/未知，文案变化，真实 HTTP 联动与脱敏                        | `scripts/runtime/hydra-client.test.mjs` 覆盖 loopback 404、异常 HTTP/JSON、metadata、token 探测、竞争登记、producer→adapter、5xx、网络与超时；`scripts/runtime/settings.test.mjs` 覆盖所有类别、文案变化、伪造错误、白名单和未知码；`tests/runtime/native-health.test.ts` 验证 native 适配。独立复跑 Node 56/56、native 3/3。PASS。 |
| verify 只读、ensure 显式登记，不扩权限                                                   | HTTP fixture 检查缺失只读校验不 POST/PUT、显式创建/幂等/409 重读及冲突不覆写；入口操作方式未改。PASS。                                                                                                                                                                                                                              |
| 共同身份规则只有一份完整纯拼装，来源/拓扑/开关留适配端                                   | Common `parseIdentityConfiguration()` 复用既有规则并冻结结果；Server config 保留禁用短路；runtime settings 保留根来源、覆盖、端口、Web 白名单与诊断。实现/声明和 Server 类型检查、两次独立审查均通过。PASS。                                                                                                                        |
| 空/有效配置、非法 URL/密钥、重复客户端、cleanup-only 隔离及同名冲突                      | `packages/common/test/config.test.mjs` 的聚合与细粒度规则表、`tests/auth/identity-config.test.ts` 的 Server 和 local/deployment 投影、settings 密钥诊断用例。Common 63 项和 auth 20 项定向通过，原 Reviewer 独立复跑通过。PASS。                                                                                                    |
| runtime→Server 身份语义与部署绑定相同，不刷新 pin                                        | auth 配置测试逐字段比较身份及完整 binding/规范化 digest；`tests/auth/deployment-binding.test.ts` 与 `scripts/runtime/deployment.test.mjs` 分别固定空/非空旧 v2 字节，原绑定投影及消费者未改。两端原有 JSON 键顺序不同，保持各自旧字节与全字段语义。PASS。                                                                           |
| Node 导入、未公开路径、browser 条件、实际 Vite 浏览器构建拒绝；声明一致、无 Web 秘密路径 | `packages/common/test/entry.test.mjs` 三项实际进程/构建检查；`.mjs` 与 `.d.mts` 对齐并经消费者 tsc；投影测试断言 Web 无身份 JSON/密钥。PASS。                                                                                                                                                                                       |
| 共享 proof 正常导入，生产与测试无 prototype 借用                                         | `scripts/runtime/container-proof.mjs`、Services 与 retire-outline 正常导入，静态搜索无旧借用或方法调用。新函数沿用原 digest、完整 Mounts 与比较器，仅三指定 DNS null→[]。PASS。                                                                                                                                                     |
| 与旧 proof 相同，Docker 表示差异允许，实质漂移拒绝                                       | settings 的固定完整旧 inspect 夹具使用字面摘要 `ac4538fe791ed70f9571fb6c45be27b6ad87adb867433971f1b979998d2f52cf`；helper 和真实 Services.start/stop 覆盖 Mounts 换序、三 DNS、挂载字段、HostConfig/Config/Image/Id 变化及旧证明/文件不变。PASS。                                                                                   |
| 退役与日常调用者共同验证，旧证明不刷新、未知资源不接管、授权不变                         | `scripts/runtime/retire-outline.test.mjs` 真实 apply 函数的注入 fake 在合法差异时通过证明核验、漂移时 mutation=0，计划与归属文件原字节不变，Redis 漂移阻止 rm；Services 检查缺记录、未知容器、启停前后核验。开发者完整定向 44+25 项，原 Reviewer 独立 9 项通过，整合 Reviewer 确认授权代码未改。PASS。                              |
| 三项独立代码审查，问题交原作者                                                           | 三位原 Reviewer 分别 APPROVED，无遗留修复项；另有只读整合审查 APPROVED，无 P2 及以上问题，20/20 文件审前后 hash 一致。PASS。                                                                                                                                                                                                        |
| 稳定知识更新，路径/知识归属正确                                                          | 使用 `codebase-documenter` 仅更新现有 identity/runtime 两份 `.ai/architectures/` 边界页，未新增结构/重复 ADR，无需重组索引；整合 Reviewer 确认与源码和测试一致。PASS。                                                                                                                                                              |
| 保留原改动，HTTP Contract/数据库/协议不变，无真实环境维护或 Git 交付                     | PASS；四项门禁后重算 20/20 文件及聚合 hash 均一致，tracked 变化集合与冻结清单完全相符；API/DB/lockfile/其他模块无改动。HEAD 仍为原 `0cfa6df`，索引无 staged diff，分支仍 `refactor/docs`。原 Outline 退役/Common 行为保留；未运行真实退役、infra/client 登记、dev 生命周期或部署，不提交/推送/创建 PR。                             |

## 实现后整仓门禁

严格按下列顺序执行，不与其他测试/构建/生成操作并行。完整日志位于临时目录，名称如下：

| 命令             | 状态                                             | 日志                                                 |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `pnpm api:check` | PASS，exit 0                                     | `exwebsite-runtime-architecture-api-final.log`       |
| `pnpm typecheck` | PASS，exit 0                                     | `exwebsite-runtime-architecture-typecheck-final.log` |
| `pnpm test`      | PASS，exit 0；Website 294.5 秒、runtime 130.2 秒 | `exwebsite-runtime-architecture-test-final.log`      |
| `pnpm build`     | PASS，exit 0；Contract、SDK、Web、Server 均完成  | `exwebsite-runtime-architecture-build-final.log`     |

自动数据库测试使用隔离 PostgreSQL Testcontainers；原环境数据不是夹具。上述证据不表示真实浏览器 UI、外部 Hydra/provider、现场容器/退役或部署验收；这些不属于本次执行范围，均未执行。

## 审计结论

全部必需设计、审批、实现、独立审查、行为测试、四项顺序门禁和稳定知识交付均已证实，无缺失或未验证的必需项。最终候选在验证前后完全一致，`git diff --check` 与 staged diff 检查均通过；保留命名分支和未提交工作树。

剩余边界：token 探测返回非预期有效 JSON（含 5xx）仍沿用原冲突类运行诊断，只能说明凭据探测失败，不能确定是密钥错误；这是经批准设计保留的既有兼容行为。既有 API schema、Vite 配置加载和 Web chunk 体积警告仍存在，四项命令均成功退出，未扩展到本任务之外处理。
