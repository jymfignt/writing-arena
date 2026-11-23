import { App, Modal, TextComponent, DropdownComponent, Notice } from "obsidian";
import type { Idea } from "../types";

export interface IdeaFormData {
  title: string;
  core: string;
  characters: string;
  tone: string;
  tag: string;
  spare: string;
  avoid: string;
  status: Idea["status"];
}

/** 新建 / 编辑脑洞的表单弹窗 */
export class IdeaModal extends Modal {
  private data: Record<string, string>;
  private onSubmit: (data: IdeaFormData) => void;

  constructor(app: App, existing: Idea | null, onSubmit: (data: IdeaFormData) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.data = existing
      ? {
          title: existing.title,
          core: existing.core,
          characters: existing.characters,
          tone: existing.tone,
          tag: existing.tag,
          spare: existing.spare,
          avoid: existing.avoid,
          status: existing.status,
        }
      : {
          title: "",
          core: "",
          characters: "",
          tone: "",
          tag: "可直接写",
          spare: "",
          avoid: "",
          status: "草稿",
        };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.data.title ? "编辑脑洞" : "存脑洞" });

    const field = (
      label: string,
      placeholder: string,
      key: string,
      multiline = false,
    ): void => {
      contentEl.createEl("label", { text: label });
      if (multiline) {
        const ta = contentEl.createEl("textarea", { cls: "writing-arena-multiline" });
        ta.placeholder = placeholder;
        ta.value = this.data[key] ?? "";
        ta.addEventListener("input", () => {
          this.data[key] = ta.value;
        });
      } else {
        const component = new TextComponent(contentEl)
          .setPlaceholder(placeholder)
          .setValue(this.data[key] ?? "");
        component.onChange((v) => {
          this.data[key] = v;
        });
      }
      contentEl.createEl("div", { cls: "writing-arena-gap" });
    };

    field("标题", "一句话给脑洞起个名", "title");
    field("核心梗", "这个脑洞最核心的设定 / 冲突", "core", true);
    field("出场人物", "角色名，多人用顿号分隔", "characters");
    field("基调", "甜 / 刀 / 悬疑 / 拉扯 …", "tone");

    contentEl.createEl("label", { text: "标签" });
    new DropdownComponent(contentEl)
      .addOption("可直接写", "可直接写")
      .addOption("待结合设定", "待结合设定")
      .setValue(this.data.tag)
      .onChange((v) => (this.data.tag = v));
    contentEl.createEl("div", { cls: "writing-arena-gap" });

    field("碎片情节", "已经想到的片段、画面、对话", "spare", true);
    field("避雷 / 不想写的点", "梗、结局、人设上的禁区", "avoid", true);

    contentEl.createEl("label", { text: "当前阶段" });
    new DropdownComponent(contentEl)
      .addOption("草稿", "草稿")
      .addOption("大纲", "大纲")
      .addOption("正文", "正文")
      .setValue(this.data.status)
      .onChange((v) => (this.data.status = v));
    contentEl.createEl("div", { cls: "writing-arena-gap" });

    const footer = contentEl.createDiv({ cls: "writing-arena-footer" });
    footer
      .createEl("button", { text: "取消", cls: "mod-ghost" })
      .addEventListener("click", () => this.close());
    footer
      .createEl("button", { text: "保存", cls: "mod-cta" })
      .addEventListener("click", () => {
        if (!this.data.title.trim()) {
          new Notice("请先填写脑洞标题");
          return;
        }
        const form: IdeaFormData = {
          title: this.data.title.trim(),
          core: this.data.core,
          characters: this.data.characters,
          tone: this.data.tone,
          tag: this.data.tag,
          spare: this.data.spare,
          avoid: this.data.avoid,
          status: this.data.status as Idea["status"],
        };
        this.onSubmit(form);
        this.close();
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
