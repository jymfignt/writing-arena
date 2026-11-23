import { normalizePath, Vault, TFile } from "obsidian";
import { replaceSection } from "./IdeaStore";

/**
 * 论文研读热身模块。
 * 注意：本模块只做学习笔记与自测问答，内容不向脑洞库 / 正文做任何自动联动。
 */
export class PaperStore {
  constructor(private vault: Vault, private folder: string) {}

  /** 新建一篇论文研读笔记，返回路径 */
  async createNote(): Promise<string> {
    const folder = normalizePath(this.folder);
    if (!this.vault.getFolderByPath(folder)) {
      await this.vault.createFolder(folder);
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const path = normalizePath(`${folder}/论文研读-${stamp}.md`);

    const content = [
      "---",
      `type: 论文研读`,
      `created: ${now.toISOString().slice(0, 10)}`,
      "---",
      "",
      "# 论文研读笔记",
      "",
      "## 研究目标",
      "（这篇论文要解决什么问题）",
      "",
      "## 研究方法",
      "（模型 / 数据集 / 实验设计 / 关键步骤）",
      "",
      "## 核心结论",
      "（主要发现与结果）",
      "",
      "## 关键概念",
      "（专有名词与术语解释）",
      "",
      "## 研究局限",
      "（不足、边界条件、可改进点）",
      "",
      "## 自测问答",
      "（可调用命令「为当前论文笔记生成自测题」由 LLM 出题）",
      "",
      "> 热身结束后，可手动回到脑洞库开始创作；论文内容不会自动进入同人设定。",
      "",
    ].join("\n");

    await this.vault.create(path, content);
    return path;
  }

  /** 把 LLM 生成的自测题写入「自测问答」区块（原子修改） */
  async writeQuiz(file: TFile, quiz: string): Promise<void> {
    await this.vault.process(file, (content) => replaceSection(content, "自测问答", quiz));
  }
}
