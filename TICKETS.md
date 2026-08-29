# TICKETS — dsh-agent-frugality 产品化发布

> 契约以 `docs/SPEC.md` 为准。每个 ticket：目标 / 范围 / 验收 / 依赖。
> 状态：⬜ 未开始 | 🟨 进行中 | ✅ 完成

## Phase 1 — Spec & Tickets（本清单）

- [x] **T01 规格**：`docs/SPEC.md` v1.0 完成（FR/NFR/安全模型/AC/发布要求）
- [x] **T02 任务拆分**：本文件

## Phase 2 — Implement（实现闭环）

- [x] **T03 核心纯函数导出**：`lib/core.js`（14 个导出）+ index.js 引用（`?v=1` 缓存失效）
- [x] **T04 测试套件**：`test/core.test.mjs`（node:test 零依赖）**14/14 全绿**；测试抓出 isReadTool 对 mcp 组合名漏判实 bug 并修复
- [x] **T05 安全加固（SPEC §7）**：verify 参数默认忽略（ALLOW_ARG_VERIFY 门控）；review 文件白名单（扩展名+≤256KB+isFile）；RULES 8KB 截断；READ_PATTERNS 可配
- [x] **T06 台账持久化（FR-6）**：`agent-frugality-ledger.jsonl` 追加 + 恢复最近 500 条；实测 grep 记录落盘验证
- [x] **T07 文档同步**：README 发布级重写（机制图/配置表/目录/免责声明）；package.json 升级（scripts.test/keywords/files/version 0.1.0）；LICENSE(MIT)
- [x] **T08 CHANGELOG**：`CHANGELOG.md`（0.1.0：Added/Fixed/已知限制/研究免责声明）
- [x] **T09 机械检查**：node --check ×2 OK；node --test 14/14；frugality_ledger 冒烟 OK；修复"dedup 预记账-跳过"双记账污染 bug（recordRead 统一入口 + suppressed set）

## Phase 3 — Review（质量门禁）

- [x] **T09 机械检查**：node --check ×2 OK；node --test 18/18；frugality_ledger 冒烟 OK；save后 ledger JSONL 落盘验证
- [x] **T10 独立代码审查**：子代理审查完成 verdict=NEEDS_REVISION（1 blocker + 3 HIGH + 2 medium + 4 low）；`frugality_review` 低成本 lane 同步审查（9 findings，采纳 4/豁免 5）
- [x] **T11 修复 + 复审**：blocker（脚手架 no-op 化）+ 3 HIGH（NaNKB/复利/off-by-one 回归测试锁住）+ §7.4 + suppressed 键统一 + FR-6 预算全部关闭；误报/豁免 3 项记录理由；18/18 全绿

## Phase 4 — 发布（状态：GitHub ✅ / npm ✅ / Release ⏳ / 市场 topic ⏳）

- [x] **T12 仓库初始化**：git init(main) + .gitignore + commit `968d806`（12 文件 / 1398 行）+ tag `v0.1.0`
- [x] **T13 GitHub 仓库**：**gongyijie85/dsh-agent-frugality 已创建并推送**（main @ `87eb0fe` + v0.1.0 tag，2026-08-29 用户执行）
- [ ] **T14 tag + Release**：tag 已推送；GitHub Release 待创建（notes=CHANGELOG 0.1.0 + docs/POST.md，网页 30 秒或授权 gh）
- [x] **T15 npm**：**dsh-agent-frugality@0.1.0 已发布**（npm whoami=gongyijie，registry 200 验证）
- [ ] **T16 市场收录**：待仓库加 topic=dsh-plugin（AwesomeHou 自动同步；chnjames 目录站见 docs/MARKETPLACE.md）

## Phase 5 — 推广包装

- [x] **T17 发布公告**：docs/POST.md（中文）
- [x] **T18 宣传物料**：docs/PROMO.md（X thread 7 条 / Show HN / 中文长文要点）
- [x] **T19 发布日执行清单**：docs/PROMO.md 尾部（git push / Release / 市场 / npm / 公告顺序）

## 依赖图

```
T03 → T04 → T09 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17/T18
  └→ T05 → T06 → T07 → T08 ─────────┘
```
