# Руководство по Redux Store (управление состоянием клиента)

## Обзор

Клиентская часть использует **Redux Toolkit** для управления состоянием приложения. Store организован по модульному принципу с отдельными slices для разных доменов.

## Архитектура

### Структура Store

```typescript
{
  auth: AuthState;      // Аутентификация
  game: GameState;     // Состояние игры
  player: PlayerState; // Игроки
  combat: CombatState; // Боевая система
}
```

### Конфигурация

Файл `client/src/store/store.ts` настраивает Redux store:

```typescript
export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
    player: playerReducer,
    combat: combatReducer,
  },
  middleware: [
    ...getDefaultMiddleware(),
    socketMiddleware, // Интеграция с Socket.io
  ],
});
```

## Slices

### authSlice

Управляет аутентификацией пользователя.

**Состояние:**
```typescript
{
  token: string | null;        // JWT токен
  user: {                       // Данные пользователя
    id: string;
    username: string;
  } | null;
  isAuthenticated: boolean;    // Флаг аутентификации
  loading: boolean;            // Загрузка
  error: string | null;        // Ошибка
}
```

**Actions:**
- `login(credentials)` - асинхронный вход
- `register(credentials)` - асинхронная регистрация
- `verifyToken()` - проверка токена
- `logout()` - выход
- `clearError()` - очистка ошибки

**Использование:**
```typescript
import { useAppDispatch, useAppSelector } from './hooks';
import { login, logout } from './slices/authSlice';

const dispatch = useAppDispatch();
const { isAuthenticated, user } = useAppSelector(state => state.auth);

// Вход
await dispatch(login({ username: 'player', password: 'pass' }));

// Выход
dispatch(logout());
```

### gameSlice

Управляет состоянием игры (карта, фаза).

**Состояние:**
```typescript
{
  id: string | null;           // ID игрового мира
  phase: GamePhase;            // Текущая фаза
  map: {                        // Карта
    radius: number;
    cells: HexCell[];
  } | null;
  connected: boolean;           // Подключение к серверу
}
```

**Actions:**
- `setGameState(state)` - установить полное состояние
- `updateMap(map)` - обновить карту
- `updateGameState(update)` - обновить состояние (заглушка)
- `setConnected(connected)` - статус подключения

**Использование:**
```typescript
const { map, phase, connected } = useAppSelector(state => state.game);
```

### playerSlice

Управляет данными игроков.

**Состояние:**
```typescript
{
  currentPlayer: Player | null; // Текущий игрок
  players: Player[];            // Все игроки
}
```

**Actions:**
- `setCurrentPlayer(player)` - установить текущего игрока
- `setPlayers(players)` - установить список игроков
- `addPlayer(player)` - добавить игрока
- `removePlayer(playerId)` - удалить игрока
- `updatePlayerPosition({playerId, position?, moveTimer?, canMove?})` - обновить позицию/таймеры
- `updatePlayerTimers(timers[])` - массовое обновление таймеров

**Использование:**
```typescript
const { currentPlayer, players } = useAppSelector(state => state.player);

// Обновить позицию игрока
dispatch(updatePlayerPosition({
  playerId: 'player-123',
  position: { q: 1, r: 0 },
  moveTimer: Date.now() + 15000,
  canMove: false,
}));
```

### combatSlice

Управляет боевой системой.

**Состояние:**
```typescript
{
  activeCombat: CombatState | null; // Текущий бой
  inCombat: boolean;                // Флаг боя
  combatResult: {                   // Результат боя
    winner: string;
    combat: CombatState;
  } | null;
}
```

**Actions:**
- `startCombat(combat)` - начать бой
- `updateCombat(combat)` - обновить состояние боя
- `setCombatResult({winner, combat})` - установить результат
- `endCombat()` - завершить бой

**Использование:**
```typescript
const { activeCombat, inCombat, combatResult } = useAppSelector(state => state.combat);

// Начать бой
dispatch(startCombat(combatState));

// Завершить бой
dispatch(endCombat());
```

## Socket Middleware

### Интеграция с Socket.io

`socketMiddleware.ts` интегрирует Socket.io события с Redux store.

**Процесс:**
1. При инициализации store вызывается `setupSocketListeners(store)`
2. Устанавливаются слушатели Socket.io событий
3. При получении события диспатчится соответствующий Redux action

**Обрабатываемые события:**

| Socket.io событие | Redux Action |
|------------------|--------------|
| `connect` | `setConnected(true)` |
| `disconnect` | `setConnected(false)` |
| `auth:success` | `setCurrentPlayer(player)` |
| `game:state` | `setGameState(state)`, `setPlayers(players)` |
| `game:update` (player_moved) | `updatePlayerPosition(...)` |
| `game:update` (colony_created) | `updateMap(map)` |
| `player:join` | `addPlayer(player)` |
| `player:leave` | `removePlayer(playerId)` |
| `combat:started` | `startCombat(combat)` |
| `combat:update` | `updateCombat(combat)` |
| `combat:ended` | `setCombatResult(...)` |

**Пример обработки:**
```typescript
socket.on(SocketEvent.GAME_UPDATE, (data) => {
  if (data.type === 'player_moved') {
    store.dispatch(updatePlayerPosition({
      playerId: data.playerId,
      position: data.position,
      moveTimer: data.moveTimer,
      canMove: data.canMove,
    }));
  }
});
```

## Типизированные хуки

### useAppDispatch и useAppSelector

Файл `client/src/store/hooks.ts` экспортирует типизированные хуки:

```typescript
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T) => 
  useSelector(selector);
```

**Использование:**
```typescript
import { useAppDispatch, useAppSelector } from '../store/hooks';

const MyComponent = () => {
  const dispatch = useAppDispatch();
  const currentPlayer = useAppSelector(state => state.player.currentPlayer);
  const map = useAppSelector(state => state.game.map);
  
  // ...
};
```

## Селекторы

### Простые селекторы

Используются напрямую в компонентах:

```typescript
// Текущий игрок
const currentPlayer = useAppSelector(state => state.player.currentPlayer);

// Все игроки
const players = useAppSelector(state => state.player.players);

// Карта
const map = useAppSelector(state => state.game.map);

// Статус аутентификации
const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
```

### Мемоизированные селекторы (рекомендуется)

Для производительности можно использовать `createSelector`:

```typescript
import { createSelector } from '@reduxjs/toolkit';

const selectPlayers = (state: RootState) => state.player.players;
const selectCurrentPlayerId = (state: RootState) => state.player.currentPlayer?.id;

const selectOtherPlayers = createSelector(
  [selectPlayers, selectCurrentPlayerId],
  (players, currentId) => players.filter(p => p.id !== currentId)
);
```

## Примеры использования

### Компонент с Redux

```typescript
import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updatePlayerPosition } from '../store/slices/playerSlice';
import { socketService } from '../services/socketService';

const GameComponent = () => {
  const dispatch = useAppDispatch();
  const currentPlayer = useAppSelector(state => state.player.currentPlayer);
  const map = useAppSelector(state => state.game.map);
  
  const handleMove = (target: HexCoordinates) => {
    socketService.emit('move', { target });
    // Redux обновится автоматически через socketMiddleware
  };
  
  return (
    <div>
      <p>Игрок: {currentPlayer?.username}</p>
      <p>Позиция: [{currentPlayer?.position.q}, {currentPlayer?.position.r}]</p>
      {/* Карта и интерфейс */}
    </div>
  );
};
```

### Обработка асинхронных действий

```typescript
import { useAppDispatch } from '../store/hooks';
import { login } from '../store/slices/authSlice';

const LoginComponent = () => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector(state => state.auth);
  
  const handleLogin = async (username: string, password: string) => {
    try {
      await dispatch(login({ username, password })).unwrap();
      // Успешный вход
    } catch (err) {
      // Ошибка уже в state.auth.error
      console.error('Ошибка входа:', err);
    }
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(username, password);
    }}>
      {error && <div className="error">{error}</div>}
      {loading && <div>Загрузка...</div>}
      {/* Форма */}
    </form>
  );
};
```

## Производительность

### Оптимизации

1. **Мемоизация селекторов** - используйте `createSelector` для сложных вычислений
2. **React.memo** - оборачивайте компоненты, которые не должны перерисовываться часто
3. **Разделение состояния** - храните только необходимое в Redux, остальное в локальном состоянии

### Избегайте

- Хранения больших объектов в store (например, полная карта)
- Частых обновлений при каждом событии Socket.io
- Дублирования данных между slices

## Отладка

### Redux DevTools

Redux Toolkit автоматически настраивает Redux DevTools:

1. Установите расширение [Redux DevTools](https://github.com/reduxjs/redux-devtools)
2. Откройте DevTools в браузере
3. Просматривайте actions, state и time-travel debugging

### Логирование

Все Socket.io события логируются в консоль:

```typescript
socket.on(SocketEvent.GAME_UPDATE, (data) => {
  console.log('Получено обновление:', data);
  // ...
});
```

## Связанные компоненты

- `store.ts` - конфигурация store
- `hooks.ts` - типизированные хуки
- `socketMiddleware.ts` - интеграция с Socket.io
- `slices/` - все Redux slices
- `socketService.ts` - Socket.io клиент
