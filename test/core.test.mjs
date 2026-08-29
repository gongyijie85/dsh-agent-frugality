/**
 * dsh-agent-frugality core 纯函数测试（node:test，零依赖）。
 * 运行：node --test test/
 * 契约：docs/SPEC.md §8/FR/§7
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_RULES, READ_PATTERNS, GATE_OBJECTION, REVIEW_FILE_EXTS,
  isReadTool, extractText, sha1, targetOf, toJsonSchema, duplicateOf,
  cheapModelOf, lastAssistantTail, looksLikeCompletion, reviewPromptFor, parseFindings,
  sanitizeVerify, safeSlice, applyRead, foldLedgerLine,
} from '../lib/core.js'

/** 构造一个测试用 live 状态（与 index.js 结构一致）。 */
function newState() {
  return { hashIndex: new Map(), perAgent: new Map(), lastReads: [] }
}

test('toJsonSchema: 扁平 map → 合规 JSON Schema', () => {
  const s = toJsonSchema({ claim: { type: 'string', required: true, description: 'x' } })
  assert.equal(s.type, 'object')
  assert.deepEqual(s.required, ['claim'])
  assert.equal(s.properties.claim.type, 'string')
  assert.equal(s.properties.claim.description, 'x')
  assert.equal(s.additionalProperties, false)
})

test('toJsonSchema: 空 map 与 enum', () => {
  const empty = toJsonSchema({})
  assert.equal(empty.type, 'object')
  assert.deepEqual(empty.properties, {})
  assert.deepEqual(empty.required, [])
  const e = toJsonSchema({ mode: { type: 'string', enum: ['quick', 'deep'] } })
  assert.deepEqual(e.properties.mode.enum, ['quick', 'deep'])
})

test('isReadTool: 精确/后缀/大小写/负例', () => {
  assert.equal(isReadTool('read'), true)
  assert.equal(isReadTool('Read'), true)
  assert.equal(isReadTool('mcp__qwen-mm-plugins-core__read_image'), true)
  assert.equal(isReadTool('mcp__srv__visualize'), true)
  assert.equal(isReadTool('grep'), true)
  assert.equal(isReadTool('write'), false)
  assert.equal(isReadTool('edit'), false)
  assert.equal(isReadTool(''), false)
  assert.equal(isReadTool(null), false)
  assert.equal(isReadTool('readme'), false) // 子串不是后缀
})

test('isReadTool: 自定义 patterns', () => {
  assert.equal(isReadTool('cat_file', ['cat']), true)
  assert.equal(isReadTool('write', ['cat']), false)
})

test('sha1: 确定性', () => {
  assert.equal(sha1('abc'), sha1('abc'))
  assert.notEqual(sha1('abc'), sha1('abd'))
  assert.equal(sha1('abc').length, 40)
})

test('targetOf: 各参数字段与回退', () => {
  assert.equal(targetOf('read', { path: '/a/b.ts' }), '/a/b.ts')
  assert.equal(targetOf('grep', { pattern: 'foo' }), 'foo')
  assert.equal(targetOf('read', { file: '/x' }), '/x')
  assert.equal(targetOf('read', { url: 'https://x' }), 'https://x')
  assert.equal(targetOf('read', {}), 'read')
  assert.equal(targetOf('read', 'not-json{'), 'read')
  assert.equal(targetOf('read', JSON.stringify({ query: 'q' })), 'q')
  assert.ok(targetOf('read', { path: 'x'.repeat(200) }).length <= 120)
})

test('extractText: 递归提取', () => {
  assert.equal(extractText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'ab')
  assert.equal(extractText([{ type: 'tool-result', content: [{ type: 'text', text: 'c' }] }]), 'c')
  assert.equal(extractText([{ type: 'image' }]), '')
  assert.equal(extractText('not-array'), '')
  assert.equal(extractText(null), '')
})

test('duplicateOf: 首次/重复/无 map', () => {
  const m = new Map()
  assert.equal(duplicateOf(m, 'h1').dup, false)
  m.set('h1', { count: 3, summary: 's' })
  const d = duplicateOf(m, 'h1')
  assert.equal(d.dup, true)
  assert.equal(d.count, 3)
  assert.equal(d.summary, 's')
  assert.equal(duplicateOf(undefined, 'h1').dup, false)
})

test('parseFindings: 纯 JSON/前缀/垃圾/空', () => {
  const ok = parseFindings('{"verdict":"pass","findings":[]}')
  assert.equal(ok.verdict, 'pass')
  assert.deepEqual(ok.findings, [])
  const prefix = parseFindings('Here you go:\n{"verdict":"needs_revision","findings":[{"severity":"high","problem":"p","fix":"f"}]}')
  assert.equal(prefix.verdict, 'needs_revision')
  assert.equal(prefix.findings.length, 1)
  assert.equal(prefix.findings[0].severity, 'high')
  assert.deepEqual(parseFindings('no json at all'), { verdict: 'unknown', findings: [] })
  assert.deepEqual(parseFindings(''), { verdict: 'unknown', findings: [] })
  assert.deepEqual(parseFindings('{"verdict":"x","findings":"not-array"}'), { verdict: 'x', findings: [] })
})

test('looksLikeCompletion: 中英正负例', () => {
  assert.equal(looksLikeCompletion('完成了，测试全部通过'), true)
  assert.equal(looksLikeCompletion('All done, shipped.'), true)
  assert.equal(looksLikeCompletion('fix: bug fixed'), true)
  assert.equal(looksLikeCompletion('下面继续处理数据'), false)
  assert.equal(looksLikeCompletion('请修改文件'), false)
  assert.equal(looksLikeCompletion(''), false)
})

test('cheapModelOf: CHEAP 族识别', () => {
  assert.equal(cheapModelOf('deepseek-v4-flash'), 'deepseek-v4-flash')
  assert.equal(cheapModelOf('chat-something'), 'chat-something')
  assert.equal(cheapModelOf('deepseek-v4-pro'), null)
  assert.equal(cheapModelOf(null), null)
  assert.equal(cheapModelOf(''), null)
})

test('lastAssistantTail: 最近 assistant 尾部', () => {
  const session = { events: [
    { type: 'user/message', data: { message: { content: [{ type: 'text', text: 'hi' }] } } },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'first' }] } } },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'tail_' + 'x'.repeat(500) }] } } },
  ] }
  const tail = lastAssistantTail(session)
  assert.ok(tail.endsWith('x'))
  assert.equal(tail.length, 200)
  assert.equal(lastAssistantTail({ events: [] }), '')
  assert.equal(lastAssistantTail(null), '')
  assert.equal(lastAssistantTail({ events: [{ type: 'assistant/message', data: {} }] }), '')
})

test('reviewPromptFor: quick/deep 与截断', () => {
  const quick = reviewPromptFor('x', 'quick')
  const deep = reviewPromptFor('x', 'deep')
  assert.notEqual(quick, deep)
  assert.ok(quick.includes('快速审查'))
  assert.ok(deep.includes('深入审查'))
  const big = reviewPromptFor('y'.repeat(30000), 'quick')
  assert.ok(big.length < 12500) // target 截断 12000 + 前缀 <500
})

test('常量完整性', () => {
  assert.ok(DEFAULT_RULES.includes('验证'))
  assert.ok(READ_PATTERNS.includes('read'))
  assert.ok(GATE_OBJECTION.includes('frugality_gate'))
  assert.ok(REVIEW_FILE_EXTS.includes('.ts'))
  assert.ok(REVIEW_FILE_EXTS.includes('.py'))
})

test('sanitizeVerify: 纯净命令放行、元字符/破坏性关键字拒绝', () => {
  assert.deepEqual(sanitizeVerify('npm test'), { ok: true, cmd: 'npm test' })
  assert.deepEqual(sanitizeVerify('  pytest -q  '), { ok: true, cmd: 'pytest -q' })
  assert.equal(sanitizeVerify('npm test; rm -rf /').ok, false)
  assert.equal(sanitizeVerify('cmd && evil').ok, false)
  assert.equal(sanitizeVerify('echo `id`').ok, false)
  assert.equal(sanitizeVerify('x | y').ok, false)
  assert.equal(sanitizeVerify('rm -rf x').ok, false)
  assert.equal(sanitizeVerify('del /f a.txt').ok, false)
  assert.equal(sanitizeVerify('').ok, true)
  assert.deepEqual(sanitizeVerify(''), { ok: true, cmd: '' })
})

test('safeSlice: surrogate 安全截断', () => {
  assert.equal(safeSlice('abcdef', 3), 'abc')
  const emoji = 'a😀b'
  const s1 = safeSlice(emoji, 2) // 断在 surrogate pair 中间 → 回退
  assert.ok(!/[\uD800-\uDBFF]$/.test(s1))
  assert.ok(s1.length <= 2)
  assert.equal(safeSlice(null, 5), '')
  assert.equal(safeSlice('abc', 100), 'abc')
})

test('applyRead: 首次/重复/bytes 记账（HIGH#1 NaNKB 回归）', () => {
  const st = newState()
  const r1 = applyRead(st, { text: 'hello world', agentId: 'a1', label: 'L1', target: '/x', at: '2026-01-01T00:00:00Z' })
  assert.equal(r1.dup, false)
  assert.equal(r1.count, 1)
  assert.equal(r1.bytes, 11)
  const r2 = applyRead(st, { text: 'hello world', agentId: 'a2', label: 'L2', target: '/x', at: '2026-01-01T00:01:00Z' })
  assert.equal(r2.dup, true)
  assert.equal(r2.count, 2)
  // lastReads 条目必须带 bytes（已读清单渲染依赖）
  const last = st.lastReads[st.lastReads.length - 1]
  assert.equal(last.bytes, 11)
  assert.equal(last.agentId, 'a2')
  // per-agent 聚合
  assert.equal(st.perAgent.get('a1').reads, 1)
  assert.equal(st.perAgent.get('a2').dups, 1)
  assert.equal(st.perAgent.get('a2').reads, 1)
})

test('foldLedgerLine: count 按出现次数重建（HIGH#2 复利回归）', () => {
  const st = newState()
  const lines = [
    { hash: 'h1', agentId: 'a1', agentLabel: 'L1', target: '/x', at: '2026-01-01T00:00:00Z', bytes: 10, dup: false },
    { hash: 'h1', agentId: 'a1', agentLabel: 'L1', target: '/x', at: '2026-01-01T00:01:00Z', bytes: 10, dup: true },
    { hash: 'h1', agentId: 'a1', agentLabel: 'L1', target: '/x', at: '2026-01-01T00:02:00Z', bytes: 10, dup: true },
    { hash: 'h2', agentId: 'a2', agentLabel: 'L2', target: '/y', at: '2026-01-01T00:03:00Z', bytes: 5, dup: false },
  ]
  for (const line of lines) foldLedgerLine(st, line)
  // 3 次出现 → count=3（不是 1+2+3=6 复利）
  assert.equal(st.hashIndex.get('h1').count, 3)
  assert.equal(st.hashIndex.get('h2').count, 1)
  // per-agent 聚合与 lastReads 结构
  assert.equal(st.perAgent.get('a1').reads, 3)
  assert.equal(st.perAgent.get('a1').dups, 2)
  assert.equal(st.lastReads[0].bytes, 10)
  assert.equal(st.lastReads.length, 4)
  assert.equal(foldLedgerLine(st, null), false)
  assert.equal(foldLedgerLine(st, { nope: true }), false)
})
