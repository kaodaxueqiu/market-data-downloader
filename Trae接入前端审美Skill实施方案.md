# Trae IDE 接入 AI 前端审美 Skill 实施方案

**文档版本**：v1.0
**创建日期**：2026-07-11
**适用范围**：使用 Trae IDE 进行前端开发的项目
**执行人**：前端工程师

---

## 一、背景与目标

### 1.1 问题
AI coding agent（包括 Trae 内置 AI）生成的前端界面存在"AI 味"过重的问题——排版模板化、间距生硬、缺乏视觉层次，业内称为 **"AI slop"**。

### 1.2 解决方案
接入两个开源 **Agent Skill**，给 Trae 的 AI 喂入专业前端设计规范。Skill 本质是一份 `SKILL.md` 说明文件 + 配套脚本资源，AI 写代码前会参考其中的设计标准（字体、间距、配色、动效、响应式规则等），而不是套用默认模板。

**这不是 IDE 插件**，不会改变编辑器界面或增加菜单按钮。它改变的是"AI 生成代码时参考的设计标准"。

### 1.3 目标项目（均为真实开源、已核实）

| 项目 | GitHub | Star | 协议 | 定位 |
|---|---|---|---|---|
| **taste-skill** | `Leonxlnx/taste-skill` | 61.6k | MIT | Anti-Slop 前端框架规范，覆盖排版/间距/动效/暗色模式/无障碍 |
| **impeccable** | `pbakaus/impeccable` | 45.3k | Apache-2.0 | 更完整的设计语言体系，含实时调优能力（`impeccable.style`）和 `/impeccable` 系列命令 |

数据核实（GitHub API 实测，2026-07-10）：两个仓库 star/watch/fork/issue 比例健康，非刷量号，均持续维护（最近一次 push 分别为 6 天前、当天）。

---

## 二、前置条件

- [ ] Trae IDE 已安装，版本较新（Skills 功能是 Trae 近期版本才支持，过老版本可能不识别）
- [ ] 本机已装 **Node.js**（`npx` 命令依赖 Node 环境，跑 `node -v` 确认）
- [ ] 项目目录已初始化（Skill 会装到当前项目的 `.trae/skills/` 下）
- [ ] 网络能访问 GitHub（`npx skills add` 需要拉取仓库内容）

---

## 三、实施步骤

### 3.1 安装 taste-skill

在项目根目录打开终端（Trae 自带终端或系统终端均可），执行：

```bash
npx skills add https://github.com/Leonxlnx/taste-skill
```

如果只想装单个具体 skill（而不是仓库里全部 skill），用 `--skill` 参数指定安装名（注意是 `SKILL.md` frontmatter 里的 `name:` 字段，不是文件夹名）：

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

首次运行如果弹出选择"要装到哪个 agent"的提示，**选择 Trae**。

### 3.2 安装 impeccable

```bash
npx skills add https://github.com/pbakaus/impeccable
```

### 3.3 验证安装成功

检查项目下是否生成了对应目录：

```bash
ls .trae/skills/
```

应能看到类似 `design-taste-frontend`、`impeccable` 之类的文件夹，里面包含 `SKILL.md` 及配套脚本/资源文件。

---

## 四、使用方式

安装完成后**无需额外配置**，直接在 Trae 里用自然语言提需求即可，例如：

> "帮我做一个 SaaS 产品的落地页，Hero 区 + 功能介绍 + 定价卡片"

Trae 的 AI 在处理**涉及界面/前端/UI/设计**的需求时，会自动检索并参考已安装的 Skill。

**建议做法**：如果发现 AI 没有主动应用设计规范，可以在提示词里显式提一句，比如：

> "参考 taste-skill 的设计规范，帮我做一个……"

这样能提高命中率。

### 4.1 impeccable 补充能力

impeccable 除了静态设计规范，还提供一套 `/impeccable` 系列命令（在 Trae 对话里以斜杠命令形式使用），常用的包括：

| 命令 | 作用 |
|---|---|
| `/impeccable init` | 初次配置：收集设计上下文，生成 `PRODUCT.md` 和 `DESIGN.md` |
| `/impeccable craft` | 完整的"设计-构建"流程 |
| `/impeccable extract` | 从现有项目代码反推生成 `DESIGN.md` |
| `/impeccable distill` | 提炼可复用组件和设计 token |

首次接入建议先跑一次 `/impeccable init`，让它了解项目的设计上下文。

---

## 五、风险与注意事项

1. **两个 Skill 有一定功能重叠**，都是"给 AI 讲设计规范"，先都装上试用，若冲突或体验重复，可以只保留一个（taste-skill 更轻量专注前端排版，impeccable 更完整但涉及命令体系学习成本略高）。
2. **不保证 100% 生效**——AI 是否严格遵循 Skill 里的规范，取决于 Trae 底层 agent 的执行情况，属于"参考"而非"强制约束"。
3. **两个项目均声明无官方代币/token**，如遇到相关仿冒信息（尤其 taste-skill 的 README 里有专门声明），可判定为诈骗，与本项目无关。
4. 装的时候留意终端输出，如果提示装到了非 Trae 的目录（比如误装到 Claude Code 或 Cursor 的目录），需要检查本机是否同时装了多个 AI IDE 导致识别混淆。

---

## 六、参考链接

- taste-skill 仓库：https://github.com/Leonxlnx/taste-skill
- taste-skill 官网：https://tasteskill.dev
- impeccable 仓库：https://github.com/pbakaus/impeccable
- impeccable 官网：https://impeccable.style
- Trae 官方 Skills 文档：https://docs.trae.ai/ide/skills
- Vercel Labs 通用 Skill 安装器（`npx skills` 背后的工具）：https://github.com/vercel-labs/agent-skills

---

## 七、验收标准

- [ ] `.trae/skills/` 下能看到两个 Skill 的目录
- [ ] 提一个前端界面需求，AI 生成的代码在排版/间距/字体上有明显区别于"默认模板感"
- [ ] （可选）跑过 `/impeccable init`，项目根目录生成了 `DESIGN.md`
