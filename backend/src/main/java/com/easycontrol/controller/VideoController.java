package com.easycontrol.controller;

import com.easycontrol.model.FrameExtractRequest;
import com.easycontrol.model.FrameInfo;
import com.easycontrol.model.VideoUploadResponse;
import com.easycontrol.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

  private final VideoService videoService;

  @PostMapping("/upload")
  public ResponseEntity<VideoUploadResponse> uploadVideo(@RequestParam("file") MultipartFile file) {
    try {
      VideoUploadResponse response = videoService.uploadVideo(file);
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      log.error("Failed to upload video", e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @PostMapping("/{videoId}/frames/auto")
  public ResponseEntity<List<FrameInfo>> extractFramesAuto(
      @PathVariable String videoId,
      @RequestBody(required = false) FrameExtractRequest request) {
    try {
      int interval = request != null ? request.getIntervalSeconds() : 3;
      List<FrameInfo> frames = videoService.extractFramesAuto(videoId, interval);
      return ResponseEntity.ok(frames);
    } catch (Exception e) {
      log.error("Failed to extract frames for video: {}", videoId, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @PostMapping("/{videoId}/frames/manual")
  public ResponseEntity<List<FrameInfo>> extractFramesManual(
      @PathVariable String videoId,
      @RequestBody FrameExtractRequest request) {
    try {
      List<FrameInfo> frames = videoService.extractFramesManual(videoId, request.getTimestamps());
      return ResponseEntity.ok(frames);
    } catch (Exception e) {
      log.error("Failed to extract manual frames for video: {}", videoId, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @GetMapping("/{videoId}/stream")
  public ResponseEntity<Resource> streamVideo(@PathVariable String videoId) {
    try {
      Path videoPath = videoService.getVideoPath(videoId);
      if (videoPath == null) {
        return ResponseEntity.notFound().build();
      }
      Resource resource = new FileSystemResource(videoPath);
      return ResponseEntity.ok()
          .header(HttpHeaders.CONTENT_TYPE, "video/mp4")
          .header(HttpHeaders.ACCEPT_RANGES, "bytes")
          .body(resource);
    } catch (Exception e) {
      log.error("Failed to stream video: {}", videoId, e);
      return ResponseEntity.internalServerError().build();
    }
  }
}
