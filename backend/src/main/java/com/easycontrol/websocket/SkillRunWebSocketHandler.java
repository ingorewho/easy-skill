package com.easycontrol.websocket;

import com.easycontrol.service.SkillRunnerService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class SkillRunWebSocketHandler extends TextWebSocketHandler {

    private final SkillRunnerService skillRunnerService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // 存储运行中的任务
    private final Map<String, CompletableFuture<?>> runningTasks = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket connected: {}", session.getId());
        sendMessage(session, Map.of(
            "type", "connected",
            "message", "已连接到 Skill 运行服务"
        ));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.debug("Received message: {}", payload);

        try {
            JsonNode json = objectMapper.readTree(payload);
            String action = json.get("action").asText();

            switch (action) {
                case "run":
                    handleRun(session, json);
                    break;
                case "stop":
                    handleStop(session, json);
                    break;
                default:
                    sendError(session, "Unknown action: " + action);
            }
        } catch (Exception e) {
            log.error("Error handling message", e);
            sendError(session, "Error: " + e.getMessage());
        }
    }

    private void handleRun(WebSocketSession session, JsonNode json) {
        String skillId = json.get("skillId").asText();
        String platform = json.has("platform") ? json.get("platform").asText() : "browser";
        String targetUrl = json.has("targetUrl") ? json.get("targetUrl").asText() : null;
        String deviceId = json.has("deviceId") ? json.get("deviceId").asText() : null;
        boolean headless = json.has("headless") ? json.get("headless").asBoolean() : false;

        SkillRunnerService.RunOptions options = SkillRunnerService.RunOptions.builder()
            .platform(platform)
            .targetUrl(targetUrl)
            .deviceId(deviceId)
            .headless(headless)
            .maxSteps(20)
            .build();

        sendMessage(session, Map.of(
            "type", "started",
            "skillId", skillId,
            "message", "开始运行 Skill..."
        ));

        // 异步运行
        CompletableFuture<SkillRunnerService.RunResult> future = CompletableFuture.supplyAsync(() -> {
            return skillRunnerService.runSkill(skillId, options, logMsg -> {
                sendMessage(session, Map.of(
                    "type", "log",
                    "message", logMsg
                ));
            });
        });

        runningTasks.put(session.getId(), future);

        future.whenComplete((result, error) -> {
            runningTasks.remove(session.getId());
            
            if (error != null) {
                sendMessage(session, Map.of(
                    "type", "error",
                    "message", error.getMessage()
                ));
            } else {
                sendMessage(session, Map.of(
                    "type", "completed",
                    "success", result.isSuccess(),
                    "exitCode", result.getExitCode(),
                    "durationMs", result.getDurationMs(),
                    "screenshots", result.getScreenshots(),
                    "message", result.isSuccess() ? "运行成功" : "运行失败"
                ));
            }
        });
    }

    private void handleStop(WebSocketSession session, JsonNode json) {
        CompletableFuture<?> future = runningTasks.get(session.getId());
        if (future != null) {
            future.cancel(true);
            runningTasks.remove(session.getId());
            sendMessage(session, Map.of(
                "type", "stopped",
                "message", "已停止运行"
            ));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("WebSocket closed: {}, status: {}", session.getId(), status);
        
        // 取消正在运行的任务
        CompletableFuture<?> future = runningTasks.remove(session.getId());
        if (future != null) {
            future.cancel(true);
        }
    }

    private void sendMessage(WebSocketSession session, Map<String, Object> message) {
        try {
            if (session.isOpen()) {
                String json = objectMapper.writeValueAsString(message);
                log.debug("[WebSocket] Sending to {}: {}", session.getId(), json.substring(0, Math.min(json.length(), 200)));
                session.sendMessage(new TextMessage(json));
            } else {
                log.warn("[WebSocket] Session {} is not open, message dropped", session.getId());
            }
        } catch (IOException e) {
            log.error("[WebSocket] Failed to send message: {}", e.getMessage());
        }
    }

    private void sendError(WebSocketSession session, String error) {
        sendMessage(session, Map.of(
            "type", "error",
            "message", error
        ));
    }
}
