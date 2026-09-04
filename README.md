# dsh-agent-frugality

> **English** | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/dsh-agent-frugality?color=blue)](https://www.npmjs.com/package/dsh-agent-frugality)
[![npm downloads](https://img.shields.io/npm/dm/dsh-agent-frugality)](https://www.npmjs.com/package/dsh-agent-frugality)
[![GitHub](https://img.shields.io/badge/GitHub-gongyijie85%2Fdsh--agent--frugality-black?logo=github)](https://github.com/gongyijie85/dsh-agent-frugality)
[![GitHub Release](https://img.shields.io/github/v/release/gongyijie85/dsh-agent-frugality)](https://github.com/gongyijie85/dsh-agent-frugality/releases)
[![Last commit](https://img.shields.io/github/last-commit/gongyijie85/dsh-agent-frugality)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-18%2F18%20passing-brightgreen)]()
[![Zero deps](https://img.shields.io/badge/dependencies-none-9cf)]()

> A **DeepSeek Harness (DSH) plugin** that defends multi-agent systems against three mechanism-level failure modes:
> **read-ledger dedup · compaction-immune rules · mechanical completion gate · cheap-review lane**.
> Zero external dependencies — inject and go.

📐 Spec: [`docs/SPEC.md`](docs/SPEC.md) · 📋 Tickets: [`TICKETS.md`](TICKETS.md) · 📝 Changelog: [`CHANGELOG.md`](CHANGELOG.md) · 🛒 Market status: [`docs/MARKETPLACE.md`](docs/MARKETPLACE.md)

## What it does

| Capability | Outcome |
|---|---|
| **read-ledger** | Every read-type tool call is content-hashed into a per-agent ledger. `frugality_ledger` shows who re-reads what — waste becomes *visible* instead of invisible. |
| **immutable-core** | Frugality rules live in a compaction-immune prompt section (re-rendered on every assembly) — context compression cannot erase them. |
| **completion-gate** | "Done" must pass `frugality_gate` with a claim + exit-0 verification. Unsupported completion claims are steered back (≤2 objections, anti-loop). |
| **review-lane** | `frugality_review` runs independent review on the **CHEAP** model family — the main (expensive) model never reviews its own work. |

**Who it is for**: teams and solo builders running long multi-agent DSH sessions, agent plugin authors, and anyone whose token spend grows with no accounting for *why*.

## Why

Three failure modes are real and independently evidenced:

| Failure | Evidence | This plugin's defense |
|---|---|---|
| **Subagent duplicate reads** (no shared memory → token waste) | Claude Code [#46968](https://github.com/anthropics/claude-code/issues/46968), [#45660](https://github.com/anthropics/claude-code/issues/45660); Jack Maguire: subagents account for most token cost in long runs, 70–90% recoverable | `read-ledger` content-hash ledger + "already read" sheet injection |
| **Prompt decay** (soft rules fade, compaction erases them) | Anthropic *Building effective agents*: cost tradeoffs come from architecture, not wording | `immutable-core` rules in a compaction-immune prompt section + `completion-gate` mechanical gate |
| **Expensive-model fallacy** (costly models are worse reviewers) | Anthropic *multi-agent research system*: gains come from token budget; RouteLLM/FrugalGPT consensus | `review-lane` cheap-model independent review |

This plugin does **not** forbid multi-agents — it makes the waste *visible* and the behavior *mechanically bounded*; **measure first, intervene second** (DEDUP off by default).

> ⚠️ **Research-integrity note**: this plugin does not endorse the headline numbers of the "$85K multi-agent experiment" (54.7% duplicate reads / 243→311 commits / Opus 23.9% — verified to have **no primary source**; they are a generated-summary hallucination; verification report: `research/01-primary-source.md`). It targets the mechanism problems themselves, which do have independent evidence.

## Quick start

```powershell
# 1. Install (published v0.1.0)
dsh plugin add github:gongyijie85/dsh-agent-frugality   # GitHub channel (primary)
npm install dsh-agent-frugality                          # npm channel

# Local dev (runtime injection, no restart)
dev_inject_plugin D:\plugins\dsh-agent-frugality
# dev_uninject_plugin dsh-agent-frugality

# 2. Measure your baseline — the ledger is ON by default, DEDUP is OFF
frugality_ledger

# 3. Intervene only when the baseline says so
#    (e.g. dupRate > 15% for a week → set DSH_FRUGALITY_DEDUP=1)
```

The completion gate is **ON by default** (`DSH_FRUGALITY_GATE=1`). Disable only if it fights your workflow.

## How it works

```
tool calls ──→ tools/result ──→ [read-ledger] SHA-1 ledger → JSONL persistence
                      │                │
                      └─ 2nd+ same content ──→ [dedup-replace] summary swap (DEDUP=1)
system-prompt/assemble ──→ [immutable-core] frugality-rules (compaction-immune) + frugality-read-cache
agent/turn-stopping ──→ completion claim without gate proof ──→ steer back (≤2)
frugality_gate / frugality_review / frugality_ledger ──→ three tools
```

## Tools

| Tool | Purpose |
|---|---|
| `frugality_ledger` | Read ledger (per-agent reads/dups/bytes, dup rate, gate & review counters; JSONL-restored) — baseline first, then decide on intervention |
| `frugality_gate` | Completion gate: `claim` required; verify command must exit 0 (host-configured only) |
| `frugality_review` | Cheap-review lane: independent review on a CHEAP-class model (quick/deep), verdict + findings |

## Configuration (env vars — full table in docs/SPEC.md §6)

| Variable | Default | Meaning |
|---|---|---|
| `DSH_FRUGALITY_DEDUP` | `0` | `1` = replace 2nd+ identical read with a summary |
| `DSH_FRUGALITY_GATE` | `1` | `0` = disable completion gate |
| `DSH_FRUGALITY_GATE_MAX` | `2` | max gate objections (anti-loop) |
| `DSH_FRUGALITY_VERIFY` | empty | default verify command (`npm test`; exit 0 = pass) |
| `DSH_FRUGALITY_ALLOW_ARG_VERIFY` | `0` | `1` = accept tool-arg verify (**default ignored — anti-RCE**, SPEC §7.1) |
| `DSH_FRUGALITY_REVIEW_MODEL` | auto | review model id; auto = CHEAP family |
| `DSH_FRUGALITY_RULES` | builtin | rules file (≤8KB) |
| `DSH_FRUGALITY_LEDGER_CAP` | `30` | read-cache sheet max entries |
| `DSH_FRUGALITY_WORKDIR` | cwd | gate verify command cwd |
| `DSH_FRUGALITY_READ_PATTERNS` | builtin | extra read-tool substrings (comma-separated) |

## FAQ & troubleshooting

**Why is DEDUP off by default?** Measure-first philosophy: the ledger shows your real duplicate rate before any intervention. Enable it only when the baseline shows net gain.

**Can the verify command run arbitrary code?** No. `frugality_gate` only runs the host-configured `DSH_FRUGALITY_VERIFY`; tool-provided verify args are ignored unless `DSH_FRUGALITY_ALLOW_ARG_VERIFY=1` (anti-RCE, SPEC §7.1).

**Does it break subagents?** No — read-ledger only observes and dedupes read results (opt-in); immutable-core only injects a prompt section; nothing blocks or rewrites agent output.

**Is my content logged?** No content is stored: the ledger records content-hashes + targets only; logs are JSONL events (apply/read/gate/review) without file contents (SPEC §7).

**Where are the logs?** `$DSH_HOME/agent-frugality.log` (JSONL events) and `$DSH_HOME/agent-frugality-ledger.jsonl` (ledger persistence).

**Does it duplicate other plugins?** It intentionally fills only the gaps: shared memory → `dsh-memory-vault`; model routing → `dsh-model-router`; task orchestration → `dsh-agent-teams`. This plugin adds read dedup metrics, the host completion gate, and the cheap-review lane — nothing else.

## Layout

```
lib/index.js       host assembly (hooks / tool registration / config / persistence)
lib/core.js        pure functions & constants (18 unit tests green)
test/core.test.mjs node:test, zero-dependency
docs/SPEC.md       spec (FR / NFR / security model §7 / API contract §8 / acceptance §9)
docs/MARKETPLACE.md marketplace ingestion kit & status
TICKETS.md         productization checklist (phase 1-5)
CHANGELOG.md       release notes
LICENSE            MIT
```

## Test & verify

```powershell
node --test test/core.test.mjs   # 18/18
node --check lib/index.js && node --check lib/core.js
```

## Design principles

1. **Measure first, intervene second** — ledger on, DEDUP off until your baseline shows net gain.
2. **Mechanical bounds > prompts** — rules land in tool-result errors / turn-stopping objections; prompts only echo (the rules section itself is compaction-immune).
3. **Only fill real gaps** — shared memory via `dsh-memory-vault`, routing via `dsh-model-router`, task gates via `dsh-agent-teams`; this plugin adds read-ledger, host completion gate, cheap-review lane.
4. **Zero deps** — node built-ins + `lib/core.js`; JS-direct like `dsh-mode-boost`.

## Experiment data (daily-use-as-experiment)

The plugin is instrumented by design: every real session feeds the ledger, and periodic snapshots are published to the repo as evidence.

```powershell
node scripts/experiment-report.mjs   # -> docs/experiments/YYYY-MM-DD-snapshot.{json,md}
```

- First snapshot (2026-08-29): 34 reads, 5.9% duplicate rate, 93KB, gate 3 pass / 3 objections, review lane 1×9 findings, 0 plugin errors
- **Exp-3 done (2026-08-29)**: cheap lane (flash) 81.8% recall @ $0.033 with **1.65× per-dollar hits vs strong**; strong (v4) 100%/0 FPs @ $0.067 → dual-lane policy validated ([results](docs/experiments/exp3-results.md))
- Thresholds & ops loop: [`docs/EXPERIMENT.md`](docs/EXPERIMENT.md) ("运营模式" section)

## Roadmap

- [ ] Weekly ledger snapshots → README experiment-data section updates (T21)
- [ ] Threshold-driven ops loop: dupRate > 15% for a week → DEDUP=1; record baseline → improvement → validation per release (T22)
- [ ] Next feature candidates: cross-session ledger summaries; review-lane feedback loop into DEDUP heuristics

## Release & ingestion status (v0.1.0, updated 2026-09-02)

- [x] GitHub: github.com/gongyijie85/dsh-agent-frugality (main + tag v0.1.0)
- [x] npm: dsh-agent-frugality@0.1.0
- [x] GitHub Release @ v0.1.0 with `dsh-agent-frugality-0.1.0.tgz` asset
- [x] Repo description + topics (`dsh-plugin` `deepseek-harness` `multi-agent`) set — topic-driven markets auto-sync
- [ ] awesome-dsh-plugin curated registry PR **#4173** — submitted 2026-09-02, **pending maintainer merge** (merge → one-click install inside dsh-market)
- [ ] chnjames / 0326 directories — auto-discovery via `dsh-plugin` topic; entry appears on their next sync cycle (no manual submission)

> **Topics (2026-09-02 expanded, 12)**: `dsh-plugin` `deepseek-harness` `dsh` `cordis` `multi-agent` `ai-agents` `agent-cost` `cost-optimization` `token-efficiency` `context-management` `subagent` `completion-gate` — apply in repo → Settings → About → Topics.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security review: SPEC §7 model (verify command is host-config only; review file whitelist; no content in logs).

## License

MIT