package com.easycontrol.controller;

import com.easycontrol.model.GenerateSkillRequest;
import com.easycontrol.model.SkillFile;
import com.easycontrol.model.SkillRecord;
import com.easycontrol.service.SkillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/api/skills")
@RequiredArgsConstructor
public class SkillController {

  private final SkillService skillService;
  private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();
  private final ExecutorService executor = Executors.newCachedThreadPool();

  @GetMapping
  public ResponseEntity<List<SkillRecord>> listSkills() {
    return ResponseEntity.ok(skillService.listSkills());
  }

  /** 建立 SSE 日志流，前端先调这个，再调 /generate */
  @GetMapping(value = "/logs/{sessionId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter streamLogs(@PathVariable String sessionId) {
    SseEmitter emitter = new SseEmitter(180_000L);
    emitters.put(sessionId, emitter);
    emitter.onCompletion(() -> emitters.remove(sessionId));
    emitter.onTimeout(() -> emitters.remove(sessionId));
    emitter.onError(e -> emitters.remove(sessionId));
    return emitter;
  }

  @PostMapping("/generate")
  public ResponseEntity<SkillFile> generateSkill(@RequestBody GenerateSkillRequest request) {
    String sessionId = request.getSessionId();
    SseEmitter emitter = sessionId != null ? emitters.get(sessionId) : null;

    try {
      SkillFile skill = skillService.generateSkill(request, msg -> {
        log.debug("[skill-gen] {}", msg);
        if (emitter != null) {
          try {
            emitter.send(SseEmitter.event().data(msg));
          } catch (Exception e) {
            // client disconnected, ignore
          }
        }
      });

      if (emitter != null) {
        try { emitter.complete(); } catch (Exception ignored) {}
      }
      return ResponseEntity.ok(skill);
    } catch (Exception e) {
      log.error("Failed to generate skill", e);
      if (emitter != null) {
        try {
          emitter.send(SseEmitter.event().data("❌ 错误：" + e.getMessage()));
          emitter.complete();
        } catch (Exception ignored) {}
      }
      return ResponseEntity.internalServerError().build();
    }
  }

  @GetMapping("/{skillId}")
  public ResponseEntity<SkillFile> getSkill(@PathVariable String skillId) {
    try {
      return ResponseEntity.ok(skillService.getSkill(skillId));
    } catch (Exception e) {
      log.error("Failed to get skill: {}", skillId, e);
      return ResponseEntity.notFound().build();
    }
  }

  @PutMapping("/{skillId}/files")
  public ResponseEntity<Void> updateFile(@PathVariable String skillId, @RequestBody Map<String, String> body) {
    try {
      skillService.updateFile(skillId, body.get("path"), body.get("content"));
      return ResponseEntity.ok().build();
    } catch (Exception e) {
      log.error("Failed to update skill file: {}", skillId, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @GetMapping("/{skillId}/export")
  public ResponseEntity<byte[]> exportSkill(@PathVariable String skillId) {
    try {
      byte[] zip = skillService.exportZip(skillId);
      return ResponseEntity.ok()
          .header(HttpHeaders.CONTENT_TYPE, "application/zip")
          .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"skill-" + skillId + ".zip\"")
          .body(zip);
    } catch (Exception e) {
      log.error("Failed to export skill: {}", skillId, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @DeleteMapping("/{skillId}")
  public ResponseEntity<Void> deleteSkill(@PathVariable String skillId) {
    try {
      skillService.deleteSkill(skillId);
      return ResponseEntity.ok().build();
    } catch (Exception e) {
      log.error("Failed to delete skill: {}", skillId, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @PostMapping("/{skillId}/deploy")
  public ResponseEntity<Map<String, String>> deploySkill(@PathVariable String skillId) {
    try {
      String deployedPath = skillService.deployToLocal(skillId);
      return ResponseEntity.ok(Map.of(
          "message", "部署成功",
          "path", deployedPath
      ));
    } catch (Exception e) {
      log.error("Failed to deploy skill: {}", skillId, e);
      return ResponseEntity.internalServerError().body(Map.of(
          "message", "部署失败: " + e.getMessage()
      ));
    }
  }
}
