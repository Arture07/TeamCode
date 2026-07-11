package com.codesync.syncservice.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Redis-based relay for horizontal scaling of WebSocket messages.
 *
 * Strategy: LOCAL-FIRST
 *   1. Every message is delivered locally via SimpMessagingTemplate (guaranteed to work).
 *   2. The same message is also published to Redis for other instances.
 *   3. Each instance ignores its own messages from Redis (via instanceId).
 *   4. If Redis is unavailable, local delivery still works — no impact on users.
 */
@Configuration
@Slf4j
public class RedisRelayConfig {

    public static final String REDIS_CHANNEL = "teamcode:stomp-relay";
    private static final String INSTANCE_ID = UUID.randomUUID().toString().substring(0, 8);

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            RedisRelaySubscriber subscriber) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(subscriber, new ChannelTopic(REDIS_CHANNEL));
        log.info("Redis relay listener registered (instanceId={})", INSTANCE_ID);
        return container;
    }

    /**
     * Drop-in replacement for SimpMessagingTemplate.convertAndSend().
     * Delivers locally first (always works), then relays via Redis for other instances.
     */
    @Service
    @Slf4j
    public static class ScalableMessagingService {
        private final SimpMessagingTemplate messagingTemplate;
        private final StringRedisTemplate stringRedisTemplate;
        private final ObjectMapper objectMapper;

        public ScalableMessagingService(SimpMessagingTemplate messagingTemplate,
                                         StringRedisTemplate stringRedisTemplate,
                                         ObjectMapper objectMapper) {
            this.messagingTemplate = messagingTemplate;
            this.stringRedisTemplate = stringRedisTemplate;
            this.objectMapper = objectMapper;
        }

        /**
         * Sends a message to all WebSocket subscribers on the given destination.
         * Local delivery happens first (guaranteed). Redis relay is best-effort.
         */
        public void convertAndSend(String destination, Object payload) {
            // 1. ALWAYS deliver locally first — this is the critical path
            messagingTemplate.convertAndSend(destination, payload);

            // 2. Relay to Redis for other instances (non-fatal if it fails)
            try {
                Map<String, Object> envelope = new LinkedHashMap<>();
                envelope.put("i", INSTANCE_ID);
                envelope.put("d", destination);
                envelope.put("p", payload);
                String json = objectMapper.writeValueAsString(envelope);
                stringRedisTemplate.convertAndSend(REDIS_CHANNEL, json);
            } catch (Exception e) {
                // Redis failure must NEVER break local functionality
                log.debug("Redis relay publish failed (non-fatal): {}", e.getMessage());
            }
        }
    }

    /**
     * Listens for messages from OTHER instances via Redis and forwards them
     * to local WebSocket clients.
     */
    @Service
    @Slf4j
    public static class RedisRelaySubscriber implements MessageListener {
        private final SimpMessagingTemplate messagingTemplate;
        private final ObjectMapper objectMapper;

        public RedisRelaySubscriber(SimpMessagingTemplate messagingTemplate, ObjectMapper objectMapper) {
            this.messagingTemplate = messagingTemplate;
            this.objectMapper = objectMapper;
        }

        @Override
        public void onMessage(Message message, byte[] pattern) {
            try {
                String json = new String(message.getBody(), StandardCharsets.UTF_8);
                Map<String, Object> envelope = objectMapper.readValue(json,
                        new TypeReference<Map<String, Object>>() {});

                String sourceInstanceId = (String) envelope.get("i");

                // Skip our own messages — they were already delivered locally
                if (INSTANCE_ID.equals(sourceInstanceId)) {
                    return;
                }

                String destination = (String) envelope.get("d");
                Object payload = envelope.get("p");

                if (destination != null && payload != null) {
                    messagingTemplate.convertAndSend(destination, payload);
                    log.trace("Relayed message from instance {} to {}", sourceInstanceId, destination);
                }
            } catch (Exception e) {
                log.debug("Redis relay receive failed (non-fatal): {}", e.getMessage());
            }
        }
    }
}
