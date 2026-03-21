package com.easycontrol.service;

import com.easycontrol.model.GenerateSkillRequest;
import com.easycontrol.model.SkillFile;
import com.easycontrol.model.SkillRecord;
import com.easycontrol.repository.SkillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class SkillService {

  @Value("${app.skills-dir}")
  private String skillsDir;

  private final AIService aiService;
  private final SkillRepository skillRepository;

  public SkillFile generateSkill(GenerateSkillRequest request, Consumer<String> logger) throws IOException {
    Map<String, Object> aiResult = aiService.generateSkill(request, logger);

    String skillName = (String) aiResult.get("skillName");
    String platform = (String) aiResult.getOrDefault("platform", "browser");
    String skillMd = (String) aiResult.get("skillMd");
    String packageJson = (String) aiResult.getOrDefault("packageJson", "");
    @SuppressWarnings("unchecked")
    List<Map<String, String>> scripts = (List<Map<String, String>>) aiResult.get("scripts");

    String skillId = UUID.randomUUID().toString();
    logger.accept("🎯 检测平台：" + platform);
    logger.accept("💾 保存 Skill 文件，ID：" + skillId);

    Path skillPath = Paths.get(skillsDir, skillId);
    Files.createDirectories(skillPath);
    Files.createDirectories(skillPath.resolve("scripts"));
    Files.writeString(skillPath.resolve("SKILL.md"), skillMd);

    List<SkillFile.FileEntry> fileEntries = new ArrayList<>();
    fileEntries.add(SkillFile.FileEntry.builder()
        .name("SKILL.md").path("SKILL.md").content(skillMd).build());

    // 生成或保存 package.json
    String packageJsonContent = packageJson.isEmpty() 
        ? generateDefaultPackageJson(skillName, platform) 
        : packageJson;
    Files.writeString(skillPath.resolve("package.json"), packageJsonContent);
    fileEntries.add(SkillFile.FileEntry.builder()
        .name("package.json").path("package.json").content(packageJsonContent).build());
    logger.accept("📄 生成文件：package.json");

    for (Map<String, String> script : scripts) {
      String scriptName = script.get("name");
      String scriptContent = script.get("content");
      Files.writeString(skillPath.resolve("scripts").resolve(scriptName), scriptContent);
      fileEntries.add(SkillFile.FileEntry.builder()
          .name(scriptName).path("scripts/" + scriptName).content(scriptContent).build());
      logger.accept("📄 生成文件：scripts/" + scriptName);
    }

    skillRepository.save(SkillRecord.builder()
        .skillId(skillId)
        .skillName(skillName)
        .platform(platform)
        .createdAt(LocalDateTime.now())
        .build());

    logger.accept("✨ Skill 生成完成：" + skillName);
    return SkillFile.builder()
        .skillId(skillId).skillName(skillName).files(fileEntries).build();
  }

  public List<SkillRecord> listSkills() {
    return skillRepository.findAllByOrderByCreatedAtDesc();
  }

  public SkillFile getSkill(String skillId) throws IOException {
    Path skillPath = Paths.get(skillsDir, skillId);
    if (!Files.exists(skillPath)) throw new FileNotFoundException("Skill not found: " + skillId);

    List<SkillFile.FileEntry> fileEntries = new ArrayList<>();
    Path skillMdPath = skillPath.resolve("SKILL.md");
    if (Files.exists(skillMdPath)) {
      fileEntries.add(SkillFile.FileEntry.builder()
          .name("SKILL.md").path("SKILL.md").content(Files.readString(skillMdPath)).build());
    }
    Path packageJsonPath = skillPath.resolve("package.json");
    if (Files.exists(packageJsonPath)) {
      fileEntries.add(SkillFile.FileEntry.builder()
          .name("package.json").path("package.json").content(Files.readString(packageJsonPath)).build());
    }
    Path scriptsPath = skillPath.resolve("scripts");
    if (Files.exists(scriptsPath)) {
      Files.list(scriptsPath).forEach(p -> {
        try {
          fileEntries.add(SkillFile.FileEntry.builder()
              .name(p.getFileName().toString())
              .path("scripts/" + p.getFileName().toString())
              .content(Files.readString(p)).build());
        } catch (IOException e) {
          log.error("Failed to read script: {}", p, e);
        }
      });
    }
    return SkillFile.builder()
        .skillId(skillId).skillName(extractSkillName(skillPath)).files(fileEntries).build();
  }

  public void updateFile(String skillId, String filePath, String content) throws IOException {
    Path skillPath = Paths.get(skillsDir, skillId);
    if (!Files.exists(skillPath)) throw new FileNotFoundException("Skill not found: " + skillId);
    Path targetFile = skillPath.resolve(filePath);
    Files.createDirectories(targetFile.getParent());
    Files.writeString(targetFile, content);
  }

  public byte[] exportZip(String skillId) throws IOException {
    Path skillPath = Paths.get(skillsDir, skillId);
    if (!Files.exists(skillPath)) throw new FileNotFoundException("Skill not found: " + skillId);
    String skillName = extractSkillName(skillPath);
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    try (var zos = new java.util.zip.ZipOutputStream(baos)) {
      Files.walk(skillPath).filter(p -> !Files.isDirectory(p)).forEach(file -> {
        try {
          zos.putNextEntry(new java.util.zip.ZipEntry(skillName + "/" + skillPath.relativize(file)));
          Files.copy(file, zos);
          zos.closeEntry();
        } catch (IOException e) {
          log.error("Failed to add file to ZIP: {}", file, e);
        }
      });
    }
    return baos.toByteArray();
  }

  public void deleteSkill(String skillId) throws IOException {
    // 删除数据库记录
    skillRepository.deleteById(skillId);
    
    // 删除文件目录
    Path skillPath = Paths.get(skillsDir, skillId);
    if (Files.exists(skillPath)) {
      Files.walk(skillPath)
          .sorted((a, b) -> -a.compareTo(b)) // 反向排序，先删除子文件/目录
          .forEach(p -> {
            try {
              Files.delete(p);
            } catch (IOException e) {
              log.error("Failed to delete file: {}", p, e);
            }
          });
    }
  }

  private String extractSkillName(Path skillPath) throws IOException {
    Path skillMdPath = skillPath.resolve("SKILL.md");
    if (Files.exists(skillMdPath)) {
      for (String line : Files.readString(skillMdPath).split("\n")) {
        if (line.startsWith("name:")) return line.substring("name:".length()).trim();
      }
    }
    return skillPath.getFileName().toString();
  }

  private String generateDefaultPackageJson(String skillName, String platform) {
    String midscenePkg = switch (platform) {
      case "android" -> "@midscene/android";
      case "ios" -> "@midscene/ios";
      case "computer" -> "@midscene/computer";
      default -> "@midscene/web";
    };
    
    String additionalDeps = platform.equals("browser") ? ",\n    \"puppeteer\": \"^latest\"" : "";
    
    return """
        {
          "name": "%s",
          "version": "1.0.0",
          "description": "Auto-generated skill by Easy Control",
          "main": "scripts/main.js",
          "scripts": {
            "start": "node scripts/main.js"
          },
          "dependencies": {
            "%s": "^latest",
            "dotenv": "^latest"%s
          }
        }
        """.formatted(skillName, midscenePkg, additionalDeps);
  }

  /**
   * 部署 Skill 到本地 ~/.openclaw/skills 目录
   */
  public String deployToLocal(String skillId) throws IOException {
    Path sourcePath = Paths.get(skillsDir, skillId);
    if (!Files.exists(sourcePath)) {
      throw new FileNotFoundException("Skill not found: " + skillId);
    }

    String skillName = extractSkillName(sourcePath);
    // 清理 skillName，确保适合作为目录名
    String safeSkillName = skillName.replaceAll("[^a-zA-Z0-9\\-\\_]", "_");
    
    Path deployDir = Paths.get(System.getProperty("user.home"), ".openclaw", "skills", safeSkillName);
    
    log.info("Deploying skill '{}' to {}", skillName, deployDir);

    // 如果目标目录已存在，先删除
    if (Files.exists(deployDir)) {
      Files.walk(deployDir)
          .sorted((a, b) -> -a.compareTo(b))
          .forEach(p -> {
            try {
              Files.delete(p);
            } catch (IOException e) {
              log.warn("Failed to delete existing file: {}", p, e);
            }
          });
    }

    // 创建目标目录
    Files.createDirectories(deployDir);

    // 复制文件
    Files.walk(sourcePath).forEach(source -> {
      try {
        Path target = deployDir.resolve(sourcePath.relativize(source));
        if (Files.isDirectory(source)) {
          Files.createDirectories(target);
        } else {
          Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
      } catch (IOException e) {
        log.error("Failed to copy file: {} -> {}", source, deployDir, e);
        throw new RuntimeException("Failed to copy file: " + source, e);
      }
    });

    log.info("Skill '{}' deployed successfully to {}", skillName, deployDir);
    return deployDir.toString();
  }
}
