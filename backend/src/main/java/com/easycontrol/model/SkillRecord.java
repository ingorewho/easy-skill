package com.easycontrol.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "skill_records")
public class SkillRecord {

  @Id
  private String skillId;

  private String skillName;

  private String platform;

  @Column(name = "display_order")
  private Integer displayOrder;

  @Column(length = 1000)
  private String description;
  
  // 当前生效的代码文件（JSON）
  @Column(name = "files_json", length = 50000)
  private String filesJson;
  
  // 当前生效的变量定义（JSON）
  @Column(name = "variables_json", length = 5000)
  private String variablesJson;
  
  // 候选代码（重新生成但未接受）
  @Column(name = "candidate_json", length = 50000)
  private String candidateJson;
  
  // 当前版本号
  @Column(name = "current_version")
  @Builder.Default
  private Integer currentVersion = 1;
  
  // 重新生成迭代次数
  @Column(name = "regeneration_count")
  @Builder.Default
  private Integer regenerationCount = 0;
  
  // 原始诉求
  @Column(name = "requirement", length = 2000)
  private String requirement;
  
  // 最后一次使用的补充 prompt
  @Column(name = "last_additional_prompt", length = 5000)
  private String lastAdditionalPrompt;
  
  // 关联的视频ID
  @Column(name = "video_id")
  private String videoId;
  
  // 关联的帧信息（JSON数组，包含 frameId, timestamp, description, annotationJson, base64Image）
  @Column(name = "frames_json", length = 100000)
  private String framesJson;

  @CreationTimestamp
  @Column(name = "created_at")
  private LocalDateTime createdAt;
  
  @UpdateTimestamp
  @Column(name = "updated_at")
  private LocalDateTime updatedAt;
}
