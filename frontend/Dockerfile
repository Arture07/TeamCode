# 1) Build Stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
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
