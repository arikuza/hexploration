# Руководство по системе базы данных

## Обзор

Проект использует **MongoDB** для персистентного хранения данных игроков и игрового мира. Система состоит из моделей данных и сервисов для работы с БД.

## Архитектура

### Модели данных

Все модели находятся в `server/src/database/models/`:

- `User.ts` - пользователи (аутентификация)
- `PlayerData.ts` - данные игроков (прогресс, позиция, ресурсы)
- `GameWorld.ts` - состояние игрового мира (карта, фаза)

### Сервисы

Сервисы для работы с данными:

- `PlayerService.ts` - операции с данными игроков
- `GameWorldService.ts` - операции с состоянием мира

## Модели

### User

Хранит данные для аутентификации пользователей.

**Схема:**
```typescript
{
  userId: string;        // UUID пользователя
  username: string;      // Уникальное имя пользователя
  passwordHash: string;  // Хеш пароля (bcrypt)
  createdAt: Date;       // Дата создания
  lastLogin?: Date;      // Последний вход
}
```

**Использование:**
- Регистрация новых пользователей
- Аутентификация при входе
- Отслеживание активности

### PlayerData

Хранит игровой прогресс каждого игрока.

**Схема:**
```typescript
{
  userId: string;        // ID пользователя (связь с User)
  username: string;      // Имя игрока
  position: HexCoordinates; // Текущая позиция на карте
  ship: Ship;            // Данные корабля
  resources: number;     // Ресурсы игрока
  experience: number;    // Опыт
  level: number;        // Уровень
  lastPlayed: Date;     // Последняя игра
}
```

**Особенности:**
- Данные сохраняются при каждом автосохранении (30 сек)
- Восстанавливаются при входе игрока
- Позволяют продолжить игру с того же места

### GameWorld

Хранит состояние игрового мира.

**Схема:**
```typescript
{
  worldId: string;       // ID мира (обычно 'main')
  phase: GamePhase;      // Текущая фаза игры
  mapRadius: number;    // Радиус карты
  cells: Array<{         // Массив гексов (конвертируется из Map)
    key: string;         // Ключ гекса (hexKey)
    coordinates: HexCoordinates;
    systemType: SystemType;
    threat: number;
    owner?: string;
    resources: number;
    discoveredBy: string[];
    hasStation: boolean;
    lastDecayCheck?: number;
  }>;
  lastUpdate: Date;      // Последнее обновление
}
```

**Особенности:**
- Сохраняется каждые 30 секунд автоматически
- Восстанавливается при старте сервера
- Хранит все изменения карты (колонизация, развитие)

## Сервисы

### PlayerService

Сервис для работы с данными игроков.

#### `loadPlayer(userId): Promise<Partial<Player> | null>`

Загружает данные игрока из БД.

**Процесс:**
1. Ищет запись по `userId`
2. Если найдена - возвращает данные игрока
3. Если не найдена - возвращает `null`

**Возвращает:**
```typescript
{
  id: string;
  username: string;
  position: HexCoordinates;
  ship: Ship;
  resources: number;
  experience: number;
  level: number;
}
```

**Использование:**
- При входе игрока для восстановления прогресса
- В `GameWorld.addPlayer()`

#### `savePlayer(player): Promise<void>`

Сохраняет данные игрока в БД.

**Процесс:**
1. Ищет существующую запись по `userId`
2. Обновляет все поля
3. Если записи нет - создает новую (`upsert: true`)
4. Обновляет `lastPlayed` на текущее время

**Использование:**
- При автосохранении (каждые 30 сек)
- При отключении игрока

#### `saveAllPlayers(players: Map<string, Player>): Promise<void>`

Сохраняет всех активных игроков одновременно.

**Процесс:**
1. Преобразует Map в массив
2. Вызывает `savePlayer()` для каждого игрока параллельно
3. Использует `Promise.all()` для параллельного выполнения

**Использование:**
- При автосохранении мира

### GameWorldService

Сервис для работы с состоянием игрового мира.

#### `loadWorld(): Promise<{phase, map} | null>`

Загружает состояние мира из БД.

**Процесс:**
1. Ищет мир с `worldId = 'main'`
2. Если найден:
   - Конвертирует массив `cells` обратно в `Map<string, HexCell>`
   - Возвращает фазу и карту
3. Если не найден - возвращает `null`

**Возвращает:**
```typescript
{
  phase: GamePhase;
  map: HexMap; // С Map<string, HexCell>
}
```

**Использование:**
- При инициализации `GameWorld`
- При старте сервера

#### `saveWorld(phase, map): Promise<void>`

Сохраняет состояние мира в БД.

**Процесс:**
1. Конвертирует `Map<string, HexCell>` в массив для MongoDB
2. Для каждого гекса сохраняет все поля
3. Обновляет или создает запись (`upsert: true`)
4. Обновляет `lastUpdate` на текущее время

**Особенности:**
- Конвертация Map → Array необходима, т.к. MongoDB не поддерживает Map напрямую
- Сохраняются все поля гексов, включая `lastDecayCheck`

**Использование:**
- При автосохранении (каждые 30 сек)
- После колонизации системы
- После развития колонии

## Подключение к БД

### Файл `connection.ts`

Настраивает подключение к MongoDB через Mongoose.

**Конфигурация:**
```typescript
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hexploration';
```

**Процесс подключения:**
1. Подключается к MongoDB
2. Обрабатывает ошибки подключения
3. Логирует успешное подключение

**Использование:**
- Импортируется в `server.ts` при старте сервера
- Обеспечивает подключение перед использованием моделей

## Примеры использования

### Загрузка игрока при входе

```typescript
// В GameWorld.addPlayer()
const savedPlayer = await PlayerService.loadPlayer(userId);

if (savedPlayer) {
  // Восстановить прогресс
  player = {
    ...savedPlayer,
    online: true,
    moveTimer: 0,
    canMove: true,
  };
} else {
  // Создать нового игрока
  player = createNewPlayer();
}
```

### Сохранение при отключении

```typescript
// В gameSocket.ts
socket.on('disconnect', async () => {
  const player = gameWorld.getPlayer(socket.data.userId);
  if (player) {
    await PlayerService.savePlayer(player);
  }
  gameWorld.removePlayer(socket.data.userId);
});
```

### Автосохранение мира

```typescript
// В GameWorld.startAutoSave()
setInterval(async () => {
  await gameWorld.saveWorld();
}, 30000); // 30 секунд
```

## Миграции данных

### Текущая версия

Все данные хранятся в одной коллекции MongoDB без версионирования схемы.

### Будущие миграции

При изменении схемы данных потребуется:
1. Создать скрипт миграции
2. Обновить существующие записи
3. Обработать обратную совместимость

## Резервное копирование

### Рекомендации

- Настроить автоматические бэкапы MongoDB
- Хранить бэкапы отдельно от основного сервера
- Тестировать восстановление из бэкапов

### Частота бэкапов

Рекомендуется:
- Ежедневные полные бэкапы
- Еженедельные архивы
- Хранение минимум 30 дней

## Производительность

### Индексы

Рекомендуемые индексы для оптимизации:

```javascript
// User
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ userId: 1 }, { unique: true });

// PlayerData
db.playerdata.createIndex({ userId: 1 }, { unique: true });

// GameWorld
db.gameworlds.createIndex({ worldId: 1 }, { unique: true });
```

### Оптимизация запросов

- Использование `findOneAndUpdate` с `upsert` для атомарных операций
- Параллельное сохранение игроков через `Promise.all()`
- Кэширование часто запрашиваемых данных (в будущем)

## Безопасность

### Защита данных

- Пароли хранятся как хеши (bcrypt, 10 rounds)
- JWT токены для аутентификации
- Валидация данных перед сохранением

### Доступ к БД

- Использование переменных окружения для URI
- Ограничение доступа к БД только с сервера
- Регулярное обновление зависимостей

## Связанные компоненты

- `server.ts` - инициализация подключения
- `GameWorld.ts` - использование сервисов
- `gameSocket.ts` - сохранение при отключении
- `auth.ts` - работа с User моделью
