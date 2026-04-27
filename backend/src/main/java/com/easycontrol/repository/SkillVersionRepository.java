package com.easycontrol.repository;

import com.easycontrol.model.SkillVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SkillVersionRepository extends JpaRepository<SkillVersion, String> {
    
    // 获取 Skill 的所有历史版本，按版本号降序
    List<SkillVersion> findBySkillIdOrderByVersionNumberDesc(String skillId);
    
    // 获取 Skill 的最新版本
    Optional<SkillVersion> findTopBySkillIdOrderByVersionNumberDesc(String skillId);
    
    // 获取指定版本号
    Optional<SkillVersion> findBySkillIdAndVersionNumber(String skillId, Integer versionNumber);
    
    // 统计版本数量
    long countBySkillId(String skillId);
    
    // 删除 Skill 的所有版本
    void deleteBySkillId(String skillId);
}
