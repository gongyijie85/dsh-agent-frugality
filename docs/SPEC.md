# dsh-agent-frugality — 技术规格（SPEC v1.0）

> 上游：`research/85k-experiment/05-solution-design.md`（方案设计）→ 本 SPEC 为**唯一技术规格事实源**，实现与审查均以此为准。
> 状态：已实现核心（v0.1），本 SPEC 锁定产品化发布前的完整契约。

## 1. 背景与定位

多智能体系统存在三类被实测与独立证据支持的机制性失效：
- **A 重复读取/内耗**：无共享记忆的子智能体重复读取相同内容（独立证据：Claude Code issue #46968/#45660；Jack Maguire 实测子智能体占长任务大部分 token 成本）。
- **B 提示词失效**：软性规劝短期失效、上下文压缩后丢失；须以机制层（工具错误/物理门禁/沙箱）约束行为。
- **C 贵模型误区**：昂贵模型当审查员/写手并不更优；应按角色分层、用低成本审查 lane。

本插件**不禁止多智能体**，而是把三类失效变成**可度量 + 可物理阻断**的机制，度量优先、干预后置（先观测基线，净收益为正才开启阻断）。

免责声明（README 与包描述必须包含）：本插件名字与文档不背书任何"8.5 万美元实验"的具体数字；那些数字（54.7%/243→311/23.9% 等）经核实无一手出处，属生成式摘要幻觉（详见 research/01-primary-source.md）。本插件针对的是**有独立证据的机制性失效**本身。

## 2. 目标 / 非目标

**目标**
1. 全量（主会话+全部子智能体）读取记账：内容哈希级去重、按 agent 聚合、重复率可见。
2. 恒久规则不可丢：规则区免疫上下文压缩，每次组装机械注入。
3. 完成声明机械门禁：未通过 `frugality_gate` 的完成声明被 turn-stopping 拦截。
4. 低成本审查 lane：审查直接走便宜模型，主模型不参与。
5. 零外部依赖、JS 直出、注入即用（与 dsh-mode-boost 同部署路径）。

**非目标**
- 不做多智能体编排器（agent-teams / workflow 已覆盖）。
- 不做共享记忆存储（dsh-memory-vault 已覆盖；本插件只做"去重记账 + 已读提示"）。
- 不做模型复杂度路由升级版（dsh-model-router 已覆盖快速问答降级）。
- 不做 UI 面板（P2，另行 ticket）。

## 3. 组件与装配

| 组件 | 挂载点 | 行为 |
|---|---|---|
| `read-ledger` | `tools/result`（emit） | 读类工具成功结果 → SHA-1 内容哈希 → 台账（hashIndex / perAgent / lastReads）→ `frugality-ledger.jsonl` 追加（P1） |
| `dedup-replace` | `tools/post-execute`（waterfall，仅 `DSH_FRUGALITY_DEDUP=1`） | 同内容 hash 第 ≥2 次读取 → `{kind:'accept', content: 摘要提示块}` 替换模型可见内容（value 保留） |
| `immutable-core` | `system-prompt/assemble` | 追加 `frugality-rules` section（order 5，每次重渲染，免疫压缩）；有读取记录时追加 `frugality-read-cache`（order 100，≤LEDGER_CAP 条） |
| `completion-gate` | 工具 `frugality_gate` + `agent/turn-stopping` | gate 登记凭证（verify 命令 exit 0 才 verified=true）；turn-stopping 检测完成性声明且无凭证 → `agent.steer()` objection（≤GATE_MAX 次） |
| `review-lane` | 工具 `frugality_review` | 便宜模型审查（4 维打分），输出 verdict+findings |
| `ledger-stats` | 工具 `frugality_ledger` | 台账/门禁/审查统计输出 |

## 4. 功能需求

### FR-1 读取台账（A 度量）
- 读类工具白名单（子串匹配，覆盖 `mcp__<server>__<tool>`）：`read / glob / grep / search / visualize / media_info`（配置可扩：见 `DSH_FRUGALITY_READ_PATTERNS`）。
- 记录：`{at, agentId, agentLabel, tool, target, hash, bytes, dup}`；target 从参数提取（path/pattern/url/file…）。
- 重复判定：`hashIndex` 全局（跨 agent、跨会话、进程内）已有该 hash → `dup=true`。
- 度量输出：`frugality_ledger` 的 per-agent reads/dups/bytes + 全局重复率 + 最近 10 次读取。
- 性能：单次记账同步 O(n)（文本哈希），n≤10MB 时 <5ms；哈希**必须**在 `try/catch` 内，永不阻断工具执行。

### FR-2 已读清单注入（A 提示）
- 组装时若本 agent 会话存在读取记录 → 注入 `frugality-read-cache` section：`<target> (<label>, <KB>, 首读/重复)`，≤`DSH_FRUGALITY_LEDGER_CAP`（默认 30）条。
- 子智能体自动受益：assemble 按 `context.agent` 过滤本会话记录（宿主进程同一监听覆盖所有 agent）。

### FR-3 恒久规则区（B 免疫压缩）
- 规则文本来源：`DSH_FRUGALITY_RULES` 指定文件（存在则读取，截断 8KB）→ 否则内置 4 条默认规则。
- 注入方式：assemble 时 `sections.filter(剔除同名)` 后 append，防重复；每次组装重渲染 → 免疫上下文压缩。
- 默认 4 条（提交前验证/不凭空断言/删除需确认/交付说明）——与 frugality 插件恒久规则一致。

### FR-4 完成门禁（B 物理阻断）
- `frugality_gate` 工具：`claim`（必填，≤500 字符）；`verify`（见 §7 安全约束）。
- 验证命令：`DSH_FRUGALITY_VERIFY` 为主；exit 0 → `verified=true` 写入凭证；失败 → 返回 `[BLOCKED]` 文本 + 输出尾部。
- `agent/turn-stopping`：最近 assistant 文本（尾部 200 字符）匹配完成正则（`完成|搞定|已交付|done|finished|completed|complete|all done`）且无凭证 → `agent.steer()` objection；**上限 `DSH_FRUGALITY_GATE_MAX`（默认 2）次防死循环**；`DSH_FRUGALITY_GATE=0` 整体禁用。
- 完成类 objection 文案必须让模型可行动（"请先调用 frugality_gate"）。

### FR-5 低成本审查 lane（C）
- `frugality_review`：`target`（文本/diff/存在的文件路径——文件 <4KB 条件或扩展名黑名单？见 §7）；`mode` quick|deep。
- 模型选择：`DSH_FRUGALITY_REVIEW_MODEL` > provider 目录里 CHEAP 命名（flash/chat/mini/turbo/haiku/lite/air/nano）> 失败返回 `[BLOCKED]`（不静默用主模型）。
- 输出：`[frugality_review · <model> · <mode>]` + verdict + findings（≤10 条，每条 severity/problem/fix 截断 200 字符）。
- 计量：`reviews`/`reviewFindings` 计数进 ledger。

### FR-6 台账持久化（P1）
- JSONL 追加：`$DSH_HOME/agent-frugality-ledger.jsonl`；每条读取一行，启动时加载最近 500 条重建 hashIndex（预算 <200KB）。
- 失败静默（文件系统错误不得影响主流程）。

## 5. 非功能需求

| NFR | 要求 |
|---|---|
| NFR-1 依赖 | 运行时零外部依赖（仅 node: 内置）；package.json 无 peerDependencies |
| NFR-2 版本 | node >= 20；ESM |
| NFR-3 性能 | 记账路径永不阻塞工具执行；事件监听全部 try/catch 包裹 |
| NFR-4 安全 | 见 §7 安全模型 |
| NFR-5 兼容 | 工具名唯一前缀 `frugality_`；重载/重复注册幂等（registerToolSafe 失败静默跳过）；与 mode-boost/model-router/agent-teams 共存无干扰 |
| NFR-6 可观测 | `$DSH_HOME/agent-frugality.log` JSONL：apply/read/dedup-replace/gate/gate-object/review/错误事件 |
| NFR-7 测试 | 核心纯函数（toJsonSchema/isReadTool/targetOf/parseFindings/looksLikeCompletion/duplicate 判定）node:test 覆盖率 ≥80% |

## 6. 配置（环境变量全表）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_FRUGALITY_DEDUP` | `0` | `1`=开缓存摘要替换（干预层） |
| `DSH_FRUGALITY_GATE` | `1` | `0`=禁用完成门禁 |
| `DSH_FRUGALITY_GATE_MAX` | `2` | objection 轮数上限 |
| `DSH_FRUGALITY_VERIFY` | 空 | 默认验证命令（用户配置，唯一默认命令源） |
| `DSH_FRUGALITY_ALLOW_ARG_VERIFY` | `0` | `1`=允许工具参数 verify（否则忽略参数 verify） |
| `DSH_FRUGALITY_REVIEW_MODEL` | 空 | 审查模型；空=自动选 CHEAP |
| `DSH_FRUGALITY_RULES` | 空 | 规则文件；空=内置 4 条 |
| `DSH_FRUGALITY_LEDGER_CAP` | `30` | 已读清单注入条数上限 |
| `DSH_FRUGALITY_WORKDIR` | cwd | gate 验证命令工作目录 |
| `DSH_FRUGALITY_READ_PATTERNS` | 内置 6 词 | 追加读类工具子串（逗号分隔） |

## 7. 安全模型（重要）

1. **命令执行面**：`frugality_gate` 的 verify 命令仅允许来自 `DSH_FRUGALITY_VERIFY`（用户配置）；工具参数 `verify` 默认**忽略**（`DSH_FRUGALITY_ALLOW_ARG_VERIFY=1` 显式开启）——防模型注入任意命令（RCE 面）。命令执行超时 120s、输出截断 2KB、工作目录仅 `DSH_FRUGALITY_WORKDIR`。
2. **文件读取面**：`frugality_review` 的 `target` 若为文件路径，仅接受 <256KB 且扩展名在白名单（.js/.ts/.py/.md/.json/.yml/.yaml/.txt/.css/.html/.tsx/.jsx/.go/.rs/.java）的文件；否则按文本处理。禁止任意路径读取。
3. **规则文件面**：`DSH_FRUGALITY_RULES` 读取上限 8KB，超限截断。
4. **日志面**：台账/日志不记录完整文件内容，只记哈希与 target 路径前缀（≤120 字符）。

## 8. 接口契约（工具 schema）

所有工具 `parameters` 必须为合规 JSON Schema（`type:"object"` + properties + required），经 `toJsonSchema` 编译器注册——**这是发布拦截项**（v0.0 曾以扁平 map 注册导致运行时崩溃）。

| 工具 | 参数 | output |
|---|---|---|
| `frugality_ledger` | 无 | text |
| `frugality_gate` | `claim`(string, req) `verify`(string, opt, 受 §7 约束) | text |
| `frugality_review` | `target`(string, req) `mode`(enum quick/deep) | text |

## 9. 验收标准（AC）

- [ ] AC-1：`frugality_ledger` 输出 per-agent reads/dups/bytes 与重复率（手工验证：重复读同一文件 dup 递增）
- [ ] AC-2：`frugality-reules` section 注入 assemble 且无重复（同会话 3 次组装只有 1 份规则）
- [ ] AC-3：完成声明（无 gate 凭证）被 turn-stopping 拦截 ≤GATE_MAX 次；gate 通过后不再拦截
- [ ] AC-4：`frugality_review` 在便宜模型上返回 verdict+findings；无便宜模型时 `[BLOCKED]` 而非回落主模型
- [ ] AC-5：DEDUP=1 时第 2 次读取同 hash 返回摘要块；DEDUP=0 时原样透传
- [ ] AC-6：node:test 全绿；核心纯函数覆盖率 ≥80%
- [ ] AC-7：注入→重载→卸载全链路无残留（dev_inject/reload/uninject 循环）
- [ ] AC-8：发布物含 README（免责声明）、LICENSE、CHANGELOG、SPEC、TICKETS；GitHub 仓库 topic=`dsh-plugin`

## 10. 发布要求

- 仓库：GitHub（用户账号），topic `dsh-plugin`（供 dsh-plugin-marketplace 类聚合收录）；`dsh plugin add github:...` 可装入。
- 版本：semver；`v0.1.0` 起；tag + GitHub Release（tgz 附件）。
- npm：可选发布（scope 待定）；发布前 package.json 移除 `private:true`。
- 市场收录：确认至少一家 marketplace（AwesomeHou/dsh-plugin-marketplace 等 topic 同步型自动收录；chnjames/dsh-plugin-market 提交入口）。
