package com.easycontrol.controller;

import com.easycontrol.model.PromptTemplate;
import com.easycontrol.repository.PromptTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/prompt-templates")
@RequiredArgsConstructor
public class PromptTemplateController {

    private final PromptTemplateRepository templateRepository;

    @GetMapping
    public ResponseEntity<List<PromptTemplate>> listTemplates() {
        return ResponseEntity.ok(templateRepository.findAllByOrderByUseCountDescCreatedAtDesc());
    }

    @PostMapping
    public ResponseEntity<PromptTemplate> createTemplate(@RequestBody CreateTemplateRequest request) {
        PromptTemplate template = PromptTemplate.builder()
            .id(UUID.randomUUID().toString())
            .name(request.name)
            .content(request.content)
            .category(request.category != null ? request.category : "custom")
            .useCount(0)
            .createdAt(LocalDateTime.now())
            .build();
        
        return ResponseEntity.ok(templateRepository.save(template));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PromptTemplate> updateTemplate(
            @PathVariable String id,
            @RequestBody CreateTemplateRequest request) {
        return templateRepository.findById(id)
            .map(template -> {
                template.setName(request.name);
                template.setContent(request.content);
                if (request.category != null) {
                    template.setCategory(request.category);
                }
                return ResponseEntity.ok(templateRepository.save(template));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable String id) {
        templateRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/use")
    public ResponseEntity<Void> incrementUseCount(@PathVariable String id) {
        return templateRepository.findById(id)
            .map(template -> {
                template.incrementUseCount();
                templateRepository.save(template);
                return ResponseEntity.ok().<Void>build();
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // Request DTOs
    public static class CreateTemplateRequest {
        public String name;
        public String content;
        public String category;
    }
}
