# Windows 进程身份查询很慢，会让定时器型 fixture 用例随机失败

`scripts/runtime/ownership.mjs` 的 `processIdentity()` 在 Windows 上要起一次 `powershell.exe` 跑 `Get-CimInstance Win32_Process`，**单次实测 1–3.4 秒**，且随机器负载大幅波动。这不是 CIM 故障：对存活进程它正常返回 `creation/executable/commandDigest`，对不存在的 pid 返回 `null`（符合设计）。

## 由此产生的竞态形态

任何"fixture 在固定时间后自退，测试要在它退出前观察它的后代"的用例都会踩到：

- `spawnOwned()` 自身先做一次 `processIdentity()`（约 2.3–2.4 秒），
- 测试随后再查一次后代身份（约 2.8–3.4 秒），
- 两段相加超过 fixture 原来的 5 秒自退定时器，于是第二次查询落在 Job 已杀死后代之后，返回 `null`。

`identityAlive(null)` 抛 `MODE_OWNER_AMBIGUOUS`，表现为用例随机失败——机器负载决定胜负，与被测的生产行为无关。

## 处理方向（不要放宽断言）

- 把 fixture 的自退定时器做成**可覆盖**，默认保留原值，需要观察后代的用例放大到明显大于"两次查询 + 余量"。
- 后代清理与后代 PID 上报都是**操作系统异步完成**的，用有界等待替代一次性快照；Job 真的漏掉后代时仍然超时失败，判定力不变。
- 有界等待要用**墙钟**（`Date.now()`）而不是名义累加（`waited += 100` 与 `await delay(100)` 并行计），否则每次查询耗时 1–2.3 秒时，失败路径要跑满上百次才收敛。

`spawnOwned` 与 Job 语义本身是正确的；问题只在测试的时序假设。
