# 1) Build Stage
FROM node:18-alpine AS build
WORKDIR /app

# Make npm installs more resilient to flaky networks/timeouts
ENV NPM_CONFIG_FETCH_RETRIES=5 \
	NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
	NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
	NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
	NPM_CONFIG_TIMEOUT=600000 \
	NPM_CONFIG_AUDIT=false \
	NPM_CONFIG_FUND=false \
	NPM_CONFIG_LOGLEVEL=warn

# Copy lockfile for deterministic installs
COPY package*.json ./

# Prefer npm ci (deterministic); fallback to npm install if lock mismatch
RUN (npm ci --legacy-peer-deps --no-progress --prefer-online) \
 || (npm install --legacy-peer-deps --no-progress --prefer-online)

COPY . .
RUN npm run build

# 2) Production Stage
FROM nginx:1.25-alpine

# Copia o build estático do Vite
COPY --from=build /app/dist /usr/share/nginx/html

# Sobrescreve a configuração padrão do nginx
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
