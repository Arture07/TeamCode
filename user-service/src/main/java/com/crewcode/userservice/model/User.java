package com.crewcode.userservice.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Nome de usuário é obrigatório")
    @Size(min = 3, max = 30, message = "Nome de usuário deve ter entre 3 e 30 caracteres")
    @Column(unique = true, length = 30)
    private String username;

    @Email(message = "E-mail inválido")
    @Size(max = 100)
    @Column(length = 100)
    private String email;

    @Size(max = 255)
    private String password;

    // OAuth fields
    @Column(nullable = false, length = 10)
    private String provider = "LOCAL"; // LOCAL, GITHUB, GOOGLE

    @Column(name = "provider_id", length = 100)
    private String providerId;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    // RBAC: ROLE_USER, ROLE_SUPER_ADMIN
    @Column(nullable = false, length = 30)
    private String role = "ROLE_USER";

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (role == null) {
            role = "ROLE_USER";
        }
        if (isActive == null) {
            isActive = true;
        }
    }

    public User() {
    }

    public User(Long id, String username, String email, String password, String provider, String providerId, String avatarUrl) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.password = password;
        this.provider = provider != null ? provider : "LOCAL";
        this.providerId = providerId;
        this.avatarUrl = avatarUrl;
        this.role = "ROLE_USER";
        this.isActive = true;
        this.createdAt = Instant.now();
    }

    public User(Long id, String username, String email, String password, String provider, String providerId, String avatarUrl, String role, Boolean isActive) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.password = password;
        this.provider = provider != null ? provider : "LOCAL";
        this.providerId = providerId;
        this.avatarUrl = avatarUrl;
        this.role = role != null ? role : "ROLE_USER";
        this.isActive = isActive != null ? isActive : true;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderId() {
        return providerId;
    }

    public void setProviderId(String providerId) {
        this.providerId = providerId;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}