package com.easycontrol.controller;

import com.easycontrol.service.SkillRunnerService;
import com.easycontrol.service.SkillRunnerService.DeviceInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final SkillRunnerService skillRunnerService;

    @GetMapping("/android")
    public ResponseEntity<List<DeviceInfo>> listAndroidDevices() {
        try {
            List<DeviceInfo> devices = skillRunnerService.listAndroidDevices();
            return ResponseEntity.ok(devices);
        } catch (Exception e) {
            log.error("Failed to list android devices", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/ios")
    public ResponseEntity<List<DeviceInfo>> listIosDevices() {
        try {
            List<DeviceInfo> devices = skillRunnerService.listIosDevices();
            return ResponseEntity.ok(devices);
        } catch (Exception e) {
            log.error("Failed to list iOS devices", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping
    public ResponseEntity<Map<String, List<DeviceInfo>>> listAllDevices() {
        try {
            List<DeviceInfo> android = skillRunnerService.listAndroidDevices();
            List<DeviceInfo> ios = skillRunnerService.listIosDevices();
            
            return ResponseEntity.ok(Map.of(
                "android", android,
                "ios", ios
            ));
        } catch (Exception e) {
            log.error("Failed to list devices", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
