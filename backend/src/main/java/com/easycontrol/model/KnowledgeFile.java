package com.easycontrol.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeFile {
  private String fileName;
  private String mimeType;
  private String fileType;   // image | document | other
  private long size;
  private String description;
  private String createdAt;
}
