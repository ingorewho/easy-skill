package com.easycontrol.model;

import lombok.Data;
import java.util.List;

@Data
public class GenerateSkillRequest {
  private String videoId;
  private List<AnnotatedFrame> frames;
  private String requirement;
  private String sessionId; // for SSE log streaming

  @Data
  public static class AnnotatedFrame {
    private String frameId;
    private double timestamp;
    private String base64Image;
    private String description; // user annotation text
    private String annotationJson; // Fabric.js annotation JSON
  }
}
