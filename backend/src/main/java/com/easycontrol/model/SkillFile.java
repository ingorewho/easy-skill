package com.easycontrol.model;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SkillFile {
  private String skillId;
  private String skillName;
  private List<FileEntry> files;
  private List<SkillVariable> variables; // 抽取的变量列表
  
  // 关联的视频和帧信息（用于重新生成/局部调整）
  private String videoId;
  private List<FrameInfo> frames;
  private String requirement;
  
  @Data
  @Builder
  @AllArgsConstructor
  @NoArgsConstructor
  public static class FrameInfo {
    private String frameId;
    private double timestamp;
    private String base64Image;
    private String description;
    private String annotationJson;
  }

  @Data
  @Builder
  @AllArgsConstructor
  @NoArgsConstructor
  public static class FileEntry {
    private String name;
    private String path;
    private String content;
  }

  @Data
  @Builder
  @AllArgsConstructor
  @NoArgsConstructor
  public static class SkillVariable {
    private String name;        // 英文驼峰变量名
    private String label;       // 中文说明
    private String defaultValue; // 默认值（视频中的值）
    private String type;        // 类型：string, number, boolean
  }
}
