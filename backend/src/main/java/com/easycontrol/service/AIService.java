package com.easycontrol.service;

import com.easycontrol.model.GenerateSkillRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

@Slf4j
@Service
public class AIService {

  @Value("${app.ai-api-key}")
  private String apiKey;

  @Value("${app.ai-base-url}")
  private String baseUrl;

  @Value("${app.ai-model}")
  private String model;

  private final OkHttpClient httpClient = new OkHttpClient.Builder()
      .connectTimeout(60, TimeUnit.SECONDS)
      .readTimeout(600, TimeUnit.SECONDS)
      .writeTimeout(120, TimeUnit.SECONDS)
      .build();

  private final ObjectMapper objectMapper = new ObjectMapper();

  public Map<String, Object> generateSkill(GenerateSkillRequest request, Consumer<String> logger) throws IOException {
    int frameCount = request.getFrames() != null ? request.getFrames().size() : 0;
    logger.accept("📋 开始处理请求：" + frameCount + " 帧，诉求：" + request.getRequirement());

    List<Map<String, Object>> messages = new ArrayList<>();

    Map<String, Object> systemMsg = new HashMap<>();
    systemMsg.put("role", "system");
    systemMsg.put("content", getSystemPrompt());
    messages.add(systemMsg);

    Map<String, Object> userMsg = new HashMap<>();
    userMsg.put("role", "user");
    userMsg.put("content", buildUserContent(request, logger));
    messages.add(userMsg);

    Map<String, Object> requestBody = new HashMap<>();
    requestBody.put("model", model);
    requestBody.put("max_tokens", 4096);
    requestBody.put("messages", messages);

    String jsonBody = objectMapper.writeValueAsString(requestBody);
    int approxKb = jsonBody.length() / 1024;
    logger.accept("📡 发送请求到 " + model + "，请求大小约 " + approxKb + " KB");

    Request httpRequest = new Request.Builder()
        .url(baseUrl + "/chat/completions")
        .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
        .header("Authorization", "Bearer " + apiKey)
        .header("Content-Type", "application/json")
        .build();

    logger.accept("⏳ 等待 AI 响应中...");
    long start = System.currentTimeMillis();

    try (Response response = httpClient.newCall(httpRequest).execute()) {
      String responseBody = response.body() != null ? response.body().string() : "";
      long elapsed = System.currentTimeMillis() - start;
      if (!response.isSuccessful()) {
        logger.accept("❌ API 返回错误 " + response.code() + "：" + responseBody);
        throw new IOException("AI API error: " + response.code() + " " + responseBody);
      }
      logger.accept("✅ 收到响应，耗时 " + elapsed + " ms，响应大小 " + responseBody.length() / 1024 + " KB");
      logger.accept("🔍 解析 JSON 输出...");
      Map<String, Object> result = parseResponse(responseBody);
      logger.accept("🎉 解析成功，Skill 名称：" + result.get("skillName"));
      return result;
    }
  }

  private List<Map<String, Object>> buildUserContent(GenerateSkillRequest request, Consumer<String> logger) {
    List<Map<String, Object>> content = new ArrayList<>();
    content.add(textPart("用户诉求：" + request.getRequirement() + "\n\n以下是操作视频的关键帧截图："));

    if (request.getFrames() != null) {
      for (int i = 0; i < request.getFrames().size(); i++) {
        GenerateSkillRequest.AnnotatedFrame frame = request.getFrames().get(i);
        logger.accept("🖼️  处理帧 " + (i + 1) + "/" + request.getFrames().size()
            + "（时间戳 " + String.format("%.1f", frame.getTimestamp()) + " 秒）");

        Map<String, Object> imageUrl = new HashMap<>();
        imageUrl.put("url", "data:image/jpeg;base64," + frame.getBase64Image());
        Map<String, Object> imageSource = new HashMap<>();
        imageSource.put("type", "image_url");
        imageSource.put("image_url", imageUrl);
        content.add(imageSource);

        String desc = String.format("帧 %d（时间戳 %.1f 秒）", i + 1, frame.getTimestamp());
        if (frame.getDescription() != null && !frame.getDescription().isEmpty()) {
          desc += "：" + frame.getDescription();
        }
        content.add(textPart(desc));
      }
    }
    content.add(textPart("请根据以上截图和用户诉求，生成对应的自动化 skill。输出严格遵守 JSON 格式，不要包含任何额外文字。"));
    return content;
  }

  private Map<String, Object> textPart(String text) {
    Map<String, Object> part = new HashMap<>();
    part.put("type", "text");
    part.put("text", text);
    return part;
  }

  private String getSystemPrompt() {
    return """
        你是一个 midscene 自动化脚本生成专家。分析操作视频截图，生成 midscene 脚本和 SKILL.md。

        ## 【极其重要】midscene API 规范

        所有操作必须使用 agent 的 AI 方法，绝对禁止使用原生 Puppeteer/Playwright/浏览器方法。

        ✅ 必须使用的方法（agent.xxx）：
        - agent.aiAct('自然语言描述操作步骤')          // 执行一个或多个操作
        - agent.aiTap('元素描述')                      // 点击某个元素
        - agent.aiInput('元素描述', { value: '文本' }) // 在某个输入框输入文字
        - agent.aiScroll('区域描述', { direction: 'down', scrollType: 'scrollToBottom' }) // 滚动
        - agent.aiQuery('{key: type}[], 数据描述')     // 提取页面数据，返回结构化结果
        - agent.aiAssert('断言描述')                   // 验证页面状态
        - agent.aiWaitFor('条件描述', { timeoutMs: 10000 }) // 等待某个条件成立

        ❌ 严禁使用的方法（这些是原生方法，不能用）：
        - page.click() / page.tap() / element.click()
        - page.type() / page.fill() / page.keyboard.type()
        - page.waitForSelector() / page.waitFor()
        - page.evaluate() / page.$() / page.$$()
        - element.getAttribute() / document.querySelector()
        - 任何 CSS 选择器、XPath 操作

        ## 输出 JSON 格式（不加任何 markdown 包裹）

        {
          "skillName": "kebab-case-name",
          "platform": "browser|android|ios|computer",
          "skillMd": "SKILL.md完整内容",
          "packageJson": "package.json完整内容",
          "scripts": [{ "name": "main.js", "content": "脚本完整内容" }]
        }

        ## SKILL.md 格式

        ---
        name: skill-name
        description: 详细描述技能功能和用途。包括：该技能实现什么功能、使用场景、操作流程简述、需要提取的数据字段说明。
        ---

        # 技能标题（简短描述技能名称）

        该技能的详细说明，解释自动化操作的完整流程和目的。

        ## 使用步骤

        1. 具体操作步骤1
        2. 具体操作步骤2
        3. 具体操作步骤3
        ...

        ## 注意事项

        - 前置条件或依赖说明
        - 可能的异常情况处理
        - 其他重要提示

        ## 各平台 main.js 模板

        ### browser（必须用 PuppeteerAgent，必须只用 agent.aiXxx 方法）

        require('dotenv').config();
        const puppeteer = require('puppeteer');
        const { PuppeteerAgent } = require('@midscene/web/puppeteer');

        async function main() {
          const browser = await puppeteer.launch({ headless: false });
          const page = await browser.newPage();
          await page.goto('目标URL');
          const agent = new PuppeteerAgent(page);

          await agent.aiAct('点击登录按钮');
          await agent.aiInput('用户名输入框', { value: 'admin' });
          await agent.aiInput('密码输入框', { value: '123456' });
          await agent.aiTap('登录按钮');
          await agent.aiWaitFor('页面加载完成');
          const result = await agent.aiQuery('{title: string, url: string}[], 所有结果列表');
          await agent.aiAssert('结果列表不为空');

          await agent.destroy();
          await browser.close();
          return result;
        }

        module.exports = { main };

        ### browser 对应的 package.json

        {
          "name": "skill-name",
          "version": "1.0.0",
          "description": "技能描述",
          "main": "scripts/main.js",
          "scripts": {
            "start": "node scripts/main.js"
          },
          "dependencies": {
            "@midscene/web": "^1.5.6",
            "puppeteer": "^24.0.0",
            "dotenv": "^17.0.0"
          }
        }

        ### android（用 agentFromAdbDevice）

        require('dotenv').config();
        const { agentFromAdbDevice } = require('@midscene/android');

        async function main(deviceId) {
          const agent = await agentFromAdbDevice(deviceId, {
            aiActionContext: '如有权限弹窗，点击同意。',
          });

          await agent.aiAct('打开目标应用');
          await agent.aiTap('搜索按钮');
          await agent.aiInput('搜索输入框', { value: '关键词' });
          await agent.aiScroll(undefined, { direction: 'down', scrollType: 'scrollToBottom' });
          const result = await agent.aiQuery('{name: string, value: string}[], 列表所有项');

          await agent.destroy();
          return result;
        }

        module.exports = { main };

        ### android 对应的 package.json

        {
          "name": "skill-name",
          "version": "1.0.0",
          "description": "技能描述",
          "main": "scripts/main.js",
          "scripts": {
            "start": "node scripts/main.js"
          },
          "dependencies": {
            "@midscene/android": "^1.5.6",
            "dotenv": "^17.0.0"
          }
        }

        ### ios（用 agentFromWebDriverAgent）

        require('dotenv').config();
        const { agentFromWebDriverAgent } = require('@midscene/ios');

        async function main(udid) {
          const agent = await agentFromWebDriverAgent(udid, {
            aiActionContext: '如有权限弹窗，点击允许。',
          });

          await agent.aiAct('打开目标页面');
          await agent.aiTap('目标按钮');
          const result = await agent.aiQuery('{name: string}[], 列表所有项');

          await agent.destroy();
          return result;
        }

        module.exports = { main };

        ### ios 对应的 package.json

        {
          "name": "skill-name",
          "version": "1.0.0",
          "description": "技能描述",
          "main": "scripts/main.js",
          "scripts": {
            "start": "node scripts/main.js"
          },
          "dependencies": {
            "@midscene/ios": "^1.5.6",
            "dotenv": "^17.0.0"
          }
        }

        ### computer（用 agentFromComputer）

        require('dotenv').config();
        const { agentFromComputer } = require('@midscene/computer');

        async function main() {
          const agent = await agentFromComputer();

          await agent.aiAct('执行操作步骤');
          const result = await agent.aiQuery('string, 结果内容');

          await agent.destroy();
          return result;
        }

        module.exports = { main };

        ### computer 对应的 package.json

        {
          "name": "skill-name",
          "version": "1.0.0",
          "description": "技能描述",
          "main": "scripts/main.js",
          "scripts": {
            "start": "node scripts/main.js"
          },
          "dependencies": {
            "@midscene/computer": "^1.5.6",
            "dotenv": "^17.0.0"
          }
        }

        ## 生成规则

        1. 从截图判断 platform：手机界面→android/ios，浏览器→browser，桌面软件→computer
        2. 脚本中每一步都必须对应截图中的实际操作，用自然语言描述操作目标
        3. 所有操作方法只能是 agent.aiAct / agent.aiTap / agent.aiInput / agent.aiScroll / agent.aiQuery / agent.aiAssert / agent.aiWaitFor
        4. 禁止使用任何原生 DOM/CSS/XPath 操作
        5. main 函数末尾 return 提取的数据，无数据提取则 return null
        6. 代码用 2 空格缩进，字符串用单引号
        """;
  }

  private Map<String, Object> parseResponse(String responseBody) throws IOException {
    JsonNode root = objectMapper.readTree(responseBody);
    String text = root.path("choices").get(0).path("message").path("content").asText();

    String jsonText = text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```\\s*$", "").trim();
    }
    int start = jsonText.indexOf('{');
    int end = jsonText.lastIndexOf('}');
    if (start >= 0 && end > start) {
      jsonText = jsonText.substring(start, end + 1);
    }

    try {
      JsonNode result = objectMapper.readTree(jsonText);
      Map<String, Object> resultMap = new HashMap<>();
      resultMap.put("skillName", result.path("skillName").asText("untitled-skill"));
      resultMap.put("platform", result.path("platform").asText("browser"));
      resultMap.put("skillMd", result.path("skillMd").asText(""));
      resultMap.put("packageJson", result.path("packageJson").asText(""));

      List<Map<String, String>> scripts = new ArrayList<>();
      JsonNode scriptsNode = result.path("scripts");
      if (scriptsNode.isArray()) {
        for (JsonNode script : scriptsNode) {
          Map<String, String> s = new HashMap<>();
          s.put("name", script.path("name").asText("main.js"));
          s.put("content", script.path("content").asText(""));
          scripts.add(s);
        }
      }
      resultMap.put("scripts", scripts);
      return resultMap;
    } catch (Exception e) {
      log.error("Failed to parse AI response: {}", jsonText);
      throw new IOException("Failed to parse AI response: " + e.getMessage());
    }
  }
}
