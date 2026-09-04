# 市场收录清单（T16）— dsh-agent-frugality

> 收录状态以本文件记录；仓库创建并推送 + topic 设置后执行。

## 收录路径一览（2026-09-02 实测刷新）

| 市场 | 机制 | 状态（实测） |
|---|---|---|
| **[awesome-dsh-plugin](https://awesome-dsh-plugin.com)（curated，必投）** | dsh-market 一键安装的**安装源白名单**；前 5 插件（dsh-repo-setup/dsh-ecc/dsh-ponytail/mattpocock-skills-dsh/…）即在此注册表中 | **PR #4173 已提交**（2026-09-02，经 API 创建：fork yaml fc60f1e + 自证正文），待维护者合并 |
| [AwesomeHou/dsh-plugin-marketplace](https://github.com/AwesomeHou/dsh-plugin-marketplace) | **live-sync GitHub `dsh-plugin` topic** | ✅ topic 已打（`dsh-plugin`/`deepseek-harness`/`multi-agent`），live-sync 自动收录 |
| [chnjames/dsh-plugin-market](https://github.com/chnjames/dsh-plugin-market) | **topic + npm keyword 自动同步**，CI 重建 `website/public/registry.json`；README 无手动提交入口 | 2026-09-02 核查 registry.json 尚无 frugality —— 无需手动操作，等 CI 同步（本包 keywords 含 `dsh-plugin` ✅） |
| [0326/dsh-plugin-market](https://github.com/0326/dsh-plugin-market)（dsh-plugin.market） | **Cloudflare Cron 每小时 topic 发现 + Submit 页面**（审核制）；README 无 PR/issue 提交格式 | 2026-09-02 核查 `GET /api/plugins/gongyijie85/dsh-agent-frugality` = 404 —— 无需手动操作，等每小时 cron 发现；或待站点 Submit 页可用后走表单 |

## awesome-dsh-plugin 收录申请模板（同你前 5 插件路径提交）

```markdown
### 插件收录申请: dsh-agent-frugality

**仓库**: https://github.com/gongyijie85/dsh-agent-frugality
**版本**: v0.1.0（tag） | **npm**: dsh-agent-frugality@0.1.0
**描述**: DeepSeek Harness 对抗多智能体三层机制性失效的防御插件——读取台账去重(read-ledger)、免疫压缩规则区+完成机械门禁(immutable-core+completion-gate)、低成本审查lane(role-router)
**安装**: dsh plugin add github:gongyijie85/dsh-agent-frugality
**Topics**: dsh-plugin / deepseek-harness / dsh / cordis / multi-agent / ai-agents / agent-cost / cost-optimization / token-efficiency / context-management / subagent / completion-gate（12 个，2026-09-02 扩充）

#### 自证清单
- [x] 零运行时依赖（package.json 无 dependencies/peerDependencies；仅 node 内置 + lib/core.js）
- [x] 安全模型（docs/SPEC.md §7）：verify 命令仅宿主配置（工具参数默认忽略，防 RCE）；review 文件读取白名单（扩展名+≤256KB+isFile）；规则文件 8KB 截断；台账/日志不记内容全文
- [x] 测试：node:test 18/18（test/core.test.mjs）
- [x] 独立代码审查：T10 子代理（NEEDS_REVISION→全部 findings 处置，CHANGELOG 0.1.0 段）+ 自举 frugality_review（9 findings）
- [x] 研究免责声明（README）：不背书 "$85K 实验" 幻觉数字，针对有独立证据的机制问题
- [x] MIT License；LICENSE 文件就位

#### 备注
沿用作者此前已收录插件的维护标准（dsh-repo-setup / dsh-ecc / dsh-ponytail / mattpocock-skills-dsh 均为同一仓库体系）。
```

## 自证信息（curated 市场申请用）

- **仓库**：github.com/gongyijie85/dsh-agent-frugality（MIT）
- **安装命令**：`dsh plugin add github:gongyijie85/dsh-agent-frugality`
- **零依赖**：package.json 无 dependencies/peerDependencies（仅 node: 内置 + lib/core.js）
- **安全面**（docs/SPEC.md §7）：verify 命令仅宿主配置（参数 verify 默认忽略，防模型 RCE）；review 文件读取白名单（扩展名 + ≤256KB + isFile）；规则文件 8KB 截断；台账/日志只记 hash+target 不记内容全文
- **测试**：node:test 18/18（test/core.test.mjs）
- **审查**：T10 独立代码审查（NEEDS_REVISION → 全部 findings 处置；CHANGELOG .050 段）
- **研究免责**：不背书"$85K 实验"幻觉数字（README 声明）

## 执行清单（2026-09-02 已执行部分）

```powershell
# 1. 仓库 Settings → Topics 加 dsh-plugin —— ✅ 已设（dsh-plugin/deepseek-harness/multi-agent）
# 2. awesome-dsh-plugin curated 注册表 —— ✅ PR #4173 已提交（2026-09-02，待合并）
# 3. chnjames / 0326 —— 经 README 实测为自动发现通道，无手动提交入口，等同步即可
# 4. Release 资产 + 仓库描述 —— ✅ 已补（tgz 39,524 B；描述已写入）
# 5. 合并后：把 README/TICKETS 的 [ ] 改为 [x]
```
