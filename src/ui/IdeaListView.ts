import { ItemView, WorkspaceLeaf, TFile, DropdownComponent, Notice } from "obsidian";
import type WritingArenaPlugin from "../main";
import type { Idea } from "../types";

const STATUS_ORDER: Idea["status"][] = ["草稿", "大纲", "正文"];

/** 脑洞库侧边栏视图：首页图 + 筛选 + 阶段分组 + 编辑 + 音乐播放器 */
export class IdeaListView extends ItemView {
  static VIEW_TYPE = "writing-arena-ideas";
  private listEl!: HTMLElement;
  private filterBar!: HTMLElement;
  private tagFilter = "全部";
  private statusFilter = "全部";

  constructor(leaf: WorkspaceLeaf, private plugin: WritingArenaPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return IdeaListView.VIEW_TYPE;
  }

  getDisplayText(): string {
    return "脑洞库";
  }

  getIcon(): string {
    return "pencil";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("writing-arena-view");

    this.renderHomeImage(container);

    const header = container.createDiv({ cls: "writing-arena-header" });
    header.createEl("h3", { text: "脑洞库存" });
    const addBtn = header.createEl("button", { text: "+ 存脑洞", cls: "mod-cta" });
    addBtn.addEventListener("click", () => this.plugin.openNewIdeaModal());

    this.filterBar = container.createDiv({ cls: "writing-arena-filter" });
    this.listEl = container.createDiv({ cls: "writing-arena-list" });
    this.renderPlayer(container);

    await this.refresh();
  }

  /** 设置中配置的首页封面图 */
  private renderHomeImage(container: HTMLElement): void {
    const imgPath = this.plugin.settings.homeImage;
    if (!imgPath) return;
    const file = this.plugin.app.vault.getAbstractFileByPath(imgPath);
    if (file instanceof TFile) {
      const img = container.createEl("img", {
        cls: "writing-arena-home-img",
        attr: { alt: "首页封面" },
      });
      img.src = this.plugin.app.vault.getResourcePath(file);
    }
  }

  /** 音乐播放器：本地音频目录 + 在线音频直链 */
  private renderPlayer(container: HTMLElement): void {
    const musicFiles = this.plugin.listMusic();

    const box = container.createDiv({ cls: "writing-arena-player" });
    box.createEl("div", { text: "音乐", cls: "writing-arena-player-title" });

    const audio = box.createEl("audio", {
      cls: "writing-arena-audio",
      attr: { controls: "true" },
    });

    if (musicFiles.length) {
      const select = box.createEl("select", { cls: "writing-arena-player-select" });
      musicFiles.forEach((f, i) => {
        select.createEl("option", { value: String(i), text: f.basename });
      });
      const playLocal = (index: number) => {
        const file = musicFiles[index];
        if (file) audio.src = this.plugin.app.vault.getResourcePath(file);
      };
      playLocal(0);
      select.addEventListener("change", () => playLocal(Number(select.value)));
    }

    const urlRow = box.createDiv({ cls: "writing-arena-player-url-row" });
    const urlInput = urlRow.createEl("input", {
      cls: "writing-arena-player-url",
      attr: { type: "text", placeholder: "在线音频直链（mp3 / ogg / m4a）" },
    });
    urlInput.value = this.plugin.settings.onlineAudioUrl;
    const playUrl = urlRow.createEl("button", {
      text: "播放链接",
      cls: "mod-ghost writing-arena-btn",
    });
    playUrl.addEventListener("click", async () => {
      const url = urlInput.value.trim();
      if (!url) {
        new Notice("请先粘贴音频链接");
        return;
      }
      audio.src = url;
      try {
        await audio.play();
        this.plugin.settings.onlineAudioUrl = url;
        await this.plugin.saveSettings();
      } catch {
        new Notice("无法播放该链接：检查格式或网络，m3u8/HLS 流暂不支持");
      }
    });
  }

  async refresh(): Promise<void> {
    if (!this.listEl) return;
    const ideas = await this.plugin.ideaStore().list();
    this.fillFilter(ideas);

    const filtered = ideas.filter(
      (i) =>
        (this.statusFilter === "全部" || i.status === this.statusFilter) &&
        (this.tagFilter === "全部" || i.tag === this.tagFilter),
    );

    this.listEl.empty();
    if (!filtered.length) {
      this.listEl.createEl("p", {
        text: "库存为空，或当前筛选条件下没有脑洞。",
        cls: "writing-arena-empty",
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

  private fillFilter(ideas: Idea[]): void {
    this.filterBar.empty();

    const tags = [...new Set(ideas.map((i) => i.tag).filter(Boolean))];
    const tagDD = new DropdownComponent(this.filterBar);
    tagDD.addOption("全部", "全部");
    tags.forEach((t) => tagDD.addOption(t, t));
    tagDD.setValue(this.tagFilter);
    tagDD.onChange((v) => {
      this.tagFilter = v;
      void this.refresh();
    });

    const statusDD = new DropdownComponent(this.filterBar);
    statusDD.addOption("全部", "全部");
    STATUS_ORDER.forEach((s) => statusDD.addOption(s, s));
    statusDD.setValue(this.statusFilter);
    statusDD.onChange((v) => {
      this.statusFilter = v;
      void this.refresh();
    });
  }

  private renderCard(idea: Idea): void {
    const card = this.listEl.createDiv({ cls: "writing-arena-card" });

    const top = card.createDiv({ cls: "writing-arena-card-top" });
    top.createEl("span", { text: idea.title, cls: "writing-arena-title" });
    top.createEl("span", { text: idea.status, cls: "writing-arena-badge" });

    if (idea.core) {
      card.createEl("p", { text: idea.core, cls: "writing-arena-core" });
    }

    const meta = card.createDiv({ cls: "writing-arena-meta" });
    if (idea.characters) meta.createSpan({ text: `人物：${idea.characters}　` });
    if (idea.tone) meta.createSpan({ text: `基调：${idea.tone}　` });
    if (idea.tag) meta.createSpan({ text: `#${idea.tag}` });

    const actions = card.createDiv({ cls: "writing-arena-actions" });
    const btn = (text: string, fn: () => void) => {
      const b = actions.createEl("button", { text, cls: "mod-ghost writing-arena-btn" });
      b.addEventListener("click", fn);
    };
    btn("打开", () => this.plugin.openIdea(idea));
    btn("编辑", () => this.plugin.openEditIdea(idea));
    btn("思路", () => this.plugin.runLlm(idea, "expand"));
    btn("大纲", () => this.plugin.runLlm(idea, "outline"));
    btn("正文起头", () => this.plugin.runLlm(idea, "draft"));
    btn("删除", () => this.plugin.deleteIdea(idea));
  }
}
