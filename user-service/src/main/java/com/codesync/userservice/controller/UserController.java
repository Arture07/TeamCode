package com.codesync.userservice.controller;

import com.codesync.userservice.dto.AuthRequest;
import com.codesync.userservice.dto.AuthResponse;
import com.codesync.userservice.model.User;
import com.codesync.userservice.repository.UserRepository;
import com.codesync.userservice.security.JwtUtil;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtUtil jwtUtil;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder, AuthenticationManager authenticationManager, UserDetailsService userDetailsService, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody User user) {
        // Sanitize username: allow only alphanumeric, underscore, hyphen
        String username = user.getUsername().trim();
        if (!username.matches("^[a-zA-Z0-9_\\-]+$")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Nome de usuário pode conter apenas letras, números, _ e -"));
        }

        // Check password length for local registration
        if (user.getPassword() == null || user.getPassword().length() < 6) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "A senha deve ter no mínimo 6 caracteres"));
        }

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "O nome de usuário já existe!"));
        }

        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setProvider("LOCAL");
        userRepository.save(user);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Usuário registrado com sucesso!"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> createAuthenticationToken(@Valid @RequestBody AuthRequest authRequest) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(authRequest.getUsername().trim(), authRequest.getPassword())
            );
        } catch (Exception e) {
            // Generic error message — don't reveal whether username exists
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Credenciais inválidas"));
        }

        final UserDetails userDetails = userDetailsService.loadUserByUsername(authRequest.getUsername().trim());
        final String jwt = jwtUtil.generateToken(userDetails);

        return ResponseEntity.ok(new AuthResponse(jwt));
    }
}