FROM node:20-alpine

WORKDIR /app

# Устанавливаем зависимости для сборки better-sqlite3
RUN apk add --no-cache python3 make g++

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходники и собираем TypeScript
COPY . .
RUN npm run build

# Создаём директорию для данных (будет смонтирован volume)
RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "dist/index.js"]
