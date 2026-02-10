# План реализации планетарных систем

## Текущий статус

✅ **Создано:**
- Дизайн-документ (`PLANETARY_SYSTEMS_DESIGN.md`)
- Типы данных (`shared/src/types/planetary.types.ts`)
- Константы (`shared/src/constants/planetary.constants.ts`)
- Экспорты в `shared/src/index.ts`

## Следующие шаги

### Шаг 1: Обновить HexCell для хранения ссылки на систему

**Файл:** `shared/src/types/hex.types.ts`

Добавить в `HexCell`:
```typescript
planetarySystemId?: string; // ID планетарной системы (если systemType === PLANETARY)
```

### Шаг 2: Создать модель БД для планетарных систем

**Файл:** `server/src/database/models/PlanetarySystem.ts`

```typescript
import mongoose from 'mongoose';
import { PlanetarySystem } from '@hexploration/shared';

const PlanetarySystemSchema = new mongoose.Schema({
  hexKey: { type: String, required: true, unique: true }, // "q,r"
  system: { type: Object, required: true }, // PlanetarySystem
  lastUpdate: { type: Date, default: Date.now },
});

export const PlanetarySystemModel = mongoose.model('PlanetarySystem', PlanetarySystemSchema);
```

### Шаг 3: Генератор планетарных систем

**Файл:** `server/src/game/PlanetarySystemGenerator.ts`

Создать класс для генерации случайных планетарных систем:
- Генерация звезды (тип, размер, температура)
- Генерация планет (количество, типы, орбиты)
- Генерация астероидных поясов
- Генерация газовых гигантов
- Использование seed для воспроизводимости

### Шаг 4: Интеграция с HexMap

**Файл:** `server/src/game/HexMap.ts`

Модифицировать `generateMap()`:
- При создании гекса с `systemType === PLANETARY`
- Генерировать `PlanetarySystem` через `PlanetarySystemGenerator`
- Сохранять систему в БД
- Связывать через `planetarySystemId` в `HexCell`

### Шаг 5: API для работы с системами

**Файл:** `server/src/game/GameWorld.ts`

Добавить методы:
- `getPlanetarySystem(coordinates): Promise<PlanetarySystem | null>`
- `buildStructure(playerId, coordinates, structureType, location): Promise<{success, error?}>`
- `collectResources(playerId, coordinates, structureId): Promise<{success, resources?}>`

### Шаг 6: Socket.io события

**Файл:** `server/src/socket/gameSocket.ts`

Добавить обработчики:
- `system:get` - получить данные системы
- `system:build_structure` - построить структуру
- `system:collect_resources` - собрать ресурсы

### Шаг 7: Redux slice для планетарных систем

**Файл:** `client/src/store/slices/planetarySlice.ts`

Создать slice для:
- Текущая открытая система
- Структуры игрока
- Состояние загрузки

### Шаг 8: Компонент визуализации

**Файл:** `client/src/components/planetary/PlanetarySystemView.tsx`

Создать компонент с Canvas:
- Рендеринг звезды (центр, пульсация)
- Рендеринг планет (орбиты, вращение)
- Рендеринг астероидных поясов (кольца)
- Рендеринг газовых гигантов
- Рендеринг структур (иконки)
- Интерактивность (клик по элементам)

### Шаг 9: Интеграция с HexInfo

**Файл:** `client/src/components/ui/HexInfo.tsx`

Добавить:
- Кнопку "Открыть систему" если `systemType === PLANETARY` и игрок в гексе
- Модальное окно или боковую панель с `PlanetarySystemView`

### Шаг 10: Панель управления структурами

**Файл:** `client/src/components/planetary/StructurePanel.tsx`

Создать панель для:
- Список структур в системе
- Информация о структурах (здоровье, производство, ресурсы)
- Кнопки: построить, собрать ресурсы, улучшить, уничтожить

### Шаг 11: Система добычи ресурсов

**Файл:** `server/src/game/ResourceExtraction.ts`

Создать систему:
- Периодическое обновление добычи (каждые N минут)
- Регенерация ресурсов в астероидных поясах
- Накопление ресурсов в структурах
- Ограничение вместимости

### Шаг 12: Обновление ресурсов игрока

**Файл:** `shared/src/types/player.types.ts`

Расширить `Player`:
```typescript
resources: {
  credits: number;
  minerals: number;
  energy: number;
  helium?: number;
  rareMaterials?: number;
  research?: number;
};
```

## Приоритет реализации

### MVP (Минимально жизнеспособный продукт)

1. ✅ Типы и константы
2. Генератор систем (базовая генерация)
3. Модель БД
4. Интеграция с HexMap
5. API получения системы
6. Базовый компонент визуализации (статичный, без анимации)
7. Интеграция с HexInfo

### Фаза 2 (Полная функциональность)

8. Размещение структур
9. Добыча ресурсов
10. Анимация визуализации
11. Панель управления структурами

### Фаза 3 (Полировка)

12. Оптимизация производительности
13. Улучшение UI/UX
14. Балансировка стоимости и времени
15. Дополнительные типы структур

## Тестирование

### Юнит-тесты

- Генератор систем (воспроизводимость через seed)
- Расчет добычи ресурсов
- Валидация размещения структур

### Интеграционные тесты

- Сохранение/загрузка систем из БД
- Socket.io события
- Интеграция с HexMap

### Ручное тестирование

- Генерация систем при создании карты
- Открытие системы в игре
- Размещение структуры
- Добыча ресурсов
- Сбор ресурсов

## Известные ограничения

1. **Производительность анимации** - может потребоваться оптимизация для большого количества систем
2. **Размер данных** - планетарные системы могут быть большими, нужна оптимизация сериализации
3. **Конфликты** - несколько игроков могут пытаться построить структуру одновременно

## Будущие улучшения

- Видео-фон для звездной системы (как предложил пользователь)
- 3D визуализация (Three.js)
- Более детальная генерация (атмосфера, спутники)
- Взаимодействие между структурами
- Автоматическая торговля между системами
