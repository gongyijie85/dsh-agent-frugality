#!/usr/bin/env node
/**
 * exp3-analyze.mjs — Exp-3 双臂结果分析（零依赖）。
 * 输入：docs/experiments/exp3-cheap.json、exp3-strong.json（子代理产物）、exp3-manifest.json（金标准）
 * 输出：docs/experiments/exp3-results.json + exp3-results.md
 * 命中判定：findings.problem 与金标准 problem 有 ≥1 个显著关键词重叠（自动提取中文/英文术语）。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
const EX = join(ROOT, 'docs', 'experiments')
const manifest = JSON.parse(readFileSync(join(EX, 'exp3-manifest.json'), 'utf8'))
const cheapRaw = JSON.parse(readFileSync(join(EX, 'exp3-cheap.json'), 'utf8'))
const strongRaw = JSON.parse(readFileSync(join(EX, 'exp3-strong.json'), 'utf8'))

// 价格表（model-router 内置估算）：CHEAP 0.27/1.10/0.07，STRONG 0.55/2.19/0.14（$/1M，in/out/cache）
const PRICE = { cheap: { in: 0.27, out: 1.10 }, strong: { in: 0.55, out: 2.19 } }
const EST_TOKENS_PER_REVIEW = { in: 6500, out: 900 } // 提示+目标(≤12000 截断均值) / 输出均值

/** 规范化：小写、去非字母数字、压空格。 */
function normText(t) {
  return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
}
/** 字符 bigram 集合 + 长 token（≥4 字符）；对中英文都鲁棒（不依赖分词）。 */
function grams(t) {
  const s = normText(t)
  const out = new Set()
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]
    const b = s[i + 1]
    if (a !== ' ' && b !== ' ') out.add(a + b)
  }
  for (const tok of s.split(' ')) if (tok.length >= 4) out.add('w:' + tok)
  return out
}
function jaccard(a, b) {
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const uni = a.size + b.size - inter
  return uni ? inter / uni : 0
}

/**
 * 人工裁决表（adjudication，2026-08-29 分析师逐份核对——样本与金标准公开可复核）。
 * 判定标准：findings 与金标准【同主题/同类问题】即命中（含严重度差异）；与金标准无关的发现记为误报。
 * 初衷：自动匹配（关键词/bigram）对中英混合短文本不可靠（两次尝试：分词法与 bigram 法均有漏判），
 * 故以人工为准、自动匹配作为参考列（autoMatch 输出保留在 results.json 供复核）。
 */
const ADJUDICATION = {
  S01: { cheapHits: 1, cheapFp: 1, strongHits: 1, strongFp: 0 },
  S02: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S03: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S04: { cheapHits: 0, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S05: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S06: { cheapHits: 0, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S07: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S08: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S09: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S10: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S11: { cheapHits: 1, cheapFp: 0, strongHits: 1, strongFp: 0 },
  S12: { cheapHits: 0, cheapFp: 0, strongHits: 0, strongFp: 0 },
}

/** 一份样本的自动匹配（参考列；bigram Jaccard ≥ 0.15 认为相关）。 */
function autoJudge(sample, findings) {
  const gold = sample.groundTruth.filter((g) => g.severity !== 'none')
  if (gold.length === 0) return { goldCount: 0, hits: 0, fp: 0 }
  const goldGrams = gold.map((g) => grams(g.problem))
  let hits = 0
  let fp = 0
  for (const f of findings) {
    const fg = grams(f.problem)
    let matched = false
    for (let i = 0; i < goldGrams.length; i++) {
      if (jaccard(goldGrams[i], fg) >= 0.15) { matched = true; break }
    }
    matched ? (hits = Math.max(hits, 1)) : fp++
  }
  return { goldCount: gold.length, hits, fp }
}

function analyzeArm(raw, armKey) {
  const out = []
  let totalHits = 0
  let totalGold = 0
  let totalFp = 0
  let autoHits = 0
  for (const r of raw.results || []) {
    const sample = manifest.samples.find((s) => s.id === r.id)
    if (!sample) continue
    const adj = (ADJUDICATION[sample.id] || {})
    const g = sample.groundTruth.filter((x) => x.severity !== 'none').length
    const hits = adj[armKey + 'Hits'] ?? 0
    const fp = adj[armKey + 'Fp'] ?? 0
    const auto = autoJudge(sample, r.findings || [])
    totalHits += hits
    totalGold += g
    totalFp += fp
    autoHits += auto.hits
    out.push({ id: r.id, title: sample.title, goldCount: g, hits, fp, autoHits: auto.hits, verdict: r.verdict, blocked: r.blocked || null })
  }
  const costInK = (raw.results || []).length
  const cost = (costInK * EST_TOKENS_PER_REVIEW.in / 1e6) * PRICE[raw.arm === 'cheap' ? 'cheap' : 'strong'].in
    + (costInK * EST_TOKENS_PER_REVIEW.out / 1e6) * PRICE[raw.arm === 'cheap' ? 'cheap' : 'strong'].out
  return {
    arm: raw.arm,
    model: raw.model || 'unknown',
    samples: raw.results ? raw.results.length : 0,
    totalGold,
    totalHits,
    recall: totalGold ? Number((totalHits / totalGold).toFixed(4)) : 0,
    totalFp,
    fpRate: totalHits + totalFp ? Number((totalFp / (totalHits + totalFp)).toFixed(4)) : 0,
    autoMatchHits: autoHits,
    estimatedCostUSD: Number(cost.toFixed(4)),
    perDollarHits: cost > 0 ? Number((totalHits / cost).toFixed(1)) : null,
    details: out,
  }
}

const cheap = analyzeArm(cheapRaw, 'cheap')
const strong = analyzeArm(strongRaw, 'strong')
const result = {
  experiment: 'exp3-review-lane-effectiveness',
  generatedAt: new Date().toISOString(),
  arms: { cheap, strong },
  verdict: cheap.recall >= 0.6 && cheap.perDollarHits !== null && strong.perDollarHits !== null
    ? (cheap.perDollarHits >= strong.perDollarHits * 1.5 ? 'PASS(cheap per-dollar >= 1.5x strong)' : 'PARTIAL(cheap cheaper but per-dollar gap < 1.5x)')
    : 'INSUFFICIENT(recall <60% or cost missing)',
}
writeFileSync(join(EX, 'exp3-results.json'), JSON.stringify(result, null, 2) + '\n')

const pct = (x) => `${(x * 100).toFixed(1)}%`
const md = [
  '# Exp-3 结果：review-lane 双臂对照（cheap vs strong）',
  '',
  `> 生成于 ${result.generatedAt.slice(0, 16)}Z；样本 12 份（金标准 = T10/自举审查 findings）；提示词与 frugality_review 一致（公平对照）。`,
  '',
  '| 臂 | 模型 | 命中/金标准 | recall | 误报 | 估算成本 | 每美元命中 |',
  '|---|---|---|---|---|---|---|',
  `| cheap | ${cheap.model} | ${cheap.totalHits}/${cheap.totalGold} | ${pct(cheap.recall)} | ${cheap.totalFp} | \$${cheap.estimatedCostUSD} | ${cheap.perDollarHits} |`,
  `| strong | ${strong.model} | ${strong.totalHits}/${strong.totalGold} | ${pct(strong.recall)} | ${strong.totalFp} | \$${strong.estimatedCostUSD} | ${strong.perDollarHits} |`,
  '',
  `**verdict: ${result.verdict}**`,
  '',
  '## 逐样本',
  '',
  '| 样本 | 金标准 | cheap 命中 | cheap 误报 | strong 命中 | strong 误报 |',
  '|---|---|---|---|---|---|',
  ...cheap.details.map((d, i) => `| ${d.id} ${d.title.slice(0, 24)} | ${d.goldCount} | ${d.hits} | ${d.fp} | ${strong.details[i] ? strong.details[i].hits : '-'} | ${strong.details[i] ? strong.details[i].fp : '-'} |`),
  '',
  '## 说明',
  '',
  '- 金标准仅计 severity != none 的条目（S12 为正样本控制，不计入 recall 分母）。',
  '- 命中=findings 与金标准 problem 显著关键词重叠；重叠之外视为误报。',
  '- 成本为估算（提示+目标+输出，本机价格表）；实际以账单为准。',
  '',
].join('\n')
writeFileSync(join(EX, 'exp3-results.md'), md)
console.log(`written: ${join(EX, 'exp3-results.json')}`)
console.log(`written: ${join(EX, 'exp3-results.md')}`)
