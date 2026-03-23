package com.easycontrol.repository;

import com.easycontrol.model.RequirementHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RequirementHistoryRepository extends JpaRepository<RequirementHistory, String> {
    
    List<RequirementHistory> findAllByOrderByLastUsedAtDescCreatedAtDesc();
    
    List<RequirementHistory> findTop10ByOrderByLastUsedAtDesc();
    
    @Modifying
    @Query("UPDATE RequirementHistory r SET r.useCount = COALESCE(r.useCount, 0) + 1, r.lastUsedAt = ?2 WHERE r.id = ?1")
    void incrementUseCount(String id, LocalDateTime lastUsedAt);
}
