export interface WritingArenaSettings {
  /** 脑洞库目录（vault 相对路径） */
  ideaFolder: string;
  /** 论文研读目录（vault 相对路径），与脑洞库内容隔离 */
  paperFolder: string;
  /** 侧边栏首页封面图（vault 内图片路径，留空则不显示） */
  homeImage: string;
  /** 音乐播放器扫描的目录（vault 相对路径） */
  musicFolder: string;
  /** 播放器默认在线音频直链（mp3/ogg/m4a），留空则不预填 */
  onlineAudioUrl: string;
  /** 是否接入兼容 OpenAI 接口的 LLM */
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
}

export const DEFAULT_SETTINGS: WritingArenaSettings = {
  ideaFolder: "创作/脑洞库",
  paperFolder: "创作/论文研读",
  homeImage: "",
  musicFolder: "创作/音乐",
  onlineAudioUrl: "",
  llmEnabled: false,
  llmBaseUrl: "https://api.openai.com/v1",
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
};
