package com.codesync.syncservice.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // prefixo para onde o servidor enviará as mensagens de broadcast
        config.enableSimpleBroker("/topic");
        // prefixo para onde o cliente manda mensagens de aplicação (MessageMapping)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // registra o endpoint /ws-connect com fallback SockJS
        registry
                .addEndpoint("/ws-connect")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
