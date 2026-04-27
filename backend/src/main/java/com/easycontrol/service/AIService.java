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
    return generateSkill(request, null, logger);
  }

  public Map<String, Object> generateSkill(GenerateSkillRequest request, String additionalPrompt, Consumer<String> logger) throws IOException {
    return generateSkillWithImages(request, additionalPrompt, model, logger);
  }

  /**
   * 使用图片的多模态生成（首次生成时使用）
   */
  public Map<String, Object> generateSkillWithImages(GenerateSkillRequest request, String additionalPrompt, String useModel, Consumer<String> logger) throws IOException {
    int frameCount = request.getFrames() != null ? request.getFrames().size() : 0;
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      logger.accept("🔄 重新生成模式：第 N 次迭代，补充要求已添加");
    }
    logger.accept("📋 开始处理请求：" + frameCount + " 帧，诉求：" + request.getRequirement());

    List<Map<String, Object>> messages = new ArrayList<>();

    Map<String, Object> systemMsg = new HashMap<>();
    systemMsg.put("role", "system");
    systemMsg.put("content", getSystemPrompt());
    messages.add(systemMsg);

    Map<String, Object> userMsg = new HashMap<>();
    userMsg.put("role", "user");
    userMsg.put("content", buildUserContent(request, additionalPrompt, logger));
    messages.add(userMsg);

    Map<String, Object> requestBody = new HashMap<>();
    requestBody.put("model", useModel);
    requestBody.put("max_tokens", 4096);
    requestBody.put("messages", messages);

    String jsonBody = objectMapper.writeValueAsString(requestBody);
    int approxKb = jsonBody.length() / 1024;
    logger.accept("📡 发送请求到 " + useModel + "，请求大小约 " + approxKb + " KB");

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

  /**
   * 纯文本生成（重新生成时使用，不携带图片，使用文本模型如 qwen3.5-plus）
   */
  public Map<String, Object> generateSkillTextOnly(
      String requirement,
      String additionalPrompt,
      List<SkillContextFrame> frames,
      String currentCode,
      String useModel,
      Consumer<String> logger) throws IOException {
    
    logger.accept("📋 开始纯文本重新生成，诉求：" + requirement);
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      logger.accept("📝 补充要求：" + additionalPrompt.substring(0, Math.min(additionalPrompt.length(), 100)) + "...");
    }

    List<Map<String, Object>> messages = new ArrayList<>();

    Map<String, Object> systemMsg = new HashMap<>();
    systemMsg.put("role", "system");
    systemMsg.put("content", getSystemPromptForTextRegeneration());
    messages.add(systemMsg);

    Map<String, Object> userMsg = new HashMap<>();
    userMsg.put("role", "user");
    userMsg.put("content", buildTextOnlyContent(requirement, additionalPrompt, frames, currentCode, logger));
    messages.add(userMsg);

    Map<String, Object> requestBody = new HashMap<>();
    requestBody.put("model", useModel);
    requestBody.put("max_tokens", 4096);
    requestBody.put("messages", messages);

    String jsonBody = objectMapper.writeValueAsString(requestBody);
    int approxKb = jsonBody.length() / 1024;
    logger.accept("📡 发送请求到 " + useModel + "（纯文本模式），请求大小约 " + approxKb + " KB");

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

  // ==================== 局部重新生成新方法 ====================

  /**
   * 局部重新生成 - 多模态模式（携带图片 + 代码范围）
   */
  public Map<String, Object> generatePartialWithImages(
      String requirement,
      String additionalPrompt,
      List<GenerateSkillRequest.AnnotatedFrame> selectedFrames,
      String currentFullCode,
      com.easycontrol.controller.SkillController.CodeRange selectedCodeRange,
      String useModel,
      Consumer<String> logger) throws IOException {
    
    logger.accept("📋 开始局部重新生成（多模态模式），诉求：" + requirement);
    logger.accept("🖼️ 携带 " + (selectedFrames != null ? selectedFrames.size() : 0) + " 张参考图片");
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      logger.accept("📝 补充要求：" + additionalPrompt.substring(0, Math.min(additionalPrompt.length(), 100)) + "...");
    }

    List<Map<String, Object>> messages = new ArrayList<>();

    Map<String, Object> systemMsg = new HashMap<>();
    systemMsg.put("role", "system");
    systemMsg.put("content", getSystemPromptForPartialRegeneration(true));
    messages.add(systemMsg);

    Map<String, Object> userMsg = new HashMap<>();
    userMsg.put("role", "user");
    userMsg.put("content", buildPartialContentWithImages(
        requirement, additionalPrompt, selectedFrames, currentFullCode, selectedCodeRange, logger));
    messages.add(userMsg);

    Map<String, Object> requestBody = new HashMap<>();
    requestBody.put("model", useModel);
    requestBody.put("max_tokens", 4096);
    requestBody.put("messages", messages);

    String jsonBody = objectMapper.writeValueAsString(requestBody);
    int approxKb = jsonBody.length() / 1024;
    logger.accept("📡 发送请求到 " + useModel + "（多模态局部模式），请求大小约 " + approxKb + " KB");

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

  /**
   * 局部重新生成 - 纯文本模式（代码范围）
   */
  public Map<String, Object> generatePartialTextOnly(
      String requirement,
      String additionalPrompt,
      List<SkillContextFrame> contextFrames,
      String currentFullCode,
      com.easycontrol.controller.SkillController.CodeRange selectedCodeRange,
      String useModel,
      Consumer<String> logger) throws IOException {
    
    logger.accept("📋 开始局部重新生成（纯文本模式），诉求：" + requirement);
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      logger.accept("📝 补充要求：" + additionalPrompt.substring(0, Math.min(additionalPrompt.length(), 100)) + "...");
    }

    List<Map<String, Object>> messages = new ArrayList<>();

    Map<String, Object> systemMsg = new HashMap<>();
    systemMsg.put("role", "system");
    systemMsg.put("content", getSystemPromptForPartialRegeneration(false));
    messages.add(systemMsg);

    Map<String, Object> userMsg = new HashMap<>();
    userMsg.put("role", "user");
    userMsg.put("content", buildPartialTextContent(
        requirement, additionalPrompt, contextFrames, currentFullCode, selectedCodeRange, logger));
    messages.add(userMsg);

    Map<String, Object> requestBody = new HashMap<>();
    requestBody.put("model", useModel);
    requestBody.put("max_tokens", 4096);
    requestBody.put("messages", messages);

    String jsonBody = objectMapper.writeValueAsString(requestBody);
    int approxKb = jsonBody.length() / 1024;
    logger.accept("📡 发送请求到 " + useModel + "（纯文本局部模式），请求大小约 " + approxKb + " KB");

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
    return buildUserContent(request, null, logger);
  }

  private List<Map<String, Object>> buildUserContent(GenerateSkillRequest request, String additionalPrompt, Consumer<String> logger) {
    List<Map<String, Object>> content = new ArrayList<>();
    
    // 基础诉求
    StringBuilder promptBuilder = new StringBuilder();
    promptBuilder.append("用户诉求：").append(request.getRequirement()).append("\n\n");
    
    // 补充要求（重新生成时使用）
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      promptBuilder.append("补充要求：\n").append(additionalPrompt).append("\n\n");
    }
    
    promptBuilder.append("以下是操作视频的关键帧截图：");
    content.add(textPart(promptBuilder.toString()));

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
        - agent.aiAction('自然语言描述操作步骤')       // 执行一个或多个操作
        - agent.aiTap('元素描述')                      // 点击某个元素
        - agent.aiHover('元素描述')                    // 鼠标悬停
        - agent.aiInput('元素描述', '文本内容')        // 在某个输入框输入文字
        - agent.aiKeyboard('快捷键')                   // 发送键盘快捷键，如 'Enter', 'Command+A'
        - agent.aiScroll({ direction: 'down', scrollType: 'untilBottom' }) // 滚动，scrollType: untilBottom|once
        - agent.aiQuery('{key: type}[], 数据描述')     // 提取页面数据，返回结构化结果
        - agent.aiAssert('断言描述')                   // 验证页面状态
        - agent.aiWaitFor('条件描述')                  // 等待某个条件成立

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
          "scripts": [{ "name": "main.js", "content": "脚本完整内容" }],
          "variables": [
            { "name": "searchKeyword", "label": "搜索关键词", "defaultValue": "手机壳", "type": "string" },
            { "name": "maxResults", "label": "最大结果数", "defaultValue": "10", "type": "number" }
          ]
        }

        ## 【步骤1】变量识别（必须先完成此步骤）

        在生成任何代码之前，首先分析截图中的用户操作，识别所有**输入框中被输入的内容**，这些必须抽取为变量。

        ### 变量识别规则：
        1. 查看每一帧截图，找出用户在输入框中输入的内容
        2. 任何在输入框中输入的文字、URL、数字都必须是变量
        3. 常见场景：搜索关键词、商品链接、用户名、密码、筛选条件

        ### 输出要求：
        - 必须在 output JSON 中包含 `variables` 字段（不能为空数组，除非确实没有输入）
        - 每个变量必须包含：name(英文驼峰)、label(中文)、defaultValue(视频中的值)、type(string/number/boolean)

        ### 示例（商品链接采集场景）：
        如果视频中用户在搜索框输入了 `https://mobile.pinduoduo.com/goods.html?goods_id=123456789`
        
        必须输出：
        ```json
        "variables": [
          {
            "name": "productUrl",
            "label": "商品链接",
            "defaultValue": "https://mobile.pinduoduo.com/goods.html?goods_id=123456789",
            "type": "string"
          }
        ]
        ```

        ## 【步骤2】代码生成（使用步骤1的变量）

        ### main 函数签名要求：
        - browser: `async function main(variables)`
        - android: `async function main(deviceId, variables)`
        - ios: `async function main(udid, variables)`
        - computer: `async function main(variables)`

        ### 代码中必须使用变量（关键！）：
        ```javascript
        async function main(deviceId, variables) {
          // 从 variables 参数读取，提供默认值
          const productUrl = variables?.productUrl || 'https://mobile.pinduoduo.com/goods.html?goods_id=123456789';
          
          // ... agent 初始化 ...
          
          // ❌ 绝对禁止硬编码：
          // await agent.aiInput('搜索框', 'https://mobile.pinduoduo.com/goods.html?goods_id=123456789');
          
          // ✅ 必须使用变量：
          await agent.aiInput('搜索框', productUrl);
        }
        ```

        ### 强制检查（生成前必须确认）：
        - [ ] variables 数组已定义且不为空（有输入操作时）
        - [ ] main 函数接收 variables 参数
        - [ ] 所有输入框的值都使用 `variables?.xxx || '默认值'` 格式
        - [ ] 代码中没有硬编码的输入值
        - [ ] **严禁生成 `if (require.main === module)` 代码块**（运行器会自动调用 main 函数）

        ## SKILL.md 格式（文档说明，不包含代码）

        SKILL.md 文件应该只包含技能的使用说明文档，不包含任何脚本代码。脚本代码放在 scripts/main.js 中。

        ---
        name: skill-name
        description: 详细描述技能功能和用途。包括：该技能实现什么功能、使用场景、操作流程简述、需要提取的数据字段说明。
        platform: browser|android|ios|computer
        version: 1.0.0
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

        ## 变量说明

        | 变量名 | 类型 | 说明 | 默认值 |
        |--------|------|------|--------|
        | xxx | string | 变量说明 | 默认值 |

        ## 生成规则

        1. 从截图判断 platform：手机界面→android/ios，浏览器→browser，桌面软件→computer
        2. 脚本中每一步都必须对应截图中的实际操作，用自然语言描述操作目标
        3. 所有操作方法只能是 agent.aiAction / agent.aiTap / agent.aiHover / agent.aiInput / agent.aiKeyboard / agent.aiScroll / agent.aiQuery / agent.aiAssert / agent.aiWaitFor
        4. 禁止使用任何原生 DOM/CSS/XPath 操作
        5. main 函数必须返回标准 JSON 格式：{ success: boolean, data: any, timestamp: string, error?: string }
           - success: 操作是否成功
           - data: 提取的数据（使用 aiQuery 获取）
           - timestamp: ISO 格式时间戳
           - error: 可选的错误信息
        6. 代码用 2 空格缩进，字符串用单引号
        7. 所有数据提取必须通过 aiQuery 完成，返回的数据要结构化

        ## 【知识库】运行时上下文注入

        运行器会自动加载 skill 根目录下 `knowledge/` 中的图片和文档，并在全局提供：

        ```javascript
        globalThis.__KNOWLEDGE__ = {
          context: string,                        // 已自动注入到 agent.aiActContext，无需手动处理
          texts: [{ name, description, content }],// 可选引用
          images: [{ name, url, fileName, description }] // url 为 base64 data URI
        }
        ```

        **约定**：
        - 文本知识已通过 `aiActContext` 自动生效，生成代码时不必主动拼接。
        - 当业务需要"找到和参考图一致的按钮/商品/图标"等视觉匹配场景时，主动调用带 images 参数的形式：
          ```javascript
          const kb = globalThis.__KNOWLEDGE__ || { images: [] };
          const refImg = kb.images.find(i => i.fileName === 'target-button.png');
          if (refImg) {
            await agent.aiTap({ prompt: '页面上和参考图一致的按钮', images: [refImg] });
          } else {
            await agent.aiTap('主要操作按钮');
          }
          ```
        - 禁止对知识库做 I/O（不要 fs.readFile），只使用 `globalThis.__KNOWLEDGE__`。
        - 如果用户诉求里提到"参考图"、"标准界面"、"这种样式"等视觉匹配意图，则必须使用 images 参数引用知识库图片。
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

      // 解析变量定义
      List<Map<String, String>> variables = new ArrayList<>();
      JsonNode variablesNode = result.path("variables");
      if (variablesNode.isArray()) {
        for (JsonNode var : variablesNode) {
          Map<String, String> v = new HashMap<>();
          v.put("name", var.path("name").asText(""));
          v.put("label", var.path("label").asText(""));
          v.put("defaultValue", var.path("defaultValue").asText(""));
          v.put("type", var.path("type").asText("string"));
          variables.add(v);
        }
      }
      resultMap.put("variables", variables);
      
      return resultMap;
    } catch (Exception e) {
      log.error("Failed to parse AI response: {}", jsonText);
      throw new IOException("Failed to parse AI response: " + e.getMessage());
    }
  }

  // ==================== 纯文本重新生成辅助方法 ====================

  /**
   * 纯文本重新生成的系统提示词（不依赖图片）
   */
  private String getSystemPromptForTextRegeneration() {
    return """
        你是一个 midscene 自动化脚本优化专家。基于用户提供的当前代码和修改要求，优化和改进自动化脚本。

        ## 【极其重要】midscene API 规范

        所有操作必须使用 agent 的 AI 方法，绝对禁止使用原生 Puppeteer/Playwright/浏览器方法。

        ✅ 必须使用的方法（agent.xxx）：
        - agent.aiAction('自然语言描述操作步骤')       // 执行一个或多个操作
        - agent.aiTap('元素描述')                      // 点击某个元素
        - agent.aiHover('元素描述')                    // 鼠标悬停
        - agent.aiInput('元素描述', '文本内容')        // 在某个输入框输入文字
        - agent.aiKeyboard('快捷键')                   // 发送键盘快捷键，如 'Enter', 'Command+A'
        - agent.aiScroll({ direction: 'down', scrollType: 'untilBottom' }) // 滚动
        - agent.aiQuery('{key: type}[], 数据描述')     // 提取页面数据
        - agent.aiAssert('断言描述')                   // 验证页面状态
        - agent.aiWaitFor('条件描述')                  // 等待某个条件成立

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
          "skillMd": "SKILL.md文档内容（不包含代码，只有说明文档）",
          "packageJson": "package.json完整内容",
          "scripts": [{ "name": "main.js", "content": "脚本完整内容" }],
          "variables": [
            { "name": "searchKeyword", "label": "搜索关键词", "defaultValue": "手机壳", "type": "string" }
          ]
        }

        ## SKILL.md 格式规范（文档说明，不包含代码）

        SKILL.md 文件应该只包含技能的使用说明文档，不包含任何脚本代码。脚本代码放在 scripts/main.js 中。

        ---
        name: skill-name
        description: 详细描述技能功能和用途
        platform: browser|android|ios|computer
        version: 1.0.0
        ---

        # 技能标题

        技能详细说明...

        ## 使用步骤

        1. 步骤1
        2. 步骤2

        ## 注意事项

        - 注意事项1
        - 注意事项2

        ## 变量说明

        | 变量名 | 类型 | 说明 | 默认值 |
        |--------|------|------|--------|

        ## 重新生成规则

        1. 基于当前代码进行修改，保留原有功能结构
        2. 优先处理用户的补充要求
        3. 保持变量定义和使用方式不变（除非用户要求修改）
        4. 代码风格保持一致：2 空格缩进，单引号字符串
        5. main 函数签名和返回格式保持不变
        6. 所有数据提取必须通过 aiQuery 完成
        7. 禁止使用任何原生 DOM/CSS/XPath 操作
        8. 必须返回标准 JSON 格式：{ success: boolean, data: any, timestamp: string }

        ## 修改建议

        - 如果用户要求添加功能：在合适位置插入新代码
        - 如果用户要求修复问题：定位问题并修改
        - 如果用户要求优化：改进代码结构或逻辑
        - 如果用户要求简化：移除冗余代码但保持功能
        """;
  }

  /**
   * 构建纯文本请求内容（用于重新生成，不携带图片）
   */
  private String buildTextOnlyContent(
      String requirement,
      String additionalPrompt,
      List<SkillContextFrame> frames,
      String currentCode,
      Consumer<String> logger) {
    
    StringBuilder content = new StringBuilder();
    
    // 原始诉求
    content.append("## 原始诉求\n\n").append(requirement).append("\n\n");
    
    // 补充要求
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      content.append("## 修改要求\n\n").append(additionalPrompt).append("\n\n");
    }
    
    // 原始帧信息（文本描述，不含图片）
    if (frames != null && !frames.isEmpty()) {
      content.append("## 操作步骤参考（原始视频帧描述）\n\n");
      for (int i = 0; i < frames.size(); i++) {
        SkillContextFrame frame = frames.get(i);
        content.append(String.format("%d. 时间点 %.1f 秒", i + 1, frame.timestamp));
        if (frame.description != null && !frame.description.isEmpty()) {
          content.append("：").append(frame.description);
        }
        if (frame.annotationJson != null && !frame.annotationJson.isEmpty()) {
          content.append(" [有标注信息]");
        }
        content.append("\n");
      }
      content.append("\n");
      logger.accept("📝 已加载 " + frames.size() + " 帧的文本描述");
    }
    
    // 当前代码
    if (currentCode != null && !currentCode.isEmpty()) {
      content.append("## 当前代码\n\n```javascript\n").append(currentCode).append("\n```\n\n");
    }
    
    content.append("请基于以上信息，生成优化后的自动化 skill。输出严格遵守 JSON 格式，不要包含任何额外文字。");
    
    return content.toString();
  }

  // ==================== 局部重新生成辅助方法 ====================

  /**
   * 局部重新生成的系统提示词
   */
  private String getSystemPromptForPartialRegeneration(boolean withImages) {
    StringBuilder prompt = new StringBuilder();
    prompt.append("你是一个 midscene 自动化脚本优化专家。基于用户提供的当前代码和修改要求，对指定范围的代码进行优化。\n\n");
    
    if (withImages) {
      prompt.append("## 多模态模式说明\n\n");
      prompt.append("用户提供了参考截图和需要修改的代码范围。请结合截图中的界面信息，理解操作上下文，对指定代码范围进行精准优化。\n\n");
    } else {
      prompt.append("## 纯文本模式说明\n\n");
      prompt.append("用户提供了需要修改的代码范围和修改要求。请基于当前代码，对指定范围进行精准优化。\n\n");
    }
    
    prompt.append("""
        ## 【极其重要】midscene API 规范

        所有操作必须使用 agent 的 AI 方法，绝对禁止使用原生 Puppeteer/Playwright/浏览器方法。

        ✅ 必须使用的方法（agent.xxx）：
        - agent.aiAction('自然语言描述操作步骤')       // 执行一个或多个操作
        - agent.aiTap('元素描述')                      // 点击某个元素
        - agent.aiHover('元素描述')                    // 鼠标悬停
        - agent.aiInput('元素描述', '文本内容')        // 在某个输入框输入文字
        - agent.aiKeyboard('快捷键')                   // 发送键盘快捷键
        - agent.aiScroll({ direction: 'down', scrollType: 'untilBottom' }) // 滚动
        - agent.aiQuery('{key: type}[], 数据描述')     // 提取页面数据
        - agent.aiAssert('断言描述')                   // 验证页面状态
        - agent.aiWaitFor('条件描述')                  // 等待某个条件成立

        ❌ 严禁使用的方法（这些是原生方法，不能用）：
        - page.click() / page.tap() / element.click()
        - page.type() / page.fill() / page.keyboard.type()
        - page.waitForSelector() / page.waitFor()
        - page.evaluate() / page.$() / page.$$()
        - 任何 CSS 选择器、XPath 操作

        ## 输出 JSON 格式（不加任何 markdown 包裹）

        {
          "skillName": "kebab-case-name",
          "platform": "browser|android|ios|computer",
          "skillMd": "SKILL.md文档内容（不包含代码，只有说明文档）",
          "packageJson": "package.json完整内容",
          "scripts": [{ "name": "main.js", "content": "修改后的main.js内容" }],
          "variables": [
            { "name": "varName", "label": "变量说明", "defaultValue": "默认值", "type": "string" }
          ]
        }

        ## SKILL.md 格式规范（文档说明，不包含代码）

        SKILL.md 文件应该只包含技能的使用说明文档，不包含任何脚本代码。脚本代码放在 scripts/main.js 中。

        ---
        name: skill-name
        description: 详细描述技能功能和用途
        platform: browser|android|ios|computer
        version: 1.0.0
        ---

        # 技能标题

        技能详细说明...

        ## 使用步骤

        1. 步骤1
        2. 步骤2

        ## 注意事项

        - 注意事项1
        - 注意事项2

        ## 变量说明

        | 变量名 | 类型 | 说明 | 默认值 |
        |--------|------|------|--------|

        ## 局部修改规则（极其重要）

        你正在执行**局部代码修改**任务。用户只要求修改特定范围的代码。

        ### 必须遵守的规则：

        1. **只修改标记为【需要修改的代码】的部分**
        2. **其他代码必须与原文完全一致**，包括：
           - 不能增减任何行
           - 不能修改变量名
           - 不能修改函数签名
           - 不能调整缩进或格式
           - 不能添加注释（除非在修改范围内）
        
        ### 修改示例：
        
        如果用户选中：
        ```javascript
        await agent.aiTap('搜索框');
        await agent.aiInput('搜索框', productUrl);
        await agent.aiTap('搜索按钮');
        ```
        
        要求改成 aiAct，你应该返回：
        ```javascript
        await agent.aiAction('在搜索框中输入商品链接并点击搜索按钮');
        ```
        
        其他未选中的代码必须保持**一字不差**。

        ### 输出要求：
        
        请返回**完整的 main.js 代码**，但只修改标记范围内的代码。系统会对比你的输出和原始代码的差异。
        """);
    
    return prompt.toString();
  }

  /**
   * 构建多模态局部重新生成内容（携带图片）
   */
  private List<Map<String, Object>> buildPartialContentWithImages(
      String requirement,
      String additionalPrompt,
      List<GenerateSkillRequest.AnnotatedFrame> selectedFrames,
      String currentFullCode,
      com.easycontrol.controller.SkillController.CodeRange selectedCodeRange,
      Consumer<String> logger) {
    
    List<Map<String, Object>> content = new ArrayList<>();
    StringBuilder textContent = new StringBuilder();
    
    // 原始诉求
    textContent.append("## 原始诉求\n\n").append(requirement).append("\n\n");
    
    // 补充要求
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      textContent.append("## 修改要求\n\n").append(additionalPrompt).append("\n\n");
    }
    
    // 代码范围说明
    if (selectedCodeRange != null && selectedCodeRange.start != null && selectedCodeRange.end != null) {
      textContent.append("## 需要修改的代码范围\n\n");
      textContent.append("第 ").append(selectedCodeRange.start).append("-").append(selectedCodeRange.end).append(" 行\n\n");
      
      // 提取选中范围的代码
      if (currentFullCode != null && !currentFullCode.isEmpty()) {
        String[] lines = currentFullCode.split("\\n");
        int start = Math.max(0, selectedCodeRange.start - 1);
        int end = Math.min(lines.length, selectedCodeRange.end);
        
        textContent.append("```javascript\n");
        for (int i = start; i < end; i++) {
          textContent.append(String.format("%4d | %s\n", i + 1, lines[i]));
        }
        textContent.append("```\n\n");
      }
    }
    
    textContent.append("## 参考截图\n\n以下是用户操作的关键帧截图，请结合这些截图理解操作上下文：\n\n");
    content.add(textPart(textContent.toString()));
    
    // 添加选中的图片
    if (selectedFrames != null) {
      for (int i = 0; i < selectedFrames.size(); i++) {
        GenerateSkillRequest.AnnotatedFrame frame = selectedFrames.get(i);
        
        Map<String, Object> imageUrl = new HashMap<>();
        imageUrl.put("url", "data:image/jpeg;base64," + frame.getBase64Image());
        Map<String, Object> imageSource = new HashMap<>();
        imageSource.put("type", "image_url");
        imageSource.put("image_url", imageUrl);
        content.add(imageSource);
        
        String desc = String.format("参考图 %d（时间戳 %.1f 秒）", i + 1, frame.getTimestamp());
        if (frame.getDescription() != null && !frame.getDescription().isEmpty()) {
          desc += "：" + frame.getDescription();
        }
        content.add(textPart(desc));
        
        logger.accept("🖼️  添加参考图 " + (i + 1) + "/" + selectedFrames.size());
      }
    }
    
    // 发送完整代码，但明确标记每一行的状态
    if (currentFullCode != null && !currentFullCode.isEmpty() && selectedCodeRange != null) {
      String[] lines = currentFullCode.split("\\n");
      int start = Math.max(0, selectedCodeRange.start - 1);
      int end = Math.min(lines.length, selectedCodeRange.end);
      
      StringBuilder markedCode = new StringBuilder();
      markedCode.append("```javascript\n");
      markedCode.append("// 【必须保持原样 - 不要修改】\n");
      
      for (int i = 0; i < lines.length; i++) {
        if (i == start) {
          markedCode.append("\n// 【必须修改 - 根据要求重写以下代码】\n");
        }
        
        // 对于选中范围外的代码，标记为 KEEP
        // 对于选中范围内的代码，标记为 MODIFY
        if (i >= start && i < end) {
          markedCode.append(String.format("%4d | [MODIFY] %s\n", i + 1, lines[i]));
        } else {
          markedCode.append(String.format("%4d | [KEEP]   %s\n", i + 1, lines[i]));
        }
        
        if (i == end - 1) {
          markedCode.append("// 【必须保持原样 - 不要修改】\n\n");
        }
      }
      markedCode.append("```\n\n");
      
      content.add(textPart("\n## 完整代码（标记了修改范围）\n\n" + markedCode.toString()));
    }
    
    content.add(textPart("重要提示：\n1. 带有 [MODIFY] 标记的行是你需要修改的\n2. 带有 [KEEP] 标记的行必须保持原样，一字不改\n3. 返回完整的 main.js 代码\n4. 除了 [MODIFY] 标记的行，其他行必须与输入完全一致\n\n输出严格遵守 JSON 格式。"));
    
    return content;
  }

  /**
   * 构建纯文本局部重新生成内容
   */
  private String buildPartialTextContent(
      String requirement,
      String additionalPrompt,
      List<SkillContextFrame> contextFrames,
      String currentFullCode,
      com.easycontrol.controller.SkillController.CodeRange selectedCodeRange,
      Consumer<String> logger) {
    
    StringBuilder content = new StringBuilder();
    
    // 原始诉求
    content.append("## 原始诉求\n\n").append(requirement).append("\n\n");
    
    // 补充要求
    if (additionalPrompt != null && !additionalPrompt.trim().isEmpty()) {
      content.append("## 修改要求\n\n").append(additionalPrompt).append("\n\n");
    }
    
    // 发送完整代码，明确标记每一行的状态
    if (selectedCodeRange != null && selectedCodeRange.start != null && selectedCodeRange.end != null) {
      content.append("## 完整代码（标记了修改范围）\n\n");
      
      if (currentFullCode != null && !currentFullCode.isEmpty()) {
        String[] lines = currentFullCode.split("\\n");
        int start = Math.max(0, selectedCodeRange.start - 1);
        int end = Math.min(lines.length, selectedCodeRange.end);
        
        content.append("```javascript\n");
        content.append("// 【必须保持原样 - 不要修改】\n");
        
        for (int i = 0; i < lines.length; i++) {
          if (i == start) {
            content.append("\n// 【必须修改 - 根据要求重写以下代码】\n");
          }
          
          if (i >= start && i < end) {
            content.append(String.format("%4d | [MODIFY] %s\n", i + 1, lines[i]));
          } else {
            content.append(String.format("%4d | [KEEP]   %s\n", i + 1, lines[i]));
          }
          
          if (i == end - 1) {
            content.append("// 【必须保持原样 - 不要修改】\n\n");
          }
        }
        content.append("```\n\n");
      }
    }
    
    // 帧描述（文本）
    if (contextFrames != null && !contextFrames.isEmpty()) {
      content.append("## 操作步骤参考\n\n");
      for (int i = 0; i < contextFrames.size(); i++) {
        SkillContextFrame frame = contextFrames.get(i);
        content.append(String.format("%d. 时间点 %.1f 秒", i + 1, frame.timestamp));
        if (frame.description != null && !frame.description.isEmpty()) {
          content.append("：").append(frame.description);
        }
        content.append("\n");
      }
      content.append("\n");
    }
    
    content.append("重要提示：\n");
    content.append("1. 带有 [MODIFY] 标记的行是你需要修改的\n");
    content.append("2. 带有 [KEEP] 标记的行必须保持原样，一字不改\n");
    content.append("3. 返回完整的 main.js 代码\n");
    content.append("4. 除了 [MODIFY] 标记的行，其他行必须与输入完全一致\n\n");
    content.append("输出严格遵守 JSON 格式。");
    
    return content.toString();
  }

  // ==================== 纯文本模式的数据类 ====================

  /**
   * 用于纯文本重新生成的帧上下文（不含图片 base64）
   */
  public static class SkillContextFrame {
    public double timestamp;
    public String description;
    public String annotationJson;

    public SkillContextFrame(double timestamp, String description, String annotationJson) {
      this.timestamp = timestamp;
      this.description = description;
      this.annotationJson = annotationJson;
    }
  }
}
