# 市场收录清单（T16）— dsh-agent-frugality

> 收录状态以本文件记录；仓库创建并推送 + topic 设置后执行。

## 收录路径一览

| 市场 | 机制 | 动作 |
|---|---|---|
| [AwesomeHou/dsh-plugin-marketplace](https://github.com/AwesomeHou/dsh-plugin-marketplace) | **live-sync GitHub `dsh-plugin` topic**（1800+ repos，设置页搜索/一键安装 + `market_search`/`market_install` agent tools） | 仅需仓库加 topic `dsh-plugin` → **自动收录**（无需 PR） |
| [chnjames/dsh-plugin-market](https://github.com/chnjames/dsh-plugin-market) | 公开目录站 + 一键安装；插件目录站浏览/复制安装命令 | 仓库上 topic 后确认站内可见；否则按该仓库 README 提 PR/issue |
| [0326/dsh-plugin-market](https://github.com/0326/dsh-plugin-market) | curated 市场（审核制） | 提交收录申请（含安全自证）——README 要求的格式 |

## 自证信息（curated 市场申请用）

- **仓库**：github.com/gongyijie85/dsh-agent-frugality（MIT）
- **安装命令**：`dsh plugin add github:gongyijie85/dsh-agent-frugality`
- **零依赖**：package.json 无 dependencies/peerDependencies（仅 node: 内置 + lib/core.js）
- **安全面**（docs/SPEC.md §7）：verify 命令仅宿主配置（参数 verify 默认忽略，防模型 RCE）；review 文件读取白名单（扩展名 + ≤256KB + isFile）；规则文件 8KB 截断；台账/日志只记 hash+target 不记内容全文
- **测试**：node:test 18/18（test/core.test.mjs）
- **审查**：T10 独立代码审查（NEEDS_REVISION → 全部 findings 处置；CHANGELOG .050 段）
- **研究免责**：不背书"$85K 实验"幻觉数字（README 声明）

## 执行清单（仓库就绪后）

```powershell
# 1. 仓库 Settings → Topics 加 dsh-plugin（AwesomeHou 自动收录）
# 2. curl 目录站确认 https://github.com/chnjames/dsh-plugin-market 可见性
# 3. 0326/dsh-plugin-market 提 PR/issue（用上方自证信息）
# 4. release 后 @AwesomeHou 类 sync 型在数小时内出现
```
