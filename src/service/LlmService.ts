import type { WritingArenaSettings } from "../settings";
import type { Idea } from "../types";

/**
 * 兼容 OpenAI /chat/completions 协议的 LLM 服务。
 * 仅用于脑洞的思路发散、大纲与正文起头；论文研读模块不调用本服务。
 */
export class LlmService {
  constructor(private settings: WritingArenaSettings) {}

  private async chat(system: string, user: string): Promise<string> {
    if (!this.settings.llmEnabled) {
      throw new Error("未在插件设置中开启 LLM");
    }
    const base = this.settings.llmBaseUrl.replace(/\/+$/, "");
    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.llmApiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.llmModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.8,
      }),
    });

    if (!resp.ok) throw new Error(`LLM 请求失败：HTTP ${resp.status}`);
    const data = await resp.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    return content?.trim() || "（模型未返回内容）";
  }

  private ideaBrief(idea: Idea): string {
    return [
      `标题：${idea.title}`,
      `核心梗：${idea.core || "（无）"}`,
      `出场人物：${idea.characters || "（无）"}`,
      `基调：${idea.tone || "（无）"}`,
      `碎片情节：${idea.spare || "（无）"}`,
      `避雷：${idea.avoid || "（无）"}`,
    ].join("\n");
  }

  /** 拓展 2~3 条情节 / 冲突 / 情绪走向方向 */
  async expand(idea: Idea): Promise<string> {
    const system =
      "你是同人创作助手。围绕用户给出的脑洞，给出 2~3 条可落地的拓展方向，每条包含场景、冲突或情绪走向；不要写完整正文，注意避开用户标注的避雷点。";
    const user = `请基于以下脑洞拓展思路：\n${this.ideaBrief(idea)}`;
    return this.chat(system, user);
  }

  /** 生成简易故事大纲：开端 / 发展 / 冲突 / 高潮 / 结尾 */
  async outline(idea: Idea): Promise<string> {
    const system =
      "你是同人创作助手。根据脑洞生成简易大纲，按「开端、发展、冲突、高潮、结尾」五段输出，保留弹性方便修改；避开避雷点。";
    const user = `请基于以下脑洞生成大纲：\n${this.ideaBrief(idea)}`;
    return this.chat(system, user);
  }

  /** 正文起头：只写开头片段，不替用户写完整篇 */
  async draft(idea: Idea): Promise<string> {
    const system =
      "你是同人创作助手。只写正文开头片段（300 字以内），交代人物与场景氛围，不写完整结局；避开避雷点。";
    const user = `请基于以下脑洞写正文起头：\n${this.ideaBrief(idea)}`;
    return this.chat(system, user);
  }

  /** 论文研读自测题：根据论文笔记出 3 道分层题目，不给答案 */
  async quiz(paperContent: string): Promise<string> {
    const system =
      "你是学术助教。根据用户给出的论文笔记内容出 3 道自测题，依次为「基础概念」「实验逻辑」「延伸思考」三类；每题留作答空位，不要直接给出答案；题目必须基于笔记已有内容，不要编造论文里没有的结论。";
    const user = `论文笔记内容如下：\n${paperContent.slice(0, 6000)}`;
    return this.chat(system, user);
  }
}
