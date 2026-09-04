# dsh-agent-frugality

> [English](README.md) | **中文**

[![npm version](https://img.shields.io/npm/v/dsh-agent-frugality?color=blue)](https://www.npmjs.com/package/dsh-agent-frugality)
[![npm downloads](https://img.shields.io/npm/dm/dsh-agent-frugality)](https://www.npmjs.com/package/dsh-agent-frugality)
[![GitHub](https://img.shields.io/badge/GitHub-gongyijie85%2Fdsh--agent--frugality-black?logo=github)](https://github.com/gongyijie85/dsh-agent-frugality)
[![GitHub Release](https://img.shields.io/github/v/release/gongyijie85/dsh-agent-frugality)](https://github.com/gongyijie85/dsh-agent-frugality/releases)
[![Last commit](https://img.shields.io/github/last-commit/gongyijie85/dsh-agent-frugality)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-18%2F18%20passing-brightgreen)]()
[![Zero deps](https://img.shields.io/badge/dependencies-none-9cf)]()

> **DeepSeek Harness（DSH）插件**：对抗多智能体三层机制性失效的防御插件——
> **读取台账去重 · 免疫压缩规则区 · 完成机械门禁 · 低成本审查 lane**。零外部依赖，注入即用。

📐 规格事实源：[`docs/SPEC.md`](docs/SPEC.md) · 📋 任务清单：[`TICKETS.md`](TICKETS.md) · 📝 变更记录：[`CHANGELOG.md`](CHANGELOG.md) · 🛒 市场状态：[`docs/MARKETPLACE.md`](docs/MARKETPLACE.md)

## 它做什么

| 能力 | 效果 |
|---|---|
| **read-ledger 读取台账** | 所有读类工具调用按内容哈希记入 per-agent 台账；`frugality_ledger` 一眼看出"谁在重复读"——浪费从不可见变成可见 |
| **immutable-core 免疫规则区** | 恒久规则注册进每次组装都重渲染的提示词 section——**上下文压缩无法移除** |
| **completion-gate 完成门禁** | "完成"必须经过 `frugality_gate`：声明 + 验证 exit 0；空口完成被塞回重做（≤2 次防死循环） |
| **review-lane 审查 lane** | `frugality_review` 自动挑 **CHEAP 便宜模型**做独立审查——贵主模型不审查自己的活 |

**适合谁**：跑长时多智能体 DSH 会话的团队与个人、插件作者，以及任何觉得 token 在涨但说不清"为什么"的人。

## 为什么

多智能体系统存在三类被实测与独立证据支持的机制性失效：

| 失效 | 证据 | 本插件防御 |
|---|---|---|
| **子智能体重复读取**（无共享记忆 → 内耗烧 token） | Claude Code [#46968](https://github.com/anthropics/claude-code/issues/46968)、[#45660](https://github.com/anthropics/claude-code/issues/45660)；Jack Maguire 实测子智能体占长任务大部分成本、修复可省 70–90% | `read-ledger` 内容哈希台账 + 已读清单注入 |
| **提示词失效**（软规劝短期失效、压缩后丢失） | Anthropic《Building effective agents》：成本权衡来自架构而非提示语 | `immutable-core` 规则区（免疫压缩）+ `completion-gate` 机械门禁 |
| **贵模型误区**（贵模型产出低、当审查员反而更弱） | Anthropic《multi-agent research system》：收益来自 token 预算；RouteLLM/FrugalGPT 生态共识 | `review-lane` 便宜模型独立审查 |

**限制边界**：本插件不禁止多智能体，而是把失效变成**可度量 + 可物理阻断**；**先度量后干预**（DEDUP 默认关）。

> ⚠️ **科研诚实声明**：插件不背书流传的"$85K 多智能体实验"具体数字（54.7% / 243→311 / Opus 23.9% 等经核实**无一手出处**，属生成式摘要幻觉，核实报告见 `research/01-primary-source.md`）。本插件针对有独立证据的机制问题本身。

## 快速开始

```powershell
# 1. 安装（v0.1.0 已发布）
dsh plugin add github:gongyijie85/dsh-agent-frugality   # GitHub 通道（主分发；市场收录基于 topic）
npm install dsh-agent-frugality                          # npm 通道

# 本地开发态（运行时注入，免重启）
dev_inject_plugin D:\plugins\dsh-agent-frugality
# dev_uninject_plugin dsh-agent-frugality

# 2. 先看基线——台账默认开，DEDUP 默认关
frugality_ledger

# 3. 基线说了算再干预（如 dupRate > 15% 持续一周 → DSH_FRUGALITY_DEDUP=1）
```

完成门禁**默认开启**（`DSH_FRUGALITY_GATE=1`）；只有跟你的工作流打架时才关。

## 机制（一图流）

```
工具调用 ──→ tools/result ──→ [read-ledger] SHA-1 台账 → JSONL 持久化
                      │                │
                      └─ 第≥2次同内容 ──→ [dedup-replace] 摘要替换（可选 DEDUP=1）
system-prompt/assemble ──→ [immutable-core] frugality-rules（免疫压缩）+ frugality-read-cache（已读清单）
agent/turn-stopping ──→ 完成性声明 且 无 gate 凭证 ──→ steer 塞回（≤2 次）
frugality_gate / frugality_review / frugality_ledger ──→ 三个工具
```

## 工具

| 工具 | 用途 |
|---|---|
| `frugality_ledger` | 读取台账（per-agent reads/dups/bytes、重复率、门禁状态、审查计数；含 JSONL 恢复）——先看基线，再决定开干预 |
| `frugality_gate` | 完成门禁：`claim` 必填；验证命令 exit 0 才通过（命令仅宿主配置） |
| `frugality_review` | 低成本审查：便宜模型独立审查代码/diff/白名单文件（quick/deep），输出 verdict+findings |

## 配置（环境变量全表，详见 docs/SPEC.md §6）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_FRUGALITY_DEDUP` | `0` | `1`=同内容第 ≥2 次读取替换为摘要提示 |
| `DSH_FRUGALITY_GATE` | `1` | `0`=禁用完成门禁 |
| `DSH_FRUGALITY_GATE_MAX` | `2` | 门禁 objection 轮数上限（防死循环） |
| `DSH_FRUGALITY_VERIFY` | 空 | 默认验证命令（如 `npm test`；exit 0=通过） |
| `DSH_FRUGALITY_ALLOW_ARG_VERIFY` | `0` | `1`=允许工具参数 verify（**默认忽略防模型 RCE**，SPEC §7.1） |
| `DSH_FRUGALITY_REVIEW_MODEL` | auto | 审查模型；auto=自动选 CHEAP 族 |
| `DSH_FRUGALITY_RULES` | builtin | 规则文件（≤8KB） |
| `DSH_FRUGALITY_LEDGER_CAP` | `30` | 已读清单注入条数上限 |
| `DSH_FRUGALITY_WORKDIR` | cwd | gate 验证命令工作目录 |
| `DSH_FRUGALITY_READ_PATTERNS` | builtin | 追加读类工具子串（逗号分隔） |

## FAQ / 排障

**DEDUP 为什么默认关？** 先度量后干预：台账先告诉你真实重复率，再决定是否开干预；基线证明净收益为正才开。

**验证命令会不会被用来执行任意代码？** 不会。`frugality_gate` 只运行宿主配置的 `DSH_FRUGALITY_VERIFY`；工具传入的 verify 参数默认忽略，除非 `DSH_FRUGALITY_ALLOW_ARG_VERIFY=1`（防 RCE，SPEC §7.1）。

**会破坏子智能体吗？** 不会——read-ledger 只观察/可选去重读结果；immutable-core 只注入提示词 section；不拦截、不改写任何 agent 输出。

**我的内容会被记日志吗？** 不记内容。台账只存内容哈希 + 目标；日志是 JSONL 事件（apply/read/gate/review），不含文件全文（SPEC §7）。

**日志在哪？** `$DSH_HOME/agent-frugality.log`（JSONL 事件）与 `$DSH_HOME/agent-frugality-ledger.jsonl`（台账持久化）。

**会不会和别的插件重复？** 只补缺口：共享记忆用 `dsh-memory-vault`、模型路由用 `dsh-model-router`、任务编排用 `dsh-agent-teams`；本插件只加读取去重度量、host 级完成门禁、低成本审查 lane。

## 目录结构

```
lib/index.js       宿主装配（hooks/工具注册/配置/持久化）
lib/core.js        纯函数与常量（18 用例全绿）
test/core.test.mjs node:test 零依赖测试
docs/SPEC.md       技术规格（FR/NFR/安全模型 §7/接口契约 §8/验收标准 §9）
docs/MARKETPLACE.md 市场收录材料与状态
TICKETS.md         产品化任务清单（Phase 1-5）
CHANGELOG.md       变更记录
LICENSE            MIT
```

## 测试与验证

```powershell
node --test test/core.test.mjs   # 18/18（toJsonSchema/isReadTool/targetOf/applyRead/foldLedgerLine/...）
node --check lib/index.js && node --check lib/core.js
```

## 设计原则

1. **先度量后干预**：台账默认开、DEDUP 默认关；`frugality_ledger` 跑基线，净收益为正再开干预。
2. **物理阻断 > 提示词**：规则落到工具结果错误 / turn-stopping objection / deny；提示词仅回显（规则区本身免疫压缩）。
3. **只补缺口**：共享记忆用 `dsh-memory-vault`、路由降级用 `dsh-model-router`、任务门禁用 `dsh-agent-teams`；本插件只补读取台账、host 级完成门禁、低成本审查 lane。
4. **零依赖**：仅 node: 内置 + `lib/core.js`；JS 直出（dsh-mode-boost 同路径，无编译依赖）。

## 实验数据（日常即实验）

插件天生带度量：每个真实会话都在喂台账，周期性快照发布到仓库作为效果证据。

```powershell
node scripts/experiment-report.mjs   # -> docs/experiments/YYYY-MM-DD-snapshot.{json,md}
```

- 首份快照（2026-08-29）：34 次读取 / 5.9% 重复率 / 93KB / 门禁 3 过 3 拦 / 审查 lane 1 次 9 findings / 0 插件错误
- **Exp-3 完成（2026-08-29）**：cheap 臂（flash）81.8% recall @ $0.033、**每美元命中 = 主模型 1.65×**；strong 臂 100%/0 误报 @ $0.067 → **双 lane 策略验证通过**（[结果](docs/experiments/exp3-results.md)）
- 阈值与运营闭环：[`docs/EXPERIMENT.md`](docs/EXPERIMENT.md)（「运营模式」节）

## 路线图

- [ ] 每周台账快照 → README 实验数据段更新（T21）
- [ ] 阈值运营闭环：dupRate > 15% 持续一周 → DEDUP=1；每版记录「基线→改进→验证」（T22）
- [ ] 下一版候选：跨会话台账摘要；review-lane 反馈进入 DEDUP 启发式

## 发布与收录状态（v0.1.0，2026-09-02 更新）

- [x] GitHub：github.com/gongyijie85/dsh-agent-frugality（main + tag v0.1.0）
- [x] npm：dsh-agent-frugality@0.1.0
- [x] GitHub Release @ v0.1.0，含 `dsh-agent-frugality-0.1.0.tgz` 资产
- [x] 仓库描述与 topics（`dsh-plugin` `deepseek-harness` `multi-agent`）已设——topic 同步市场自动收录
- [ ] awesome-dsh-plugin curated 注册表 PR **#4173**——2026-09-02 已提交，**待维护者合并**（合并后 dsh-market 一键安装生效）
- [ ] chnjames / 0326 目录——经 `dsh-plugin` topic 自动发现，下个同步周期自动出现（无手动提交入口）

> **Topics（2026-09-02 扩充为 12 个）**：`dsh-plugin` `deepseek-harness` `dsh` `cordis` `multi-agent` `ai-agents` `agent-cost` `cost-optimization` `token-efficiency` `context-management` `subagent` `completion-gate`——在仓库 Settings → About → Topics 应用。

## 参与贡献

见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。安全模型见 SPEC §7（verify 命令仅宿主配置；review 文件白名单；日志不记内容）。

## License

MIT