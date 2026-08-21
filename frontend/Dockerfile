# 1) Estágio de Construção (Build)
FROM node:22.13.1-alpine AS build
WORKDIR /app
COPY package*.json ./

# Configurações para evitar timeouts de rede durante a instalação
RUN npm config set fetch-retry-maxtimeout 600000 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm install --legacy-peer-deps --no-audit
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# 2) Estágio de Produção
FROM nginx:1.27.0-alpine

# Copia certificados SSL de fallback para /tmp/ssl
COPY ssl/ /tmp/ssl/

# Copia o build estático do Vite
COPY --from=build /app/dist /usr/share/nginx/html

# Sobrescreve a configuração padrão do nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Script de inicialização que detecta certificados reais vs fallback
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]
