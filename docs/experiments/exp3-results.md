# Exp-3 结果：review-lane 双臂对照（cheap vs strong）

> 生成于 2026-08-29T09:39Z；样本 12 份（金标准 = T10/自举审查 findings）；提示词与 frugality_review 一致（公平对照）。

| 臂 | 模型 | 命中/金标准 | recall | 误报 | 估算成本 | 每美元命中 |
|---|---|---|---|---|---|---|
| cheap | deepseek-v4-flash | 9/11 | 81.8% | 1 | $0.0329 | 273.2 |
| strong | deepseek-v4 | 11/11 | 100.0% | 0 | $0.0666 | 165.3 |

**verdict: PASS(cheap per-dollar >= 1.5x strong)**

## 逐样本

| 样本 | 金标准 | cheap 命中 | cheap 误报 | strong 命中 | strong 误报 |
|---|---|---|---|---|---|
| S01 工具参数 schema 非法（扁平 map 未经 | 1 | 1 | 1 | 1 | 0 |
| S02 isReadTool 对 mcp__<serve | 1 | 1 | 0 | 1 | 0 |
| S03 完成正则漏 'fixed/implemented | 1 | 1 | 0 | 1 | 0 |
| S04 已读清单注入显示 NaNKB（lastReads | 1 | 0 | 0 | 1 | 0 |
| S05 loadLedger count 复利膨胀 | 1 | 1 | 0 | 1 | 0 |
| S06 DEDUP off-by-one：第 2 次读取 | 1 | 0 | 0 | 1 | 0 |
| S07 台账持久化写入内容摘要（§7.4 违反） | 1 | 1 | 0 | 1 | 0 |
| S08 suppressed 键不对称与 error 路 | 1 | 1 | 0 | 1 | 0 |
| S09 验证命令未净化（命令注入面） | 1 | 1 | 0 | 1 | 0 |
| S10 gateOk 无界增长 | 1 | 1 | 0 | 1 | 0 |
| S11 规则文件 8KB 截断切断多字节字符 | 1 | 1 | 0 | 1 | 0 |
| S12 审查模型选择绝不静默回落主模型（正样本） | 0 | 0 | 0 | 0 | 0 |

## 说明

- 金标准仅计 severity != none 的条目（S12 为正样本控制，不计入 recall 分母）。
- 命中=findings 与金标准 problem 显著关键词重叠；重叠之外视为误报。
- 成本为估算（提示+目标+输出，本机价格表）；实际以账单为准。
