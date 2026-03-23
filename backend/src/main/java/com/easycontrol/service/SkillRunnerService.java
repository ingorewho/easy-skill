package com.easycontrol.service;

import com.easycontrol.model.SkillFile;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class SkillRunnerService {

    private final SkillService skillService;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @Value("${app.runner.timeout:180}")
    private int timeoutSeconds;

    // 检测 shell 类型
    private final String shell = detectShell();
    private final String shellLoginFlag = shell.contains("zsh") ? "-l" : "-l";

    @Data
    @Builder
    public static class RunResult {
        private boolean success;
        private int exitCode;
        private List<String> logs;
        private List<Screenshot> screenshots;
        private String error;
        private long durationMs;

        @Data
        @Builder
        public static class Screenshot {
            private String label;
            private String base64Image;
            private long timestamp;
        }
    }

    @Data
    @Builder
    public static class RunOptions {
        private String platform;      // browser, android, ios, computer
        private String targetUrl;     // 目标网址（browser）
        private String deviceId;      // 设备ID（android/ios）
        private boolean headless;     // 无头模式
        private int maxSteps;         // 最大步骤数
    }

    @Data
    @Builder
    public static class DeviceInfo {
        private String id;
        private String model;
        private String state;         // device, offline, unauthorized
        private String platform;      // android, ios
    }

    /**
     * 运行 Skill 脚本
     */
    public RunResult runSkill(String skillId, RunOptions options, Consumer<String> logConsumer) {
        long startTime = System.currentTimeMillis();
        String runId = UUID.randomUUID().toString();
        Path tempDir = null;

        try {
            // 1. 获取 Skill 文件
            SkillFile skillFile = skillService.getSkill(skillId);
            logConsumer.accept("📦 准备运行 Skill: " + skillFile.getSkillName());
            logConsumer.accept("🖥️ 平台: " + options.getPlatform());
            
            if (options.getDeviceId() != null) {
                logConsumer.accept("📱 设备: " + options.getDeviceId());
            }

            // 2. 创建临时目录
            tempDir = createTempDir(runId);
            Path scriptsDir = tempDir.resolve("scripts");
            Files.createDirectories(scriptsDir);
            logConsumer.accept("📁 工作目录: " + tempDir);

            // 3. 写入文件
            writeSkillFiles(skillFile, tempDir, scriptsDir);
            logConsumer.accept("📝 写入 " + skillFile.getFiles().size() + " 个文件");

            // 4. 安装依赖
            logConsumer.accept("⬇️ 安装依赖中... (npm install)");
            int npmExit = runShellCommand(tempDir, "npm install", line -> {
                // npm 输出过滤，只显示重要信息
                String lower = line.toLowerCase();
                if (line.contains("added") || line.contains("removed") || line.contains("changed") ||
                    lower.contains("err") || lower.contains("error") || lower.contains("warn") ||
                    lower.contains("npm")) {
                    logConsumer.accept("[npm] " + line);
                }
            }, 120);
            if (npmExit != 0) {
                return buildErrorResult(startTime, npmExit, "npm install 失败");
            }
            logConsumer.accept("✅ 依赖安装完成");

            // 5. 修改脚本注入日志和截图
            injectInstrumentation(scriptsDir.resolve("main.js"), options.getPlatform());

            // 6. 执行脚本
            logConsumer.accept("🚀 开始执行脚本...");
            RunResult result = executeScript(tempDir, options, logConsumer);
            
            // 7. 收集截图
            List<RunResult.Screenshot> screenshots = collectScreenshots(tempDir);
            result.setScreenshots(screenshots);
            result.setDurationMs(System.currentTimeMillis() - startTime);

            // 8. 清理（异步，不阻塞返回）
            final Path cleanupDir = tempDir;
            CompletableFuture.runAsync(() -> cleanup(cleanupDir));

            return result;

        } catch (Exception e) {
            log.error("Failed to run skill", e);
            if (tempDir != null) {
                cleanup(tempDir);
            }
            return buildErrorResult(startTime, -1, e.getMessage());
        }
    }

    /**
     * 获取 Android 设备列表
     */
    public List<DeviceInfo> listAndroidDevices() {
        List<DeviceInfo> devices = new ArrayList<>();
        
        try {
            String output = runShellCommandForOutput("adb devices -l", 10);
            log.debug("adb devices output: {}", output);
            
            // 解析输出：
            // List of devices attached
            // abc12345               device usb:123456 product:xxx model:Pixel_6 device:xxx transport_id:1
            // def67890               unauthorized usb:... 
            String[] lines = output.split("\n");
            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("List of")) {
                    continue;
                }
                
                // 解析：id + 状态 + 属性
                String[] parts = line.split("\\s+");
                if (parts.length >= 2) {
                    String id = parts[0];
                    String state = parts[1];
                    String model = extractValue(line, "model:");
                    
                    devices.add(DeviceInfo.builder()
                        .id(id)
                        .model(model != null ? model : "Unknown")
                        .state(state)
                        .platform("android")
                        .build());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to list android devices: {}", e.getMessage());
        }
        
        return devices;
    }

    /**
     * 获取 iOS 设备列表（需要 idevice_id）
     */
    public List<DeviceInfo> listIosDevices() {
        List<DeviceInfo> devices = new ArrayList<>();
        
        try {
            // 先尝试 idevice_id（libimobiledevice）
            String output = runShellCommandForOutput("idevice_id -l", 10);
            
            String[] lines = output.split("\n");
            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty()) continue;
                
                String udid = line;
                // 获取设备名称
                String name = "iOS Device";
                try {
                    name = runShellCommandForOutput("idevicename -u " + udid, 5).trim();
                } catch (Exception ignored) {}
                
                devices.add(DeviceInfo.builder()
                    .id(udid)
                    .model(name)
                    .state("device")
                    .platform("ios")
                    .build());
            }
        } catch (Exception e) {
            log.warn("Failed to list iOS devices: {}", e.getMessage());
            // iOS 设备列表失败不是致命错误，可能用户没装 libimobiledevice
        }
        
        return devices;
    }

    // ==================== 私有方法 ====================

    private Path createTempDir(String runId) throws IOException {
        Path tempDir = Paths.get(System.getProperty("java.io.tmpdir"), "skill-run-" + runId);
        Files.createDirectories(tempDir);
        return tempDir;
    }

    private void writeSkillFiles(SkillFile skillFile, Path tempDir, Path scriptsDir) throws IOException {
        for (SkillFile.FileEntry file : skillFile.getFiles()) {
            Path targetPath;
            if (file.getPath().startsWith("scripts/")) {
                targetPath = scriptsDir.resolve(file.getName());
            } else {
                targetPath = tempDir.resolve(file.getName());
            }
            
            String content = file.getContent();
            
            // 修复 package.json 中的无效版本号
            if ("package.json".equals(file.getName())) {
                content = fixPackageJsonVersions(content);
            }
            
            Files.writeString(targetPath, content);
        }
    }
    
    /**
     * 修复 package.json 中的无效版本号为有效版本号
     */
    private String fixPackageJsonVersions(String content) {
        // 替换所有无效版本号为有效版本号
        // 查询时间: 2026-03-21
        // @midscene/* 最新: 1.5.6
        // puppeteer 最新: 24.40.0
        // dotenv 最新: 17.3.1
        String fixed = content
            // ^latest -> 有效版本
            .replace("\"@midscene/web\": \"^latest\"", "\"@midscene/web\": \"^1.5.6\"")
            .replace("\"@midscene/android\": \"^latest\"", "\"@midscene/android\": \"^1.5.6\"")
            .replace("\"@midscene/ios\": \"^latest\"", "\"@midscene/ios\": \"^1.5.6\"")
            .replace("\"@midscene/computer\": \"^latest\"", "\"@midscene/computer\": \"^1.5.6\"")
            .replace("\"puppeteer\": \"^latest\"", "\"puppeteer\": \"^24.0.0\"")
            .replace("\"dotenv\": \"^latest\"", "\"dotenv\": \"^17.0.0\"")
            // ^0.8.0 (旧版本) -> 有效版本
            .replace("\"@midscene/web\": \"^0.8.0\"", "\"@midscene/web\": \"^1.5.6\"")
            .replace("\"@midscene/android\": \"^0.8.0\"", "\"@midscene/android\": \"^1.5.6\"")
            .replace("\"@midscene/ios\": \"^0.8.0\"", "\"@midscene/ios\": \"^1.5.6\"")
            .replace("\"@midscene/computer\": \"^0.8.0\"", "\"@midscene/computer\": \"^1.5.6\"")
            // dotenv ^16.0.0 -> ^17.0.0
            .replace("\"dotenv\": \"^16.0.0\"", "\"dotenv\": \"^17.0.0\"");
        
        return fixed;
    }

    /**
     * 使用登录 Shell 执行命令，继承用户环境
     * 使用独立线程实时读取输出，避免阻塞
     */
    private int runShellCommand(Path workingDir, String command, Consumer<String> logConsumer, int timeout) 
            throws IOException, InterruptedException {
        
        List<String> cmdList = new ArrayList<>();
        cmdList.add(shell);
        cmdList.add(shellLoginFlag);
        cmdList.add("-c");
        cmdList.add(command);
        
        ProcessBuilder pb = new ProcessBuilder(cmdList);
        pb.directory(workingDir != null ? workingDir.toFile() : null);
        pb.redirectErrorStream(true);
        
        // 继承环境变量
        Map<String, String> env = pb.environment();
        env.putAll(System.getenv());
        
        log.info("[SkillRunner] Executing: {}", command);
        logConsumer.accept("[系统] 执行命令: " + command.substring(0, Math.min(command.length(), 100)) + "...");
        
        Process process = pb.start();
        
        // 使用独立线程实时读取输出（关键：不能阻塞主线程）
        Thread outputThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("[SkillRunner Output] {}", line);
                    if (logConsumer != null) {
                        try {
                            logConsumer.accept(line);
                        } catch (Exception e) {
                            log.warn("[SkillRunner] Error in log consumer: {}", e.getMessage());
                        }
                    }
                }
            } catch (IOException e) {
                log.warn("[SkillRunner] Error reading output: {}", e.getMessage());
            }
        });
        outputThread.setDaemon(true);
        outputThread.start();
        
        boolean finished = process.waitFor(timeout, TimeUnit.SECONDS);
        
        // 等待输出线程完成
        try {
            outputThread.join(5000); // 最多等待5秒
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("Command timeout after " + timeout + "s");
        }
        
        int exitCode = process.exitValue();
        log.info("[SkillRunner] Command completed with exit code: {}", exitCode);
        
        return exitCode;
    }

    /**
     * 执行命令并返回输出（不流式）
     */
    private String runShellCommandForOutput(String command, int timeout) throws IOException, InterruptedException {
        List<String> cmdList = new ArrayList<>();
        cmdList.add(shell);
        cmdList.add(shellLoginFlag);
        cmdList.add("-c");
        cmdList.add(command);
        
        ProcessBuilder pb = new ProcessBuilder(cmdList);
        pb.environment().putAll(System.getenv());
        pb.redirectErrorStream(true);
        
        Process process = pb.start();
        
        String output = new String(process.getInputStream().readAllBytes());
        
        boolean finished = process.waitFor(timeout, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("Command timeout");
        }
        
        return output;
    }

    private void injectInstrumentation(Path mainJsPath, String platform) throws IOException {
        if (!Files.exists(mainJsPath)) {
            return;
        }
        
        String content = Files.readString(mainJsPath);
        
        // 注入监控代码到开头
        String injection = buildInstrumentationCode(platform);
        content = injection + content;
        
        // 在文件末尾添加执行代码（如果还没有的话）
        if (!content.contains("main(process.env.DEVICE_ID")) {
            String executor = buildExecutorCode(platform);
            content = content + "\n" + executor;
        }
        
        Files.writeString(mainJsPath, content);
    }
    
    /**
     * 构建执行代码，调用 main 函数
     */
    private String buildExecutorCode(String platform) {
        if ("android".equals(platform) || "ios".equals(platform)) {
            return "\n" +
                   "// === Auto-execution ===\n" +
                   "(async () => {\n" +
                   "    try {\n" +
                   "        const deviceId = process.env.DEVICE_ID;\n" +
                   "        if (!deviceId) {\n" +
                   "            console.error('[SKILL_LOG] ERROR: DEVICE_ID environment variable not set');\n" +
                   "            process.exit(1);\n" +
                   "        }\n" +
                   "        console.log('[SKILL_LOG] Starting skill on device: ' + deviceId);\n" +
                   "        const result = await main(deviceId);\n" +
                   "        console.log('[SKILL_LOG] Skill completed successfully');\n" +
                   "        console.log('[SKILL_LOG] Result:', JSON.stringify(result, null, 2));\n" +
                   "        process.exit(0);\n" +
                   "    } catch (error) {\n" +
                   "        console.error('[SKILL_LOG] Skill failed:', error.message);\n" +
                   "        console.error(error.stack);\n" +
                   "        process.exit(1);\n" +
                   "    }\n" +
                   "})();\n";
        } else {
            return "\n" +
                   "// === Auto-execution ===\n" +
                   "(async () => {\n" +
                   "    try {\n" +
                   "        console.log('[SKILL_LOG] Starting skill...');\n" +
                   "        const result = await main();\n" +
                   "        console.log('[SKILL_LOG] Skill completed successfully');\n" +
                   "        console.log('[SKILL_LOG] Result:', JSON.stringify(result, null, 2));\n" +
                   "        process.exit(0);\n" +
                   "    } catch (error) {\n" +
                   "        console.error('[SKILL_LOG] Skill failed:', error.message);\n" +
                   "        console.error(error.stack);\n" +
                   "        process.exit(1);\n" +
                   "    }\n" +
                   "})();\n";
        }
    }

    private String buildInstrumentationCode(String platform) {
        // 使用无缩进的字符串，避免 JS 语法错误
        return "// === Easy Skill Runtime Injection ===\n" +
               "const fs = require('fs');\n" +
               "const path = require('path');\n" +
               "let _stepCount = 0;\n" +
               "let _lastAgent = null;\n" +
               "const _screenshotDir = process.cwd();\n" +
               "\n" +
               "async function _skillScreenshot(agent, label) {\n" +
               "    try {\n" +
               "        let page = null;\n" +
               "        if (agent && agent.page) page = agent.page;\n" +
               "        else if (agent && agent.driver) page = agent.driver;\n" +
               "        \n" +
               "        if (page && page.screenshot) {\n" +
               "            const screenshot = await page.screenshot({ \n" +
               "                encoding: 'base64',\n" +
               "                fullPage: false \n" +
               "            });\n" +
               "            const filename = `_skill_${label}_${Date.now()}.txt`;\n" +
               "            fs.writeFileSync(path.join(_screenshotDir, filename), screenshot);\n" +
               "            console.log('[SKILL_SCREENSHOT]' + label + '|' + filename);\n" +
               "        }\n" +
               "    } catch (e) {\n" +
               "        console.log('[SKILL_LOG] Screenshot failed: ' + e.message);\n" +
               "    }\n" +
               "}\n" +
               "\n" +
               "function _wrapAgent(agent) {\n" +
               "    _lastAgent = agent;\n" +
               "    const methods = ['aiAct', 'aiTap', 'aiInput', 'aiScroll', 'aiQuery', 'aiAssert', 'aiWaitFor'];\n" +
               "    methods.forEach(method => {\n" +
               "        if (agent[method]) {\n" +
               "            const original = agent[method].bind(agent);\n" +
               "            agent[method] = async function(...args) {\n" +
               "                _stepCount++;\n" +
               "                const desc = args[0] ? args[0].toString().substring(0, 50) : '';\n" +
               "                console.log(`[SKILL_STEP] ${_stepCount}: ${method} - ${desc}`);\n" +
               "                const result = await original(...args);\n" +
               "                await _skillScreenshot(agent, `step-${_stepCount}`);\n" +
               "                return result;\n" +
               "            };\n" +
               "        }\n" +
               "    });\n" +
               "    return agent;\n" +
               "}\n" +
               "\n" +
               "const Module = require('module');\n" +
               "const originalRequire = Module.prototype.require;\n" +
               "Module.prototype.require = function(id) {\n" +
               "    const mod = originalRequire.apply(this, arguments);\n" +
               "    \n" +
               "    if (id === '@midscene/web/puppeteer' && mod.PuppeteerAgent) {\n" +
               "        const Original = mod.PuppeteerAgent;\n" +
               "        mod.PuppeteerAgent = class extends Original {\n" +
               "            constructor(page, opts) {\n" +
               "                super(page, opts);\n" +
               "                _wrapAgent(this);\n" +
               "            }\n" +
               "        };\n" +
               "    }\n" +
               "    \n" +
               "    if (id === '@midscene/android' && mod.agentFromAdbDevice) {\n" +
               "        const original = mod.agentFromAdbDevice;\n" +
               "        mod.agentFromAdbDevice = async function(...args) {\n" +
               "            const agent = await original.apply(this, args);\n" +
               "            _wrapAgent(agent);\n" +
               "            return agent;\n" +
               "        };\n" +
               "    }\n" +
               "    \n" +
               "    if (id === '@midscene/ios' && mod.agentFromWebDriverAgent) {\n" +
               "        const original = mod.agentFromWebDriverAgent;\n" +
               "        mod.agentFromWebDriverAgent = async function(...args) {\n" +
               "            const agent = await original.apply(this, args);\n" +
               "            _wrapAgent(agent);\n" +
               "            return agent;\n" +
               "        };\n" +
               "    }\n" +
               "    \n" +
               "    return mod;\n" +
               "};\n" +
               "// === Injection End ===\n\n";
    }

    private RunResult executeScript(Path tempDir, RunOptions options, Consumer<String> logConsumer) {
        List<String> logs = new ArrayList<>();
        
        // 构建命令
        StringBuilder command = new StringBuilder();
        command.append("cd ").append(tempDir).append(" && ");
        
        // 环境变量
        command.append("NODE_ENV=test ");
        command.append("HEADLESS=").append(options.isHeadless()).append(" ");
        
        if (options.getTargetUrl() != null) {
            command.append("TARGET_URL=").append(escapeShellArg(options.getTargetUrl())).append(" ");
        }
        
        if (options.getDeviceId() != null) {
            command.append("DEVICE_ID=").append(escapeShellArg(options.getDeviceId())).append(" ");
        }
        
        // 使用 node 直接执行，并添加调试输出
        command.append("node scripts/main.js 2>&1");
        
        logConsumer.accept("[系统] 开始执行脚本，超时时间: " + timeoutSeconds + "秒");
        
        try {
            int exitCode = runShellCommand(null, command.toString(), line -> {
                logs.add(line);
                parseAndForwardLog(line, logConsumer);
            }, timeoutSeconds);
            
            boolean success = exitCode == 0;
            logConsumer.accept("[系统] 脚本执行完成，退出码: " + exitCode);
            
            return RunResult.builder()
                .success(success)
                .exitCode(exitCode)
                .logs(logs)
                .build();
                
        } catch (Exception e) {
            log.error("[SkillRunner] Script execution failed", e);
            logConsumer.accept("[系统错误] " + e.getMessage());
            return RunResult.builder()
                .success(false)
                .exitCode(-1)
                .logs(logs)
                .error(e.getMessage())
                .build();
        }
    }

    private void parseAndForwardLog(String line, Consumer<String> logConsumer) {
        // 保留原始日志用于调试
        log.debug("[SkillRunner Parse] {}", line);
        
        if (line.startsWith("[SKILL_STEP]")) {
            logConsumer.accept("🎯 步骤 " + line.substring(12));
        } else if (line.startsWith("[SKILL_SCREENSHOT]")) {
            // 截图已保存，内部使用
            log.debug("Screenshot saved: {}", line);
        } else if (line.startsWith("[SKILL_LOG]")) {
            logConsumer.accept("ℹ️ " + line.substring(11));
        } else if (line.contains("aiTap") || line.contains("aiAct") || line.contains("aiInput")) {
            // 检测到 AI 操作，高亮显示
            logConsumer.accept("🤖 AI: " + line);
        } else if (line.toLowerCase().contains("error") || line.toLowerCase().contains("错误")) {
            logConsumer.accept("❌ " + line);
        } else {
            // 普通日志
            logConsumer.accept(line);
        }
    }

    private List<RunResult.Screenshot> collectScreenshots(Path tempDir) {
        List<RunResult.Screenshot> screenshots = new ArrayList<>();
        
        try {
            Files.list(tempDir)
                .filter(p -> p.getFileName().toString().startsWith("_skill_"))
                .sorted()
                .forEach(p -> {
                    try {
                        String filename = p.getFileName().toString();
                        // _skill_step-1_123456789.txt
                        String label = filename.replace("_skill_", "").replaceAll("_\\d+\\.txt$", "");
                        String base64 = Files.readString(p);
                        
                        screenshots.add(RunResult.Screenshot.builder()
                            .label(label)
                            .base64Image(base64)
                            .timestamp(System.currentTimeMillis())
                            .build());
                    } catch (IOException e) {
                        log.warn("Failed to read screenshot: {}", p, e);
                    }
                });
        } catch (IOException e) {
            log.warn("Failed to collect screenshots", e);
        }
        
        return screenshots;
    }

    private void cleanup(Path tempDir) {
        try {
            Files.walk(tempDir)
                .sorted((a, b) -> -a.compareTo(b))
                .forEach(p -> {
                    try {
                        Files.delete(p);
                    } catch (IOException ignored) {}
                });
        } catch (IOException ignored) {}
    }

    private RunResult buildErrorResult(long startTime, int exitCode, String error) {
        return RunResult.builder()
            .success(false)
            .exitCode(exitCode)
            .logs(List.of())
            .error(error)
            .durationMs(System.currentTimeMillis() - startTime)
            .build();
    }

    private String extractValue(String line, String key) {
        int start = line.indexOf(key);
        if (start >= 0) {
            int end = line.indexOf(" ", start);
            if (end < 0) end = line.length();
            return line.substring(start + key.length(), end);
        }
        return null;
    }

    private String escapeShellArg(String arg) {
        return "'" + arg.replace("'", "'\"'\"'") + "'";
    }

    private String detectShell() {
        String shell = System.getenv("SHELL");
        if (shell != null && !shell.isEmpty()) {
            return shell;
        }
        // 默认使用 zsh (macOS) 或 bash (Linux)
        return Files.exists(Paths.get("/bin/zsh")) ? "/bin/zsh" : "/bin/bash";
    }
}
