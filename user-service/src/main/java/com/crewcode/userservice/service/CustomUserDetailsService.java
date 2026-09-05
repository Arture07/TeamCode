package com.crewcode.userservice.service;

import com.crewcode.userservice.model.User;
import com.crewcode.userservice.repository.UserRepository;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Utilizador não encontrado: " + username));

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new DisabledException("Conta de usuário desativada por um administrador.");
        }

        String role = (user.getRole() != null && !user.getRole().isBlank()) ? user.getRole() : "ROLE_USER";
        List<SimpleGrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority(role));

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword() != null ? user.getPassword() : "",
                user.getIsActive() != null ? user.getIsActive() : true,
                true,
                true,
                true,
                authorities
        );
    }
}
