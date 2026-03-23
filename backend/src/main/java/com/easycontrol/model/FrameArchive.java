package com.easycontrol.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "frame_archives")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FrameArchive {
    
    @Id
    private String id;
    
    @Column(name = "frame_id")
    private String frameId;
    
    @Column(name = "video_id")
    private String videoId;
    
    @Column(name = "video_archive_id")
    private String videoArchiveId;
    
    private Double timestamp;
    
    @Column(name = "image_path")
    private String imagePath;
    
    @Column(name = "thumbnail_path")
    private String thumbnailPath;
    
    private String description;
    
    @Column(name = "annotation_json", length = 10000)
    private String annotationJson;
    
    @Column(name = "base64_preview")
    private String base64Preview;
    
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
