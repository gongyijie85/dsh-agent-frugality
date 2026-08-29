# 发布公告：dsh-agent-frugality v0.1.0

> 用于 GitHub Release notes、dsh 社区、中文技术媒体。发布于 2026-08-29。

## 标题

**dsh-agent-frugality：把多智能体的"看不见的浪费"变成看得见的台账、拦得住的完成、烧得起的审查**

## 引言（研究故事线）

几个月来，社区流传一份"8.5 万美元多智能体实测"，结论振聋发聩：无共享记忆的子智能体导致 **54.7% 的读取是重复的**，关闭子智能体后提交量反而上升，贵模型 Opus 当审查员挑错率低三成……

我们做了一件事：**把这篇"实验"扒到底**。核实结果是——这些数字没有一手出处（主源 Lovable 博客全文无 Opus/Sonnet、无 54.7%、无 243→311，疑为生成式摘要幻觉，核实报告：D:\plugins\research\85k-experiment\01-primary-source.md）。

但"故事是假的，问题是真的"：子智能体重复读取、提示词规劝失效、贵模型当审查员更弱——这三类机制性失效有**独立证据**（Claude Code 官方 issue #46968/#45660、Jack Maguire 实测 70-90% 成本冗余、Anthropic 官方多智能体评测"收益来自 token 预算"）。

**于是我们为 DeepSeek Harness 写了 dsh-agent-frugality**：不停用多智能体，而是让它"浪费可见、规则不可丢、完成不可水过、审查不烧钱"。

## 功能亮点

1. **read-ledger 读取台账** —— 所有读类工具调用按内容 SHA-1 去重，per-agent 聚合读取/重复/字节；`frugality_ledger` 一眼看出"谁在重复读"；`frugality-read-cache` 已读清单自动注入上下文（子智能体同样受益）；JSONL 持久化重启不丢。
2. **immutable-core 免疫压缩规则区** —— 恒久规则注册进 system prompt section：每次组装机械重渲染，**上下文压缩无法移除**。软提示词 5 分钟失效？不存在的。
3. **completion-gate 完成机械门禁** —— "完成"不是一句话：`frugality_gate` 必须带上声明与验证（exit 0），turn-stopping 检测到"空口完成"自动塞回重做（≤2 次防死循环）。
4. **review-lane 低成本审查** —— `frugality_review` 自动挑 CHEAP 模型做独立审查（正确性/性能/安全/复用），主模型不参与。写手和审查员，本就不该是同一个人。

## 安装

```powershell
dev_inject_plugin D:\plugins\dsh-agent-frugality
# 发布后：dsh plugin add github:<你>/dsh-agent-frugality
```

先跑 `frugality_ledger` 看你的基线，再决定打开 `DSH_FRUGALITY_DEDUP=1` 干预层——**先度量，后干预**。

## 免责声明（科研诚实，必附）

本插件不背书任何"8.5 万美元实验"的具体数字；那些数字经核实无一手出处。插件针对的是有独立证据的机制性问题本身。

## 致谢

- 研究：D:\plugins\research\85k-experiment（主源核实 / 生态 33 方案 / DSH 原语审计 / 已装插件盘点 / 方案设计）
- DSH 生态：dsh-super-injector（装配）、dsh-mode-boost（样板）、dsh-model-router（路由）、dsh-memory-vault（记忆）、dsh-agent-teams（编排）
