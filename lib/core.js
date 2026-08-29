/**
 * dsh-agent-frugality core — 纯函数与常量（可测试，零外部依赖）。
 * 契约以 docs/SPEC.md 为准。index.js 从本模块 import 并做宿主侧装配。
 */
import { createHash } from 'node:crypto'

/** 内置恒久规则（被 DSH_FRUGALITY_RULES 文件覆盖）。 */
export const DEFAULT_RULES = [
  '[恒久规则 - frugality 插件在每次系统组装时机械注入；上下文压缩无法移除]',
  '1. 完成声明前必须运行验证（测试/构建/复查），以工具输出为准；未验证不得声称已通过。',
  '2. 引用文件内容、命令输出时必须来自本次会话的实际工具结果；不得补全或编造。',
  '3. 删除文件、危险命令、修改配置、扩大改动范围前需征得用户确认。',
  '4. 任务完成时给出简短交付说明：做了什么、验证了什么、还剩什么未做。',
].join('\n')

/** 内置读类工具识别子串（含 mcp__<server>__<tool> 形态）。 */
export const READ_PATTERNS = ['read', 'glob', 'grep', 'search', 'visualize', 'media_info']

/** frugality_review 允许直接读取的文件扩展名（SPEC §7.2 白名单）。 */
export const REVIEW_FILE_EXTS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.md', '.json', '.yml', '.yaml', '.txt', '.css', '.html', '.go', '.rs', '.java', '.mjs', '.cjs']

/** 完成门禁 objection 文案（模型可行动）。 */
export const GATE_OBJECTION = '⛔ 完成门禁：检测到完成性声明，但本回合尚未通过 frugality_gate 检查。' +
  '请先调用 frugality_gate 工具（给出完成声明 claim；如配置了验证则命令必须 exit 0），再宣布完成。'

/** 读类工具判定：精确名 / 后缀 `_name`/`__name`/`.`/`-` / 名字段 token（如 mcp__srv__read_image → [mcp,srv,read,image] 含 read）。大小写不敏感。 */
export function isReadTool(toolName, patterns = READ_PATTERNS) {
  if (typeof toolName !== 'string' || !toolName) return false
  const n = toolName.toLowerCase()
  for (const p of patterns) {
    const lp = String(p).toLowerCase()
    if (!lp) continue
    if (n === lp) return true
    if (n.endsWith('_' + lp) || n.endsWith('.' + lp) || n.endsWith('__' + lp) || n.endsWith('-' + lp)) return true
    for (const token of n.split(/[_\-.]+/)) if (token === lp) return true
  }
  return false
}

/** 递归提取 model-facing content blocks 中的全部文本。 */
export function extractText(content) {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') out += block.text
    else if (block.type === 'tool-result' && Array.isArray(block.content)) out += extractText(block.content)
  }
  return out
}

/** SHA-1 内容哈希（去重键）。 */
export function sha1(text) {
  return createHash('sha1').update(text).digest('hex')
}

/** 从工具参数提取 target 标签（path/pattern/url/file 等字段，截断 120）。 */
export function targetOf(toolName, args) {
  try {
    const a = args && typeof args === 'object' ? args : JSON.parse(String(args || ''))
    if (!a || typeof a !== 'object') return String(args || toolName).slice(0, 80)
    for (const key of ['path', 'file_path', 'file', 'pattern', 'url', 'target', 'query']) {
      if (a[key] !== undefined) {
        if (typeof a[key] === 'string') return a[key].slice(0, 120)
        return String(a[key]).slice(0, 120)
      }
    }
  } catch { /* unparsable */ }
  return String(toolName).slice(0, 60)
}

/** 扁平参数 map → 合规 JSON Schema（SPEC §8：type:"object" + properties + required）。 */
export function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: (meta && typeof meta === 'object' && meta.type) || 'string' }
    if (meta && typeof meta === 'object') {
      if (Array.isArray(meta.enum)) prop.enum = meta.enum
      if (meta.description) prop.description = meta.description
      if (meta.required) required.push(key)
    }
    properties[key] = prop
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

/** 台账重复判定：contentHash 已存在 → {dup:true, count, summary}。 */
export function duplicateOf(hashIndex, hash) {
  const prev = hashIndex && hashIndex.get ? hashIndex.get(hash) : undefined
  if (prev === undefined) return { dup: false, count: 0, summary: '' }
  return { dup: true, count: prev.count || 1, summary: prev.summary || '' }
}

/** 模型 id 是否为 CHEAP 族（审查 lane 用）。 */
export function cheapModelOf(modelId) {
  if (/flash|chat|mini|turbo|haiku|lite|air|nano/i.test(modelId || '')) return modelId
  return null
}

/** 最近 assistant 消息文本尾部（完成性检测输入）。 */
export function lastAssistantTail(session) {
  try {
    const events = session && Array.isArray(session.events) ? session.events : []
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]
      if (e && e.type === 'assistant/message' && e.data && e.data.message) {
        const blocks = (e.data.message.content || []).filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        const text = blocks.map((b) => b.text).join(' ').trim()
        if (text) return text.slice(-200)
      }
    }
  } catch { /* ignore */ }
  return ''
}

/** 完成性声明检测（中英正负例见测试）。 */
export function looksLikeCompletion(text) {
  return /(完成|搞定|已交付|done|finished|completed|complete|all done|wrapped up|ready to ship|fixed|implemented)/i.test(text || '')
}

/** 审查提示词生成（quick/deep 4 维）。 */
export function reviewPromptFor(targetText, mode) {
  const depth = mode === 'deep'
    ? '深入审查：正确性（含边界/错误处理）、性能、安全（注入/泄露/权限）、复用（是否重复造轮子）。'
    : '快速审查：正确性、明显性能问题、明显安全风险、明显重复实现。'
  return 'You are a code reviewer for AI-generated work.\n' + depth + '\n' +
    '输出单个 JSON 对象（其余不要）：{"verdict":"pass"|"needs_revision","findings":[{"severity":"low"|"medium"|"high","problem":"...","fix":"..."}]}\n' +
    '没有问题时 findings 为空数组。\n\n=== 待审目标 ===\n' + String(targetText || '').slice(0, 12000)
}

/** 审查模型输出解析：提取首个 JSON 对象，容错。 */
export function parseFindings(text) {
  try {
    const m = String(text).match(/\{[\s\S]*\}/)
    if (!m) return { verdict: 'unknown', findings: [] }
    const obj = JSON.parse(m[0])
    return {
      verdict: String(obj.verdict || 'unknown'),
      findings: Array.isArray(obj.findings) ? obj.findings : [],
    }
  } catch { /* not JSON */ }
  return { verdict: 'unknown', findings: [] }
}

/**
 * 验证命令净化（SPEC §7.1 强化）：拒绝 shell 元字符（; & | ` $ < > 换行 等），
 * 只允许简单命令（可含空格参数）。返回 {ok, cmd} 或 {ok:false, reason}。
 */
export function sanitizeVerify(command) {
  const cmd = String(command || '').trim()
  if (!cmd) return { ok: true, cmd: '' }
  if (/[\u0000-\u001f;|&`$<>(){}[\]]/.test(cmd)) {
    return { ok: false, reason: 'contains shell metacharacters' }
  }
  if (/\b(rm|del|format|shutdown|reboot|rd)\b/i.test(cmd)) return { ok: false, reason: 'destructive command keyword' }
  return { ok: true, cmd }
}

/** UTF-16 surrogate 安全截断（避免截断 emoji/多字节字符尾部）。 */
export function safeSlice(text, max) {
  let s = String(text || '').slice(0, max)
  if (/[\uD800-\uDBFF]$/.test(s)) s = s.slice(0, -1)
  return s
}

/**
 * 对台账状态应用一条读取记录（纯逻辑，可测）。
 * state = { hashIndex: Map, perAgent: Map, lastReads: [] }。
 * entry = { text, at?, agentId?, label?, target? }。
 * 返回 { dup, count, bytes, hash }（count 为更新后的累计）。
 */
export function applyRead(state, entry) {
  const { hashIndex, perAgent, lastReads } = state
  const text = String(entry.text || '')
  const hash = entry.hash || sha1(text)
  const at = entry.at || new Date().toISOString()
  const agentId = entry.agentId || '(none)'
  const label = entry.label || agentId
  const target = entry.target || ''
  const bytes = text.length

  const prev = hashIndex.get(hash)
  const dup = prev !== undefined
  if (prev === undefined) {
    hashIndex.set(hash, { firstAgent: agentId, firstLabel: label, firstTarget: target, firstAt: at, count: 1, summary: text.slice(0, 600) })
  } else {
    prev.count += 1
    if (!prev.summary) prev.summary = text.slice(0, 600)
  }
  const count = prev ? prev.count : 1

  const rec = perAgent.get(agentId) || { label, reads: 0, dups: 0, bytes: 0, lastAt: at }
  rec.reads += 1
  if (dup) rec.dups += 1
  rec.bytes += bytes
  rec.lastAt = at
  perAgent.set(agentId, rec)

  lastReads.push({ at, agent: label, agentId, target, hash, dup, bytes })
  if (lastReads.length > 120) lastReads.shift()
  return { dup, count, bytes, hash }
}

/**
 * 从一行持久化记录折叠进台账状态（启动恢复用）。
 * count 按窗口内出现次数重建（每行计 1 次），不做累计值复利。
 */
export function foldLedgerLine(state, e) {
  if (!e || !e.hash) return false
  const { hashIndex, perAgent, lastReads } = state
  const prev = hashIndex.get(e.hash)
  if (prev === undefined) {
    hashIndex.set(e.hash, { firstAgent: e.agentId || '', firstLabel: e.agentLabel || '', firstTarget: e.target || '', firstAt: e.at || '', count: 1, summary: '' })
  } else {
    prev.count += 1
  }
  const aid = e.agentId || '(none)'
  const rec = perAgent.get(aid) || { label: e.agentLabel || aid, reads: 0, dups: 0, bytes: 0, lastAt: e.at || '' }
  rec.reads += 1
  if (e.dup) rec.dups += 1
  rec.bytes += e.bytes || 0
  rec.lastAt = e.at || rec.lastAt
  perAgent.set(aid, rec)
  lastReads.push({ at: e.at || '', agent: e.agentLabel || aid, agentId: e.agentId || aid, target: e.target || '', hash: e.hash, dup: !!e.dup, bytes: e.bytes || 0 })
  if (lastReads.length > 120) lastReads.shift()
  return true
}
