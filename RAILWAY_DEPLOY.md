# Деплой Hexploration на Railway

## Структура проекта

Hexploration - это монорепозиторий с 3 пакетами:
- `shared` - общие типы и константы
- `server` - Node.js/Express/Socket.io сервер
- `client` - React + Vite клиент

**Важно**: Деплой использует **один сервис** Railway, который:
- Собирает все три пакета (shared, server, client)
- Сервер раздаёт статические файлы клиента в продакшн режиме
- Обрабатывает API и WebSocket через Express

## 1. Подготовка проекта

### 1.1 GitHub репозиторий

Проект уже должен быть на GitHub: `https://github.com/arikuza/hexploration.git`

Если ещё не запушен:

```bash
git add .
git commit -m "Prepare for Railway deployment"
git push -u origin main
```

### 1.2 Файлы конфигурации

В проекте уже есть:
- `railway.json` - конфигурация Railway
- `package.json` (root) - скрипты для сборки:
  - `railway:build` - собирает shared, server, client
  - `railway:start` - запускает сервер
- `.env.example` файлы для сервера и клиента

## 2. Настройка Railway

### 2.1 Создать проект

1. Зайди на [railway.app](https://railway.app)
2. Авторизуйся через GitHub
3. Нажми "New Project"
4. Выбери "Deploy from GitHub repo"
5. Выбери репозиторий `arikuza/hexploration`

### 2.2 Настроить единственный сервис

Railway автоматически создаст один сервис. Проверь настройки:

**Build Command**: (должно быть автоматически из `railway.json`)
```
npm run railway:build
```

**Start Command**: (должно быть автоматически из `railway.json`)
```
npm run railway:start
```

**Root Directory**: `/` (корень репозитория)

### 2.3 Настроить переменные окружения

В настройках сервиса добавь:

```
NODE_ENV=production
PORT=3050
JWT_SECRET=твой-супер-секретный-ключ-измени-это
```

**Важно**: 
- `CLIENT_URL` НЕ нужен (клиент на том же домене)
- `VITE_API_URL` и `VITE_WS_URL` НЕ нужны (сервер и клиент на одном домене)

### 2.4 Деплой

1. Railway автоматически начнёт деплой после добавления переменных
2. Подожди завершения сборки (5-10 минут)
3. Railway выделит публичный домен (например: `hexploration-production.up.railway.app`)
4. Открой этот домен в браузере

## 3. Проверка

После деплоя проверь:

1. **Главная страница**: `https://твой-домен.up.railway.app/`
   - Должна показать React приложение

2. **API Health Check**: `https://твой-домен.up.railway.app/health`
   - Должен вернуть `{"status":"ok","timestamp":"..."}`

3. **WebSocket**: Открой DevTools → Network → WS
   - Должно быть активное WebSocket соединение

## 4. Обновление кода

После изменений в коде:

```bash
git add .
git commit -m "Update game logic"
git push origin main
```

Railway автоматически пересоберёт и задеплоит новую версию.

## 5. Логи и отладка

В Railway:
1. Открой свой проект
2. Выбери сервис
3. Вкладка "Deployments" → последний деплой → "View Logs"

## 6. Возможные проблемы

### Деплой не запускается после push

Если после `git push` новый деплой не стартует:

1. **Ручной редеплой**
   - Railway → проект → сервис (например, @hexploration/server)
   - Вкладка **Deployments** → кнопка **Deploy** / **Redeploy** (или три точки у последнего деплоя → **Redeploy**)
   - Либо **Settings** → **Redeploy** / **Trigger Deploy**

2. **Проверить связку с GitHub**
   - **Settings** сервиса → **Source** / **Connected Repo**
   - Убедиться, что репозиторий подключён и ветка `main` (или твоя рабочая ветка)
   - При необходимости **Disconnect** и заново **Connect** репозиторий

3. **Проверить, что push дошёл**
   - На GitHub: репозиторий → вкладка **Commits** — последний коммит должен быть твой
   - В Railway в **Deployments** у последнего деплоя будет тот же коммит (hash/message)

4. **Принудительный редеплой через пустой коммит**
   ```bash
   git commit --allow-empty -m "Trigger Railway redeploy"
   git push origin main
   ```

### Ошибка сборки

Если сборка падает:
- Проверь логи Railway (Deployments → последний деплой → **View Logs** / **Build Logs**)
- Убедись что `railway:build` скрипт работает локально:
  ```bash
  npm run railway:build
  ```
- Если в логах есть **Node version** (например, нужен Node ≥20): в корне проекта можно добавить файл `.nvmrc` с одной строкой `20` и закоммитить — Nixpacks часто подхватывает версию оттуда.

### WebSocket не подключается

- Проверь что в клиенте WebSocket использует тот же домен что и HTTP
- В продакшн режиме `socketService.ts` должен использовать `window.location.origin`

### 404 на маршрутах клиента

- Убедись что в `server.ts` есть обработчик `app.get('*', ...)` для SPA routing
- Он должен быть **после** всех API маршрутов

## 7. Стоимость

Railway предоставляет:
- $5 бесплатных кредитов в месяц
- Этого хватает на ~500 часов работы небольшого сервиса
- Для хобби-проекта достаточно

## 8. Альтернативы

Если Railway не подходит:
- **Render.com** - похожий сервис, тоже бесплатный tier
- **Fly.io** - больше контроля, сложнее настройка
- **VPS (DigitalOcean, Linode)** - полный контроль, от $5/месяц
