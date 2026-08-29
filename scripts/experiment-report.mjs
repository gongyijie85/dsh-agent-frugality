#!/usr/bin/env node
/**
 * experiment-report.mjs — 从本机台账生成可发布的实验快照（零依赖）。
 * 用法：node scripts/experiment-report.mjs [--out docs/experiments]
 * 产物：docs/experiments/YYYY-MM-DD-snapshot.json（原始聚合）+ .md（人类可读报告）
 * 数据源：$DSH_HOME/agent-frugality-ledger.jsonl（读取台账）+ agent-frugality.log（门禁/审查事件）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const ledgerFile = join(DSH_HOME, 'agent-frugality-ledger.jsonl')
const logFile = join(DSH_HOME, 'agent-frugality.log')
const PKG_ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
const now = new Date().toISOString().slice(0, 10)

/** 读取 JSONL（坏行跳过）。 */
function readJsonl(file) {
  try {
    const raw = readFileSync(file, 'utf8')
    const rows = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try { rows.push(JSON.parse(line)) } catch { /* skip */ }
    }
    return rows
  } catch { return [] }
}

const reads = readJsonl(ledgerFile)
const logRows = readJsonl(logFile)

// ── 聚合：总览 / 按 agent / 按工具 ──
const totals = { reads: 0, dups: 0, bytes: 0 }
const byAgent = new Map()
const byTool = new Map()
for (const r of reads) {
  totals.reads += 1
  if (r.dup) totals.dups += 1
  totals.bytes += r.bytes || 0
  const a = byAgent.get(r.agentId || '?') || { label: r.agentLabel || '?', reads: 0, dups: 0, bytes: 0 }
  a.reads += 1; if (r.dup) a.dups += 1; a.bytes += r.bytes || 0
  byAgent.set(r.agentId || '?', a)
  const t = byTool.get(r.tool || '?') || { reads: 0, dups: 0, bytes: 0 }
  t.reads += 1; if (r.dup) t.dups += 1; t.bytes += r.bytes || 0
  byTool.set(r.tool || '?', t)
}
const dupRate = totals.reads ? (totals.dups / totals.reads) : 0
const savedTokensUpper = Math.round((totals.bytes / 4) * dupRate) // 重复字节 ÷4 = 可省 token 上限

// ── 门禁/审查事件统计（log）──
const stat = { gatePass: 0, gateBlocked: 0, gateObjections: 0, reviews: 0, reviewFindings: 0, dedupReplaces: 0, errors: 0 }
for (const e of logRows) {
  if (!e || !e.event) continue
  if (e.event === 'gate') { e.verified === false ? stat.gateBlocked++ : stat.gatePass++ }
  if (e.event === 'gate-object') stat.gateObjections++
  if (e.event === 'review') { stat.reviews++; stat.reviewFindings += e.findings || 0 }
  if (e.event === 'dedup-replace') stat.dedupReplaces++
  if (e.event === 'read-error' || e.event === 'gate-object-error' || e.event === 'dedup-error') stat.errors++
}

// ── 快照数据 ──
const snapshot = {
  generatedAt: new Date().toISOString(),
  pluginVersion: '0.1.0',
  window: { first: reads[0] ? reads[0].at : null, last: reads.length ? reads[reads.length - 1].at : null, count: reads.length },
  totals: { ...totals, dupRate: Number(dupRate.toFixed(4)), savedTokensUpperEstimate: savedTokensUpper },
  byAgent: [...byAgent.entries()].map(([id, a]) => ({ agentId: id, ...a, dupRate: a.reads ? Number((a.dups / a.reads).toFixed(4)) : 0 })),
  byTool: [...byTool.entries()].map(([tool, t]) => ({ tool, ...t, dupRate: t.reads ? Number((t.dups / t.reads).toFixed(4)) : 0 })),
  gateAndReview: stat,
}

// ── 输出 ──
const outDirArg = process.argv[2] || ''
const outDir = outDirArg.replace(/^--out=?/, '') || join(PKG_ROOT, 'docs', 'experiments')
mkdirSync(outDir, { recursive: true })
const jsonPath = join(outDir, `${now}-snapshot.json`)
const mdPath = join(outDir, `${now}-snapshot.md`)
writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2) + '\n')

const pct = (x) => `${(x * 100).toFixed(1)}%`
const md = [
  `# 实验数据快照 · ${now}`,
  '',
  `> 由 \`scripts/experiment-report.mjs\` 自动生成（plugin v${snapshot.pluginVersion}）。日常使用即实验：本快照来自真实会话流。`,
  '',
  '## 总览',
  '',
  '| 指标 | 值 |',
  '|---|---|',
  `| 读取次数 | ${totals.reads} |`,
  `| 重复读取 | ${totals.dups} (${pct(dupRate)}) |`,
  `| 读取字节 | ${(totals.bytes / 1024).toFixed(1)}KB |`,
  `| 可节省 token 上限（重复字节÷4） | ~${savedTokensUpper} |`,
  `| 数据窗口 | ${snapshot.window.first ? snapshot.window.first.slice(0, 10) : '-'} → ${snapshot.window.last ? snapshot.window.last.slice(0, 10) : '-'}（${snapshot.window.count} 条） |`,
  '',
  '## 按 agent',
  '',
  '| agent | reads | dups | dupRate | bytes |',
  '|---|---|---|---|---|',
  ...snapshot.byAgent.map((a) => `| ${a.label} | ${a.reads} | ${a.dups} | ${pct(a.dupRate)} | ${(a.bytes / 1024).toFixed(1)}KB |`),
  '',
  '## 按工具',
  '',
  '| tool | reads | dups | dupRate |',
  '|---|---|---|---|',
  ...snapshot.byTool.map((t) => `| ${t.tool} | ${t.reads} | ${t.dups} | ${pct(t.dupRate)} |`),
  '',
  '## 门禁与审查',
  '',
  `| 指标 | 值 |`,
  '|---|---|',
  `| gate 通过 | ${stat.gatePass} |`,
  `| gate 拦截（verify 失败） | ${stat.gateBlocked} |`,
  `| gate objection（无凭证完成声明） | ${stat.gateObjections} |`,
  `| review 次数 | ${stat.reviews} |`,
  `| review findings | ${stat.reviewFindings} |`,
  `| dedup 替换 | ${stat.dedupReplaces} |`,
  `| 插件错误 | ${stat.errors} |`,
  '',
  '## 解读对照（docs/EXPERIMENT.md 阈值）',
  '',
  '- 重复率目标：**< 15%**（当前 ' + pct(dupRate) + '）',
  '- 门禁目标：违规完成声明拒绝后模型补证（抽样人工核查）',
  '- review-lane 目标：每美元发现数 ≥ 主模型 1.5×（见 Exp-3）',
  '',
].join('\n')
writeFileSync(mdPath, md)
console.log(`snapshot written: ${mdPath}`)
console.log(`json: ${jsonPath}`)
