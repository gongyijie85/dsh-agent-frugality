# 宣传物料（T18）

## X/Twitter Thread（EN，7 条）

1/ We fact-checked the famous "$85K multi-agent experiment" that everyone quotes. Result: the numbers (54.7% duplicate reads, 243→311 commits, Opus 23.9% fail) don't exist in the primary source — it's a generated-summary hallucination. 🧵

2/ But the *problems* are real, and independently evidenced: subagents re-reading the same files (Claude Code #46968, Jack Maguire: 70-90% waste in long runs), soft prompt rules dying after minutes, and expensive models being *worse* reviewers.

3/ So we built `dsh-agent-frugality` for DeepSeek Harness — not to ban multi-agent, but to make the waste *visible* and the rules *unbreakable*.

4/ 📊 read-ledger: every read tool call gets content-hashed (SHA-1), aggregated per agent, with a "what we already read" sheet injected into every prompt — subagents included. `frugality_ledger` shows your dup rate live. JSONL persistence survives restarts.

5/ 🔒 immersive-core + completion-gate: permanent rules live in a system-prompt section that **context compression cannot remove**. "Done" is no longer a word — `frugality_gate` requires claim + verify (exit 0), and turn-stopping bounces unverified completions back.

6/ 💸 review-lane: `frugality_review` routes review to a CHEAP-class model automatically. Writer and reviewer should never be the same expensive model — now the default isn't either.

7/ Measure first, intervene second (DEDUP off by default). Zero dependencies, JS-direct, inject-and-go: `dev_inject_plugin`. Spec: docs/SPEC.md. MIT.

#ShowHN built-tool multi-agent frugality observability

## Show HN 草稿（EN）

Title: Show HN: dsh-agent-frugality – make multi-agent waste visible, rules unbreakable

Text: We fact-checked the "$85K multi-agent experiment" everyone quotes — the headline numbers turned out to be a hallucination (no primary source). But three failure modes are real (subagent duplicate reads, soft-rule decay, expensive reviewers). So we built a zero-dependency DeepSeek Harness plugin that: (1) ledger-counts every file read with content hashing + per-agent aggregation, (2) injects rules into a compaction-immune system-prompt section, (3) gates "done" behind a mechanical verify (exit 0) with a bounce-back objection (max 2x), (4) routes code review to a cheap-class model automatically. Measure-first: intervention layers default off. 14/14 tests. MIT. Would love feedback on the completion-gate UX — is "bounce back" too aggressive for real workflows?

## 中文社区 / 公众号长文要点（T17 延伸）

1. 开头钩子：你可能相信过一个 8.5 万美元的多智能体"实测"——我们把它扒穿了（附核实表）。
2. 反转：数字是幻觉，但三类问题是真的（给独立证据链接）。
3. 我们不主张"禁多智能体"（Lovable 作者本人结论相反：值得，但要确定性使用），主张"机制防御"。
4. 四个机制（台账/免疫区/门禁/审查 lane）+ 一张真实运行截图（frugality_ledger 抓到自己 60% 重复读取）。
5. 安装 3 行命令 + 先跑基线再开干预的方法论。
6. 科研诚实声明收尾。

## 发布日执行清单（T19 草稿）

```powershell
# 1. GitHub
git add -A; git commit -m "feat: dsh-agent-frugality v0.1.0"
git remote add origin <repo>; git push -u origin main
git tag v0.1.0; git push origin v0.1.0

# 2. Release（gh 或网页）
#    notes = CHANGELOG.md 0.1.0 段 + docs/POST.md 摘要
#    附件 = npm pack 产物 dsh-external-dsh-agent-frugality-0.1.0.tgz

# 3. 市场收录（自动：GitHub topic=dsh-plugin）
#    确认仓库 Settings → Topics 已加 dsh-plugin

# 4. npm（可选，需用户确认 scope）
#    package.json private:false → npm publish

# 5. 公告：X thread + Show HN + docs/POST.md 中文长文
```
