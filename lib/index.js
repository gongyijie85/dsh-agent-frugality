/**
 * @dsh-external/dsh-agent-frugality — 对抗多智能体三层失效的防御插件。
 *
 * 依据 docs/SPEC.md（规格事实源）：
 *  A. read-ledger    — 读取台账 + 内容哈希去重 + 已读清单注入（度量默认开，JSONL 持久化）
 *  B. immutable-core — 恒久规则区（system-prompt section，免疫压缩）+ 完成门禁（frugality_gate + turn-stopping objection）
 *  C. role-router    — frugality_review 低成本审查 lane（独立于主模型）
 *
 * 零外部 import（node: 内置）+ lib/core.js（纯函数，可测试）——JS 直出模式。
 * 配置经环境变量（全表见 docs/SPEC.md §6）：
 *   DSH_FRUGALITY_DEDUP / GATE / GATE_MAX / VERIFY / ALLOW_ARG_VERIFY /
 *   REVIEW_MODEL / RULES / LEDGER_CAP / WORKDIR / READ_PATTERNS
 */
import { appendFileSync, readFileSync, existsSync, statSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'
import {
  DEFAULT_RULES, READ_PATTERNS, GATE_OBJECTION,
  isReadTool, extractText, sha1, targetOf, toJsonSchema, duplicateOf,
  cheapModelOf, lastAssistantTail, looksLikeCompletion, reviewPromptFor, parseFindings,
  REVIEW_FILE_EXTS, sanitizeVerify, safeSlice, applyRead, foldLedgerLine,
} from './core.js?v=3' // ?v= cache-busting（ESM 缓存按 URL），API 变更时递增

const exec = promisify(execCb)

/** Cordis plugin name used by loader diagnostics. */
export const name = '@dsh-external/dsh-agent-frugality'

/** Tools/session composition services that must exist. */
export const inject = ['tools', 'systemPrompt', 'llm']

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const PLUGIN = '@dsh-external/dsh-agent-frugality'

// ── config (env; zero-dep schema) ───────────────────────────────────────────
const cfg = {
  dedupReplace: process.env.DSH_FRUGALITY_DEDUP === '1',
  gateEnabled: process.env.DSH_FRUGALITY_GATE !== '0',
  gateMax: clampInt(process.env.DSH_FRUGALITY_GATE_MAX, 2, 1, 10),
  verifyCommand: process.env.DSH_FRUGALITY_VERIFY || '',
  allowArgVerify: process.env.DSH_FRUGALITY_ALLOW_ARG_VERIFY === '1',
  reviewModel: process.env.DSH_FRUGALITY_REVIEW_MODEL || '',
  rulesFile: process.env.DSH_FRUGALITY_RULES || '',
  ledgerCap: clampInt(process.env.DSH_FRUGALITY_LEDGER_CAP, 30, 1, 100),
  workdir: process.env.DSH_FRUGALITY_WORKDIR || process.cwd(),
  readPatterns: [...READ_PATTERNS, ...String(process.env.DSH_FRUGALITY_READ_PATTERNS || '').split(',').map((s) => s.trim()).filter(Boolean)],
  logFile: join(DSH_HOME, 'agent-frugality.log'),
  ledgerFile: join(DSH_HOME, 'agent-frugality-ledger.jsonl'),
  ledgerLoadLimit: 500,
}

function clampInt(v, dflt, min, max) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : dflt
}

function agentLabel(agent) {
  if (!agent) return '(none)'
  const meta = agent.session && agent.session.meta
  const label = meta && (meta.label || meta.description)
  return label ? String(label).slice(0, 40) : String(agent.id).slice(0, 24)
}

function log(entry) {
  try {
    appendFileSync(cfg.logFile, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n', 'utf8')
  } catch { /* observability is best-effort */ }
}

// ── live ledger (in-memory; host process, all agents share one tab) ─────────
const live = {
  hashIndex: new Map(), // hash -> { firstAgent, firstLabel, firstTarget, firstAt, count, summary }
  perAgent: new Map(), // agentId -> { label, reads, dups, bytes, lastAt }
  lastReads: [], // cap 120: { at, agent, target, hash, dup }
  gateOk: new Map(), // sessionId -> { claim, verified, at }
  objections: new Map(), // sessionId -> count
  reviews: 0,
  reviewFindings: 0,
  dedupSaves: 0,
  suppressed: new Set(), // rootCallId：dedup-replace 已预记账，tools/result 跳过二次记账
}

/** 单条读取记账（纯逻辑在 core.applyRead；持久化 + 日志 + 内存）。 */
function recordRead(exec, contentText, now) {
  const text = String(contentText || '')
  if (!text) return null
  const agentId = exec.agent ? String(exec.agent.id) : '(none)'
  const label = agentLabel(exec.agent)
  const target = targetOf(exec.name, exec.arguments)
  const r = applyRead(live, { text, at: now, agentId, label, target })
  // SPEC §7.4：持久化只记 hash + target（≤120）+ 元数据，不记内容摘要
  ledgerAppend({ at: now, agentId, agentLabel: label, tool: exec.name, target, hash: r.hash, bytes: r.bytes, dup: r.dup })
  log({ event: 'read', agent: label, tool: exec.name, target, dup: r.dup, bytes: r.bytes })
  return r
}

/** 持久化（T06/FR-6）：启动重建 + 追加。任何 IO 失败必须静默。 */
function ledgerAppend(entry) {
  try {
    appendFileSync(cfg.ledgerFile, JSON.stringify(entry) + '\n', 'utf8')
  } catch { /* best-effort */ }
}

function loadLedger() {
  try {
    const st = statSync(cfg.ledgerFile)
    if (!st.isFile()) return 0
    // FR-6 预算：仅读尾部 ≤512KB（JSONL 行按 \n 分块，slice(-500) 按行）
    const MAX_TAIL = 512 * 1024
    let raw
    if (st.size <= MAX_TAIL) {
      raw = readFileSync(cfg.ledgerFile, 'utf8')
    } else {
      const fd = openSync(cfg.ledgerFile, 'r')
      try {
        const buf = Buffer.alloc(MAX_TAIL)
        const read = readSync(fd, buf, 0, MAX_TAIL, st.size - MAX_TAIL)
        raw = buf.subarray(0, read).toString('utf8')
      } finally {
        closeSync(fd)
      }
    }
    const lines = raw.split('\n').filter(Boolean).slice(-cfg.ledgerLoadLimit)
    let folded = 0
    for (const line of lines) {
      let e
      try { e = JSON.parse(line) } catch { continue }
      if (foldLedgerLine(live, e)) folded += 1
    }
    return folded
  } catch { return 0 }
}

// ── A. read-ledger: tools/result observer ───────────────────────────────────
function hookReadLedger(ctx) {
  ctx.on('tools/result', (exec, result) => {
    try {
      // 统一键（rootCallId || token）；error 结束也消费 suppressed（防泄漏）
      const key = exec.rootCallId || exec.token || ''
      if (key && live.suppressed.has(key)) {
        live.suppressed.delete(key)
        return
      }
      if (!isReadTool(exec.name, cfg.readPatterns) || result.isError) return
      const text = extractText(result.content)
      if (!text) return
      recordRead(exec, text, new Date().toISOString())
    } catch (error) {
      log({ event: 'read-error', error: String(error) })
    }
  })
}

// ── A2. dedup replace (SPEC FR-2; default off: measure first) ───────────────
function hookDedupReplace(ctx) {
  if (!cfg.dedupReplace) return
  ctx.on('tools/post-execute', (exec, result, next) => {
    try {
      if (result.isError || !isReadTool(exec.name, cfg.readPatterns)) return next()
      const text = extractText(result.content)
      if (!text) return next()
      const hash = sha1(text)
      const d = duplicateOf(live.hashIndex, hash)
      // FR-2：同内容第 ≥2 次读取即替换（首次读取时 d.dup=false 放行）
      if (!d.dup) return next()
      const blocks = [{ type: 'text', text: [
        `⚠️ [frugality dedup] 此内容与此前 ${d.count} 次读取相同（首读：${live.hashIndex.get(hash).firstLabel} → ${live.hashIndex.get(hash).firstTarget} @ ${live.hashIndex.get(hash).firstAt.slice(11, 16)}）。`,
        '如需其中细节，请引用已有上下文或指明区段。摘要：',
        (d.summary || '').slice(0, 600),
      ].join('\n') }]
      live.dedupSaves += text.length
      // 预记账（原内容），并让 tools/result 跳过二次记账（防摘要污染哈希索引）
      recordRead(exec, text, new Date().toISOString())
      const key = exec.rootCallId || exec.token || ''
      if (key) live.suppressed.add(key)
      log({ event: 'dedup-replace', count: d.count, target: targetOf(exec.name, exec.arguments) })
      return { kind: 'accept', content: blocks }
    } catch (error) {
      log({ event: 'dedup-error', error: String(error) })
      return next()
    }
  })
}

// ── B. immutable-core: rules + read-cache sections (system-prompt/assemble) ──
function loadRules() {
  if (cfg.rulesFile && existsSync(cfg.rulesFile)) {
    try {
      const text = safeSlice(readFileSync(cfg.rulesFile, 'utf8').trim(), 8192) // SPEC §7.3 上限 8KB（surrogate 安全）
      if (text) return text
    } catch { /* fall through to defaults */ }
  }
  return DEFAULT_RULES
}

/** gateOk 修剪：TTL 24h + 容量 100（防无界增长，进程长跑安全）。 */
function pruneGateOk() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const [sid, g] of live.gateOk) {
    if (new Date(g.at).getTime() < cutoff) live.gateOk.delete(sid)
  }
  if (live.gateOk.size > 100) {
    const sorted = [...live.gateOk.entries()].sort((a, b) => new Date(a[1].at) - new Date(b[1].at))
    for (const [sid] of sorted.slice(0, live.gateOk.size - 100)) live.gateOk.delete(sid)
  }
}

function renderReadCache(entries) {
  if (!entries.length) return ''
  const lines = entries.slice(-cfg.ledgerCap).map((e) => {
    return `- ${e.target} (${e.agent}, ${Math.ceil(e.bytes / 1024)}KB, ${e.dup ? '重复' : '首次'})`
  })
  return [
    '[已读缓存 - frugality] 本会话此前已读取过以下内容，如需其中信息请引用已有上下文，避免重复读取：',
    ...lines,
  ].join('\n')
}

function hookImmutableCore(ctx) {
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    try {
      const sections = (assembled.sections || []).filter((s) => s && s.name !== 'frugality-rules' && s.name !== 'frugality-read-cache')
      sections.push({ name: 'frugality-rules', text: loadRules(), order: 5 })
      const agent = context && context.agent
      if (agent && agent.session) {
        const aid = String(agent.id || '')
        const scoped = live.lastReads.filter((e) => aid === '' ? e.agent === agentLabel(agent) : e.agentId === aid)
        const cacheText = renderReadCache(scoped)
        if (cacheText) sections.push({ name: 'frugality-read-cache', text: cacheText, order: 100 })
      }
      return { ...assembled, sections }
    } catch (error) {
      log({ event: 'assemble-error', error: String(error) })
      return assembled
    }
  })
}

// ── B. completion-gate: frugality_gate tool + turn-stopping objection ───────
async function runVerify(command) {
  try {
    const { stdout, stderr } = await exec(command, { cwd: cfg.workdir, timeout: 120000, maxBuffer: 1024 * 1024 })
    return { verified: true, output: (stdout || '').slice(-2000) || (stderr || '').slice(-2000) || 'ok' }
  } catch (error) {
    const err = error || {}
    const out = String(err.stdout || err.stderr || err.message || err).slice(-2000)
    return { verified: false, output: out }
  }
}

function registerGate(ctx) {
  const tool = {
    name: 'frugality_gate',
    description: '完成门禁：机械检查本轮任务完成前必须满足的条件。提供 claim（简短完成声明）；验证命令只采用宿主配置 DSH_FRUGALITY_VERIFY（另启 DSH_FRUGALITY_ALLOW_ARG_VERIFY=1 才接受本参数），exit 0 才通过。任何"完成"声明前必须先调用本工具。',
    parameters: {
      claim: { type: 'string', required: true, description: '简短完成声明（做了什么）' },
      verify: { type: 'string', description: '可选：覆盖验证命令（默认忽略，需 DSH_FRUGALITY_ALLOW_ARG_VERIFY=1）' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    async execute(args, execCtx) {
      try {
        const claim = String((args && args.claim) || '').slice(0, 500)
        // SPEC §7.1：命令执行面仅允许宿主配置；参数 verify 默认忽略（防模型 RCE）；
        // sanitizeVerify 再净化一次（shell 元字符/破坏性命令关键字拒绝）。
        let cmd = cfg.verifyCommand
        let cmdNote = ''
        if (!cmd && cfg.allowArgVerify && args && args.verify) {
          const s = sanitizeVerify(String(args.verify))
          if (s.ok) cmd = s.cmd
          else cmdNote = '（参数 verify 含 shell 元字符，已忽略）'
        } else if (cfg.verifyCommand) {
          const s = sanitizeVerify(cfg.verifyCommand)
          if (!s.ok) return '[BLOCKED] 宿主验证命令含非法字符（' + s.reason + '），请修正 DSH_FRUGALITY_VERIFY'
          cmd = s.cmd
        }
        let verified = null
        let output = '（未配置验证命令，仅登记声明）' + (cmdNote || '')
        if (cmd) {
          const r = await runVerify(cmd)
          verified = r.verified
          output = r.output
        }
        const sid = execCtx && execCtx.agent && execCtx.agent.session ? String(execCtx.agent.session.id) : '(none)'
        if (verified !== false) {
          pruneGateOk()
          live.gateOk.set(sid, { claim, verified, at: new Date().toISOString() })
          live.objections.delete(sid)
        }
        log({ event: 'gate', session: sid, verified, claim: claim.slice(0, 80) })
        if (verified === false) {
          return '[BLOCKED] 验证失败，未通过门禁。输出:\n' + (output || '(empty)')
        }
        return '✅ 完成门禁通过（verified=' + String(verified) + '）\nclaim: ' + claim + '\n输出: ' + output.slice(0, 400)
      } catch (error) {
        return '[BLOCKED] frugality_gate 执行异常: ' + String(error)
      }
    },
  }
  registerToolSafe(ctx, tool)
}

function hookTurnStopping(ctx) {
  if (!cfg.gateEnabled) return
  ctx.on('agent/turn-stopping', (payload) => {
    try {
      const agent = payload.agent
      const sid = agent && agent.session ? String(agent.session.id) : ''
      if (!sid || live.gateOk.get(sid)) return
      const tail = lastAssistantTail(agent.session)
      if (!looksLikeCompletion(tail)) return
      const n = live.objections.get(sid) || 0
      if (n >= cfg.gateMax) {
        log({ event: 'gate-object', session: sid, action: 'max-reached', n })
        return
      }
      live.objections.set(sid, n + 1)
      agent.steer({
        id: `frugality-gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        source: { kind: 'plugin', plugin: PLUGIN },
        content: [{ type: 'text', text: GATE_OBJECTION }],
      })
      log({ event: 'gate-object', session: sid, n: n + 1 })
    } catch (error) {
      log({ event: 'gate-object-error', error: String(error) })
    }
  })
}

// ── C. role-router: frugality_review cheap-review lane ─────────────────────
async function pickReviewModel(ctx, provider) {
  if (cfg.reviewModel) return cfg.reviewModel
  try {
    const models = await ctx.llm.listModels(provider)
    if (Array.isArray(models)) {
      for (const m of models) {
        const id = String((m && m.id) || '')
        if (id && cheapModelOf(id)) return id
      }
    }
  } catch { /* catalog unavailable */ }
  return null
}

function registerReview(ctx) {
  const tool = {
    name: 'frugality_review',
    description: '低成本审查 lane：用便宜模型（非主模型）审查一段代码/diff（或白名单扩展名内的本地文件，SPEC §7.2），输出 verdict + findings。机械检查（编译/测试）请用 frugality_gate 的验证命令。',
    parameters: {
      target: { type: 'string', required: true, description: '待审文本/diff，或白名单扩展名的本地文件路径（≤256KB）' },
      mode: { type: 'string', enum: ['quick', 'deep'], description: 'quick=快速4维；deep=深入审查（默认 quick）' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    async execute(args, execCtx) {
      try {
        let text = String((args && args.target) || '')
        // SPEC §7.2：文件读取白名单（扩展名 + 大小 + 必须是文件）
        if (text.length < 4000 && existsSync(text)) {
          const lower = text.toLowerCase()
          const allowed = REVIEW_FILE_EXTS.some((ext) => lower.endsWith(ext))
          if (allowed) {
            try {
              const st = statSync(text)
              if (st.isFile() && st.size <= 256 * 1024) text = readFileSync(text, 'utf8')
            } catch { /* keep text */ }
          }
        }
        if (!text.trim()) return '[BLOCKED] 空 target（不是文件且无文本）'
        const agent = execCtx && execCtx.agent
        const options = (agent && agent.options) || {}
        const provider = String(options.provider || '')
        if (!provider) return '[BLOCKED] 无 provider 路由，无法发起审查'
        const model = await pickReviewModel(ctx, provider)
        if (!model) return '[BLOCKED] 未找到廉价模型（catalog 无 flash/chat/mini 类；可用 DSH_FRUGALITY_REVIEW_MODEL 指定）'
        const mode = String((args && args.mode) || 'quick')
        const prompt = reviewPromptFor(text, mode)
        let out = ''
        const stream = ctx.llm.stream({
          provider,
          model,
          messages: [{ id: `frug-review-${Date.now()}`, role: 'user', content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }],
          maxTokens: mode === 'deep' ? 2000 : 800,
          reasoningEffort: 'off',
        })
        for await (const chunk of stream) {
          if (chunk.type === 'text-delta') out += chunk.text
        }
        const parsed = parseFindings(out)
        live.reviews += 1
        live.reviewFindings += parsed.findings.length
        log({ event: 'review', model, mode, verdict: parsed.verdict, findings: parsed.findings.length })
        const lines = parsed.findings.slice(0, 10).map((f, i) =>
          `  ${i + 1}. [${f.severity}] ${String(f.problem || '').slice(0, 200)}\n      fix: ${String(f.fix || '').slice(0, 200)}`)
        return `[frugality_review · ${model} · ${mode}]\nverdict: ${parsed.verdict}\nfindings: ${parsed.findings.length}${lines.length ? '\n' + lines.join('\n') : ''}`
      } catch (error) {
        return '[BLOCKED] frugality_review 异常: ' + String(error)
      }
    },
  }
  registerToolSafe(ctx, tool)
}

// ── ledger stats tool ───────────────────────────────────────────────────────
function registerLedger(ctx) {
  const tool = {
    name: 'frugality_ledger',
    description: '读取台账：本插件统计的跨 agent 读取/重复读取/字节（含持久化恢复）、完成门禁状态与审查计数。用于发现"子智能体重复读取烧 token"这类内耗（重复率高 → 应减少并行子智能体或改用已读清单）。',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    execute() {
      try {
        let totalReads = 0
        let totalDups = 0
        let totalBytes = 0
        const agents = [...live.perAgent.entries()].map(([id, r]) => {
          totalReads += r.reads
          totalDups += r.dups
          totalBytes += r.bytes
          const rate = r.reads ? Math.round((r.dups / r.reads) * 100) : 0
          return `${r.label} (${id.slice(0, 16)}): reads=${r.reads} dups=${r.dups} (${rate}%) bytes=${(r.bytes / 1024).toFixed(0)}KB`
        })
        const dupRate = totalReads ? Math.round((totalDups / totalReads) * 100) : 0
        const recent = live.lastReads.slice(-10).map((e) =>
          `${(e.at || '').slice(11, 16)} ${e.agent} ${e.dup ? '⚠重复' : '·'} ${e.target}`)
        const gates = [...live.gateOk.entries()].slice(-5).map(([sid, g]) =>
          `${sid.slice(0, 16)} verified=${g.verified} @ ${g.at.slice(11, 16)} claim=${String(g.claim).slice(0, 40)}`)
        const dedupLabel = cfg.dedupReplace ? 'on' : 'off'
        return [
          '=== frugality ledger（内存 + JSONL 恢复）===',
          `agents: ${live.perAgent.size} | reads: ${totalReads} | dup-reads: ${totalDups} (${dupRate}%) | bytes: ${(totalBytes / 1024).toFixed(0)}KB`,
          `dedupReplace=${dedupLabel} saved=${live.dedupSaves} | reviews=${live.reviews} findings=${live.reviewFindings} | gate-objections=${live.objections.size}`,
          '--- per-agent ---',
          ...(agents.length ? agents : ['(no reads yet)']),
          '--- recent reads ---',
          ...(recent.length ? recent : ['(none)']),
          '--- gate ---',
          ...(gates.length ? gates : ['(no gate passes)']),
        ].join('\n')
      } catch (error) {
        return '[BLOCKED] ledger 异常: ' + String(error)
      }
    },
  }
  registerToolSafe(ctx, tool)
}

function registerToolSafe(ctx, tool) {
  try {
    ctx.effect(() => ctx.tools.register({
      ...tool,
      parameters: toJsonSchema(tool.parameters),
    }))
    return true
  } catch (error) {
    log({ event: 'tool-register-skip', tool: tool.name, error: String(error) })
    return false
  }
}

// ── apply ──────────────────────────────────────────────────────────────────
export function apply(ctx) {
  const restored = loadLedger()
  hookReadLedger(ctx)
  hookDedupReplace(ctx)
  hookImmutableCore(ctx)
  registerGate(ctx)
  hookTurnStopping(ctx)
  registerReview(ctx)
  registerLedger(ctx)
  log({ event: 'apply', dedup: cfg.dedupReplace, gate: cfg.gateEnabled, verify: cfg.verifyCommand || null, restored })
  if (ctx.logger) ctx.logger.info(`[${PLUGIN}] 已激活 (dedup=${cfg.dedupReplace} gate=${cfg.gateEnabled} restored=${restored})`)
}
