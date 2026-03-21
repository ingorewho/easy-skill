package com.easycontrol.model;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class FrameInfo {
  private String frameId;
  private double timestamp; // seconds
  private String base64Image;
  private String description;
}
