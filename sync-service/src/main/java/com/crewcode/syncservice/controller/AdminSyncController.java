package com.crewcode.syncservice.controller;

import com.crewcode.syncservice.dto.UserEventMessage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/sync")
public class AdminSyncController {

    private final SyncController syncController;

    public AdminSyncController(SyncController syncController) {
        this.syncController = syncController;
    }

    /**
     * Get active rooms telemetry for Admin Console.
     */
    @GetMapping("/admin/active-rooms")
    public ResponseEntity<Map<String, Object>> getActiveRooms() {
        Map<String, Map<String, String>> participantsMap = syncController.getSessionParticipants();
        Map<String, Long> lastActivityMap = syncController.getUserLastActivity();

        List<Map<String, Object>> roomsList = new ArrayList<>();
        Set<String> uniqueOnlineUsers = new HashSet<>();
        int totalConnectedParticipants = 0;

        for (Map.Entry<String, Map<String, String>> entry : participantsMap.entrySet()) {
            String sessionId = entry.getKey();
            Map<String, String> sessionUsers = entry.getValue();

            if (sessionUsers != null && !sessionUsers.isEmpty()) {
                List<Map<String, Object>> usersInRoom = new ArrayList<>();
                long roomLatestActivity = 0;

                for (Map.Entry<String, String> uEntry : sessionUsers.entrySet()) {
                    String userId = uEntry.getKey();
                    String username = uEntry.getValue();
                    uniqueOnlineUsers.add(username);
                    totalConnectedParticipants++;

                    Long userAct = lastActivityMap.get(sessionId + ":" + userId);
                    if (userAct != null && userAct > roomLatestActivity) {
                        roomLatestActivity = userAct;
                    }

                    Map<String, Object> uInfo = new HashMap<>();
                    uInfo.put("userId", userId);
                    uInfo.put("username", username);
                    uInfo.put("lastActivity", userAct != null ? userAct : 0L);
                    usersInRoom.add(uInfo);
                }

                Map<String, Object> roomMap = new HashMap<>();
                roomMap.put("sessionId", sessionId);
                roomMap.put("participantsCount", sessionUsers.size());
                roomMap.put("participants", new ArrayList<>(sessionUsers.values()));
                roomMap.put("users", usersInRoom);
                roomMap.put("lastActivity", roomLatestActivity);
                roomsList.add(roomMap);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("activeRoomsCount", roomsList.size());
        response.put("totalConnectedParticipants", totalConnectedParticipants);
        response.put("uniqueOnlineUsersCount", uniqueOnlineUsers.size());
        response.put("onlineUsers", uniqueOnlineUsers);
        response.put("rooms", roomsList);

        return ResponseEntity.ok(response);
    }

    /**
     * Get quick summary stats.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Map<String, String>> participantsMap = syncController.getSessionParticipants();
        int activeRooms = 0;
        int totalOnline = 0;
        for (Map<String, String> room : participantsMap.values()) {
            if (room != null && !room.isEmpty()) {
                activeRooms++;
                totalOnline += room.size();
            }
        }
        return ResponseEntity.ok(Map.of(
                "activeRoomsCount", activeRooms,
                "onlineUsersCount", totalOnline
        ));
    }

    /**
     * Force disconnect a user from a session (Admin action).
     */
    @PostMapping("/admin/sessions/{sessionId}/disconnect/{userId}")
    public ResponseEntity<?> kickUser(@PathVariable String sessionId, @PathVariable String userId) {
        syncController.removeUserFromSession(sessionId, userId, null,
                UserEventMessage.EventType.LEAVE, "Desconectado pelo Administrador");
        return ResponseEntity.ok(Map.of("message", "Usuário desconectado com sucesso da sala"));
    }
}
