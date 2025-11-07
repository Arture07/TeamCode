#!/usr/bin/env bash
set -euo pipefail

# Ports
USER_PORT=${USER_SERVICE_PORT:-8080}
SESSION_PORT=${SESSION_SERVICE_PORT:-8081}
SYNC_PORT=${SYNC_SERVICE_PORT:-8082}

echo "Starting services: user:${USER_PORT}, session:${SESSION_PORT}, sync:${SYNC_PORT}"

# Quick sanity checks for required env vars
if [ -z "${JWT_SECRET:-}" ]; then
  echo "[WARN] JWT_SECRET is not set. user-service will fail to start (JwtUtil requires it)."
fi
if [ -z "${SPRING_DATASOURCE_URL:-}" ] || [ -z "${SPRING_DATASOURCE_USERNAME:-}" ] || [ -z "${SPRING_DATASOURCE_PASSWORD:-}" ]; then
  echo "[WARN] SPRING_DATASOURCE_* variables are not fully set. user-service will fail to connect to Postgres."
  echo "       Expect 502 on /api/users/* until database config is corrected."
fi

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
java -jar /app/user-service.jar --server.port=${USER_PORT} > /app/log-user.txt 2>&1 &
USER_PID=$!

echo "Starting session-service..."
java -jar /app/session-service.jar --server.port=${SESSION_PORT} > /app/log-session.txt 2>&1 &
SESSION_PID=$!

echo "Starting sync-service..."
java -jar /app/sync-service.jar --server.port=${SYNC_PORT} > /app/log-sync.txt 2>&1 &
SYNC_PID=$!

wait_for_port() {
  local port=$1 name=$2
  for i in $(seq 1 30); do
    if nc -z 127.0.0.1 "$port" 2>/dev/null; then
      echo "[$name] port $port is UP after ${i}s"
      return 0
    fi
    sleep 1
  done
  echo "[WARN] $name did not open port $port after 30s. Recent log:"
  tail -n 40 /app/log-${name}.txt || true
  return 1
}

echo "Waiting for services to become ready..."
wait_for_port "$USER_PORT" user || true
wait_for_port "$SESSION_PORT" session || true
wait_for_port "$SYNC_PORT" sync || true

echo "Starting nginx on port ${PORT}..."
nginx -g 'daemon off;' &
NGINX_PID=$!

# Stream service logs to container stdout so platforms like Render show them
{ 
  echo "--- Tailing service logs (user/session/sync) ---";
  tail -n +1 -F /app/log-user.txt /app/log-session.txt /app/log-sync.txt &
} 2>/dev/null || true

terminate() {
  echo "Shutting down..."
  kill -TERM ${NGINX_PID} ${USER_PID} ${SESSION_PID} ${SYNC_PID} 2>/dev/null || true
  wait ${NGINX_PID} ${USER_PID} ${SESSION_PID} ${SYNC_PID} 2>/dev/null || true
}

trap terminate INT TERM
wait -n || true
terminate
