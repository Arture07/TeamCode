# Root multi-service Dockerfile for single Render deployment
# Builds all Spring Boot services and the frontend, then runs them under supervisord + nginx.

# ------------------------ Build stage (Java services + frontend) ------------------------
FROM maven:3.8.5-openjdk-17 AS build-java
WORKDIR /workspace

# Copy Maven descriptors first for dependency caching
COPY user-service/pom.xml user-service/pom.xml
COPY session-service/pom.xml session-service/pom.xml
COPY sync-service/pom.xml sync-service/pom.xml

# Pre-download dependencies for each service to leverage docker layer cache
RUN mvn -q -f user-service/pom.xml dependency:go-offline && \
    mvn -q -f session-service/pom.xml dependency:go-offline && \
    mvn -q -f sync-service/pom.xml dependency:go-offline

# Copy sources
COPY user-service/src user-service/src
COPY session-service/src session-service/src
COPY sync-service/src sync-service/src

# Package each service (skip tests for speed; adjust if you have tests)
RUN mvn -q -f user-service/pom.xml package -DskipTests && \
    mvn -q -f session-service/pom.xml package -DskipTests && \
    mvn -q -f sync-service/pom.xml package -DskipTests

# Frontend build stage
FROM node:18-alpine AS build-frontend
WORKDIR /app
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_TIMEOUT=600000 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_LOGLEVEL=warn
COPY frontend/package*.json ./
RUN (npm ci --legacy-peer-deps --no-progress --prefer-online) || \
    (npm install --legacy-peer-deps --no-progress --prefer-online)
COPY frontend .
RUN npm run build

# ------------------------ Runtime stage ------------------------
FROM eclipse-temurin:17-jre-jammy
WORKDIR /opt

# Install runtime tools and nginx + supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    python3 python3-pip nodejs npm gcc g++ make \
    ca-certificates curl && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

# Copy jars from build stage
COPY --from=build-java /workspace/user-service/target/*.jar /opt/user-service/app.jar
COPY --from=build-java /workspace/session-service/target/*.jar /opt/session-service/app.jar
COPY --from=build-java /workspace/sync-service/target/*.jar /opt/sync-service/app.jar

# Copy frontend build
COPY --from=build-frontend /app/dist /usr/share/nginx/html

# Copy nginx config (use existing one if present)
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy supervisord configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Environment variables (Render will override)
ENV SPRING_DATASOURCE_URL="" \
    SPRING_DATASOURCE_USERNAME="" \
    SPRING_DATASOURCE_PASSWORD="" \
    JWT_SECRET="" \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"

# Expose a single external port (frontend) and internal service ports if needed
EXPOSE 80
EXPOSE 8080 8081 8082

# Healthcheck (basic ping to frontend; adjust later for actuator)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fs http://localhost/ || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
