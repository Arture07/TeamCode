package com.crewcode.sessionservice.util;

import com.crewcode.sessionservice.util.JwtTokenHelper.UserTokenInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

public class JwtTokenHelperTest {

    private JwtTokenHelper jwtTokenHelper;

    @BeforeEach
    void setUp() {
        jwtTokenHelper = new JwtTokenHelper();
    }

    private String createMockJwt(String username, String role, long expSeconds) {
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = String.format("{\"sub\":\"%s\",\"role\":\"%s\",\"exp\":%d}", username, role, expSeconds);
        String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return header + "." + encodedPayload + ".mockSignature";
    }

    @Test
    @DisplayName("Parse valid user token successfully")
    void testParseValidUserToken() {
        long futureExp = (System.currentTimeMillis() / 1000) + 3600;
        String jwt = createMockJwt("artur", "ROLE_USER", futureExp);

        UserTokenInfo info = jwtTokenHelper.parseToken("Bearer " + jwt);

        assertTrue(info.isValid());
        assertEquals("artur", info.getUsername());
        assertEquals("ROLE_USER", info.getRole());
        assertFalse(info.isAdmin());
    }

    @Test
    @DisplayName("Parse valid admin token and detect admin privileges")
    void testParseAdminToken() {
        long futureExp = (System.currentTimeMillis() / 1000) + 3600;
        String jwt = createMockJwt("superadmin", "ROLE_SUPER_ADMIN", futureExp);

        UserTokenInfo info = jwtTokenHelper.parseToken("Bearer " + jwt);

        assertTrue(info.isValid());
        assertEquals("superadmin", info.getUsername());
        assertTrue(info.isAdmin());
    }

    @Test
    @DisplayName("Expired token should be recognized as invalid")
    void testExpiredToken() {
        long pastExp = (System.currentTimeMillis() / 1000) - 3600; // Expired 1 hour ago
        String jwt = createMockJwt("artur", "ROLE_USER", pastExp);

        UserTokenInfo info = jwtTokenHelper.parseToken("Bearer " + jwt);

        assertFalse(info.isValid(), "Expired token must be marked invalid");
    }

    @Test
    @DisplayName("Null or malformed header returns invalid token info")
    void testMalformedHeader() {
        UserTokenInfo nullInfo = jwtTokenHelper.parseToken(null);
        assertFalse(nullInfo.isValid());

        UserTokenInfo invalidBearer = jwtTokenHelper.parseToken("InvalidHeader");
        assertFalse(invalidBearer.isValid());
    }
}
