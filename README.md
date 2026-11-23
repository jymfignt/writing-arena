# 创作工坊（脑洞库 + 论文热身）

一个 Obsidian 插件，包含两套**相互隔离**的流程：

- **同人脑洞库**：随手存档脑洞提要，侧边栏统一管理；支持标签筛选、按阶段（草稿 / 大纲 / 正文）分组、编辑已有脑洞；可选接入 LLM 做思路发散、大纲、正文起头。
- **论文研读热身**：写正文前可选的学习环节，生成结构化研读笔记；可让 LLM 根据笔记内容出分层自测题；未启用 LLM 时写入固定模板题（无标准答案），LLM 请求失败也会回退到该模板。论文内容**不会**自动进入同人设定，两个模块不做内容联动。
- **侧边栏辅助**：可配置首页封面图；内置音乐播放器，支持本地目录音频与在线音频直链（mp3 / ogg / m4a；m3u8/HLS 流暂不支持）。

## 功能与命令

| 命令 | 作用 |
| --- | --- |
| 存脑洞 | 弹窗填写标题 / 核心梗 / 人物 / 基调 / 标签 / 碎片情节 / 避雷 / 阶段，存为 Markdown 笔记 |
| 查看脑洞库 | 打开右侧边栏：首页图、标签 / 阶段筛选、按阶段分组列表；可打开、编辑、生成思路 / 大纲 / 正文起头、删除 |
| 新建论文研读笔记（热身） | 在论文目录生成研读模板（目标 / 方法 / 结论 / 概念 / 局限 / 自测问答） |
| 为当前论文笔记生成自测题 | 读取当前打开的论文笔记，由 LLM 出「基础概念 / 实验逻辑 / 延伸思考」三道题；未启用 LLM 或请求失败时，回退固定模板题（无标准答案） |
| 热身结束，进入创作 | 关闭热身心态，切回脑洞库视图（纯流程切换，不搬运论文内容） |

脑洞笔记内部分区块：`核心梗 / 出场人物 / 基调 / 碎片情节 / 避雷 / 拓展思路 / 大纲 / 正文`，LLM 结果只写入对应区块，重复生成会覆盖该区块。

## 截图

运行插件后，把侧边栏截图保存到 `screenshots/` 目录（建议 16:9，如 1024×576），并在下方引用：

![脑洞库侧边栏](screenshots/sidebar.png)

> 上架市场前补充真实截图；首次提交时仓库可以先不带图片文件。

## 目录结构

```
writing-arena/
├─ manifest.json          # 插件清单（id、版本、最低 Obsidian 版本）
├─ package.json
├─ tsconfig.json
├─ esbuild.config.mjs
├─ versions.json
├─ styles.css
├─ version-bump.mjs
├─ screenshots/          # 上架用界面截图（自行补充）
└─ src/
   ├─ main.ts             # 插件入口、命令注册、设置页
   ├─ settings.ts         # 默认设置
   ├─ types.ts            # 脑洞数据结构
   ├─ store/
   │  ├─ IdeaStore.ts     # 脑洞笔记读写、frontmatter 解析、区块替换
   │  └─ PaperStore.ts    # 论文研读笔记模板
   ├─ service/
   │  └─ LlmService.ts    # OpenAI 兼容接口（可选）
   └─ ui/
      ├─ IdeaModal.ts     # 新建 / 编辑脑洞弹窗
      └─ IdeaListView.ts  # 脑洞库侧边栏
```

## 本地开发与构建

前置：Node.js 18+（开发时使用 v22）。

```bash
npm install
npm run dev      # 监听模式，改动后自动重新打包 main.js
npm run build    # 生产构建，输出 main.js
```

### 在自己的 vault 里试用

1. 把整个项目文件夹复制到 vault 的 `.obsidian/plugins/writing-arena/` 下；
2. 在该目录执行 `npm install && npm run build`，确认生成 `main.js`；
3. Obsidian → 设置 → 第三方插件，关闭安全模式后启用「创作工坊」；
4. 左侧功能区铅笔图标或命令面板（Ctrl/Cmd+P）调用命令。

## 发布到 GitHub

1. 新建仓库并 push 源码（`node_modules/`、`main.js` 已在 `.gitignore` 中忽略）；
2. 发 Release 前先 `npm run build`；
3. 在 Release 附件中上传三个构建产物：
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. 安装方式二选一：
   - **BRAT 插件**：添加仓库链接，自动拉取 Release 产物；
   - **手动安装**：把上述三个文件放入 vault 的 `.obsidian/plugins/writing-arena/`，重启后启用。

> 注意：只 push 源码仓库不会被 Obsidian 识别为可安装插件，必须在 Release 附带构建产物。

## 提交到官方社区市场

上架免费，Obsidian 不收上架费、不抽成，也不提供内置支付通道。提交前确认：

- 仓库根目录有 `README.md` 和 `LICENSE`（本项目采用 MIT）；
- README 已说明网络用途：LLM 接口请求、在线音频链接属于网络访问；
- 插件 ID 不含 `obsidian` 字样；不带客户端遥测、代码不混淆；
- 在 Obsidian 社区网站的开发者面板连接 GitHub 仓库提交，自动审核通过后即可被搜索下载。

变现：市场本身不收费，Free 插件可以在 README 放赞助链接（GitHub Sponsors / Ko-fi / PayPal）；若有付费功能或连接付费服务，需在面板标注 Optional payments 或 Paid。

## 设置项

- **脑洞库目录**：默认 `创作/脑洞库`
- **论文研读目录**：默认 `创作/论文研读`
- **首页封面图**：vault 内图片路径，留空不显示
- **音乐目录**：播放器扫描的本地音频目录，支持 mp3 / m4a / wav / ogg / flac
- **默认在线音频链接**：播放器预填的远程直链，也可以在播放器里临时粘贴其他链接
- **LLM（可选）**：兼容 OpenAI `/chat/completions` 协议，可填本地 Ollama、DeepSeek、通义等兼容地址；不开启时脑洞库仍可正常存档与手工整理，论文出题改为固定模板题。

## 边界说明

- 论文研读模块不读取脑洞库内容，论文笔记与同人设定保持隔离；
- LLM 只服务于脑洞的思路发散、大纲与正文起头，不替用户写完整篇；
- 所有数据都是 vault 内的 Markdown 文件，可直接手工编辑，不依赖本地数据库。
