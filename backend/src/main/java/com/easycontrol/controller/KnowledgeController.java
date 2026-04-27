package com.easycontrol.controller;

import com.easycontrol.model.KnowledgeFile;
import com.easycontrol.service.KnowledgeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/skills/{skillId}/knowledge")
@RequiredArgsConstructor
public class KnowledgeController {

  private final KnowledgeService knowledgeService;

  @GetMapping
  public ResponseEntity<List<KnowledgeFile>> list(@PathVariable String skillId) {
    try {
      return ResponseEntity.ok(knowledgeService.listFiles(skillId));
    } catch (Exception e) {
      log.error("Failed to list knowledge: {}", skillId, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<KnowledgeFile> upload(
      @PathVariable String skillId,
      @RequestParam("file") MultipartFile file,
      @RequestParam(value = "description", required = false) String description) {
    try {
      return ResponseEntity.ok(knowledgeService.uploadFile(skillId, file, description));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build();
    } catch (Exception e) {
      log.error("Failed to upload knowledge: {}", skillId, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @PutMapping("/{fileName}")
  public ResponseEntity<KnowledgeFile> updateDescription(
      @PathVariable String skillId,
      @PathVariable String fileName,
      @RequestBody Map<String, String> body) {
    try {
      return ResponseEntity.ok(
          knowledgeService.updateDescription(skillId, fileName, body.get("description")));
    } catch (Exception e) {
      log.error("Failed to update description: {}/{}", skillId, fileName, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @DeleteMapping("/{fileName}")
  public ResponseEntity<Void> delete(
      @PathVariable String skillId,
      @PathVariable String fileName) {
    try {
      knowledgeService.deleteFile(skillId, fileName);
      return ResponseEntity.ok().build();
    } catch (Exception e) {
      log.error("Failed to delete knowledge: {}/{}", skillId, fileName, e);
      return ResponseEntity.internalServerError().build();
    }
  }

  @GetMapping("/{fileName}/download")
  public ResponseEntity<ByteArrayResource> download(
      @PathVariable String skillId,
      @PathVariable String fileName) {
    try {
      byte[] bytes = knowledgeService.readFileContent(skillId, fileName);
      String mime = knowledgeService.getMimeType(skillId, fileName);
      String encoded = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
      return ResponseEntity.ok()
          .header(HttpHeaders.CONTENT_TYPE, mime)
          .header(HttpHeaders.CONTENT_DISPOSITION,
              "inline; filename*=UTF-8''" + encoded)
          .body(new ByteArrayResource(bytes));
    } catch (Exception e) {
      log.error("Failed to download knowledge: {}/{}", skillId, fileName, e);
      return ResponseEntity.notFound().build();
    }
  }
}
