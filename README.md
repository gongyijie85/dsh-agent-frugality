# dsh-agent-frugality

> **English** | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/dsh-agent-frugality?color=blue)](https://www.npmjs.com/package/dsh-agent-frugality)
[![GitHub](https://img.shields.io/badge/GitHub-gongyijie85%2Fdsh--agent--frugality-black?logo=github)](https://github.com/gongyijie85/dsh-agent-frugality)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-18%2F18%20passing-brightgreen)]()
[![Zero deps](https://img.shields.io/badge/dependencies-none-9cf)]()

> A DeepSeek Harness defense plugin against three mechanism-level failure modes of multi-agent systems:
> **read-ledger dedup · compaction-immune rules · mechanical completion gate · cheap-review lane**.
> Zero external dependencies — inject and go.

📐 Spec: [`docs/SPEC.md`](docs/SPEC.md) · 📋 Tickets: [`TICKETS.md`](TICKETS.md) · 📝 Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Why

Three failure modes are real and independently evidenced:

| Failure | Evidence | This plugin's defense |
|---|---|---|
| **Subagent duplicate reads** (no shared memory → token waste) | Claude Code [#46968](https://github.com/anthropics/claude-code/issues/46968), [#45660](https://github.com/anthropics/claude-code/issues/45660); Jack Maguire: subagents account for most token cost in long runs, 70–90% recoverable | `read-ledger` content-hash ledger + "already read" sheet injection |
| **Prompt decay** (soft rules fade, compaction erases them) | Anthropic *Building effective agents*: cost tradeoffs come from architecture, not wording | `immutable-core` rules in a compaction-immune prompt section + `completion-gate` mechanical gate |
| **Expensive-model fallacy** (costly models are worse reviewers) | Anthropic *multi-agent research system*: gains come from token budget; RouteLLM/FrugalGPT consensus | `review-lane` cheap-model independent review |

This plugin does **not** forbid multi-agents — it makes the waste *visible* and the behavior *mechanically bounded*; **measure first, intervene second** (DEDUP off by default).

> ⚠️ **Research-integrity note**: this plugin does not endorse the headline numbers of the "$85K multi-agent experiment" (54.7% duplicate reads / 243→311 commits / Opus 23.9% — verified to have **no primary source**; they are a generated-summary hallucination; verification report: `research/01-primary-source.md`). It targets the mechanism problems themselves, which do have independent evidence.

## Install

**Published (v0.1.0)**:

```powershell
# GitHub channel (primary; marketplace ingestion is topic-driven)
dsh plugin add github:gongyijie85/dsh-agent-frugality

# npm channel
npm install dsh-agent-frugality

# Local dev (runtime injection, no restart)
dev_inject_plugin D:\plugins\dsh-agent-frugality
# Uninstall
dev_uninject_plugin dsh-agent-frugality
```

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

## Layout

```
lib/index.js       host assembly (hooks / tool registration / config / persistence)
lib/core.js        pure functions & constants (18 unit tests green)
test/core.test.mjs node:test, zero-dependency
docs/SPEC.md       spec (FR / NFR / security model §7 / API contract §8 / acceptance §9)
docs/MARKETPLACE.md marketplace ingestion kit
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

## Logs

`$DSH_HOME/agent-frugality.log` (JSONL events) and `$DSH_HOME/agent-frugality-ledger.jsonl` (ledger persistence).

## Release & ingestion status (v0.1.0, 2026-08-29)

- [x] GitHub: github.com/gongyijie85/dsh-agent-frugality (main + tag v0.1.0, topics: `dsh-plugin` `deepseek-harness` `multi-agent`)
- [x] npm: dsh-agent-frugality@0.1.0
- [x] Topics set (`dsh-plugin` → auto-synced by [AwesomeHou marketplace](https://github.com/AwesomeHou/dsh-plugin-marketplace) and dsh-market)
- [ ] awesome-dsh-plugin curated registry submission (kit in [`docs/MARKETPLACE.md`](docs/MARKETPLACE.md)) — required for one-click install inside dsh-market
- [ ] GitHub Release @ v0.1.0 (notes: CHANGELOG 0.1.0 section)

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security review: SPEC §7 model (verify command is host-config only; review file whitelist; no content in logs).

## License

MIT
