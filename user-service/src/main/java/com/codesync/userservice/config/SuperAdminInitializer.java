package com.codesync.userservice.config;

import com.codesync.userservice.model.User;
import com.codesync.userservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class SuperAdminInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_USERNAME:}")
    private String adminUsername;

    @Value("${ADMIN_PASSWORD:}")
    private String adminPassword;

    public SuperAdminInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        String username = (adminUsername != null && !adminUsername.isBlank()) ? adminUsername.trim() : "admin";
        String password = (adminPassword != null && !adminPassword.isBlank()) ? adminPassword.trim() : "admin123";

        Optional<User> existingAdmin = userRepository.findByUsername(username);
        if (existingAdmin.isEmpty()) {
            User superAdmin = new User();
            superAdmin.setUsername(username);
            superAdmin.setEmail("admin@teamcode.dev");
            superAdmin.setPassword(passwordEncoder.encode(password));
            superAdmin.setProvider("LOCAL");
            superAdmin.setRole("ROLE_SUPER_ADMIN");
            superAdmin.setIsActive(true);
            userRepository.save(superAdmin);
            log.info("[TeamCode] Super Admin inicial criado com sucesso: '{}'", username);
        } else {
            User admin = existingAdmin.get();
            if (!"ROLE_SUPER_ADMIN".equalsIgnoreCase(admin.getRole())) {
                admin.setRole("ROLE_SUPER_ADMIN");
                userRepository.save(admin);
                log.info("[TeamCode] Usuário '{}' promovido a Super Admin.", username);
            }
        }
    }
}
