package com.easycontrol.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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

  @Column(length = 1000)
  private String description;

  private LocalDateTime createdAt;
}
