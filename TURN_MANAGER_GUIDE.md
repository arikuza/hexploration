# Руководство по системе управления ходами (TurnManager)

## Обзор

`TurnManager` - это система управления очередью ходов игроков в игре. Она обеспечивает пошаговый игровой процесс, где каждый игрок получает возможность совершить действие в свою очередь.

## Архитектура

### Класс TurnManager

`TurnManager` наследуется от `EventEmitter` и управляет:
- Очередью игроков
- Текущим активным игроком
- Номером текущего хода
- Событиями смены ходов

### Основные методы

#### `addPlayer(playerId: string): void`
Добавляет игрока в очередь ходов.

**Поведение:**
- Проверяет, что игрок еще не добавлен
- Добавляет игрока в конец очереди
- Генерирует событие `player:added`

**Пример:**
```typescript
turnManager.addPlayer('player-123');
```

#### `removePlayer(playerId: string): void`
Удаляет игрока из очереди.

**Поведение:**
- Если удаляется текущий активный игрок, автоматически переходит к следующему
- Генерирует событие `player:removed`
- Генерирует событие `turn:changed`, если был изменен текущий ход

**Пример:**
```typescript
turnManager.removePlayer('player-123');
```

#### `getCurrentPlayer(): string | null`
Возвращает ID текущего активного игрока.

**Возвращает:**
- `string` - ID игрока, чей сейчас ход
- `null` - если нет игроков в очереди

#### `nextTurn(): void`
Переходит к следующему ходу.

**Поведение:**
- Переходит к следующему игроку в очереди
- Если вернулись к первому игроку, увеличивает номер хода
- Генерирует событие `round:complete` при завершении раунда
- Генерирует событие `turn:changed` при смене хода

**Пример:**
```typescript
turnManager.nextTurn();
// Если было: [player1, player2, player3], current = player1
// Станет: [player1, player2, player3], current = player2
```

#### `getTurnNumber(): number`
Возвращает номер текущего раунда (начинается с 0).

#### `getPlayers(): string[]`
Возвращает массив всех ID игроков в очереди.

#### `isPlayerTurn(playerId: string): boolean`
Проверяет, является ли указанный игрок текущим активным.

## События

TurnManager генерирует следующие события:

### `player:added`
Генерируется при добавлении игрока.

**Параметры:** `playerId: string`

### `player:removed`
Генерируется при удалении игрока.

**Параметры:** `playerId: string`

### `turn:changed`
Генерируется при смене активного игрока.

**Параметры:** `playerId: string | null` - ID нового активного игрока

### `round:complete`
Генерируется при завершении полного раунда (все игроки сделали ход).

**Параметры:** `turnNumber: number` - номер завершенного раунда

## Примеры использования

### Базовое использование

```typescript
import { TurnManager } from './game/TurnManager';

const turnManager = new TurnManager();

// Добавить игроков
turnManager.addPlayer('player-1');
turnManager.addPlayer('player-2');
turnManager.addPlayer('player-3');

// Подписаться на события
turnManager.on('turn:changed', (playerId) => {
  console.log(`Ход игрока: ${playerId}`);
});

turnManager.on('round:complete', (turnNumber) => {
  console.log(`Завершен раунд: ${turnNumber}`);
});

// Получить текущего игрока
const current = turnManager.getCurrentPlayer(); // 'player-1'

// Перейти к следующему ходу
turnManager.nextTurn();
// Событие: turn:changed('player-2')

turnManager.nextTurn();
// Событие: turn:changed('player-3')

turnManager.nextTurn();
// Событие: round:complete(1)
// Событие: turn:changed('player-1')
```

### Интеграция с игровой логикой

```typescript
// Проверка, может ли игрок совершить действие
function canPlayerAct(playerId: string): boolean {
  return turnManager.isPlayerTurn(playerId);
}

// Обработка действия игрока
function handlePlayerAction(playerId: string, action: any) {
  if (!canPlayerAct(playerId)) {
    throw new Error('Не ваш ход!');
  }
  
  // Выполнить действие
  performAction(action);
  
  // Перейти к следующему ходу
  turnManager.nextTurn();
}
```

### Обработка отключения игрока

```typescript
turnManager.on('player:removed', (playerId) => {
  console.log(`Игрок ${playerId} удален из очереди`);
  
  const current = turnManager.getCurrentPlayer();
  if (current) {
    notifyPlayers(`Сейчас ход: ${current}`);
  }
});
```

## Особенности реализации

### Циклическая очередь
Очередь ходов циклическая - после последнего игрока очередь возвращается к первому.

### Автоматическая обработка удаления
При удалении текущего активного игрока система автоматически переходит к следующему, предотвращая зависание игры.

### Нумерация раундов
Раунд начинается с 0 и увеличивается каждый раз, когда очередь возвращается к первому игроку.

## Текущее состояние в проекте

**Важно:** В текущей реализации Hexploration `TurnManager` создан, но **не используется** в игровой логике. Вместо этого используется система таймеров (`moveTimer`) для ограничения частоты перемещений игроков.

### Планы интеграции

В будущем `TurnManager` может быть интегрирован для:
- Пошаговых стратегических действий
- Турнирных режимов
- Синхронизированных событий между игроками
- Режимов с ограниченным временем на ход

## Связанные компоненты

- `GameWorld` - центральный менеджер игрового состояния
- `gameSocket.ts` - обработка Socket.io событий
- `gameSlice.ts` - Redux состояние игры на клиенте
