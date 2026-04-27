#!/usr/bin/env java --source 17

import java.io.*;
import java.nio.file.*;
import java.util.regex.*;

/**
 * 迁移脚本：从 SKILL.md 中移除脚本代码，只保留说明文档
 * 使用方式: java migrate-skills.java ~/easy-skill/skills
 */
public class MigrateSkills {
    public static void main(String[] args) throws IOException {
        String skillsDir = args.length > 0 ? args[0] : System.getProperty("user.home") + "/easy-skill/skills";
        Path root = Paths.get(skillsDir);
        
        if (!Files.exists(root)) {
            System.out.println("Skills directory not found: " + root);
            System.exit(1);
        }
        
        System.out.println("Scanning skills in: " + root);
        int migrated = 0;
        int skipped = 0;
        int errors = 0;
        
        try (var stream = Files.list(root)) {
            var dirs = stream.filter(Files::isDirectory).toList();
            System.out.println("Found " + dirs.size() + " skill directories\n");
            
            for (Path skillDir : dirs) {
                Path skillMdPath = skillDir.resolve("SKILL.md");
                if (!Files.exists(skillMdPath)) {
                    System.out.println("⚠️  Skipping (no SKILL.md): " + skillDir.getFileName());
                    skipped++;
                    continue;
                }
                
                try {
                    String content = Files.readString(skillMdPath);
                    String migrated = migrateSkillMd(content);
                    
                    if (migrated.equals(content)) {
                        System.out.println("✓  No change needed: " + skillDir.getFileName());
                        skipped++;
                    } else {
                        // 备份原文件
                        Path backupPath = skillDir.resolve("SKILL.md.backup");
                        Files.writeString(backupPath, content);
                        
                        // 写入新文件
                        Files.writeString(skillMdPath, migrated);
                        System.out.println("✅ Migrated: " + skillDir.getFileName() + " (backup: SKILL.md.backup)");
                        migrated++;
                    }
                } catch (Exception e) {
                    System.out.println("❌ Error processing " + skillDir.getFileName() + ": " + e.getMessage());
                    errors++;
                }
            }
        }
        
        System.out.println("\n=== Migration Summary ===");
        System.out.println("Migrated: " + migrated);
        System.out.println("Skipped: " + skipped);
        System.out.println("Errors: " + errors);
    }
    
    /**
     * 从 SKILL.md 中移除脚本代码部分
     */
    static String migrateSkillMd(String content) {
        // 移除 "## 各平台 main.js 模板" 及之后的内容
        String[] markers = {
            "## 各平台 main.js 模板",
            "## browser（必须用 PuppeteerAgent",
            "### browser（必须用 PuppeteerAgent",
            "## android（用 agentFromAdbDevice",
            "### android（用 agentFromAdbDevice",
            "## ios（用 agentFromWebDriverAgent",
            "### ios（用 agentFromWebDriverAgent",
            "## computer（用 agentFromComputer",
            "### computer（用 agentFromComputer"
        };
        
        String lowerContent = content.toLowerCase();
        int cutIndex = -1;
        
        for (String marker : markers) {
            int idx = lowerContent.indexOf(marker.toLowerCase());
            if (idx != -1) {
                cutIndex = idx;
                break;
            }
        }
        
        if (cutIndex != -1) {
            content = content.substring(0, cutIndex);
        }
        
        // 清理多余的空行
        content = content.replaceAll("\n{3,}", "\n\n");
        
        // 确保内容以换行符结尾
        content = content.trim();
        if (!content.endsWith("\n")) {
            content = content + "\n";
        }
        
        return content;
    }
}
