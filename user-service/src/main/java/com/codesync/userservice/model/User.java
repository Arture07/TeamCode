package com.codesync.userservice.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "app_user")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String username;
    private String email;
    private String password;

    // OAuth fields
    @Column(nullable = false)
    private String provider = "LOCAL"; // LOCAL, GITHUB, GOOGLE

    @Column(name = "provider_id")
    private String providerId;

    @Column(name = "avatar_url")
    private String avatarUrl;
}