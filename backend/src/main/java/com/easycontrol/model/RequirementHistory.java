package com.easycontrol.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "requirement_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RequirementHistory {
    
    @Id
    private String id;
    
    @Column(length = 2000)
    private String content;
    
    @Column(name = "frame_ids")
    private String frameIds;
    
    private String platform;
    
    @Column(name = "use_count")
    private Integer useCount;
    
    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;
    
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
