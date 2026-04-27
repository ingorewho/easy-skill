package com.easycontrol.service;

import com.easycontrol.model.FrameArchive;
import com.easycontrol.model.RequirementHistory;
import com.easycontrol.model.VideoArchive;
import com.easycontrol.repository.FrameArchiveRepository;
import com.easycontrol.repository.RequirementHistoryRepository;
import com.easycontrol.repository.VideoArchiveRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArchiveService {

    private final VideoArchiveRepository videoArchiveRepository;
    private final FrameArchiveRepository frameArchiveRepository;
    private final RequirementHistoryRepository requirementHistoryRepository;
    private final SkillService skillService;
    private final VideoService videoService;

    @Value("${app.archive-dir:${user.home}/easy-skill/archives}")
    private String archiveDir;

    @Value("${app.upload-dir:${user.home}/easy-skill/uploads}")
    private String uploadDir;

    @Value("${app.skills-dir:${user.home}/easy-skill/skills}")
    private String skillsDir;

    // ==================== 视频归档 ====================

    @Transactional
    public VideoArchive saveVideo(String videoId, String description) throws IOException {
        Path videoPath = videoService.getVideoPath(videoId);
        if (videoPath == null || !Files.exists(videoPath)) {
            throw new IOException("Video not found: " + videoId);
        }

        String archiveId = UUID.randomUUID().toString();
        Path archivePath = Paths.get(archiveDir, "videos", archiveId);
        Files.createDirectories(archivePath);

        // 复制视频文件
        String ext = videoPath.toString().contains(".") 
            ? videoPath.toString().substring(videoPath.toString().lastIndexOf("."))
            : ".mp4";
        Path destPath = archivePath.resolve("video" + ext);
        Files.copy(videoPath, destPath, StandardCopyOption.REPLACE_EXISTING);

        // 获取视频时长
        Long duration = null;
        try {
            duration = videoService.getVideoDuration(videoId);
        } catch (Exception e) {
            log.warn("Failed to get video duration: {}", e.getMessage());
        }

        // 创建视频归档记录
        VideoArchive archive = VideoArchive.builder()
            .id(archiveId)
            .videoId(videoId)
            .filename(videoPath.getFileName().toString())
            .duration(duration)
            .fileSize(Files.size(destPath))
            .filePath(destPath.toString())
            .description(description)
            .frameCount(0) // 初始为0，保存帧时更新
            .build();

        return videoArchiveRepository.save(archive);
    }

    public List<VideoArchive> listVideoArchives() {
        return videoArchiveRepository.findAllByOrderByCreatedAtDesc();
    }

    public Optional<VideoArchive> getVideoArchive(String id) {
        return videoArchiveRepository.findById(id);
    }

    @Transactional
    public void deleteVideoArchive(String id) throws IOException {
        VideoArchive archive = videoArchiveRepository.findById(id)
            .orElseThrow(() -> new IOException("Video archive not found: " + id));
        
        // 删除关联的帧归档
        List<FrameArchive> frames = frameArchiveRepository.findByVideoArchiveIdOrderByTimestampAsc(id);
        for (FrameArchive frame : frames) {
            deleteFrameFile(frame);
            frameArchiveRepository.delete(frame);
        }

        // 删除视频文件
        if (archive.getFilePath() != null) {
            Files.deleteIfExists(Paths.get(archive.getFilePath()));
        }

        videoArchiveRepository.delete(archive);
    }

    // ==================== 帧归档 ====================

    @Transactional
    public FrameArchive saveFrame(String frameId, String videoId, Double timestamp,
                                   String base64Image, String description,
                                   String annotationJson, String videoArchiveId) throws IOException {
        String archiveId = UUID.randomUUID().toString();
        Path archivePath = Paths.get(archiveDir, "frames", archiveId);
        Files.createDirectories(archivePath);

        // 去除可能存在的 data URL 前缀
        String pureBase64 = base64Image;
        if (base64Image.contains(",")) {
            pureBase64 = base64Image.substring(base64Image.indexOf(",") + 1);
        }

        // 保存图片
        Path imagePath = archivePath.resolve("frame.jpg");
        byte[] imageBytes = Base64.getDecoder().decode(pureBase64);
        Files.write(imagePath, imageBytes);

        // 创建缩略图（简化处理，实际可以用 Thumbnailator）
        Path thumbnailPath = archivePath.resolve("thumb.jpg");
        Files.write(thumbnailPath, imageBytes);

        FrameArchive archive = FrameArchive.builder()
            .id(archiveId)
            .frameId(frameId)
            .videoId(videoId)
            .videoArchiveId(videoArchiveId)
            .timestamp(timestamp)
            .imagePath(imagePath.toString())
            .thumbnailPath(thumbnailPath.toString())
            .description(description)
            .annotationJson(annotationJson)
            .base64Preview(pureBase64)
            .build();

        return frameArchiveRepository.save(archive);
    }

    public List<FrameArchive> listFrameArchives() {
        List<FrameArchive> frames = frameArchiveRepository.findAllByOrderByCreatedAtDesc();
        // 填充完整的 base64 图片数据
        for (FrameArchive frame : frames) {
            try {
                if (frame.getImagePath() != null) {
                    Path imagePath = Paths.get(frame.getImagePath());
                    if (Files.exists(imagePath)) {
                        byte[] imageBytes = Files.readAllBytes(imagePath);
                        String base64 = Base64.getEncoder().encodeToString(imageBytes);
                        frame.setBase64Image(base64);
                        frame.setBase64Preview(base64);
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to load image for frame {}: {}", frame.getId(), e.getMessage());
            }
        }
        return frames;
    }

    public List<FrameArchive> getFramesByVideoArchive(String videoArchiveId) {
        List<FrameArchive> frames = frameArchiveRepository.findByVideoArchiveIdOrderByTimestampAsc(videoArchiveId);
        // 填充完整的 base64 图片数据
        for (FrameArchive frame : frames) {
            try {
                if (frame.getImagePath() != null) {
                    Path imagePath = Paths.get(frame.getImagePath());
                    if (Files.exists(imagePath)) {
                        byte[] imageBytes = Files.readAllBytes(imagePath);
                        String base64 = Base64.getEncoder().encodeToString(imageBytes);
                        frame.setBase64Image(base64);
                        // 同时更新 base64Preview 为完整图片
                        frame.setBase64Preview(base64);
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to load image for frame {}: {}", frame.getId(), e.getMessage());
            }
        }
        return frames;
    }

    public Optional<FrameArchive> getFrameArchive(String id) {
        return frameArchiveRepository.findById(id);
    }

    @Transactional
    public void deleteFrameArchive(String id) throws IOException {
        FrameArchive archive = frameArchiveRepository.findById(id)
            .orElseThrow(() -> new IOException("Frame archive not found: " + id));
        
        deleteFrameFile(archive);
        frameArchiveRepository.delete(archive);
    }

    private void deleteFrameFile(FrameArchive frame) {
        try {
            if (frame.getImagePath() != null) {
                Files.deleteIfExists(Paths.get(frame.getImagePath()));
            }
            if (frame.getThumbnailPath() != null) {
                Files.deleteIfExists(Paths.get(frame.getThumbnailPath()));
            }
        } catch (IOException e) {
            log.warn("Failed to delete frame files: {}", e.getMessage());
        }
    }

    // ==================== 诉求历史 ====================

    @Transactional
    public RequirementHistory saveRequirement(String content, List<String> frameIds, String platform) {
        // 检查是否已存在相同的诉求
        List<RequirementHistory> existing = requirementHistoryRepository.findAll();
        for (RequirementHistory req : existing) {
            if (req.getContent() != null && req.getContent().equals(content)) {
                // 更新使用次数
                req.setUseCount(req.getUseCount() + 1);
                req.setLastUsedAt(LocalDateTime.now());
                return requirementHistoryRepository.save(req);
            }
        }

        RequirementHistory history = RequirementHistory.builder()
            .id(UUID.randomUUID().toString())
            .content(content)
            .frameIds(frameIds != null ? String.join(",", frameIds) : "")
            .platform(platform)
            .useCount(1)
            .lastUsedAt(LocalDateTime.now())
            .build();

        return requirementHistoryRepository.save(history);
    }

    public List<RequirementHistory> listRequirementHistory() {
        return requirementHistoryRepository.findAllByOrderByLastUsedAtDescCreatedAtDesc();
    }

    public List<RequirementHistory> getRecentRequirements(int limit) {
        return requirementHistoryRepository.findTop10ByOrderByLastUsedAtDesc();
    }

    public Optional<RequirementHistory> getRequirement(String id) {
        return requirementHistoryRepository.findById(id);
    }

    @Transactional
    public void deleteRequirement(String id) {
        requirementHistoryRepository.deleteById(id);
    }

    @Transactional
    public void updateRequirementUseCount(String id) {
        requirementHistoryRepository.incrementUseCount(id, LocalDateTime.now());
    }

    // ==================== 一键保存 ====================

    @Transactional
    public Map<String, Object> saveAll(String videoId, String description, List<Map<String, Object>> frames) throws IOException {
        // 1. 保存视频
        VideoArchive videoArchive = saveVideo(videoId, description);

        // 2. 批量保存帧
        List<FrameArchive> savedFrames = new ArrayList<>();
        for (Map<String, Object> frame : frames) {
            try {
                FrameArchive saved = saveFrame(
                    (String) frame.get("frameId"),
                    videoId,
                    ((Number) frame.get("timestamp")).doubleValue(),
                    (String) frame.get("base64Image"),
                    (String) frame.get("description"),
                    (String) frame.get("annotationJson"),
                    videoArchive.getId()
                );
                savedFrames.add(saved);
            } catch (Exception e) {
                log.warn("Failed to save frame {}: {}", frame.get("frameId"), e.getMessage());
            }
        }

        // 3. 更新视频的 frameCount
        if (!savedFrames.isEmpty()) {
            videoArchive.setFrameCount(savedFrames.size());
            videoArchiveRepository.save(videoArchive);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("videoArchive", videoArchive);
        result.put("savedFrames", savedFrames);
        return result;
    }
}
