package com.codesync.syncservice.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Configuration
@Slf4j
public class RedisRelayConfig {

    public static final String REDIS_TOPIC = "stomp-relay";

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        
        ObjectMapper mapper = new ObjectMapper();
        mapper.activateDefaultTyping(mapper.getPolymorphicTypeValidator(), ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer(mapper));
        return template;
    }

    @Bean
    public RedisMessageListenerContainer container(RedisConnectionFactory connectionFactory,
                                                   MessageListenerAdapter listenerAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listenerAdapter, new ChannelTopic(REDIS_TOPIC));
        return container;
    }

    @Bean
    public MessageListenerAdapter listenerAdapter(RedisRelaySubscriber subscriber) {
        return new MessageListenerAdapter(subscriber, "onMessage");
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RelayMessage {
        private String destination;
        private Object payload;
    }

    @Service
    public static class RedisRelayPublisher {
        private final RedisTemplate<String, Object> redisTemplate;

        public RedisRelayPublisher(RedisTemplate<String, Object> redisTemplate) {
            this.redisTemplate = redisTemplate;
        }

        public void publish(String destination, Object payload) {
            RelayMessage msg = new RelayMessage(destination, payload);
            redisTemplate.convertAndSend(REDIS_TOPIC, msg);
        }
    }

    @Service
    public static class RedisRelaySubscriber {
        private final SimpMessagingTemplate messagingTemplate;

        public RedisRelaySubscriber(SimpMessagingTemplate messagingTemplate) {
            this.messagingTemplate = messagingTemplate;
        }

        public void onMessage(RelayMessage message) {
            if (message != null && message.getDestination() != null) {
                // Forward the message to local WebSocket clients
                messagingTemplate.convertAndSend(message.getDestination(), message.getPayload());
            }
        }
    }
}
