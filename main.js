"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WritingArenaPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/settings.ts
var DEFAULT_SETTINGS = {
  ideaFolder: "\u521B\u4F5C/\u8111\u6D1E\u5E93",
  paperFolder: "\u521B\u4F5C/\u8BBA\u6587\u7814\u8BFB",
  homeImage: "",
  musicFolder: "\u521B\u4F5C/\u97F3\u4E50",
  onlineAudioUrl: "",
  llmEnabled: false,
  llmBaseUrl: "https://api.openai.com/v1",
  llmApiKey: "",
  llmModel: "gpt-4o-mini"
};

// src/store/IdeaStore.ts
var import_obsidian = require("obsidian");
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
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
function replaceSection(content, heading, body) {
  const re = new RegExp(`(## ${heading}[\\s\\S]*?)(?=\\n## |$)`);
  const replacement = `## ${heading}

${body.trim()}
`;
  if (re.test(content)) return content.replace(re, replacement);
  return `${content.replace(/\s+$/, "")}

${replacement}`;
}
function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|#[\]]/g, "").trim().slice(0, 50) || "\u672A\u547D\u540D\u8111\u6D1E";
}
function today() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
var IdeaStore = class {
  constructor(vault, fileManager, folder) {
    this.vault = vault;
    this.fileManager = fileManager;
    this.folder = folder;
  }
  /** 读取脑洞库下全部笔记，解析为 Idea 列表 */
  async list() {
    const folder = (0, import_obsidian.normalizePath)(this.folder);
    const files = this.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + "/"));
    const ideas = [];
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
        status: fm.status ?? "\u8349\u7A3F",
        created: fm.created ?? ""
      });
    }
    ideas.sort((a, b) => b.created.localeCompare(a.created));
    return ideas;
  }
  /** 新建脑洞笔记；返回保存后的路径 */
  async save(input) {
    const folder = (0, import_obsidian.normalizePath)(this.folder);
    if (!this.vault.getFolderByPath(folder)) {
      await this.vault.createFolder(folder);
    }
    const base = sanitizeFileName(input.title);
    let path = (0, import_obsidian.normalizePath)(`${folder}/${base}.md`);
    let counter = 2;
    while (this.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian.normalizePath)(`${folder}/${base}-${counter}.md`);
      counter += 1;
    }
    const created = today();
    await this.vault.create(path, this.renderBody({ ...input, created }));
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian.TFile) {
      await this.fileManager.processFrontMatter(file, (fm) => {
        Object.assign(fm, this.toFrontmatter(input, created));
      });
    }
    return path;
  }
  /** 按路径更新已有脑洞的元数据与正文区块（不改 path） */
  async updateByPath(path, input) {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian.TFile)) return;
    const existing = await this.vault.read(file);
    const fm = parseFrontmatter(existing);
    const created = fm.created || today();
    await this.fileManager.processFrontMatter(file, (frontmatter) => {
      Object.assign(frontmatter, this.toFrontmatter(input, created));
    });
    await this.vault.process(file, () => this.renderBody({ ...input, created }));
  }
  async remove(path) {
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian.TFile) await this.vault.delete(file);
  }
  /** 把 AI 生成的结果写入指定区块（原子修改，不丢失光标与折叠状态） */
  async writeSection(path, heading, body) {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian.TFile)) return;
    await this.vault.process(file, (content) => replaceSection(content, heading, body));
  }
  toFrontmatter(input, created) {
    return {
      title: input.title,
      core: input.core,
      characters: input.characters,
      tone: input.tone,
      tag: input.tag,
      spare: input.spare,
      avoid: input.avoid,
      status: input.status,
      created
    };
  }
  renderBody(idea) {
    return [
      `# ${idea.title}`,
      "",
      "## \u6838\u5FC3\u6897",
      idea.core || "\uFF08\u5F85\u8865\u5145\uFF09",
      "",
      "## \u51FA\u573A\u4EBA\u7269",
      idea.characters || "\uFF08\u5F85\u8865\u5145\uFF09",
      "",
      "## \u57FA\u8C03",
      idea.tone || "\uFF08\u5F85\u8865\u5145\uFF09",
      "",
      "## \u788E\u7247\u60C5\u8282",
      idea.spare || "\uFF08\u5F85\u8865\u5145\uFF09",
      "",
      "## \u907F\u96F7",
      idea.avoid || "\uFF08\u5F85\u8865\u5145\uFF09",
      "",
      "## \u62D3\u5C55\u601D\u8DEF",
      "\uFF08\u5F85\u751F\u6210\uFF09",
      "",
      "## \u5927\u7EB2",
      "\uFF08\u5F85\u751F\u6210\uFF09",
      "",
      "## \u6B63\u6587",
      "\uFF08\u5F85\u5199\uFF09",
      ""
    ].join("\n");
  }
};

// src/store/PaperStore.ts
var import_obsidian2 = require("obsidian");
var PaperStore = class {
  constructor(vault, folder) {
    this.vault = vault;
    this.folder = folder;
  }
  /** 新建一篇论文研读笔记，返回路径 */
  async createNote() {
    const folder = (0, import_obsidian2.normalizePath)(this.folder);
    if (!this.vault.getFolderByPath(folder)) {
      await this.vault.createFolder(folder);
    }
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const path = (0, import_obsidian2.normalizePath)(`${folder}/\u8BBA\u6587\u7814\u8BFB-${stamp}.md`);
    const content = [
      "---",
      `type: \u8BBA\u6587\u7814\u8BFB`,
      `created: ${now.toISOString().slice(0, 10)}`,
      "---",
      "",
      "# \u8BBA\u6587\u7814\u8BFB\u7B14\u8BB0",
      "",
      "## \u7814\u7A76\u76EE\u6807",
      "\uFF08\u8FD9\u7BC7\u8BBA\u6587\u8981\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\uFF09",
      "",
      "## \u7814\u7A76\u65B9\u6CD5",
      "\uFF08\u6A21\u578B / \u6570\u636E\u96C6 / \u5B9E\u9A8C\u8BBE\u8BA1 / \u5173\u952E\u6B65\u9AA4\uFF09",
      "",
      "## \u6838\u5FC3\u7ED3\u8BBA",
      "\uFF08\u4E3B\u8981\u53D1\u73B0\u4E0E\u7ED3\u679C\uFF09",
      "",
      "## \u5173\u952E\u6982\u5FF5",
      "\uFF08\u4E13\u6709\u540D\u8BCD\u4E0E\u672F\u8BED\u89E3\u91CA\uFF09",
      "",
      "## \u7814\u7A76\u5C40\u9650",
      "\uFF08\u4E0D\u8DB3\u3001\u8FB9\u754C\u6761\u4EF6\u3001\u53EF\u6539\u8FDB\u70B9\uFF09",
      "",
      "## \u81EA\u6D4B\u95EE\u7B54",
      "\uFF08\u53EF\u8C03\u7528\u547D\u4EE4\u300C\u4E3A\u5F53\u524D\u8BBA\u6587\u7B14\u8BB0\u751F\u6210\u81EA\u6D4B\u9898\u300D\u7531 LLM \u51FA\u9898\uFF09",
      "",
      "> \u70ED\u8EAB\u7ED3\u675F\u540E\uFF0C\u53EF\u624B\u52A8\u56DE\u5230\u8111\u6D1E\u5E93\u5F00\u59CB\u521B\u4F5C\uFF1B\u8BBA\u6587\u5185\u5BB9\u4E0D\u4F1A\u81EA\u52A8\u8FDB\u5165\u540C\u4EBA\u8BBE\u5B9A\u3002",
      ""
    ].join("\n");
    await this.vault.create(path, content);
    return path;
  }
  /** 把 LLM 生成的自测题写入「自测问答」区块（原子修改） */
  async writeQuiz(file, quiz) {
    await this.vault.process(file, (content) => replaceSection(content, "\u81EA\u6D4B\u95EE\u7B54", quiz));
  }
};

// src/service/LlmService.ts
var LlmService = class {
  constructor(settings) {
    this.settings = settings;
  }
  async chat(system, user) {
    if (!this.settings.llmEnabled) {
      throw new Error("\u672A\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F LLM");
    }
    const base = this.settings.llmBaseUrl.replace(/\/+$/, "");
    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.llmApiKey}`
      },
      body: JSON.stringify({
        model: this.settings.llmModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.8
      })
    });
    if (!resp.ok) throw new Error(`LLM \u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${resp.status}`);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    return content?.trim() || "\uFF08\u6A21\u578B\u672A\u8FD4\u56DE\u5185\u5BB9\uFF09";
  }
  ideaBrief(idea) {
    return [
      `\u6807\u9898\uFF1A${idea.title}`,
      `\u6838\u5FC3\u6897\uFF1A${idea.core || "\uFF08\u65E0\uFF09"}`,
      `\u51FA\u573A\u4EBA\u7269\uFF1A${idea.characters || "\uFF08\u65E0\uFF09"}`,
      `\u57FA\u8C03\uFF1A${idea.tone || "\uFF08\u65E0\uFF09"}`,
      `\u788E\u7247\u60C5\u8282\uFF1A${idea.spare || "\uFF08\u65E0\uFF09"}`,
      `\u907F\u96F7\uFF1A${idea.avoid || "\uFF08\u65E0\uFF09"}`
    ].join("\n");
  }
  /** 拓展 2~3 条情节 / 冲突 / 情绪走向方向 */
  async expand(idea) {
    const system = "\u4F60\u662F\u540C\u4EBA\u521B\u4F5C\u52A9\u624B\u3002\u56F4\u7ED5\u7528\u6237\u7ED9\u51FA\u7684\u8111\u6D1E\uFF0C\u7ED9\u51FA 2~3 \u6761\u53EF\u843D\u5730\u7684\u62D3\u5C55\u65B9\u5411\uFF0C\u6BCF\u6761\u5305\u542B\u573A\u666F\u3001\u51B2\u7A81\u6216\u60C5\u7EEA\u8D70\u5411\uFF1B\u4E0D\u8981\u5199\u5B8C\u6574\u6B63\u6587\uFF0C\u6CE8\u610F\u907F\u5F00\u7528\u6237\u6807\u6CE8\u7684\u907F\u96F7\u70B9\u3002";
    const user = `\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u8111\u6D1E\u62D3\u5C55\u601D\u8DEF\uFF1A
${this.ideaBrief(idea)}`;
    return this.chat(system, user);
  }
  /** 生成简易故事大纲：开端 / 发展 / 冲突 / 高潮 / 结尾 */
  async outline(idea) {
    const system = "\u4F60\u662F\u540C\u4EBA\u521B\u4F5C\u52A9\u624B\u3002\u6839\u636E\u8111\u6D1E\u751F\u6210\u7B80\u6613\u5927\u7EB2\uFF0C\u6309\u300C\u5F00\u7AEF\u3001\u53D1\u5C55\u3001\u51B2\u7A81\u3001\u9AD8\u6F6E\u3001\u7ED3\u5C3E\u300D\u4E94\u6BB5\u8F93\u51FA\uFF0C\u4FDD\u7559\u5F39\u6027\u65B9\u4FBF\u4FEE\u6539\uFF1B\u907F\u5F00\u907F\u96F7\u70B9\u3002";
    const user = `\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u8111\u6D1E\u751F\u6210\u5927\u7EB2\uFF1A
${this.ideaBrief(idea)}`;
    return this.chat(system, user);
  }
  /** 正文起头：只写开头片段，不替用户写完整篇 */
  async draft(idea) {
    const system = "\u4F60\u662F\u540C\u4EBA\u521B\u4F5C\u52A9\u624B\u3002\u53EA\u5199\u6B63\u6587\u5F00\u5934\u7247\u6BB5\uFF08300 \u5B57\u4EE5\u5185\uFF09\uFF0C\u4EA4\u4EE3\u4EBA\u7269\u4E0E\u573A\u666F\u6C1B\u56F4\uFF0C\u4E0D\u5199\u5B8C\u6574\u7ED3\u5C40\uFF1B\u907F\u5F00\u907F\u96F7\u70B9\u3002";
    const user = `\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u8111\u6D1E\u5199\u6B63\u6587\u8D77\u5934\uFF1A
${this.ideaBrief(idea)}`;
    return this.chat(system, user);
  }
  /** 论文研读自测题：根据论文笔记出 3 道分层题目，不给答案 */
  async quiz(paperContent) {
    const system = "\u4F60\u662F\u5B66\u672F\u52A9\u6559\u3002\u6839\u636E\u7528\u6237\u7ED9\u51FA\u7684\u8BBA\u6587\u7B14\u8BB0\u5185\u5BB9\u51FA 3 \u9053\u81EA\u6D4B\u9898\uFF0C\u4F9D\u6B21\u4E3A\u300C\u57FA\u7840\u6982\u5FF5\u300D\u300C\u5B9E\u9A8C\u903B\u8F91\u300D\u300C\u5EF6\u4F38\u601D\u8003\u300D\u4E09\u7C7B\uFF1B\u6BCF\u9898\u7559\u4F5C\u7B54\u7A7A\u4F4D\uFF0C\u4E0D\u8981\u76F4\u63A5\u7ED9\u51FA\u7B54\u6848\uFF1B\u9898\u76EE\u5FC5\u987B\u57FA\u4E8E\u7B14\u8BB0\u5DF2\u6709\u5185\u5BB9\uFF0C\u4E0D\u8981\u7F16\u9020\u8BBA\u6587\u91CC\u6CA1\u6709\u7684\u7ED3\u8BBA\u3002";
    const user = `\u8BBA\u6587\u7B14\u8BB0\u5185\u5BB9\u5982\u4E0B\uFF1A
${paperContent.slice(0, 6e3)}`;
    return this.chat(system, user);
  }
};

// src/ui/IdeaModal.ts
var import_obsidian3 = require("obsidian");
var IdeaModal = class extends import_obsidian3.Modal {
  constructor(app, existing, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.data = existing ? {
      title: existing.title,
      core: existing.core,
      characters: existing.characters,
      tone: existing.tone,
      tag: existing.tag,
      spare: existing.spare,
      avoid: existing.avoid,
      status: existing.status
    } : {
      title: "",
      core: "",
      characters: "",
      tone: "",
      tag: "\u53EF\u76F4\u63A5\u5199",
      spare: "",
      avoid: "",
      status: "\u8349\u7A3F"
    };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.data.title ? "\u7F16\u8F91\u8111\u6D1E" : "\u5B58\u8111\u6D1E" });
    const field = (label, placeholder, key, multiline = false) => {
      contentEl.createEl("label", { text: label });
      if (multiline) {
        const ta = contentEl.createEl("textarea", { cls: "writing-arena-multiline" });
        ta.placeholder = placeholder;
        ta.value = this.data[key] ?? "";
        ta.addEventListener("input", () => {
          this.data[key] = ta.value;
        });
      } else {
        const component = new import_obsidian3.TextComponent(contentEl).setPlaceholder(placeholder).setValue(this.data[key] ?? "");
        component.onChange((v) => {
          this.data[key] = v;
        });
      }
      contentEl.createEl("div", { cls: "writing-arena-gap" });
    };
    field("\u6807\u9898", "\u4E00\u53E5\u8BDD\u7ED9\u8111\u6D1E\u8D77\u4E2A\u540D", "title");
    field("\u6838\u5FC3\u6897", "\u8FD9\u4E2A\u8111\u6D1E\u6700\u6838\u5FC3\u7684\u8BBE\u5B9A / \u51B2\u7A81", "core", true);
    field("\u51FA\u573A\u4EBA\u7269", "\u89D2\u8272\u540D\uFF0C\u591A\u4EBA\u7528\u987F\u53F7\u5206\u9694", "characters");
    field("\u57FA\u8C03", "\u751C / \u5200 / \u60AC\u7591 / \u62C9\u626F \u2026", "tone");
    contentEl.createEl("label", { text: "\u6807\u7B7E" });
    new import_obsidian3.DropdownComponent(contentEl).addOption("\u53EF\u76F4\u63A5\u5199", "\u53EF\u76F4\u63A5\u5199").addOption("\u5F85\u7ED3\u5408\u8BBE\u5B9A", "\u5F85\u7ED3\u5408\u8BBE\u5B9A").setValue(this.data.tag).onChange((v) => this.data.tag = v);
    contentEl.createEl("div", { cls: "writing-arena-gap" });
    field("\u788E\u7247\u60C5\u8282", "\u5DF2\u7ECF\u60F3\u5230\u7684\u7247\u6BB5\u3001\u753B\u9762\u3001\u5BF9\u8BDD", "spare", true);
    field("\u907F\u96F7 / \u4E0D\u60F3\u5199\u7684\u70B9", "\u6897\u3001\u7ED3\u5C40\u3001\u4EBA\u8BBE\u4E0A\u7684\u7981\u533A", "avoid", true);
    contentEl.createEl("label", { text: "\u5F53\u524D\u9636\u6BB5" });
    new import_obsidian3.DropdownComponent(contentEl).addOption("\u8349\u7A3F", "\u8349\u7A3F").addOption("\u5927\u7EB2", "\u5927\u7EB2").addOption("\u6B63\u6587", "\u6B63\u6587").setValue(this.data.status).onChange((v) => this.data.status = v);
    contentEl.createEl("div", { cls: "writing-arena-gap" });
    const footer = contentEl.createDiv({ cls: "writing-arena-footer" });
    footer.createEl("button", { text: "\u53D6\u6D88", cls: "mod-ghost" }).addEventListener("click", () => this.close());
    footer.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" }).addEventListener("click", () => {
      if (!this.data.title.trim()) {
        new import_obsidian3.Notice("\u8BF7\u5148\u586B\u5199\u8111\u6D1E\u6807\u9898");
        return;
      }
      const form = {
        title: this.data.title.trim(),
        core: this.data.core,
        characters: this.data.characters,
        tone: this.data.tone,
        tag: this.data.tag,
        spare: this.data.spare,
        avoid: this.data.avoid,
        status: this.data.status
      };
      this.onSubmit(form);
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/ui/IdeaListView.ts
var import_obsidian4 = require("obsidian");
var STATUS_ORDER = ["\u8349\u7A3F", "\u5927\u7EB2", "\u6B63\u6587"];
var _IdeaListView = class _IdeaListView extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tagFilter = "\u5168\u90E8";
    this.statusFilter = "\u5168\u90E8";
  }
  getViewType() {
    return _IdeaListView.VIEW_TYPE;
  }
  getDisplayText() {
    return "\u8111\u6D1E\u5E93";
  }
  getIcon() {
    return "pencil";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("writing-arena-view");
    this.renderHomeImage(container);
    const header = container.createDiv({ cls: "writing-arena-header" });
    header.createEl("h3", { text: "\u8111\u6D1E\u5E93\u5B58" });
    const addBtn = header.createEl("button", { text: "+ \u5B58\u8111\u6D1E", cls: "mod-cta" });
    addBtn.addEventListener("click", () => this.plugin.openNewIdeaModal());
    this.filterBar = container.createDiv({ cls: "writing-arena-filter" });
    this.listEl = container.createDiv({ cls: "writing-arena-list" });
    this.renderPlayer(container);
    await this.refresh();
  }
  /** 设置中配置的首页封面图 */
  renderHomeImage(container) {
    const imgPath = this.plugin.settings.homeImage;
    if (!imgPath) return;
    const file = this.plugin.app.vault.getAbstractFileByPath(imgPath);
    if (file instanceof import_obsidian4.TFile) {
      const img = container.createEl("img", {
        cls: "writing-arena-home-img",
        attr: { alt: "\u9996\u9875\u5C01\u9762" }
      });
      img.src = this.plugin.app.vault.getResourcePath(file);
    }
  }
  /** 音乐播放器：本地音频目录 + 在线音频直链 */
  renderPlayer(container) {
    const musicFiles = this.plugin.listMusic();
    const box = container.createDiv({ cls: "writing-arena-player" });
    box.createEl("div", { text: "\u97F3\u4E50", cls: "writing-arena-player-title" });
    const audio = box.createEl("audio", {
      cls: "writing-arena-audio",
      attr: { controls: "true" }
    });
    if (musicFiles.length) {
      const select = box.createEl("select", { cls: "writing-arena-player-select" });
      musicFiles.forEach((f, i) => {
        select.createEl("option", { value: String(i), text: f.basename });
      });
      const playLocal = (index) => {
        const file = musicFiles[index];
        if (file) audio.src = this.plugin.app.vault.getResourcePath(file);
      };
      playLocal(0);
      select.addEventListener("change", () => playLocal(Number(select.value)));
    }
    const urlRow = box.createDiv({ cls: "writing-arena-player-url-row" });
    const urlInput = urlRow.createEl("input", {
      cls: "writing-arena-player-url",
      attr: { type: "text", placeholder: "\u5728\u7EBF\u97F3\u9891\u76F4\u94FE\uFF08mp3 / ogg / m4a\uFF09" }
    });
    urlInput.value = this.plugin.settings.onlineAudioUrl;
    const playUrl = urlRow.createEl("button", {
      text: "\u64AD\u653E\u94FE\u63A5",
      cls: "mod-ghost writing-arena-btn"
    });
    playUrl.addEventListener("click", async () => {
      const url = urlInput.value.trim();
      if (!url) {
        new import_obsidian4.Notice("\u8BF7\u5148\u7C98\u8D34\u97F3\u9891\u94FE\u63A5");
        return;
      }
      audio.src = url;
      try {
        await audio.play();
        this.plugin.settings.onlineAudioUrl = url;
        await this.plugin.saveSettings();
      } catch {
        new import_obsidian4.Notice("\u65E0\u6CD5\u64AD\u653E\u8BE5\u94FE\u63A5\uFF1A\u68C0\u67E5\u683C\u5F0F\u6216\u7F51\u7EDC\uFF0Cm3u8/HLS \u6D41\u6682\u4E0D\u652F\u6301");
      }
    });
  }
  async refresh() {
    if (!this.listEl) return;
    const ideas = await this.plugin.ideaStore().list();
    this.fillFilter(ideas);
    const filtered = ideas.filter(
      (i) => (this.statusFilter === "\u5168\u90E8" || i.status === this.statusFilter) && (this.tagFilter === "\u5168\u90E8" || i.tag === this.tagFilter)
    );
    this.listEl.empty();
    if (!filtered.length) {
      this.listEl.createEl("p", {
        text: "\u5E93\u5B58\u4E3A\u7A7A\uFF0C\u6216\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6CA1\u6709\u8111\u6D1E\u3002",
        cls: "writing-arena-empty"
      });
      return;
    }
    for (const status of STATUS_ORDER) {
      const group = filtered.filter((i) => i.status === status);
      if (!group.length) continue;
      this.listEl.createEl("h4", { text: status, cls: "writing-arena-group-title" });
      for (const idea of group) this.renderCard(idea);
    }
  }
  fillFilter(ideas) {
    this.filterBar.empty();
    const tags = [...new Set(ideas.map((i) => i.tag).filter(Boolean))];
    const tagDD = new import_obsidian4.DropdownComponent(this.filterBar);
    tagDD.addOption("\u5168\u90E8", "\u5168\u90E8");
    tags.forEach((t) => tagDD.addOption(t, t));
    tagDD.setValue(this.tagFilter);
    tagDD.onChange((v) => {
      this.tagFilter = v;
      void this.refresh();
    });
    const statusDD = new import_obsidian4.DropdownComponent(this.filterBar);
    statusDD.addOption("\u5168\u90E8", "\u5168\u90E8");
    STATUS_ORDER.forEach((s) => statusDD.addOption(s, s));
    statusDD.setValue(this.statusFilter);
    statusDD.onChange((v) => {
      this.statusFilter = v;
      void this.refresh();
    });
  }
  renderCard(idea) {
    const card = this.listEl.createDiv({ cls: "writing-arena-card" });
    const top = card.createDiv({ cls: "writing-arena-card-top" });
    top.createEl("span", { text: idea.title, cls: "writing-arena-title" });
    top.createEl("span", { text: idea.status, cls: "writing-arena-badge" });
    if (idea.core) {
      card.createEl("p", { text: idea.core, cls: "writing-arena-core" });
    }
    const meta = card.createDiv({ cls: "writing-arena-meta" });
    if (idea.characters) meta.createSpan({ text: `\u4EBA\u7269\uFF1A${idea.characters}\u3000` });
    if (idea.tone) meta.createSpan({ text: `\u57FA\u8C03\uFF1A${idea.tone}\u3000` });
    if (idea.tag) meta.createSpan({ text: `#${idea.tag}` });
    const actions = card.createDiv({ cls: "writing-arena-actions" });
    const btn = (text, fn) => {
      const b = actions.createEl("button", { text, cls: "mod-ghost writing-arena-btn" });
      b.addEventListener("click", fn);
    };
    btn("\u6253\u5F00", () => this.plugin.openIdea(idea));
    btn("\u7F16\u8F91", () => this.plugin.openEditIdea(idea));
    btn("\u601D\u8DEF", () => this.plugin.runLlm(idea, "expand"));
    btn("\u5927\u7EB2", () => this.plugin.runLlm(idea, "outline"));
    btn("\u6B63\u6587\u8D77\u5934", () => this.plugin.runLlm(idea, "draft"));
    btn("\u5220\u9664", () => this.plugin.deleteIdea(idea));
  }
};
_IdeaListView.VIEW_TYPE = "writing-arena-ideas";
var IdeaListView = _IdeaListView;

// src/types.ts
var IDEA_SECTIONS = {
  expand: "\u62D3\u5C55\u601D\u8DEF",
  outline: "\u5927\u7EB2",
  draft: "\u6B63\u6587"
};

// src/main.ts
var MUSIC_EXTS = ["mp3", "m4a", "wav", "ogg", "flac"];
var WritingArenaPlugin = class extends import_obsidian5.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(IdeaListView.VIEW_TYPE, (leaf) => new IdeaListView(leaf, this));
    this.addRibbonIcon("pencil", "\u521B\u4F5C\u5DE5\u574A", () => this.openIdeasView());
    this.addCommand({
      id: "new-idea",
      name: "\u5B58\u8111\u6D1E",
      callback: () => this.openNewIdeaModal()
    });
    this.addCommand({
      id: "open-ideas",
      name: "\u67E5\u770B\u8111\u6D1E\u5E93",
      callback: () => this.openIdeasView()
    });
    this.addCommand({
      id: "new-paper-note",
      name: "\u65B0\u5EFA\u8BBA\u6587\u7814\u8BFB\u7B14\u8BB0\uFF08\u70ED\u8EAB\uFF09",
      callback: () => this.createPaperNote()
    });
    this.addCommand({
      id: "paper-quiz",
      name: "\u4E3A\u5F53\u524D\u8BBA\u6587\u7B14\u8BB0\u751F\u6210\u81EA\u6D4B\u9898",
      callback: () => this.generatePaperQuiz()
    });
    this.addCommand({
      id: "warmup-done",
      name: "\u70ED\u8EAB\u7ED3\u675F\uFF0C\u8FDB\u5165\u521B\u4F5C",
      callback: () => this.openIdeasView()
    });
    this.addSettingTab(new WritingArenaSettingTab(this.app, this));
  }
  /** 每次调用时按当前设置构造，避免目录修改后持有旧实例 */
  ideaStore() {
    return new IdeaStore(this.app.vault, this.app.fileManager, this.settings.ideaFolder);
  }
  /** 按需从工作区取脑洞库视图实例，不长期持有视图引用 */
  getIdeasView() {
    for (const leaf of this.app.workspace.getLeavesOfType(IdeaListView.VIEW_TYPE)) {
      if (leaf.view instanceof IdeaListView) return leaf.view;
    }
    return null;
  }
  paperStore() {
    return new PaperStore(this.app.vault, this.settings.paperFolder);
  }
  llm() {
    return new LlmService(this.settings);
  }
  /** 扫描音乐目录下的音频文件，供侧边栏播放器使用 */
  listMusic() {
    const folder = (0, import_obsidian5.normalizePath)(this.settings.musicFolder);
    return this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(folder + "/") && MUSIC_EXTS.includes(f.extension.toLowerCase())
    );
  }
  async openIdeasView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(IdeaListView.VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(false);
      await leaf.setViewState({ type: IdeaListView.VIEW_TYPE });
    }
    workspace.revealLeaf(leaf);
    await this.getIdeasView()?.refresh();
  }
  openNewIdeaModal() {
    new IdeaModal(this.app, null, async (data) => {
      await this.ideaStore().save(data);
      new import_obsidian5.Notice("\u8111\u6D1E\u5DF2\u5B58\u5165\u5E93\u5B58");
      await this.getIdeasView()?.refresh();
    }).open();
  }
  openEditIdea(idea) {
    new IdeaModal(this.app, idea, async (data) => {
      await this.ideaStore().updateByPath(idea.path, data);
      new import_obsidian5.Notice("\u8111\u6D1E\u5DF2\u66F4\u65B0");
      await this.getIdeasView()?.refresh();
    }).open();
  }
  async openIdea(idea) {
    const file = this.app.vault.getAbstractFileByPath(idea.path);
    if (file instanceof import_obsidian5.TFile) {
      await this.app.workspace.openLinkText(file.path, "", true);
    }
  }
  /** LLM 动作：expand 思路 / outline 大纲 / draft 正文起头，结果写回对应区块 */
  async runLlm(idea, action) {
    const section = IDEA_SECTIONS[action];
    const busy = new import_obsidian5.Notice(`\u6B63\u5728\u751F\u6210${section}\u2026`);
    try {
      const result = await this.llm()[action](idea);
      await this.ideaStore().writeSection(idea.path, section, result);
      new import_obsidian5.Notice(`${section}\u5DF2\u5199\u5165\u7B14\u8BB0`);
      await this.getIdeasView()?.refresh();
    } catch (err) {
      new import_obsidian5.Notice(err instanceof Error ? err.message : "\u751F\u6210\u5931\u8D25");
    } finally {
      busy.hide();
    }
  }
  async deleteIdea(idea) {
    const confirmed = window.confirm(`\u786E\u5B9A\u5220\u9664\u8111\u6D1E\u300C${idea.title}\u300D\u5417\uFF1F`);
    if (!confirmed) return;
    await this.ideaStore().remove(idea.path);
    new import_obsidian5.Notice("\u5DF2\u5220\u9664");
    await this.getIdeasView()?.refresh();
  }
  /** 论文研读热身：只建学习笔记，不与脑洞库做任何内容联动 */
  async createPaperNote() {
    const path = await this.paperStore().createNote();
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian5.TFile) {
      await this.app.workspace.openLinkText(path, "", true);
    }
    new import_obsidian5.Notice("\u8BBA\u6587\u7814\u8BFB\u7B14\u8BB0\u5DF2\u521B\u5EFA\uFF08\u70ED\u8EAB\u6A21\u5F0F\uFF0C\u4E0D\u8054\u52A8\u8111\u6D1E\uFF09");
  }
  /** 为当前打开的论文笔记生成分层自测题；未启用 LLM 时写入固定模板题（无标准答案） */
  async generatePaperQuiz() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new import_obsidian5.Notice("\u8BF7\u5148\u6253\u5F00\u4E00\u7BC7\u8BBA\u6587\u7814\u8BFB\u7B14\u8BB0");
      return;
    }
    if (!this.settings.llmEnabled) {
      await this.paperStore().writeQuiz(file, this.fallbackQuiz());
      new import_obsidian5.Notice("\u672A\u542F\u7528 LLM\uFF0C\u5DF2\u5199\u5165\u56FA\u5B9A\u81EA\u6D4B\u9898\uFF08\u65E0\u6807\u51C6\u7B54\u6848\uFF09");
      return;
    }
    const busy = new import_obsidian5.Notice("\u6B63\u5728\u751F\u6210\u81EA\u6D4B\u9898\u2026");
    try {
      const content = await this.app.vault.read(file);
      const quiz = await this.llm().quiz(content);
      await this.paperStore().writeQuiz(file, quiz);
      new import_obsidian5.Notice("\u81EA\u6D4B\u9898\u5DF2\u5199\u5165\u7B14\u8BB0");
    } catch (err) {
      await this.paperStore().writeQuiz(file, this.fallbackQuiz());
      new import_obsidian5.Notice(
        `${err instanceof Error ? err.message : "LLM \u751F\u6210\u5931\u8D25"}\uFF0C\u5DF2\u56DE\u9000\u56FA\u5B9A\u81EA\u6D4B\u9898`
      );
    } finally {
      busy.hide();
    }
  }
  /** 离线兜底题库：分层提问，留作答空位，不提供标准答案 */
  fallbackQuiz() {
    return [
      "### 1. \u57FA\u7840\u6982\u5FF5",
      "\u7528\u81EA\u5DF1\u7684\u8BDD\u89E3\u91CA\u672C\u6587\u300C\u5173\u952E\u6982\u5FF5\u300D\u533A\u5757\u4E2D\u7684\u672F\u8BED\uFF0C\u5E76\u5404\u4E3E\u4E00\u4E2A\u7B80\u5355\u4F8B\u5B50\u3002",
      "",
      "\u4F5C\u7B54\uFF1A",
      "",
      "",
      "### 2. \u5B9E\u9A8C\u903B\u8F91",
      "\u672C\u6587\u4E3A\u89E3\u51B3\u300C\u7814\u7A76\u76EE\u6807\u300D\u4E2D\u7684\u95EE\u9898\uFF0C\u91C7\u7528\u4E86\u54EA\u4E9B\u65B9\u6CD5\u3001\u6570\u636E\u6216\u5BF9\u7167\uFF1F\u5173\u952E\u6B65\u9AA4\u4E4B\u95F4\u662F\u5982\u4F55\u8854\u63A5\u7684\uFF1F",
      "",
      "\u4F5C\u7B54\uFF1A",
      "",
      "",
      "### 3. \u5EF6\u4F38\u601D\u8003",
      "\u9664\u300C\u7814\u7A76\u5C40\u9650\u300D\u5916\uFF0C\u7ED3\u8BBA\u8FD8\u53D7\u54EA\u4E9B\u8FB9\u754C\u6761\u4EF6\u7EA6\u675F\uFF1F\u6362\u4E00\u4E2A\u573A\u666F\u6216\u6570\u636E\u96C6\uFF0C\u7ED3\u8BBA\u53EF\u80FD\u5982\u4F55\u5931\u6548\uFF1F",
      "",
      "\u4F5C\u7B54\uFF1A",
      "",
      "\uFF08\u672C\u9898\u4E3A\u56FA\u5B9A\u6A21\u677F\uFF0C\u4E0D\u63D0\u4F9B\u6807\u51C6\u7B54\u6848\uFF1B\u5728\u8BBE\u7F6E\u4E2D\u542F\u7528 LLM \u540E\uFF0C\u53EF\u751F\u6210\u57FA\u4E8E\u7B14\u8BB0\u5185\u5BB9\u7684\u9898\u76EE\u3002\uFF09"
    ].join("\n");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.getIdeasView()?.refresh();
  }
};
var WritingArenaSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian5.Setting(containerEl).setName("\u8111\u6D1E\u5E93\u76EE\u5F55").addText(
      (text) => text.setPlaceholder("\u521B\u4F5C/\u8111\u6D1E\u5E93").setValue(this.plugin.settings.ideaFolder).onChange(async (v) => {
        this.plugin.settings.ideaFolder = (0, import_obsidian5.normalizePath)(v || "\u521B\u4F5C/\u8111\u6D1E\u5E93");
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u8BBA\u6587\u7814\u8BFB\u76EE\u5F55").addText(
      (text) => text.setPlaceholder("\u521B\u4F5C/\u8BBA\u6587\u7814\u8BFB").setValue(this.plugin.settings.paperFolder).onChange(async (v) => {
        this.plugin.settings.paperFolder = (0, import_obsidian5.normalizePath)(v || "\u521B\u4F5C/\u8BBA\u6587\u7814\u8BFB");
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u9996\u9875\u5C01\u9762\u56FE").setDesc("vault \u5185\u56FE\u7247\u8DEF\u5F84\uFF08\u5982 \u521B\u4F5C/\u5C01\u9762.png\uFF09\uFF0C\u7559\u7A7A\u5219\u4E0D\u663E\u793A").addText(
      (text) => text.setPlaceholder("\u521B\u4F5C/\u5C01\u9762.png").setValue(this.plugin.settings.homeImage).onChange(async (v) => {
        this.plugin.settings.homeImage = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u97F3\u4E50\u76EE\u5F55").addText(
      (text) => text.setPlaceholder("\u521B\u4F5C/\u97F3\u4E50").setValue(this.plugin.settings.musicFolder).onChange(async (v) => {
        this.plugin.settings.musicFolder = (0, import_obsidian5.normalizePath)(v || "\u521B\u4F5C/\u97F3\u4E50");
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u9ED8\u8BA4\u5728\u7EBF\u97F3\u9891\u94FE\u63A5").setDesc("\u64AD\u653E\u5668\u9884\u586B\u7684\u8FDC\u7A0B\u76F4\u94FE\uFF08mp3 / ogg / m4a\uFF09\uFF0C\u7559\u7A7A\u5219\u4E0D\u9884\u586B").addText(
      (text) => text.setPlaceholder("https://example.com/track.mp3").setValue(this.plugin.settings.onlineAudioUrl).onChange(async (v) => {
        this.plugin.settings.onlineAudioUrl = v.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "LLM\uFF08\u53EF\u9009\uFF0C\u7528\u4E8E\u601D\u8DEF\u53D1\u6563 / \u5927\u7EB2 / \u6B63\u6587\u8D77\u5934 / \u8BBA\u6587\u51FA\u9898\uFF09" });
    new import_obsidian5.Setting(containerEl).setName("\u542F\u7528 LLM").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.llmEnabled).onChange(async (v) => {
        this.plugin.settings.llmEnabled = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u63A5\u53E3\u5730\u5740\uFF08OpenAI \u517C\u5BB9\uFF09").addText(
      (text) => text.setPlaceholder("https://api.openai.com/v1").setValue(this.plugin.settings.llmBaseUrl).onChange(async (v) => {
        this.plugin.settings.llmBaseUrl = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("API Key").addText(
      (text) => text.setPlaceholder("sk-...").setValue(this.plugin.settings.llmApiKey).onChange(async (v) => {
        this.plugin.settings.llmApiKey = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u6A21\u578B\u540D").addText(
      (text) => text.setPlaceholder("gpt-4o-mini").setValue(this.plugin.settings.llmModel).onChange(async (v) => {
        this.plugin.settings.llmModel = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
