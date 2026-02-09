# Деплой на Railway

## Шаг 1: Подготовка репозитория

1. Создай репозиторий на GitHub и залей туда код:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/твой-username/hexploration.git
git push -u origin main
```

2. Создай `.gitignore` если его нет:
```
node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
```

## Шаг 2: Настройка Railway

### 2.1 Создать проект
1. Зайди на https://railway.app/
2. Войди через GitHub
3. Нажми "New Project" → "Deploy from GitHub repo"
4. Выбери репозиторий `hexploration`

### 2.2 Настроить СЕРВЕР (бэкенд)

**Railway автоматически обнаружит монорепо. Создай первый сервис для бэкенда:**

1. В настройках сервиса:
   - **Name**: `hexploration-server`
   - **Root Directory**: оставь `/` (корень)
   - **Build Command**: `npm run railway:server`
   - **Start Command**: `npm run start:server`

2. Добавь переменные окружения (Settings → Variables):
   ```
   NODE_ENV=production
   PORT=3050
   JWT_SECRET=твой-супер-секретный-ключ-измени-это
   CLIENT_URL=https://hexploration-client.up.railway.app
   ```
   
3. Railway автоматически выделит домен для сервера (например: `hexploration-server.up.railway.app`)

### 2.3 Настроить КЛИЕНТ (фронтенд)

**Создай второй сервис для клиента:**

1. В том же проекте нажми "New Service" → "GitHub Repo" → выбери тот же репозиторий

2. В настройках сервиса:
   - **Name**: `hexploration-client`
   - **Root Directory**: `/client`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: не нужен (статика)

3. Добавь переменные окружения:
   ```
   VITE_API_URL=https://hexploration-server.up.railway.app
   VITE_WS_URL=https://hexploration-server.up.railway.app
   ```

4. В Settings → Networking:
   - Включи "Public Networking"
   - Railway выделит домен (например: `hexploration-client.up.railway.app`)

### 2.4 Обновить CORS на сервере

Вернись в настройки сервера и обнови `CLIENT_URL`:
```
CLIENT_URL=https://hexploration-client.up.railway.app
```

## Шаг 3: Деплой

1. Railway автоматически задеплоит оба сервиса
2. Следи за логами в разделе "Deployments"
3. После успешного деплоя открой URL клиента

## Шаг 4: Обновления

Любой push в main ветку автоматически запустит новый деплой!

```bash
git add .
git commit -m "Update feature"
git push
```

## Важные заметки

- **Бесплатный лимит**: $5 в месяц или 500 часов
- **Автоматический SSL**: Railway предоставляет HTTPS автоматически
- **Логи**: Доступны в реальном времени в интерфейсе Railway
- **Масштабирование**: Можно увеличить ресурсы в настройках

## Альтернатива: Один сервис (все в одном)

Если хочешь использовать только один сервис, можно настроить Express чтобы он сервил статику клиента.

Добавь в `server/src/server.ts` после других middleware:

```typescript
import path from 'path';

// Сервить статические файлы клиента (только в продакшн)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build/index.html'));
  });
}
```

Тогда в Railway настрой:
- **Build Command**: `npm run build && npm run build:client`
- **Start Command**: `npm run start:server`
- Только одна переменная `NODE_ENV=production`

## Проблемы?

- **CORS ошибки**: Проверь что `CLIENT_URL` правильный в переменных сервера
- **Не подключается WebSocket**: Убедись что используешь HTTPS и WSS (Railway делает это автоматически)
- **500 ошибка**: Проверь логи сервера в Railway dashboard
