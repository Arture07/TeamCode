package com.codesync.userservice.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

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
}