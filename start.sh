#!/usr/bin/env bash
set -euo pipefail

# Ports
USER_PORT=${USER_SERVICE_PORT:-8080}
SESSION_PORT=${SESSION_SERVICE_PORT:-8081}
SYNC_PORT=${SYNC_SERVICE_PORT:-8082}

echo "Starting services: user:${USER_PORT}, session:${SESSION_PORT}, sync:${SYNC_PORT}"

# Generate nginx config from template with PORT and upstreams
export PORT=${PORT:-80}
export USER_UPSTREAM="http://127.0.0.1:${USER_PORT}"
export SESSION_UPSTREAM="http://127.0.0.1:${SESSION_PORT}"
export SYNC_UPSTREAM="http://127.0.0.1:${SYNC_PORT}"

envsubst '$PORT $USER_UPSTREAM $SESSION_UPSTREAM $SYNC_UPSTREAM' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/nginx.conf

# Start Spring services in background
echo "Starting user-service..."
java -jar /app/user-service.jar --server.port=${USER_PORT} &
USER_PID=$!

echo "Starting session-service..."
java -jar /app/session-service.jar --server.port=${SESSION_PORT} &
SESSION_PID=$!

echo "Starting sync-service..."
java -jar /app/sync-service.jar --server.port=${SYNC_PORT} &
SYNC_PID=$!

# Start nginx in foreground
echo "Starting nginx on port ${PORT}..."
nginx -g 'daemon off;' &
NGINX_PID=$!

terminate() {
  echo "Shutting down..."
  kill -TERM ${NGINX_PID} ${USER_PID} ${SESSION_PID} ${SYNC_PID} 2>/dev/null || true
  wait ${NGINX_PID} ${USER_PID} ${SESSION_PID} ${SYNC_PID} 2>/dev/null || true
}

trap terminate INT TERM
wait -n || true
terminate
