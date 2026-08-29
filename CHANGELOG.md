# Changelog

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-29

首个可发布版本。研究背景（D:\plugins\research\85k-experiment\）：多智能体系统三类机制性失效（子智能体重复读取、提示词失效、贵模型审查悖论）→ 本插件为 DSH 提供四层机制防御。

### Added

- **read-ledger**：`tools/result` 监听读类工具（read/glob/grep/search/visualize/media_info + mcp 前缀），内容 SHA-1 内容级去重，按 agent 聚合 reads/dups/bytes；`frugality_ledger` 工具查询；`frugality-read-cache` 已读清单注入 system prompt（子智能体自动受益）。
- **JSONL 持久化**（FR-6）：`$DSH_HOME/agent-frugality-ledger.jsonl` 追加写入，启动恢复最近 500 条重建台账。
- **immutable-core**：恒久规则区（`frugality-rules` section，每次组装重渲染，免疫上下文压缩）；内置 4 条默认规则 + `DSH_FRUGALITY_RULES` 文件覆盖（8KB 上限）。
- **completion-gate**：`frugality_gate` 工具（claim + 验证命令 exit 0 才通过）+ `agent/turn-stopping` 完成性声明检测（无凭证 → steer 塞回，≤GATE_MAX 次防死循环）。
- **review-lane**：`frugality_review` 工具，自动选择 CHEAP 族模型（DSH_FRUGALITY_REVIEW_MODEL 可覆盖）独立审查，输出 verdict+findings；文件 target 仅白名单扩展名 + ≤256KB（SPEC §7.2）。
- **DEDUP 干预层**（默认 off）：`DSH_FRUGALITY_DEDUP=1` 时同内容第 ≥2 次读取替换为摘要提示（先度量后干预）。
- **安全模型**（SPEC §7）：gate 验证命令仅宿主配置（参数 verify 默认忽略，防模型 RCE）；日志不记录内容全文。
- **测试**：`test/core.test.mjs`，node:test 零依赖，14 用例（toJsonSchema/isReadTool/targetOf/duplicateOf/parseFindings/looksLikeCompletion/reviewPromptFor 等）。

### Fixed

- 工具参数 schema 非法崩溃：`parameters` 扁平 map → `toJsonSchema` 编译为合规 JSON Schema（`type:"object"` + properties + required）。
- `isReadTool` 对 `mcp__<server>__<tool>` 组合名漏判 → token 化匹配。
- 完成正则漏 `fixed/implemented` 类完成语。
- **T10 独立审查修复（2026-08-29，8 findings → 4 修复 + 1 部分采纳 + 3 误报/豁免）**：
  - 已读清单注入显示 `NaNKB` → 记账统一走 `applyRead`（lastReads 带 bytes；回归测试锁住）。
  - `loadLedger` 恢复时 count 复利膨胀 → `foldLedgerLine` 按窗口内出现次数重建（回归测试锁住）。
  - DEDUP 干预层第 2 次读取未触发 → 判定改为「任何重复即替换」（FR-2 语义）。
  - §7.4 安全偏差：ledger 持久化写入内容摘要 → 只记 hash + target + 元数据。
  - 记账/恢复路径无测试 → `applyRead`/`foldLedgerLine` 纯函数化 + 2 组边界用例（共 18/18 全绿）。
  - suppressed 键不对称/泄漏 → 统一 `rootCallId || token`，error 结束路径同样消费。
  - FR-6 预算未强制 → 启动读取改为尾部 ≤512KB（`openSync` 定位读）。
  - 误报/豁免：gate 无强制机制（turn-stopping 即机制，实测拦截成功）、count 访问逻辑正确、`?v=` 查询串（mode-boost 生态先例）、steer 用 raw 对象（注入环境无法 import createUserMessage，与 mode-boost 同款且实测可用）。
- 发布阻断项：脚手架 `src/index.ts`/`tsconfig`/`tsdown.config`（与真实实现冲突、构建会覆盖 lib/）→ `scripts/build.sh` 改为 no-op + `.gitignore` 忽略残留 + README 说明（JS 直出无编译）。

### Known limitations

- 台账内存 + JSONL 恢复；无 SQLite/去重窗口配置。
- 完成门禁为 objection 循环（DSH 无 veto 原语），上限 2 次。
- 无 UI 面板（P2 计划内）。

### 研究免责声明（科研诚实）

本插件不背书"8.5 万美元多智能体实验"中的任何具体数字（54.7% 重复读取 / 243→311 提交 / Opus 23.9% 等经核实无一手出处，属生成式摘要幻觉，详见 research/01-primary-source.md）。插件针对的是有独立证据的机制性问题：子智能体重复读取（Claude Code issue #46968/#45660、Jack Maguire 实测 70-90% 节省）、提示词失效需机制约束（Anthropic Building effective agents）、模型按价值分层（Anthropic multi-agent research system、RouteLLM 生态）。
