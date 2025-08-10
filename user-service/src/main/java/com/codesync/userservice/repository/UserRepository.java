package com.codesync.userservice.repository;

import com.codesync.userservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Novo método para procurar um utilizador pelo nome de utilizador
    Optional<User> findByUsername(String username);
}
