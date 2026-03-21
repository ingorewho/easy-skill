package com.easycontrol.model;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class VideoUploadResponse {
  private String videoId;
  private String filename;
  private long duration; // seconds
  private long fileSize;
}
