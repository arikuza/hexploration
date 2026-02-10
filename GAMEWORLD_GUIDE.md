# Руководство по центральному менеджеру игрового состояния (GameWorld)

## Обзор

`GameWorld` - это центральный singleton-класс, который управляет всем состоянием игры. Он координирует работу всех подсистем: карты, боевой системы, игроков, таймеров и сохранения данных.

## Архитектура

### Singleton паттерн

`GameWorld` реализован как singleton - существует только один экземпляр на весь сервер:

```typescript
export const gameWorld = new GameWorld();
```

### Основные компоненты

```typescript
class GameWorld {
  private state: GameState;           // Состояние игры
  private hexMap: HexMapManager;      // Менеджер карты
  private combatSystem: CombatSystem; // Система боя
  private timerInterval: NodeJS.Timeout; // Интервал обновления таймеров
  private io: Server | null;          // Socket.io сервер
  private saveInterval: NodeJS.Timeout; // Интервал автосохранения
  private initialized: boolean;       // Флаг инициализации
}
```

## Инициализация

### Метод `initialize()`

Выполняется при старте сервера и загружает состояние из БД или создает новый мир.

**Процесс:**
1. Проверяет, что мир еще не инициализирован
2. Загружает сохраненный мир из БД через `GameWorldService`
3. Если мир найден - восстанавливает карту и фазу
4. Если мир не найден - создает новый
5. Запускает обновление таймеров
6. Запускает автосохранение

**Пример:**
```typescript
await gameWorld.initialize();
```

## Управление игроками

### Метод `addPlayer(userId, username): Promise<Player>`

Добавляет игрока в игру или восстанавливает его из БД.

**Процесс:**
1. Пытается загрузить данные игрока из БД через `PlayerService`
2. Если игрок найден - восстанавливает его прогресс (позицию, ресурсы, уровень)
3. Если игрок новый - создает нового с базовым кораблем и стартовой позицией
4. Добавляет игрока в `state.players`
5. Если это первый игрок - переводит игру в фазу `EXPLORATION`

**Стартовые позиции:**
```typescript
[
  { q: 0, r: 0 },
  { q: 2, r: 0 },
  { q: -2, r: 0 },
  { q: 0, r: 2 },
  { q: 0, r: -2 },
  { q: 1, r: 1 },
]
```

**Базовый корабль:**
- Тип: `Scout` (Разведчик)
- Характеристики из `SHIP_STATS.scout`
- Базовое оружие из `DEFAULT_WEAPONS`

### Метод `removePlayer(userId): void`

Удаляет игрока из игры при отключении.

**Процесс:**
1. Находит игрока в `state.players`
2. Удаляет его из Map
3. Игрок сохраняется в БД перед удалением (в `gameSocket.ts`)

### Метод `getPlayer(playerId): Player | undefined`

Получает данные игрока по ID.

### Метод `getOnlinePlayers(): Player[]`

Возвращает массив всех онлайн игроков (где `online === true`).

## Управление движением

### Метод `movePlayer(playerId, targetPosition): boolean`

Перемещает игрока на указанный гекс.

**Валидация:**
1. Проверяет существование игрока
2. Проверяет, что таймер истек (`canMove === true` и `moveTimer <= now`)
3. Проверяет расстояние (только соседние гексы, `distance === 1`)
4. Проверяет существование целевого гекса

**Процесс перемещения:**
1. Обновляет позицию игрока
2. Отмечает гекс как открытый (`discoverCell`)
3. Устанавливает таймер на следующий ход (`moveTimer = now + MOVE_COOLDOWN`)
4. Устанавливает `canMove = false`

**Возвращает:**
- `true` - перемещение успешно
- `false` - перемещение отклонено

**Кулдаун:** `MOVE_COOLDOWN` (15 секунд по умолчанию)

## Система таймеров

### Метод `startTimerUpdates()`

Запускает периодическое обновление таймеров игроков.

**Интервалы:**
- Обновление таймеров: каждые **100ms**
- Проверка деградации колоний: каждые **10 секунд**

### Метод `updatePlayerTimers()`

Обновляет таймеры всех игроков и отправляет обновления клиентам.

**Процесс:**
1. Для каждого игрока проверяет `moveTimer`
2. Если таймер истек (`moveTimer <= now`):
   - Устанавливает `moveTimer = 0`
   - Устанавливает `canMove = true`
   - Отправляет событие `game:update` всем клиентам

## Автосохранение

### Метод `startAutoSave()`

Запускает автоматическое сохранение состояния каждые **30 секунд**.

### Метод `saveWorld(): Promise<void>`

Сохраняет текущее состояние мира в БД.

**Процесс:**
1. Сохраняет фазу игры и карту через `GameWorldService.saveWorld()`
2. Сохраняет всех игроков через `PlayerService.saveAllPlayers()`

**Вызывается:**
- Автоматически каждые 30 секунд
- При колонизации системы
- При развитии колонии
- При отключении игрока

## Колонизация и развитие

### Метод `colonizeSystem(playerId, coordinates): Promise<{success, error?}>`

Позволяет игроку колонизировать систему.

**Валидация:**
1. Проверяет существование игрока
2. Проверяет, что игрок находится в целевой системе
3. Вызывает `hexMap.colonizeSystem()`
4. Сохраняет изменения в БД

### Метод `developColony(playerId, coordinates): Promise<{success, error?}>`

Развивает колонию игрока.

**Валидация:**
1. Проверяет существование игрока
2. Проверяет, что игрок находится в колонии
3. Вызывает `hexMap.developColony()`
4. Сохраняет изменения в БД

## Состояние игры

### Метод `getState(): GameState`

Возвращает полное состояние игры для отправки клиентам.

**Структура:**
```typescript
{
  id: string;              // ID игрового мира
  map: HexMap;             // Карта со всеми гексами
  players: Map<string, Player>; // Все игроки
  phase: GamePhase;        // Текущая фаза игры
}
```

### Фазы игры

- **LOBBY** - ожидание игроков
- **EXPLORATION** - исследование карты (основная фаза)
- **COMBAT** - боевая фаза
- **ENDED** - игра завершена

## Интеграция с Socket.io

### Метод `setIo(io: Server): void`

Устанавливает Socket.io сервер для отправки обновлений клиентам.

**Использование:**
- Отправка обновлений таймеров
- Уведомления о перемещениях
- Обновления карты при колонизации

## Доступ к подсистемам

### Метод `getCombatSystem(): CombatSystem`

Возвращает систему боя для обработки боевых действий.

### Метод `getHexMap(): HexMapManager`

Возвращает менеджер карты для работы с гексами.

## Примеры использования

### Добавление игрока при подключении

```typescript
// В gameSocket.ts
io.on('connection', async (socket) => {
  const player = await gameWorld.addPlayer(
    socket.data.userId,
    socket.data.username
  );
  
  socket.emit('auth:success', { player });
  socket.emit('game:state', serializeGameState(gameWorld.getState()));
});
```

### Обработка перемещения

```typescript
socket.on('move', (data) => {
  const success = gameWorld.movePlayer(
    socket.data.userId,
    data.target
  );
  
  if (success) {
    const player = gameWorld.getPlayer(socket.data.userId);
    socket.emit('move:success', {
      position: player?.position,
      moveTimer: player?.moveTimer,
    });
    
    // Уведомить всех об обновлении
    io.emit('game:update', {
      type: 'player_moved',
      playerId: socket.data.userId,
      position: player?.position,
    });
  }
});
```

### Колонизация системы

```typescript
socket.on('colonize', async (data) => {
  const result = await gameWorld.colonizeSystem(
    socket.data.userId,
    data.coordinates
  );
  
  if (result.success) {
    socket.emit('colonize:success', { coordinates: data.coordinates });
    
    // Отправить обновленную карту всем
    const state = gameWorld.getState();
    io.emit('game:update', {
      type: 'colony_created',
      map: serializeMap(state.map),
    });
  }
});
```

## Жизненный цикл

1. **Инициализация** - при старте сервера
2. **Загрузка** - восстановление из БД или создание нового мира
3. **Игровой цикл** - обработка действий игроков, обновление таймеров
4. **Автосохранение** - периодическое сохранение состояния
5. **Завершение** - сохранение при остановке сервера

## Производительность

### Оптимизации

- Обновление таймеров каждые 100ms (не каждый кадр)
- Автосохранение каждые 30 секунд (не при каждом действии)
- Инкрементальные обновления через Socket.io (не полное состояние)

### Масштабируемость

Текущая реализация рассчитана на:
- Один игровой мир
- До 100 одновременных игроков
- In-memory хранилище с периодическим сохранением в БД

Для масштабирования потребуется:
- Redis для кэширования
- Разделение миров на отдельные инстансы
- Горизонтальное масштабирование через Socket.io adapter

## Связанные компоненты

- `HexMapManager` - управление картой
- `CombatSystem` - боевая система
- `PlayerService` - сохранение данных игроков
- `GameWorldService` - сохранение состояния мира
- `gameSocket.ts` - обработка Socket.io событий
