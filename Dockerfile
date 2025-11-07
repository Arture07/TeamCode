###############################################
# Monorepo Single Web Service (Render-friendly)
# - Builds 3 Spring Boot services + Frontend
# - Runs all services and Nginx in one container
# - Nginx listens on ${PORT} when provided (Render), defaults to 80 locally
###############################################

# === Build: user-service ===
FROM maven:3.8.5-openjdk-17 AS build-user
WORKDIR /build/user
COPY user-service/pom.xml ./
RUN mvn -q dependency:go-offline
COPY user-service/src ./src
RUN mvn -q package -DskipTests

# === Build: session-service ===
FROM maven:3.8.5-openjdk-17 AS build-session
WORKDIR /build/session
COPY session-service/pom.xml ./
RUN mvn -q dependency:go-offline
COPY session-service/src ./src
RUN mvn -q package -DskipTests

# === Build: sync-service ===
FROM maven:3.8.5-openjdk-17 AS build-sync
WORKDIR /build/sync
COPY sync-service/pom.xml ./
RUN mvn -q dependency:go-offline
COPY sync-service/src ./src
RUN mvn -q package -DskipTests

# === Build: frontend ===
FROM node:18-alpine AS build-frontend
WORKDIR /build/frontend

# Resilient npm settings
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_TIMEOUT=600000 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_LOGLEVEL=warn

COPY frontend/package*.json ./
RUN (npm ci --legacy-peer-deps --no-progress --prefer-online) || (npm install --legacy-peer-deps --no-progress --prefer-online)
COPY frontend .
RUN npm run build

# === Runtime ===
FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app

# Install Nginx and developer tooling used by sync-service (python, node, compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        gettext-base \  # provides envsubst for template expansion
        python3 python3-pip \
        nodejs npm \
        gcc g++ make \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/bin/python

# Copy backend jars
COPY --from=build-user /build/user/target/*.jar /app/user-service.jar
COPY --from=build-session /build/session/target/*.jar /app/session-service.jar
COPY --from=build-sync /build/sync/target/*.jar /app/sync-service.jar

# Copy frontend build to Nginx html dir
COPY --from=build-frontend /build/frontend/dist /usr/share/nginx/html

# Copy Nginx template and start script
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose for local runs; on Render Nginx will listen on ${PORT}
EXPOSE 80

# Default envs (safe defaults; override in Render)
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0" \
    USER_SERVICE_PORT=8080 \
    SESSION_SERVICE_PORT=8081 \
    SYNC_SERVICE_PORT=8082

CMD ["/start.sh"]
