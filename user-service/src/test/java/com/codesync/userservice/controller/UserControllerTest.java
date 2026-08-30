package com.codesync.userservice.controller;

import com.codesync.userservice.model.User;
import com.codesync.userservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.repository.query.FluentQuery;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

public class UserControllerTest {

    private StubUserRepository stubUserRepository;
    private StubPasswordEncoder stubPasswordEncoder;
    private UserController userController;

    static class StubPasswordEncoder implements PasswordEncoder {
        @Override
        public String encode(CharSequence rawPassword) {
            return "hashed_" + rawPassword;
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            return ("hashed_" + rawPassword).equals(encodedPassword);
        }
    }

    static class StubUserRepository implements UserRepository {
        private final Map<String, User> database = new HashMap<>();
        public User lastSavedUser;

        @Override
        public Optional<User> findByUsername(String username) {
            return Optional.ofNullable(database.get(username));
        }

        @Override
        public Optional<User> findByEmail(String email) {
            return Optional.empty();
        }

        @Override
        public Optional<User> findByProviderAndProviderId(String provider, String providerId) {
            return Optional.empty();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <S extends User> S save(S entity) {
            lastSavedUser = entity;
            database.put(entity.getUsername(), entity);
            return entity;
        }

        @Override public void flush() {}
        @Override public <S extends User> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends User> List<S> saveAllAndFlush(Iterable<S> entities) { return List.of(); }
        @Override public void deleteAllInBatch(Iterable<User> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override public void deleteAllInBatch() {}
        @Override public User getOne(Long aLong) { return null; }
        @Override public User getById(Long aLong) { return null; }
        @Override public User getReferenceById(Long aLong) { return null; }
        @Override public <S extends User> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends User> List<S> findAll(Example<S> example) { return List.of(); }
        @Override public <S extends User> List<S> findAll(Example<S> example, Sort sort) { return List.of(); }
        @Override public <S extends User> Page<S> findAll(Example<S> example, Pageable pageable) { return null; }
        @Override public <S extends User> long count(Example<S> example) { return 0; }
        @Override public <S extends User> boolean exists(Example<S> example) { return false; }
        @Override public <S extends User, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public <S extends User> List<S> saveAll(Iterable<S> entities) { return List.of(); }
        @Override public Optional<User> findById(Long aLong) { return Optional.empty(); }
        @Override public boolean existsById(Long aLong) { return false; }
        @Override public List<User> findAll() { return List.of(); }
        @Override public List<User> findAllById(Iterable<Long> longs) { return List.of(); }
        @Override public long count() { return 0; }
        @Override public void deleteById(Long aLong) {}
        @Override public void delete(User entity) {}
        @Override public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override public void deleteAll(Iterable<? extends User> entities) {}
        @Override public void deleteAll() {}
        @Override public List<User> findAll(Sort sort) { return List.of(); }
        @Override public Page<User> findAll(Pageable pageable) { return null; }
    }

    @BeforeEach
    void setUp() {
        stubUserRepository = new StubUserRepository();
        stubPasswordEncoder = new StubPasswordEncoder();
        userController = new UserController(
                stubUserRepository,
                stubPasswordEncoder,
                null,
                null,
                null
        );
    }

    @Test
    @DisplayName("Reject registration with invalid characters in username")
    void testRejectInvalidUsernameCharacters() {
        User user = new User();
        user.setUsername("user<script>alert(1)</script>");
        user.setPassword("valid_password123");

        ResponseEntity<?> response = userController.registerUser(user);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("Reject registration with short password (< 6 chars)")
    void testRejectShortPassword() {
        User user = new User();
        user.setUsername("validuser");
        user.setPassword("12345");

        ResponseEntity<?> response = userController.registerUser(user);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("Reject duplicate username with 409 Conflict")
    void testRejectDuplicateUsername() {
        User existing = new User();
        existing.setUsername("existinguser");
        stubUserRepository.database.put("existinguser", existing);

        User newUser = new User();
        newUser.setUsername("existinguser");
        newUser.setPassword("valid_password123");

        ResponseEntity<?> response = userController.registerUser(newUser);
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
    }

    @Test
    @DisplayName("Enforce ROLE_USER and prevent Mass Assignment privilege escalation")
    void testPreventMassAssignmentPrivilegeEscalation() {
        User maliciousUser = new User();
        maliciousUser.setUsername("hacker");
        maliciousUser.setPassword("supersecret123");
        maliciousUser.setRole("ROLE_SUPER_ADMIN"); // Attacker attempts to become super admin

        ResponseEntity<?> response = userController.registerUser(maliciousUser);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());

        User saved = stubUserRepository.lastSavedUser;
        assertNotNull(saved);
        assertEquals("ROLE_USER", saved.getRole(), "Role must be forced to ROLE_USER by backend");
        assertTrue(saved.getIsActive());
        assertEquals("LOCAL", saved.getProvider());
        assertTrue(saved.getPassword().startsWith("hashed_"), "Password must be encoded");
    }
}
