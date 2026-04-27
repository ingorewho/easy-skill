package com.easycontrol.service;

import com.easycontrol.model.KnowledgeFile;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 知识库服务：完全基于文件系统，零 DB 依赖
 * 所有文件与元数据一起放在 {skillDir}/knowledge/，随 skill 自包含
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeService {

  @Value("${app.skills-dir}")
  private String skillsDir;

  private static final String MANIFEST_NAME = "knowledge.json";

  // 类型识别
  private static final Set<String> IMAGE_EXTS = Set.of(
      "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"
  );
  private static final Set<String> DOC_EXTS = Set.of(
      "md", "txt", "json", "csv", "yml", "yaml", "pdf", "doc", "docx", "xls", "xlsx", "html", "htm"
  );

  private final ObjectMapper objectMapper = new ObjectMapper();

  public List<KnowledgeFile> listFiles(String skillId) throws IOException {
    Path manifest = manifestPath(skillId);
    if (!Files.exists(manifest)) return new ArrayList<>();
    String json = Files.readString(manifest);
    if (json == null || json.isBlank()) return new ArrayList<>();
    try {
      return objectMapper.readValue(json, new TypeReference<List<KnowledgeFile>>() {});
    } catch (Exception e) {
      log.warn("Failed to parse knowledge.json for {}", skillId, e);
      return new ArrayList<>();
    }
  }

  public KnowledgeFile uploadFile(String skillId, MultipartFile file, String description) throws IOException {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("file is empty");
    }
    assertSkillExists(skillId);

    Path dir = knowledgeDir(skillId);
    Files.createDirectories(dir);

    String safeName = sanitizeFileName(file.getOriginalFilename());
    Path target = resolveUniqueName(dir, safeName);
    file.transferTo(target.toFile());

    KnowledgeFile entry = KnowledgeFile.builder()
        .fileName(target.getFileName().toString())
        .mimeType(Optional.ofNullable(file.getContentType()).orElse("application/octet-stream"))
        .fileType(detectType(target.getFileName().toString()))
        .size(Files.size(target))
        .description(description == null ? "" : description.trim())
        .createdAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
        .build();

    List<KnowledgeFile> manifest = listFiles(skillId);
    // 同名覆盖
    manifest.removeIf(k -> k.getFileName().equals(entry.getFileName()));
    manifest.add(entry);
    writeManifest(skillId, manifest);
    log.info("Uploaded knowledge file {} to skill {}", entry.getFileName(), skillId);
    return entry;
  }

  public KnowledgeFile updateDescription(String skillId, String fileName, String description) throws IOException {
    List<KnowledgeFile> manifest = listFiles(skillId);
    KnowledgeFile found = manifest.stream()
        .filter(k -> k.getFileName().equals(fileName))
        .findFirst()
        .orElseThrow(() -> new FileNotFoundException("knowledge file not found: " + fileName));
    found.setDescription(description == null ? "" : description.trim());
    writeManifest(skillId, manifest);
    return found;
  }

  public void deleteFile(String skillId, String fileName) throws IOException {
    Path file = knowledgeDir(skillId).resolve(fileName).normalize();
    // 避免目录穿越
    if (!file.startsWith(knowledgeDir(skillId))) {
      throw new IllegalArgumentException("invalid fileName");
    }
    Files.deleteIfExists(file);

    List<KnowledgeFile> manifest = listFiles(skillId);
    manifest.removeIf(k -> k.getFileName().equals(fileName));
    writeManifest(skillId, manifest);
  }

  public byte[] readFileContent(String skillId, String fileName) throws IOException {
    Path file = knowledgeDir(skillId).resolve(fileName).normalize();
    if (!file.startsWith(knowledgeDir(skillId)) || !Files.exists(file)) {
      throw new FileNotFoundException("knowledge file not found: " + fileName);
    }
    return Files.readAllBytes(file);
  }

  public String getMimeType(String skillId, String fileName) throws IOException {
    return listFiles(skillId).stream()
        .filter(k -> k.getFileName().equals(fileName))
        .map(KnowledgeFile::getMimeType)
        .findFirst()
        .orElse("application/octet-stream");
  }

  // ==================== 内部工具 ====================

  private Path knowledgeDir(String skillId) {
    return Paths.get(skillsDir, skillId, "knowledge");
  }

  private Path manifestPath(String skillId) {
    return knowledgeDir(skillId).resolve(MANIFEST_NAME);
  }

  private void assertSkillExists(String skillId) throws FileNotFoundException {
    Path p = Paths.get(skillsDir, skillId);
    if (!Files.exists(p)) throw new FileNotFoundException("Skill not found: " + skillId);
  }

  private void writeManifest(String skillId, List<KnowledgeFile> manifest) throws IOException {
    manifest.sort(Comparator.comparing(KnowledgeFile::getCreatedAt,
        Comparator.nullsLast(Comparator.naturalOrder())));
    Files.createDirectories(knowledgeDir(skillId));
    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(manifest);
    Files.writeString(manifestPath(skillId), json);
  }

  private String sanitizeFileName(String raw) {
    if (raw == null || raw.isBlank()) return "file";
    String name = Paths.get(raw).getFileName().toString();
    // 禁用控制字符和路径分隔
    name = name.replaceAll("[\\\\/\\p{Cntrl}]", "_").trim();
    if (MANIFEST_NAME.equalsIgnoreCase(name)) name = "_" + name;
    return name.isEmpty() ? "file" : name;
  }

  private Path resolveUniqueName(Path dir, String fileName) {
    Path candidate = dir.resolve(fileName);
    if (!Files.exists(candidate)) return candidate;
    String base = fileName;
    String ext = "";
    int dot = fileName.lastIndexOf('.');
    if (dot > 0) {
      base = fileName.substring(0, dot);
      ext = fileName.substring(dot);
    }
    for (int i = 1; i < 1000; i++) {
      Path c = dir.resolve(base + "-" + i + ext);
      if (!Files.exists(c)) return c;
    }
    return candidate;
  }

  private String detectType(String fileName) {
    String ext = extOf(fileName);
    if (IMAGE_EXTS.contains(ext)) return "image";
    if (DOC_EXTS.contains(ext)) return "document";
    return "other";
  }

  private String extOf(String name) {
    int dot = name.lastIndexOf('.');
    if (dot < 0) return "";
    return name.substring(dot + 1).toLowerCase(Locale.ROOT);
  }

  /**
   * 拷贝知识库到目标目录（运行器 / 部署使用）
   */
  public void copyKnowledgeTo(String skillId, Path targetSkillDir) throws IOException {
    Path src = knowledgeDir(skillId);
    if (!Files.exists(src)) return;
    Path dst = targetSkillDir.resolve("knowledge");
    Files.createDirectories(dst);
    try (var stream = Files.list(src)) {
      for (Path p : stream.collect(Collectors.toList())) {
        Path t = dst.resolve(p.getFileName().toString());
        Files.copy(p, t, StandardCopyOption.REPLACE_EXISTING);
      }
    }
  }
}
