# Easy Control 项目文档

## 项目概述

**Easy Control** 是一个视频转 Skill 工具：用户上传操作视频，AI 自动生成可复用的 midscene 自动化脚本。

### 核心功能

1. **视频上传与处理** - 支持 MP4/MOV/AVI 等格式，最大 500MB
2. **智能抽帧** - FFmpeg 自动提取关键帧，支持手动精选
3. **可视化标注** - 在帧上画箭头、标注文字，引导 AI 理解
4. **AI 生成 Skill** - 通义千问 VL 多模态模型分析，自动生成 midscene 脚本
5. **Skill 编辑器** - 查看/编辑生成的代码
6. **Skill 运行器** - 直接在浏览器中运行生成的脚本
7. **资源归档** - 保存视频、帧、诉求历史到本地归档库

---

## 技术架构

### 前端技术栈

| 技术 | 用途 |
|------|------|
| React 18 + Vite | 前端框架 + 构建工具 |
| Zustand | 状态管理 |
| React Router | 路由管理 |
| Tailwind CSS | 样式框架 |
| Fabric.js | 画布标注 |
| Monaco Editor | 代码编辑器 |
| JSZip | ZIP 导出 |
| Axios | HTTP 客户端 |

### 后端技术栈

| 技术 | 用途 |
|------|------|
| Spring Boot 3 (Java 17) | 后端框架 |
| Spring Data JPA | 数据持久化 |
| SQLite | 嵌入式数据库 |
| Spring WebSocket | 实时通信（Skill 运行） |
| OkHttp | HTTP 客户端（调用 AI API） |
| FFmpeg | 视频处理 |
| Lombok | 代码简化 |

### AI 配置

- **模型**: 通义千问 VL Plus (`qwen3-vl-plus`)
- **API 基础 URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **API Key**: 配置在 `application.yml` 的 `app.ai-api-key`

---

## 项目结构

```
easy-skill/
├── backend/                        # Spring Boot 后端
│   ├── src/main/java/com/easycontrol/
│   │   ├── EasyControlApplication.java    # 启动类
│   │   ├── config/                        # 配置类
│   │   │   ├── CorsConfig.java           # CORS 配置
│   │   │   └── WebSocketConfig.java      # WebSocket 配置
│   │   ├── controller/                    # REST 控制器
│   │   │   ├── VideoController.java      # 视频上传/抽帧
│   │   │   ├── SkillController.java      # Skill 生成/管理
│   │   │   ├── DeviceController.java     # 设备检测
│   │   │   └── ArchiveController.java    # 资源归档
│   │   ├── service/                       # 业务逻辑
│   │   │   ├── VideoService.java         # 视频处理
│   │   │   ├── SkillService.java         # Skill 生成/部署
│   │   │   ├── SkillRunnerService.java   # Skill 运行器
│   │   │   ├── AIService.java            # AI API 调用
│   │   │   └── ArchiveService.java       # 归档管理
│   │   ├── model/                         # 数据模型
│   │   │   ├── SkillRecord.java          # Skill 记录（数据库）
│   │   │   ├── VideoArchive.java         # 视频归档
│   │   │   ├── FrameArchive.java         # 帧归档
│   │   │   └── RequirementHistory.java   # 诉求历史
│   │   ├── repository/                    # JPA 仓库
│   │   └── websocket/                     # WebSocket 处理器
│   │       └── SkillRunWebSocketHandler.java
│   └── src/main/resources/
│       └── application.yml               # 应用配置
│
└── frontend/                         # React 前端
    ├── src/
    │   ├── main.jsx                  # 入口文件
    │   ├── App.jsx                   # 根组件（路由）
    │   ├── pages/                    # 页面组件
    │   │   ├── HomePage.jsx          # 首页（视频上传）
    │   │   └── PlaygroundPage.jsx    # 工作台（标注/编辑/运行）
    │   ├── components/               # 可复用组件
    │   │   ├── VideoPlayer.jsx       # 视频播放器
    │   │   ├── FrameTimeline.jsx     # 帧时间轴
    │   │   ├── FrameAnnotator.jsx    # 画布标注
    │   │   ├── FrameList.jsx         # 帧列表
    │   │   ├── RequirementHistorySelector.jsx  # 诉求历史选择器
    │   │   ├── AIProcessor.jsx       # AI 生成处理
    │   │   ├── SkillEditor.jsx       # Skill 编辑器
    │   │   ├── SkillList.jsx         # Skill 列表
    │   │   ├── SkillExport.jsx       # Skill 导出
    │   │   ├── SkillRunner.jsx       # Skill 运行器
    │   │   └── ArchiveBrowser.jsx    # 归档浏览器
    │   ├── store/
    │   │   └── useAppStore.js        # Zustand 状态管理
    │   └── api/
    │       └── client.js             # API 客户端封装
    ├── package.json
    └── vite.config.js
```

---

## 核心数据模型

### SkillRecord (Skill 记录)

```java
@Entity
@Table(name = "skill_records")
public class SkillRecord {
    String skillId;          // UUID
    String skillName;        // Skill 名称
    String platform;         // browser/android/ios/computer
    String description;      // 描述
    LocalDateTime createdAt; // 创建时间
}
```

### VideoArchive (视频归档)

```java
@Entity
@Table(name = "video_archives")
public class VideoArchive {
    String id;               // UUID
    String videoId;          // 原始视频 ID
    String filename;         // 文件名
    Long duration;           // 时长（秒）
    Long fileSize;           // 文件大小
    String filePath;         // 存储路径
    String description;      // 描述
    LocalDateTime createdAt; // 创建时间
}
```

### FrameArchive (帧归档)

```java
@Entity
@Table(name = "frame_archives")
public class FrameArchive {
    String id;               // UUID
    String frameId;          // 原始帧 ID
    String videoId;          // 原始视频 ID
    String videoArchiveId;   // 关联的视频归档 ID
    Double timestamp;        // 时间戳（秒）
    String imagePath;        // 图片路径
    String description;      // 描述
    String annotationJson;   // 标注数据（JSON）
    LocalDateTime createdAt; // 创建时间
}
```

### RequirementHistory (诉求历史)

```java
@Entity
@Table(name = "requirement_history")
public class RequirementHistory {
    String id;               // UUID
    String content;          // 诉求内容
    String frameIds;         // 关联的帧 ID 列表（逗号分隔）
    String platform;         // 平台类型
    Integer useCount;        // 使用次数
    LocalDateTime lastUsedAt;// 最后使用时间
}
```

---

## 核心 API 接口

### 视频相关

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/videos/upload` | 上传视频文件 |
| POST | `/api/videos/{id}/frames/auto` | 自动抽帧（指定间隔秒数） |
| POST | `/api/videos/{id}/frames/manual` | 手动抽帧（指定时间戳列表） |
| GET | `/api/videos/{id}/stream` | 获取视频流 |

### Skill 相关

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/skills` | 获取 Skill 列表 |
| POST | `/api/skills/generate` | AI 生成 Skill |
| GET | `/api/skills/logs/{sessionId}` | SSE 日志流 |
| GET | `/api/skills/{id}` | 获取 Skill 详情 |
| PUT | `/api/skills/{id}/files` | 更新 Skill 文件 |
| GET | `/api/skills/{id}/export` | 导出 ZIP 文件 |
| DELETE | `/api/skills/{id}` | 删除 Skill |
| POST | `/api/skills/{id}/deploy` | 部署到本地 |

### 设备相关

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/devices/android` | 获取 Android 设备列表 |
| GET | `/api/devices/ios` | 获取 iOS 设备列表 |
| GET | `/api/devices` | 获取所有设备列表 |

### 归档相关

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/archives/videos` | 保存视频归档 |
| GET | `/api/archives/videos` | 获取视频归档列表 |
| DELETE | `/api/archives/videos/{id}` | 删除视频归档 |
| POST | `/api/archives/frames` | 保存帧归档 |
| GET | `/api/archives/frames` | 获取帧归档列表 |
| GET | `/api/archives/frames/video/{videoId}` | 获取指定视频的帧 |
| DELETE | `/api/archives/frames/{id}` | 删除帧归档 |
| POST | `/api/archives/requirements` | 保存诉求历史 |
| GET | `/api/archives/requirements` | 获取诉求历史列表 |
| GET | `/api/archives/requirements/recent` | 获取最近诉求 |
| DELETE | `/api/archives/requirements/{id}` | 删除诉求历史 |

---

## 核心服务说明

### VideoService

- `uploadVideo(file)` - 上传视频并获取时长
- `extractFramesAuto(videoId, interval)` - 按指定间隔自动抽帧
- `extractFramesManual(videoId, timestamps)` - 按指定时间戳手动抽帧
- `getVideoPath(videoId)` - 获取视频文件路径

### SkillService

- `generateSkill(request, logger)` - 调用 AI 生成 Skill
- `listSkills()` - 获取 Skill 列表
- `getSkill(skillId)` - 获取 Skill 详情
- `updateFile(skillId, path, content)` - 更新文件内容
- `exportZip(skillId)` - 导出 ZIP
- `deleteSkill(skillId)` - 删除 Skill
- `deployToLocal(skillId)` - 部署到 ~/.openclaw/skills

### AIService

- `generateSkill(request, logger)` - 调用通义千问 VL API 生成 Skill
  - 构建多模态请求（截图 + 诉求）
  - 解析 AI 返回的 JSON（skillName, platform, skillMd, scripts）

### SkillRunnerService

- `runSkill(skillId, options, logger)` - 运行 Skill 脚本
  - 创建临时目录
  - 写入文件并修复 package.json 版本号
  - 注入监控代码（日志 + 截图）
  - 执行 `npm install` 和 `node scripts/main.js`
  - 收集执行结果和截图
- `listAndroidDevices()` - 获取 Android 设备列表
- `listIosDevices()` - 获取 iOS 设备列表

### ArchiveService

- `saveVideo(videoId, description)` - 保存视频归档
- `saveFrame(frameId, videoId, timestamp, image, desc, annotation, videoArchiveId)` - 保存帧归档
- `saveRequirement(content, frameIds, platform)` - 保存诉求历史
- `listVideoArchives()` / `listFrameArchives()` / `listRequirementHistory()` - 列表查询
- `deleteVideoArchive(id)` / `deleteFrameArchive(id)` / `deleteRequirement(id)` - 删除归档

---

## 前端状态管理 (useAppStore)

### 核心状态

```javascript
{
  // 视频状态
  videoId: null,
  videoFilename: null,
  videoDuration: 0,

  // 帧状态
  frames: [],  // { frameId, timestamp, base64Image, description, annotationJson }
  selectedFrameId: null,

  // 诉求
  requirement: '',

  // Skill 状态
  skillId: null,
  skillName: null,
  skillFiles: [],  // { name, path, content }

  // 应用状态
  activeTab: 'annotate',  // 'annotate' | 'skill'
  isGenerating: false,
  skillList: [],
}
```

### 核心 Action

- `setVideo(videoId, filename, duration)` - 设置视频
- `addFrames(newFrames)` - 添加帧
- `updateFrameDescription(frameId, desc)` - 更新帧描述
- `updateFrameAnnotation(frameId, json)` - 更新帧标注
- `setRequirement(req)` - 设置诉求
- `setSkill(skillId, name, files)` - 设置 Skill
- `setActiveTab(tab)` - 切换标签页
- `reset()` - 重置状态

---

## 使用流程

1. **上传视频** - 在首页拖拽或选择视频文件
2. **自动抽帧** - 设置间隔秒数，点击「自动抽帧」
3. **标注帧** - 选择帧，在画布上添加箭头/文字标注
4. **填写诉求** - 输入用户诉求（如：帮我收集微信视频号热榜列表）
5. **生成 Skill** - 点击「生成 Skill」，等待 AI 分析
6. **编辑 Skill** - 在 Skill 编辑器查看/修改生成的代码
7. **运行 Skill** - 选择平台（Browser/Android/iOS），点击运行
8. **导出/部署** - 下载 ZIP 或部署到本地 ~/.openclaw/skills

---

## 环境配置

### 后端配置 (application.yml)

```yaml
server:
  port: 8080

spring:
  servlet:
    multipart:
      max-file-size: 500MB
      max-request-size: 500MB
  datasource:
    url: jdbc:sqlite:${user.home}/easy-control/easy-skill.db
  jpa:
    hibernate:
      ddl-auto: update

app:
  upload-dir: ${user.home}/easy-control/uploads
  skills-dir: ${user.home}/easy-control/skills
  archive-dir: ${user.home}/easy-control/archives
  ffmpeg-path: ffmpeg
  ai-api-key: your_api_key
  ai-base-url: https://dashscope.aliyuncs.com/compatible-mode/v1
  ai-model: qwen3-vl-plus
```

### 前端配置

- Vite 代理配置在 `vite.config.js`，转发 `/api` 到 `http://localhost:8080`

### 系统依赖

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg
```

---

## 启动命令

### 后端

```bash
cd backend
export JAVA_HOME=/Users/rainman/Library/Java/JavaVirtualMachines/oracle_open_jdk-17/Contents/Home
mvn spring-boot:run
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

---

## WebSocket 通信

Skill 运行器通过 WebSocket 与后端通信：

### 客户端消息

```json
{ "action": "run", "skillId": "xxx", "platform": "browser", "targetUrl": "https://...", "headless": false }
{ "action": "stop" }
```

### 服务端消息

```json
{ "type": "connected", "message": "已连接到 Skill 运行服务" }
{ "type": "started", "skillId": "xxx", "message": "开始运行 Skill..." }
{ "type": "log", "message": "🎯 步骤 1: aiTap - 点击按钮" }
{ "type": "completed", "success": true, "exitCode": 0, "screenshots": [...] }
{ "type": "error", "message": "错误信息" }
```

---

## AI Prompt 系统

### System Prompt 要点

1. **midscene API 规范** - 必须使用 `agent.aiXxx` 方法，禁止使用原生 Puppeteer/Playwright
2. **可用方法**:
   - `agent.aiAct()` - 执行操作
   - `agent.aiTap()` - 点击
   - `agent.aiInput()` - 输入
   - `agent.aiScroll()` - 滚动
   - `agent.aiQuery()` - 数据提取
   - `agent.aiAssert()` - 断言
   - `agent.aiWaitFor()` - 等待

3. **输出格式** - JSON，包含 skillName, platform, skillMd, packageJson, scripts

### 多平台支持

- **browser**: PuppeteerAgent + @midscene/web
- **android**: agentFromAdbDevice + @midscene/android
- **ios**: agentFromWebDriverAgent + @midscene/ios
- **computer**: agentFromComputer + @midscene/computer

---

## 注意事项

1. **Java 版本**: 必须使用 Java 17+（Spring Boot 3.2.3 要求）
2. **FFmpeg**: 需要安装并在 PATH 中
3. **数据库**: SQLite 自动创建在 `~/easy-control/easy-skill.db`
4. **文件存储**: 所有上传和生成的文件存储在 `~/easy-control/` 子目录
5. ** Skill 运行**: 需要 Node.js 和对应平台的 midscene 依赖
