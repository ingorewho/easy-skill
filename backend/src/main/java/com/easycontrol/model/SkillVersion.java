package com.easycontrol.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "skill_versions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillVersion {
    
    @Id
    private String id;
    
    @Column(name = "skill_id", nullable = false)
    private String skillId;
    
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;
    
    @Column(name = "skill_name")
    private String skillName;
    
    private String platform;
    
    @Column(name = "files_json", length = 50000)
    private String filesJson; // JSON array of SkillFile
    
    @Column(name = "variables_json", length = 5000)
    private String variablesJson; // JSON array of variables
    
    @Column(name = "additional_prompt", length = 5000)
    private String additionalPrompt;
    
    @Column(name = "requirement", length = 2000)
    private String requirement;
    
    @Column(name = "frame_count")
    private Integer frameCount;
    
    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;
    
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
