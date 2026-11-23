/** 脑洞条目，持久化为 vault 内的 Markdown 笔记 */
export interface Idea {
  /** 笔记路径（vault 相对路径），列表与打开文件时使用 */
  path: string;
  title: string;
  /** 核心梗 / 一句话脑洞 */
  core: string;
  characters: string;
  /** 基调：甜 / 刀 / 悬疑 / 拉扯 等 */
  tone: string;
  /** 标签：可直接写 / 待结合设定 等 */
  tag: string;
  /** 已有碎片情节 */
  spare: string;
  /** 避雷 / 不想写的点 */
  avoid: string;
  /** 创作阶段：草稿 / 大纲 / 正文 */
  status: "草稿" | "大纲" | "正文";
  created: string;
}

export const IDEA_SECTIONS = {
  expand: "拓展思路",
  outline: "大纲",
  draft: "正文",
} as const;
