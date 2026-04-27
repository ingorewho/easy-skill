package com.easycontrol.repository;

import com.easycontrol.model.PromptTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, String> {
    
    // 按使用次数降序获取所有模板
    List<PromptTemplate> findAllByOrderByUseCountDescCreatedAtDesc();
    
    // 按分类获取模板
    List<PromptTemplate> findByCategoryOrderByUseCountDesc(String category);
    
    // 搜索模板
    List<PromptTemplate> findByNameContainingOrContentContainingOrderByUseCountDesc(
        String nameKeyword, String contentKeyword
    );
}
