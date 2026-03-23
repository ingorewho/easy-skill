package com.easycontrol.repository;

import com.easycontrol.model.FrameArchive;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FrameArchiveRepository extends JpaRepository<FrameArchive, String> {
    
    List<FrameArchive> findAllByOrderByCreatedAtDesc();
    
    List<FrameArchive> findByVideoArchiveIdOrderByTimestampAsc(String videoArchiveId);
    
    List<FrameArchive> findByVideoIdOrderByTimestampAsc(String videoId);
}
