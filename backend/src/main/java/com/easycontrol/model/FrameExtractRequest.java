package com.easycontrol.model;

import lombok.Data;
import java.util.List;

@Data
public class FrameExtractRequest {
  private List<Double> timestamps; // for manual frame extraction
  private int intervalSeconds = 3; // for auto extraction
}
