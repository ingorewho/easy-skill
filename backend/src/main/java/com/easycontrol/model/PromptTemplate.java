package com.easycontrol.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "prompt_templates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PromptTemplate {
    
    @Id
    private String id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false, length = 5000)
    private String content;
    
    private String category; // error-handling, logging, data-extraction, custom
    
    @Column(name = "use_count")
    @Builder.Default
    private Integer useCount = 0;
    
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;
    
    public void incrementUseCount() {
        this.useCount = (this.useCount == null ? 0 : this.useCount) + 1;
        this.lastUsedAt = LocalDateTime.now();
    }
}
