package com.easycontrol.repository;

import com.easycontrol.model.VideoArchive;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoArchiveRepository extends JpaRepository<VideoArchive, String> {
    
    List<VideoArchive> findAllByOrderByCreatedAtDesc();
    
    Optional<VideoArchive> findByVideoId(String videoId);
    
    @Query("SELECT v FROM VideoArchive v WHERE v.filename LIKE %?1% OR v.description LIKE %?1%")
    List<VideoArchive> searchByKeyword(String keyword);
}
