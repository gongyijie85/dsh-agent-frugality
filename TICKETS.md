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

- [ ] **T10 独立代码审查**：子代理审查进行中（SPEC 一致性/§7 安全/§8 接口/运行时正确性/测试覆盖/发布阻断项）
- [ ] **T11 修复 + 复审**：T10 findings 全部关闭或明确豁免；修复后重跑 T09

## Phase 4 — 发布（需用户确认的边界动作）

- [ ] **T12 仓库初始化**：`git init`（main）→ `.gitignore`（node_modules/tgz/logs）→ 初始 commit（规范 message）
- [ ] **T13 GitHub 仓库**：创建远程仓库（用户账户 gongyijie85/dsh-agent-frugality 或用户指定）+ push + `topic: dsh-plugin`（供 topic 同步型 marketplace 收录）
- [ ] **T14 tag + Release**：`v0.1.0` tag → GitHub Release（notes=CHANGELOG 0.1.0 段）→ 附件 tgz（`npm pack` 产物）
- [ ] **T15 npm（可选，待用户确认）**：npm publish 前确认 scope/凭据；发布后 `dsh plugin add` 可直接装
- [ ] **T16 市场收录**：确认 ≥1 家 marketplace 收录（AwesomeHou/dsh-plugin-marketplace 为 topic 同步自动收录；chnjames/dsh-plugin-market 提交 PR/issue）；记录收录状态到发布说明

## Phase 5 — 推广包装

- [ ] **T17 发布公告**：`docs/POST.md`（中文版）——研究背景（真实结论+幻觉数字澄清）、三层失效、方案机制、使用示例（三个工具截图式文本）、安装命令、免责声明
- [ ] **T18 宣传物料**：X/Twitter thread 草稿（EN，7 条）、中文社区/公众号长文要点（含研究故事线）、HN Show HN 草稿、dsh 社区/群公告模板
- [ ] **T19 发布日执行清单**：发布顺序（GitHub→npm→市场→公告），每步验证命令

## 依赖图

```
T03 → T04 → T09 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17/T18
  └→ T05 → T06 → T07 → T08 ─────────┘
```
