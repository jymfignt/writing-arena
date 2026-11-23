import {
  Plugin,
  Notice,
  TFile,
  Setting,
  PluginSettingTab,
  normalizePath,
} from "obsidian";
import { DEFAULT_SETTINGS, type WritingArenaSettings } from "./settings";
import { IdeaStore } from "./store/IdeaStore";
import { PaperStore } from "./store/PaperStore";
import { LlmService } from "./service/LlmService";
import { IdeaModal, type IdeaFormData } from "./ui/IdeaModal";
import { IdeaListView } from "./ui/IdeaListView";
import { IDEA_SECTIONS, type Idea } from "./types";

const MUSIC_EXTS = ["mp3", "m4a", "wav", "ogg", "flac"];

export default class WritingArenaPlugin extends Plugin {
  settings!: WritingArenaSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(IdeaListView.VIEW_TYPE, (leaf) => new IdeaListView(leaf, this));

    this.addRibbonIcon("pencil", "创作工坊", () => this.openIdeasView());

    this.addCommand({
      id: "new-idea",
      name: "存脑洞",
      callback: () => this.openNewIdeaModal(),
    });
    this.addCommand({
      id: "open-ideas",
      name: "查看脑洞库",
      callback: () => this.openIdeasView(),
    });
    this.addCommand({
      id: "new-paper-note",
      name: "新建论文研读笔记（热身）",
      callback: () => this.createPaperNote(),
    });
    this.addCommand({
      id: "paper-quiz",
      name: "为当前论文笔记生成自测题",
      callback: () => this.generatePaperQuiz(),
    });
    this.addCommand({
      id: "warmup-done",
      name: "热身结束，进入创作",
      callback: () => this.openIdeasView(),
    });

    this.addSettingTab(new WritingArenaSettingTab(this.app, this));
  }

  /** 每次调用时按当前设置构造，避免目录修改后持有旧实例 */
  ideaStore(): IdeaStore {
    return new IdeaStore(this.app.vault, this.app.fileManager, this.settings.ideaFolder);
  }

  /** 按需从工作区取脑洞库视图实例，不长期持有视图引用 */
  private getIdeasView(): IdeaListView | null {
    for (const leaf of this.app.workspace.getLeavesOfType(IdeaListView.VIEW_TYPE)) {
      if (leaf.view instanceof IdeaListView) return leaf.view;
    }
    return null;
  }

  private paperStore(): PaperStore {
    return new PaperStore(this.app.vault, this.settings.paperFolder);
  }

  private llm(): LlmService {
    return new LlmService(this.settings);
  }

  /** 扫描音乐目录下的音频文件，供侧边栏播放器使用 */
  listMusic(): TFile[] {
    const folder = normalizePath(this.settings.musicFolder);
    return this.app.vault
      .getFiles()
      .filter(
        (f) =>
          f.path.startsWith(folder + "/") &&
          MUSIC_EXTS.includes(f.extension.toLowerCase()),
      );
  }

  async openIdeasView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(IdeaListView.VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(false);
      await leaf.setViewState({ type: IdeaListView.VIEW_TYPE });
    }
    workspace.revealLeaf(leaf);
    await this.getIdeasView()?.refresh();
  }

  openNewIdeaModal(): void {
    new IdeaModal(this.app, null, async (data: IdeaFormData) => {
      await this.ideaStore().save(data);
      new Notice("脑洞已存入库存");
      await this.getIdeasView()?.refresh();
    }).open();
  }

  openEditIdea(idea: Idea): void {
    new IdeaModal(this.app, idea, async (data: IdeaFormData) => {
      await this.ideaStore().updateByPath(idea.path, data);
      new Notice("脑洞已更新");
      await this.getIdeasView()?.refresh();
    }).open();
  }

  async openIdea(idea: Idea): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(idea.path);
    if (file instanceof TFile) {
      await this.app.workspace.openLinkText(file.path, "", true);
    }
  }

  /** LLM 动作：expand 思路 / outline 大纲 / draft 正文起头，结果写回对应区块 */
  async runLlm(idea: Idea, action: "expand" | "outline" | "draft"): Promise<void> {
    const section = IDEA_SECTIONS[action];
    const busy = new Notice(`正在生成${section}…`);
    try {
      const result = await this.llm()[action](idea);
      await this.ideaStore().writeSection(idea.path, section, result);
      new Notice(`${section}已写入笔记`);
      await this.getIdeasView()?.refresh();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "生成失败");
    } finally {
      busy.hide();
    }
  }

  async deleteIdea(idea: Idea): Promise<void> {
    const confirmed = window.confirm(`确定删除脑洞「${idea.title}」吗？`);
    if (!confirmed) return;
    await this.ideaStore().remove(idea.path);
    new Notice("已删除");
    await this.getIdeasView()?.refresh();
  }

  /** 论文研读热身：只建学习笔记，不与脑洞库做任何内容联动 */
  async createPaperNote(): Promise<void> {
    const path = await this.paperStore().createNote();
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.workspace.openLinkText(path, "", true);
    }
    new Notice("论文研读笔记已创建（热身模式，不联动脑洞）");
  }

  /** 为当前打开的论文笔记生成分层自测题；未启用 LLM 时写入固定模板题（无标准答案） */
  async generatePaperQuiz(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开一篇论文研读笔记");
      return;
    }

    if (!this.settings.llmEnabled) {
      await this.paperStore().writeQuiz(file, this.fallbackQuiz());
      new Notice("未启用 LLM，已写入固定自测题（无标准答案）");
      return;
    }

    const busy = new Notice("正在生成自测题…");
    try {
      const content = await this.app.vault.read(file);
      const quiz = await this.llm().quiz(content);
      await this.paperStore().writeQuiz(file, quiz);
      new Notice("自测题已写入笔记");
    } catch (err) {
      // 请求失败时回退固定模板，保证离线也有题目可用
      await this.paperStore().writeQuiz(file, this.fallbackQuiz());
      new Notice(
        `${err instanceof Error ? err.message : "LLM 生成失败"}，已回退固定自测题`,
      );
    } finally {
      busy.hide();
    }
  }

  /** 离线兜底题库：分层提问，留作答空位，不提供标准答案 */
  private fallbackQuiz(): string {
    return [
      "### 1. 基础概念",
      "用自己的话解释本文「关键概念」区块中的术语，并各举一个简单例子。",
      "",
      "作答：",
      "",
      "",
      "### 2. 实验逻辑",
      "本文为解决「研究目标」中的问题，采用了哪些方法、数据或对照？关键步骤之间是如何衔接的？",
      "",
      "作答：",
      "",
      "",
      "### 3. 延伸思考",
      "除「研究局限」外，结论还受哪些边界条件约束？换一个场景或数据集，结论可能如何失效？",
      "",
      "作答：",
      "",
      "（本题为固定模板，不提供标准答案；在设置中启用 LLM 后，可生成基于笔记内容的题目。）",
    ].join("\n");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.getIdeasView()?.refresh();
  }
}

class WritingArenaSettingTab extends PluginSettingTab {
  constructor(app: import("obsidian").App, private plugin: WritingArenaPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("脑洞库目录").addText((text) =>
      text
        .setPlaceholder("创作/脑洞库")
        .setValue(this.plugin.settings.ideaFolder)
        .onChange(async (v) => {
          this.plugin.settings.ideaFolder = normalizePath(v || "创作/脑洞库");
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl).setName("论文研读目录").addText((text) =>
      text
        .setPlaceholder("创作/论文研读")
        .setValue(this.plugin.settings.paperFolder)
        .onChange(async (v) => {
          this.plugin.settings.paperFolder = normalizePath(v || "创作/论文研读");
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl)
      .setName("首页封面图")
      .setDesc("vault 内图片路径（如 创作/封面.png），留空则不显示")
      .addText((text) =>
        text
          .setPlaceholder("创作/封面.png")
          .setValue(this.plugin.settings.homeImage)
          .onChange(async (v) => {
            this.plugin.settings.homeImage = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName("音乐目录").addText((text) =>
      text
        .setPlaceholder("创作/音乐")
        .setValue(this.plugin.settings.musicFolder)
        .onChange(async (v) => {
          this.plugin.settings.musicFolder = normalizePath(v || "创作/音乐");
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl)
      .setName("默认在线音频链接")
      .setDesc("播放器预填的远程直链（mp3 / ogg / m4a），留空则不预填")
      .addText((text) =>
        text
          .setPlaceholder("https://example.com/track.mp3")
          .setValue(this.plugin.settings.onlineAudioUrl)
          .onChange(async (v) => {
            this.plugin.settings.onlineAudioUrl = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "LLM（可选，用于思路发散 / 大纲 / 正文起头 / 论文出题）" });

    new Setting(containerEl)
      .setName("启用 LLM")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.llmEnabled).onChange(async (v) => {
          this.plugin.settings.llmEnabled = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("接口地址（OpenAI 兼容）").addText((text) =>
      text
        .setPlaceholder("https://api.openai.com/v1")
        .setValue(this.plugin.settings.llmBaseUrl)
        .onChange(async (v) => {
          this.plugin.settings.llmBaseUrl = v;
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl).setName("API Key").addText((text) =>
      text
        .setPlaceholder("sk-...")
        .setValue(this.plugin.settings.llmApiKey)
        .onChange(async (v) => {
          this.plugin.settings.llmApiKey = v;
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl).setName("模型名").addText((text) =>
      text
        .setPlaceholder("gpt-4o-mini")
        .setValue(this.plugin.settings.llmModel)
        .onChange(async (v) => {
          this.plugin.settings.llmModel = v;
          await this.plugin.saveSettings();
        }),
    );
  }
}
