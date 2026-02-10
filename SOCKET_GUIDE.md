# Руководство по Socket.io системе коммуникации

## Обзор

Проект использует **Socket.io** для двусторонней коммуникации в реальном времени между клиентом и сервером. Все игровые события обрабатываются через WebSocket соединения.

## Архитектура

### Серверная часть

Файл `server/src/socket/gameSocket.ts` содержит всю логику обработки Socket.io событий.

### Клиентская часть

- `client/src/services/socketService.ts` - обертка для Socket.io клиента
- `client/src/store/middleware/socketMiddleware.ts` - интеграция с Redux

## Аутентификация

### Middleware аутентификации

Перед подключением каждый клиент должен пройти аутентификацию через JWT токен.

**Процесс:**
1. Клиент отправляет токен в `handshake.auth.token`
2. Сервер проверяет токен через `jwt.verify()`
3. Если токен валиден - извлекает `userId` и `username`
4. Сохраняет данные в `socket.data` для дальнейшего использования

**Ошибки:**
- `Токен не предоставлен` - если токен отсутствует
- `Недействительный токен` - если токен невалиден или истек

## События клиент → сервер

### `auth`

**Устаревшее:** В текущей реализации аутентификация происходит через middleware при подключении.

### `move`

Перемещение игрока на карте.

**Данные:**
```typescript
{
  target: HexCoordinates; // { q: number, r: number }
}
```

**Обработка:**
1. Проверяет возможность перемещения через `gameWorld.movePlayer()`
2. Если успешно:
   - Отправляет `move:success` клиенту
   - Отправляет `game:update` всем клиентам
3. Если неуспешно:
   - Отправляет `move:error` клиенту

**Пример:**
```typescript
socket.emit('move', { target: { q: 1, r: 0 } });
```

### `colonize`

Колонизация системы игроком.

**Данные:**
```typescript
{
  coordinates: HexCoordinates;
}
```

**Обработка:**
1. Вызывает `gameWorld.colonizeSystem()`
2. Если успешно:
   - Отправляет `colonize:success` клиенту
   - Отправляет обновленную карту всем через `game:update`
3. Если неуспешно:
   - Отправляет `colonize:error` с описанием ошибки

**Пример:**
```typescript
socket.emit('colonize', { coordinates: { q: 5, r: 3 } });
```

### `develop:colony`

Развитие существующей колонии.

**Данные:**
```typescript
{
  coordinates: HexCoordinates;
}
```

**Обработка:**
1. Вызывает `gameWorld.developColony()`
2. Если успешно:
   - Отправляет `develop:success` с новым уровнем threat
   - Отправляет обновленную карту всем через `game:update`
3. Если неуспешно:
   - Отправляет `develop:error` с описанием ошибки

**Пример:**
```typescript
socket.emit('develop:colony', { coordinates: { q: 5, r: 3 } });
```

### `combat:start`

Начало боя между игроками.

**Данные:**
```typescript
{
  targetPlayerId: string;
}
```

**Обработка:**
1. Находит обоих игроков
2. Создает бой через `combatSystem.startCombat()`
3. Отправляет `combat:started` обоим игрокам
4. Запускает цикл обновления боя каждые 16ms (~60 FPS)
5. Отправляет `combat:update` на каждом кадре
6. При завершении отправляет `combat:ended`

**Пример:**
```typescript
socket.emit('combat:start', { targetPlayerId: 'player-123' });
```

### `combat:start:bot`

Начало боя с NPC ботом.

**Данные:** нет

**Обработка:**
1. Создает бой с ботом через `combatSystem.startCombatWithBot()`
2. Отправляет `combat:started` игроку
3. Запускает цикл обновления боя
4. Бот управляется автоматически через AI

**Пример:**
```typescript
socket.emit('combat:start:bot');
```

### `combat:control`

Управление кораблем в бою.

**Данные:**
```typescript
{
  combatId: string;
  thrust: number;    // Тяга (0-1)
  turn: number;      // Поворот (-1 до 1)
  boost?: boolean;   // Ускорение
}
```

**Обработка:**
1. Применяет управление через `combatSystem.applyControl()`
2. Обновление состояния происходит в следующем кадре боя

**Пример:**
```typescript
socket.emit('combat:control', {
  combatId: 'combat-123',
  thrust: 1.0,
  turn: 0.5,
});
```

### `combat:action`

Боевое действие (устаревшее, используется `combat:control`).

**Данные:**
```typescript
{
  combatId: string;
  action: 'thrust' | 'turn' | 'fire';
  value?: number;
  weaponId?: string;
}
```

## События сервер → клиент

### `auth:success`

Успешная аутентификация при подключении.

**Данные:**
```typescript
{
  player: Player; // Данные игрока
}
```

**Когда отправляется:**
- Сразу после подключения и добавления игрока в игру

### `game:state`

Полное состояние игры при подключении.

**Данные:**
```typescript
{
  id: string;
  phase: GamePhase;
  map: {
    radius: number;
    cells: Array<HexCell>;
  };
  players: Array<Player>;
}
```

**Когда отправляется:**
- При подключении нового игрока
- Содержит полное состояние для синхронизации

### `game:update`

Инкрементальное обновление состояния игры.

**Данные (зависит от типа):**
```typescript
// Перемещение игрока
{
  type: 'player_moved';
  playerId: string;
  position: HexCoordinates;
  moveTimer: number;
  canMove: boolean;
}

// Создание колонии
{
  type: 'colony_created';
  coordinates: HexCoordinates;
  playerId: string;
  map: HexMap;
}

// Развитие колонии
{
  type: 'colony_developed';
  coordinates: HexCoordinates;
  playerId: string;
  threat: number;
  map: HexMap;
}

// Истечение таймера
{
  type: 'timer_expired';
  playerId: string;
  moveTimer: 0;
  canMove: true;
}
```

**Когда отправляется:**
- При перемещении игрока (всем)
- При колонизации системы (всем)
- При развитии колонии (всем)
- При истечении таймера движения (всем)

### `move:success`

Успешное перемещение игрока.

**Данные:**
```typescript
{
  position: HexCoordinates;
  moveTimer: number;
  canMove: boolean;
}
```

**Когда отправляется:**
- Только отправившему запрос игроку
- После успешного перемещения

### `move:error`

Ошибка перемещения.

**Данные:**
```typescript
{
  message: string;
}
```

**Возможные ошибки:**
- `Невозможно переместиться (таймер или расстояние)`

### `colonize:success`

Успешная колонизация.

**Данные:**
```typescript
{
  coordinates: HexCoordinates;
}
```

### `colonize:error`

Ошибка колонизации.

**Данные:**
```typescript
{
  message: string;
}
```

**Возможные ошибки:**
- `Система не найдена`
- `Система уже колонизирована другим игроком`
- `Нельзя колонизировать NPC станцию`
- `Система под влиянием других фракций`
- `Вы должны находиться в системе для колонизации`

### `develop:success`

Успешное развитие колонии.

**Данные:**
```typescript
{
  coordinates: HexCoordinates;
  threat: number; // Новый уровень threat
}
```

### `develop:error`

Ошибка развития колонии.

**Данные:**
```typescript
{
  message: string;
}
```

**Возможные ошибки:**
- `Система не найдена`
- `Это не ваша колония`
- `Это не колония`
- `Вы должны находиться в колонии для её развития`

### `player:join`

Новый игрок подключился.

**Данные:**
```typescript
{
  player: Player;
}
```

**Когда отправляется:**
- Всем клиентам кроме подключившегося игрока
- При подключении нового игрока

### `player:leave`

Игрок отключился.

**Данные:**
```typescript
{
  playerId: string;
}
```

**Когда отправляется:**
- Всем клиентам
- При отключении игрока

### `players:list`

Список всех онлайн игроков.

**Данные:**
```typescript
{
  players: Array<Player>;
}
```

**Когда отправляется:**
- При подключении нового игрока
- Содержит всех онлайн игроков

### `combat:started`

Бой начался.

**Данные:**
```typescript
{
  combat: CombatState;
}
```

**Когда отправляется:**
- Участникам боя
- При начале PvP боя или боя с ботом

### `combat:update`

Обновление состояния боя.

**Данные:**
```typescript
{
  combat: CombatState; // Полное состояние боя
}
```

**Когда отправляется:**
- Каждые 16ms (~60 FPS) во время боя
- Участникам боя

### `combat:ended`

Бой завершен.

**Данные:**
```typescript
{
  winner: string | null; // ID победителя или 'bot'
  combat: CombatState;   // Финальное состояние
}
```

**Когда отправляется:**
- Участникам боя
- При завершении боя (победа/поражение/тайм-аут)

### `combat:error`

Ошибка в боевой системе.

**Данные:**
```typescript
{
  message: string;
}
```

**Возможные ошибки:**
- `Игрок не найден`

## Сериализация данных

### `serializeGameState(state)`

Конвертирует состояние игры для отправки клиенту.

**Процесс:**
- Конвертирует `Map<string, HexCell>` в массив
- Конвертирует `Map<string, Player>` в массив
- Удаляет внутренние поля, не нужные клиенту

### `serializePlayer(player)`

Конвертирует данные игрока для отправки.

**Поля:**
- `id`, `username`, `position`, `ship`
- `resources`, `experience`, `level`
- `online`, `moveTimer`, `canMove`

## Обработка отключений

### Событие `disconnect`

При отключении игрока:

1. Сохраняет данные игрока в БД через `PlayerService.savePlayer()`
2. Удаляет игрока из `GameWorld` через `removePlayer()`
3. Отправляет `player:leave` всем клиентам
4. Логирует отключение

## Интеграция с Redux

### Socket Middleware

`socketMiddleware.ts` интегрирует Socket.io события с Redux store:

- Слушает события от сервера
- Диспатчит Redux actions
- Обновляет состояние приложения

**Пример:**
```typescript
socket.on('game:update', (data) => {
  dispatch(gameSlice.actions.updateGame(data));
});
```

## Производительность

### Оптимизации

- Инкрементальные обновления вместо полного состояния
- Обновление боя только для участников
- Батчинг обновлений (не отправляется каждое изменение отдельно)

### Частота обновлений

- Таймеры: каждые 100ms
- Бой: каждые 16ms (~60 FPS)
- Автосохранение: каждые 30 секунд

## Безопасность

### Валидация

- Все входные данные валидируются на сервере
- Проверка прав доступа перед действиями
- Защита от подделки данных клиентом

### Rate Limiting

Рекомендуется добавить:
- Ограничение частоты запросов от одного клиента
- Защита от спама событий
- Таймауты для долгих операций

## Отладка

### Логирование

Сервер логирует:
- Подключения/отключения игроков
- Все игровые действия
- Ошибки обработки событий

### Инструменты

- Socket.io Admin UI (для мониторинга соединений)
- Chrome DevTools Network tab (для просмотра WebSocket сообщений)

## Связанные компоненты

- `gameSocket.ts` - обработка событий на сервере
- `socketService.ts` - клиентская обертка
- `socketMiddleware.ts` - интеграция с Redux
- `GameWorld` - игровая логика
- `CombatSystem` - боевая система
