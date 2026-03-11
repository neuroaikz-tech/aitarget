FROM node:20-alpine

# Зависимости для компиляции better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Копируем package.json из server/
COPY server/package*.json ./
RUN npm install

# Копируем исходники сервера
COPY server/ ./

# Собираем TypeScript
RUN npm run build

# Директория для SQLite (Fly.io volume будет смонтирован сюда)
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "dist/index.js"]
