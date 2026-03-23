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
@Table(name = "video_archives")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoArchive {
    
    @Id
    private String id;
    
    @Column(name = "video_id")
    private String videoId;
    
    private String filename;
    
    private Long duration;
    
    @Column(name = "file_size")
    private Long fileSize;
    
    @Column(name = "file_path")
    private String filePath;
    
    @Column(name = "thumbnail_path")
    private String thumbnailPath;
    
    private String description;
    
    @Column(name = "frame_count")
    private Integer frameCount;
    
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
