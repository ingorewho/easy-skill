package com.easycontrol.controller;

import com.easycontrol.model.FrameArchive;
import com.easycontrol.model.RequirementHistory;
import com.easycontrol.model.VideoArchive;
import com.easycontrol.service.ArchiveService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/archives")
@RequiredArgsConstructor
public class ArchiveController {

    private final ArchiveService archiveService;

    // ==================== 视频归档 ====================

    @PostMapping("/videos")
    public ResponseEntity<VideoArchive> saveVideo(@RequestBody Map<String, String> request) {
        try {
            String videoId = request.get("videoId");
            String description = request.get("description");
            VideoArchive archive = archiveService.saveVideo(videoId, description);
            return ResponseEntity.ok(archive);
        } catch (Exception e) {
            log.error("Failed to save video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/videos")
    public ResponseEntity<List<VideoArchive>> listVideos() {
        return ResponseEntity.ok(archiveService.listVideoArchives());
    }

    @GetMapping("/videos/{id}")
    public ResponseEntity<VideoArchive> getVideo(@PathVariable String id) {
        return archiveService.getVideoArchive(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/videos/{id}")
    public ResponseEntity<Void> deleteVideo(@PathVariable String id) {
        try {
            archiveService.deleteVideoArchive(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            log.error("Failed to delete video archive", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ==================== 帧归档 ====================

    @PostMapping("/frames")
    public ResponseEntity<FrameArchive> saveFrame(@RequestBody SaveFrameRequest request) {
        try {
            FrameArchive archive = archiveService.saveFrame(
                request.frameId,
                request.videoId,
                request.timestamp,
                request.base64Image,
                request.description,
                request.annotationJson,
                request.videoArchiveId
            );
            return ResponseEntity.ok(archive);
        } catch (Exception e) {
            log.error("Failed to save frame", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/frames")
    public ResponseEntity<List<FrameArchive>> listFrames() {
        return ResponseEntity.ok(archiveService.listFrameArchives());
    }

    @GetMapping("/frames/video/{videoArchiveId}")
    public ResponseEntity<List<FrameArchive>> getFramesByVideo(@PathVariable String videoArchiveId) {
        return ResponseEntity.ok(archiveService.getFramesByVideoArchive(videoArchiveId));
    }

    @GetMapping("/frames/{id}/image")
    public ResponseEntity<byte[]> getFrameImage(@PathVariable String id) {
        try {
            FrameArchive archive = archiveService.getFrameArchive(id).orElse(null);
            if (archive == null || archive.getImagePath() == null) {
                return ResponseEntity.notFound().build();
            }
            Path imagePath = Paths.get(archive.getImagePath());
            if (!Files.exists(imagePath)) {
                return ResponseEntity.notFound().build();
            }
            byte[] imageBytes = Files.readAllBytes(imagePath);
            return ResponseEntity.ok()
                .header("Content-Type", "image/jpeg")
                .body(imageBytes);
        } catch (Exception e) {
            log.error("Failed to get frame image", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/frames/{id}")
    public ResponseEntity<Void> deleteFrame(@PathVariable String id) {
        try {
            archiveService.deleteFrameArchive(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            log.error("Failed to delete frame archive", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ==================== 诉求历史 ====================

    @PostMapping("/requirements")
    public ResponseEntity<RequirementHistory> saveRequirement(@RequestBody SaveRequirementRequest request) {
        RequirementHistory history = archiveService.saveRequirement(
            request.content,
            request.frameIds,
            request.platform
        );
        return ResponseEntity.ok(history);
    }

    @GetMapping("/requirements")
    public ResponseEntity<List<RequirementHistory>> listRequirements() {
        return ResponseEntity.ok(archiveService.listRequirementHistory());
    }

    @GetMapping("/requirements/recent")
    public ResponseEntity<List<RequirementHistory>> getRecentRequirements() {
        return ResponseEntity.ok(archiveService.getRecentRequirements(10));
    }

    @GetMapping("/requirements/{id}")
    public ResponseEntity<RequirementHistory> getRequirement(@PathVariable String id) {
        return archiveService.getRequirement(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/requirements/{id}/use")
    public ResponseEntity<Void> updateRequirementUseCount(@PathVariable String id) {
        archiveService.updateRequirementUseCount(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/requirements/{id}")
    public ResponseEntity<Void> deleteRequirement(@PathVariable String id) {
        archiveService.deleteRequirement(id);
        return ResponseEntity.ok().build();
    }

    // ==================== 一键保存 ====================

    @PostMapping("/save-all")
    public ResponseEntity<Map<String, Object>> saveAll(@RequestBody SaveAllRequest request) {
        try {
            Map<String, Object> result = archiveService.saveAll(
                request.videoId,
                request.description,
                request.frames
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Failed to save all resources", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ==================== 请求 DTO ====================

    public static class SaveFrameRequest {
        public String frameId;
        public String videoId;
        public Double timestamp;
        public String base64Image;
        public String description;
        public String annotationJson;
        public String videoArchiveId;
    }

    public static class SaveRequirementRequest {
        public String content;
        public List<String> frameIds;
        public String platform;
    }

    public static class SaveAllRequest {
        public String videoId;
        public String description;
        public List<Map<String, Object>> frames;
    }
}
