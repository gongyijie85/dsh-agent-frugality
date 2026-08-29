# dsh-agent-frugality

> [English](README.md) | **中文**

[![npm version](https://img.shields.io/npm/v/dsh-agent-frugality?color=blue)](https://www.npmjs.com/package/dsh-agent-frugality)
[![GitHub](https://img.shields.io/badge/GitHub-gongyijie85%2Fdsh--agent--frugality-black?logo=github)](https://github.com/gongyijie85/dsh-agent-frugality)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-18%2F18%20passing-brightgreen)]()
[![Zero deps](https://img.shields.io/badge/dependencies-none-9cf)]()

> DeepSeek Harness 对抗多智能体三层机制性失效的防御插件：**读取台账去重 · 免疫压缩规则区 · 完成机械门禁 · 低成本审查 lane**。零外部依赖，注入即用。

📐 规格事实源：[`docs/SPEC.md`](docs/SPEC.md) · 📋 任务清单：[`TICKETS.md`](TICKETS.md) · 📝 变更记录：[`CHANGELOG.md`](CHANGELOG.md)

## 为什么

多智能体系统存在三类被实测与独立证据支持的机制性失效：

| 失效 | 证据 | 本插件防御 |
|---|---|---|
| **子智能体重复读取**（无共享记忆 → 内耗烧 token） | Claude Code [#46968](https://github.com/anthropics/claude-code/issues/46968)、[#45660](https://github.com/anthropics/claude-code/issues/45660)；Jack Maguire 实测子智能体占长任务大部分成本、修复可省 70–90% | `read-ledger` 内容哈希台账 + 已读清单注入 |
| **提示词失效**（软规劝短期失效、压缩后丢失） | Anthropic《Building effective agents》：成本权衡来自架构而非提示语 | `immutable-core` 规则区（免疫压缩）+ `completion-gate` 机械门禁 |
| **贵模型误区**（贵模型产出低、当审查员反而更弱） | Anthropic《multi-agent research system》：收益来自 token 预算；RouteLLM/FrugalGPT 生态共识 | `review-lane` 便宜模型独立审查 |

**限制边界**：本插件不禁止多智能体，而是把失效变成**可度量 + 可物理阻断**；**先度量后干预**（DEDUP 默认关）。

> ⚠️ **科研诚实声明**：插件不背书流传的"$85K 多智能体实验"具体数字（54.7% / 243→311 / Opus 23.9% 等经核实**无一手出处**，属生成式摘要幻觉，核实报告见 `research/01-primary-source.md`）。本插件针对有独立证据的机制问题本身。

## 安装

**已发布（v0.1.0）**：

```powershell
# GitHub 通道（主分发；marketplace 收录基于 topic）
dsh plugin add github:gongyijie85/dsh-agent-frugality

# npm 通道
npm install dsh-agent-frugality

# 本地开发态（运行时注入，免重启）
dev_inject_plugin D:\plugins\dsh-agent-frugality
# 卸载
dev_uninject_plugin dsh-agent-frugality
```

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
| `DSH_FRUGALITY_REVIEW_MODEL` | 空 | 审查模型；空=自动选 CHEAP 族 |
| `DSH_FRUGALITY_RULES` | 空 | 规则文件（≤8KB）；空=内置 4 条 |
| `DSH_FRUGALITY_LEDGER_CAP` | `30` | 已读清单注入条数上限 |
| `DSH_FRUGALITY_WORKDIR` | cwd | gate 验证命令工作目录 |
| `DSH_FRUGALITY_READ_PATTERNS` | 空 | 追加读类工具子串（逗号分隔） |

## 目录结构

```
lib/index.js       宿主装配（hooks/工具注册/配置/持久化）
lib/core.js        纯函数与常量（18 用例全绿）
test/core.test.mjs node:test 零依赖测试
docs/SPEC.md       技术规格（FR/NFR/安全模型 §7/接口契约 §8/验收标准 §9）
docs/MARKETPLACE.md 市场收录材料
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
4. **零依赖**：仅 node: 内置 + `lib/core.js`；JS 直出（dsh-mode-boost 同路径，无 tsc checkout 依赖）。

## 日志

`$DSH_HOME/agent-frugality.log`（JSONL：apply/read/dedup-replace/gate/gate-object/review/错误）与 `$DSH_HOME/agent-frugality-ledger.jsonl`（台账持久化）。

## 实验数据（日常即实验）

插件天生带度量：每个真实会话都在喂台账，周期性快照发布到仓库作为效果证据。

```powershell
node scripts/experiment-report.mjs   # -> docs/experiments/YYYY-MM-DD-snapshot.{json,md}
```

- 首份快照（2026-08-29）：34 次读取 / 5.9% 重复率 / 93KB / 门禁 3 过 3 拦 / 审查 lane 1 次 9 findings / 0 插件错误
- 阈值与运营闭环：[`docs/EXPERIMENT.md`](docs/EXPERIMENT.md)（「运营模式」节）

## 发布与收录状态（v0.1.0，2026-08-29）

- [x] GitHub：github.com/gongyijie85/dsh-agent-frugality（main + tag v0.1.0；topics：`dsh-plugin` `deepseek-harness` `multi-agent`）
- [x] npm：dsh-agent-frugality@0.1.0
- [x] Topics 已打（`dsh-plugin` → AwesomeHou 等 topic 同步市场自动收录）
- [ ] awesome-dsh-plugin curated 注册表提交（材料在 [`docs/MARKETPLACE.md`](docs/MARKETPLACE.md)）——dsh-market 一键安装必需
- [ ] GitHub Release @ v0.1.0（notes 用 CHANGELOG 0.1.0 段）

## 参与贡献

见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。安全模型见 SPEC §7（verify 命令仅宿主配置；review 文件白名单；日志不记内容）。

## License

MIT
