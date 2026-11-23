import { normalizePath, Vault, TFile, FileManager } from "obsidian";
import type { Idea } from "../types";

/** 极简 frontmatter 解析（仅用于读取展示；写入走 FileManager.processFrontMatter） */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out: Record<string, string> = {};
  if (!match) return out;
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      out[key] = value;
    }
  }
  return out;
}

/** 替换（或追加）Markdown 中某个二级标题区块的正文 */
export function replaceSection(content: string, heading: string, body: string): string {
  const re = new RegExp(`(## ${heading}[\\s\\S]*?)(?=\\n## |$)`);
  const replacement = `## ${heading}\n\n${body.trim()}\n`;
  if (re.test(content)) return content.replace(re, replacement);
  return `${content.replace(/\s+$/, "")}\n\n${replacement}`;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|#[\]]/g, "")
    .trim()
    .slice(0, 50) || "未命名脑洞";
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export class IdeaStore {
  constructor(
    private vault: Vault,
    private fileManager: FileManager,
    private folder: string,
  ) {}

  /** 读取脑洞库下全部笔记，解析为 Idea 列表 */
  async list(): Promise<Idea[]> {
    const folder = normalizePath(this.folder);
    const files = this.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith(folder + "/"));

    const ideas: Idea[] = [];
    for (const file of files) {
      const content = await this.vault.read(file);
      const fm = parseFrontmatter(content);
      ideas.push({
        path: file.path,
        title: fm.title ?? file.basename,
        core: fm.core ?? "",
        characters: fm.characters ?? "",
        tone: fm.tone ?? "",
        tag: fm.tag ?? "",
        spare: fm.spare ?? "",
        avoid: fm.avoid ?? "",
        status: (fm.status as Idea["status"]) ?? "草稿",
        created: fm.created ?? "",
      });
    }
    ideas.sort((a, b) => b.created.localeCompare(a.created));
    return ideas;
  }

  /** 新建脑洞笔记；返回保存后的路径 */
  async save(input: Omit<Idea, "path" | "created">): Promise<string> {
    const folder = normalizePath(this.folder);
    if (!this.vault.getFolderByPath(folder)) {
      await this.vault.createFolder(folder);
    }

    const base = sanitizeFileName(input.title);
    let path = normalizePath(`${folder}/${base}.md`);
    let counter = 2;
    while (this.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${folder}/${base}-${counter}.md`);
      counter += 1;
    }

    const created = today();
    await this.vault.create(path, this.renderBody({ ...input, created }));

    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.fileManager.processFrontMatter(file, (fm) => {
        Object.assign(fm, this.toFrontmatter(input, created));
      });
    }
    return path;
  }

  /** 按路径更新已有脑洞的元数据与正文区块（不改 path） */
  async updateByPath(path: string, input: Omit<Idea, "path" | "created">): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;

    const existing = await this.vault.read(file);
    const fm = parseFrontmatter(existing);
    const created = fm.created || today();

    await this.fileManager.processFrontMatter(file, (frontmatter) => {
      Object.assign(frontmatter, this.toFrontmatter(input, created));
    });
    await this.vault.process(file, () => this.renderBody({ ...input, created }));
  }

  async remove(path: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.vault.delete(file);
  }

  /** 把 AI 生成的结果写入指定区块（原子修改，不丢失光标与折叠状态） */
  async writeSection(path: string, heading: string, body: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.vault.process(file, (content) => replaceSection(content, heading, body));
  }

  private toFrontmatter(
    input: Omit<Idea, "path" | "created">,
    created: string,
  ): Record<string, string> {
    return {
      title: input.title,
      core: input.core,
      characters: input.characters,
      tone: input.tone,
      tag: input.tag,
      spare: input.spare,
      avoid: input.avoid,
      status: input.status,
      created,
    };
  }

  private renderBody(idea: Omit<Idea, "path">): string {
    return [
      `# ${idea.title}`,
      "",
      "## 核心梗",
      idea.core || "（待补充）",
      "",
      "## 出场人物",
      idea.characters || "（待补充）",
      "",
      "## 基调",
      idea.tone || "（待补充）",
      "",
      "## 碎片情节",
      idea.spare || "（待补充）",
      "",
      "## 避雷",
      idea.avoid || "（待补充）",
      "",
      "## 拓展思路",
      "（待生成）",
      "",
      "## 大纲",
      "（待生成）",
      "",
      "## 正文",
      "（待写）",
      "",
    ].join("\n");
  }
}
