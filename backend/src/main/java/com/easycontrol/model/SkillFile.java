package com.easycontrol.model;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SkillFile {
  private String skillId;
  private String skillName;
  private List<FileEntry> files;

  @Data
  @Builder
  @AllArgsConstructor
  @NoArgsConstructor
  public static class FileEntry {
    private String name;
    private String path;
    private String content;
  }
}
