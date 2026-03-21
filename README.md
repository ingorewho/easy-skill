# Easy Control

视频转 Skill 工具：上传操作视频，AI 自动生成可复用的 midscene 自动化脚本。

## 快速启动

### 1. 后端（Spring Boot）

```bash
cd backend
export CLAUDE_API_KEY=your_api_key_here
mvn spring-boot:run
```

后端运行在 http://localhost:8080

**依赖：**
- Java 17+
- Maven
- FFmpeg（需要安装并在 PATH 中）

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg
```

### 2. 前端（React + Vite）

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000

## 使用流程

1. 打开 http://localhost:3000
2. 上传操作视频（MP4/MOV 等）
3. 点击「自动抽帧」或在视频时间轴截取帧
4. 在画布上标注箭头/文字，说明操作步骤
5. 填写「用户诉求」，如：帮我收集微信视频号热榜列表
6. 点击「生成 Skill」，等待 AI 分析
7. 在 Skill 编辑器中查看/编辑生成的代码
8. 下载 ZIP 文件

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS |
| 状态管理 | Zustand |
| 画布标注 | Fabric.js |
| 代码编辑器 | Monaco Editor |
| 文件导出 | JSZip |
| 后端 | Spring Boot 3 (Java 17) |
| 视频处理 | FFmpeg |
| AI | Claude API (claude-opus-4-5, 多模态) |

## API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/videos/upload` | 上传视频 |
| POST | `/api/videos/{id}/frames/auto` | 自动抽帧 |
| POST | `/api/videos/{id}/frames/manual` | 手动抽帧 |
| GET | `/api/videos/{id}/stream` | 视频流 |
| POST | `/api/skills/generate` | AI 生成 Skill |
| GET | `/api/skills/{id}` | 获取 Skill |
| PUT | `/api/skills/{id}/files` | 更新文件 |
| GET | `/api/skills/{id}/export` | 下载 ZIP |
