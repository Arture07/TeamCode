package com.codesync.userservice.controller;

import com.codesync.userservice.model.User;
import com.codesync.userservice.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/users/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminUserController {

    private final UserRepository userRepository;

    public AdminUserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * List all users.
     */
    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> response = new ArrayList<>();

        for (User u : users) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", u.getId());
            userMap.put("username", u.getUsername());
            userMap.put("email", u.getEmail());
            userMap.put("provider", u.getProvider());
            userMap.put("role", u.getRole());
            userMap.put("isActive", u.getIsActive() != null ? u.getIsActive() : true);
            userMap.put("avatarUrl", u.getAvatarUrl());
            userMap.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
            response.add(userMap);
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Get user statistics.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getUserStats() {
        List<User> users = userRepository.findAll();

        long totalUsers = users.size();
        long activeUsers = users.stream().filter(u -> Boolean.TRUE.equals(u.getIsActive())).count();
        long superAdmins = users.stream().filter(u -> "ROLE_SUPER_ADMIN".equalsIgnoreCase(u.getRole())).count();

        long localUsers = users.stream().filter(u -> "LOCAL".equalsIgnoreCase(u.getProvider())).count();
        long googleUsers = users.stream().filter(u -> "GOOGLE".equalsIgnoreCase(u.getProvider())).count();
        long githubUsers = users.stream().filter(u -> "GITHUB".equalsIgnoreCase(u.getProvider())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("activeUsers", activeUsers);
        stats.put("superAdmins", superAdmins);
        stats.put("providers", Map.of(
                "LOCAL", localUsers,
                "GOOGLE", googleUsers,
                "GITHUB", githubUsers
        ));

        return ResponseEntity.ok(stats);
    }

    /**
     * Update user role.
     */
    @PatchMapping("/users/{id}/role")
    public ResponseEntity<?> updateUserRole(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String newRole = payload.get("role");
        if (newRole == null || (!newRole.equals("ROLE_USER") && !newRole.equals("ROLE_SUPER_ADMIN"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Papel inválido. Use ROLE_USER ou ROLE_SUPER_ADMIN"));
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Usuário não encontrado"));
        }

        User user = userOpt.get();
        user.setRole(newRole);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Papel atualizado com sucesso!", "role", newRole));
    }

    /**
     * Toggle active/blocked status.
     */
    @PatchMapping("/users/{id}/toggle-active")
    public ResponseEntity<?> toggleUserActive(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Usuário não encontrado"));
        }

        User user = userOpt.get();
        boolean newStatus = !Boolean.TRUE.equals(user.getIsActive());
        user.setIsActive(newStatus);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Status do usuário alterado", "isActive", newStatus));
    }

    /**
     * Delete user account.
     */
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Usuário não encontrado"));
        }

        User user = userOpt.get();
        if ("ROLE_SUPER_ADMIN".equalsIgnoreCase(user.getRole())) {
            long adminCount = userRepository.findAll().stream()
                    .filter(u -> "ROLE_SUPER_ADMIN".equalsIgnoreCase(u.getRole()))
                    .count();
            if (adminCount <= 1) {
                return ResponseEntity.badRequest().body(Map.of("error", "Não é possível excluir o único Super Admin do sistema"));
            }
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Usuário excluído com sucesso!"));
    }
}
