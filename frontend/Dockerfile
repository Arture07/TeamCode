# 1) Estágio de Construção (Build)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./

# Configurações para evitar timeouts de rede durante a instalação
RUN npm config set fetch-retry-maxtimeout 600000 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm install --legacy-peer-deps --no-audit

COPY . .
RUN npm run build

# 2) Estágio de Produção
FROM nginx:1.25-alpine

# Copia o build estático do Vite
COPY --from=build /app/dist /usr/share/nginx/html

# Sobrescreve a configuração padrão do nginx
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
