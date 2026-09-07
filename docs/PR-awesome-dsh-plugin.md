# awesome-dsh-plugin Curated 收录 PR 载荷（v0.1.0）

> 提交目标：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
> 改动：新增 `data/plugins/gongyijie85__dsh-agent-frugality.yml`

## 一、新增文件内容（`data/plugins/gongyijie85__dsh-agent-frugality.yml`）

与注册表现有条目（`gongyijie85__dsh-repo-setup.yml` 等）格式逐字段一致：

```yaml
url: https://github.com/gongyijie85/dsh-agent-frugality
name: gongyijie85/dsh-agent-frugality
category: tools
description:
  en: 'Multi-agent frugality defense plugin: read-ledger dedup metrics, compaction-immune rules, completion gate, cheap-model review lane.'
  zh: '多智能体防内耗防御插件：读取台账去重度量、免疫压缩规则区、完成机械门禁、低成本审查 lane。'
```

## 二、PR 标题

```
Add gongyijie85/dsh-agent-frugality to plugins registry
```

## 三、PR 正文（含自证清单）

```markdown
### 插件收录申请: dsh-agent-frugality

**仓库**: https://github.com/gongyijie85/dsh-agent-frugality
**版本**: v0.1.0（tag + GitHub Release，notes=CHANGELOG 0.1.0 段） | **npm**: dsh-agent-frugality@0.1.0（已发布，registry 200 验证）
**描述**: DeepSeek Harness 对抗多智能体三层机制性失效的防御插件——读取台账去重(read-ledger)、免疫压缩规则区+完成机械门禁(immutable-core+completion-gate)、低成本审查 lane(role-router)
**安装**: `dsh plugin add github:gongyijie85/dsh-agent-frugality`（或 `npm install dsh-agent-frugality`）
**Topics**: dsh-plugin / deepseek-harness / multi-agent（仓库已设置，AwesomeHou live-sync 已满足）

#### 自证清单
- [x] 零运行时依赖（package.json 无 dependencies/peerDependencies；仅 node 内置 + lib/core.js）
- [x] 安全模型（docs/SPEC.md §7）：verify 命令仅宿主配置（工具参数默认忽略，防 RCE）；review 文件读取白名单（扩展名+≤256KB+isFile）；规则文件 8KB 截断；台账/日志不记内容全文
- [x] 测试：node:test 18/18（test/core.test.mjs）
- [x] 独立代码审查：T10 子代理（NEEDS_REVISION→全部 findings 处置，CHANGELOG 0.1.0 段）+ 自举 frugality_review（9 findings）
- [x] 研究免责声明（README）：不背书 "$85K 实验" 幻觉数字，针对有独立证据的机制问题
- [x] MIT License；LICENSE 文件就位

#### 备注
沿用作者此前已收录插件的维护标准（dsh-repo-setup / dsh-ecc / dsh-ponytail / mattpocock-skills-dsh 均为同一仓库体系，已在注册表内）。
```

## 四、提交方式（任选）

1. **网页**（无需工具）：fork awesome-dsh-plugin/awesome-dsh-plugin → 新建 `data/plugins/gongyijie85__dsh-agent-frugality.yml`（内容见第一节）→ PR（标题+正文见第二、三节）。
2. **gh CLI**（本机未装；装好后）：

```powershell
gh repo fork awesome-dsh-plugin/awesome-dsh-plugin --clone
# 新增 data/plugins/gongyijie85__dsh-agent-frugality.yml（内容见第一节）
git add data/plugins/gongyijie85__dsh-agent-frugality.yml
git commit -m "Add gongyijie85/dsh-agent-frugality to plugins registry"
git push -u origin main
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin --title "Add gongyijie85/dsh-agent-frugality to plugins registry" --body "见第三节正文"
```

3. **GitHub API**（需 PAT，repo 权限）：

```powershell
# 1) fork
POST /repos/awesome-dsh-plugin/awesome-dsh-plugin/forks
# 2) 在 fork 上创建/更新 data/plugins/gongyijie85__dsh-agent-frugality.yml（PUT /repos/<you>/awesome-dsh-plugin/contents/...）
# 3) 建 PR
POST /repos/awesome-dsh-plugin/awesome-dsh-plugin/pulls
```

## 五、附带修复（同一批完成）

- [ ] GitHub Release v0.1.0 补资产：上传 `dsh-agent-frugality-0.1.0.tgz`（本地已生成于仓库根目录，38,396 B）
- [ ] 仓库 Description 补一句话：`Multi-agent frugality defense plugin for DeepSeek Harness: read-ledger dedup, compaction-immune rules, completion gate, cheap-review lane.`
- [ ]（可选）chnjames/dsh-plugin-market 按 README 提收录；0326/dsh-plugin-market 按 README 提申请（模板与自证见 docs/MARKETPLACE.md）