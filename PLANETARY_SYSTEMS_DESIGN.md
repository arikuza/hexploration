# Дизайн системы планетарных систем

## Обзор

Система планетарных систем добавляет детальную визуализацию и интерактивность для гексов с типом `PLANETARY`. При входе в такой гекс игрок видит анимированную звездную систему с возможностью размещения структур и добычи ресурсов.

## Цели

1. **Визуализация**: Красивая анимированная звездная система (звезда, планеты, астероидные пояса)
2. **Структуры**: Размещение космических структур на планетах, в астероидных поясах, у газовых гигантов
3. **Добыча ресурсов**: Добыча минералов из астероидных поясов
4. **Расширяемость**: Основа для будущих механик (производство, торговля, исследования)

## Структура данных

### PlanetarySystem

```typescript
interface PlanetarySystem {
  // Базовая информация
  hexCoordinates: HexCoordinates;
  systemType: SystemType.PLANETARY;
  
  // Звезда
  star: {
    type: StarType;           // Тип звезды (желтый карлик, красный гигант и т.д.)
    size: number;            // Размер звезды (1-5)
    temperature: number;      // Температура (влияет на обитаемость)
  };
  
  // Планеты
  planets: Planet[];
  
  // Астероидные пояса
  asteroidBelts: AsteroidBelt[];
  
  // Газовые гиганты
  gasGiants: GasGiant[];
  
  // Структуры игроков
  structures: SpaceStructure[];
  
  // Метаданные
  discoveredBy: string[];    // Кто исследовал систему
  owner?: string;             // Владелец системы (если колонизирована)
}
```

### Planet

```typescript
interface Planet {
  id: string;
  name?: string;              // Опциональное имя (генерируется или задается игроком)
  type: PlanetType;
  orbitRadius: number;        // Расстояние от звезды (для визуализации)
  orbitSpeed: number;         // Скорость вращения (для анимации)
  size: number;               // Размер планеты (1-5)
  habitable: boolean;         // Обитаема ли планета
  resources: PlanetResources; // Ресурсы на планете
  
  // Структуры на планете
  structures: string[];       // ID структур
}
```

### PlanetType

```typescript
enum PlanetType {
  ROCKY = 'rocky',           // Каменистая планета
  OCEAN = 'ocean',            // Океаническая планета
  DESERT = 'desert',          // Пустынная планета
  ICE = 'ice',                // Ледяная планета
  VOLCANIC = 'volcanic',      // Вулканическая планета
  GAS_GIANT = 'gas_giant',    // Газовый гигант (отдельный тип)
}
```

### AsteroidBelt

```typescript
interface AsteroidBelt {
  id: string;
  orbitRadius: number;        // Расстояние от звезды
  width: number;              // Ширина пояса
  density: number;             // Плотность астероидов (1-10)
  mineralRichness: number;     // Богатство минералами (1-10)
  resources: {
    minerals: number;          // Текущее количество минералов
    maxMinerals: number;        // Максимальное количество
    regenerationRate: number;   // Скорость регенерации (минералов в час)
  };
  
  // Структуры в поясе
  structures: string[];         // ID структур (шахты, станции добычи)
}
```

### GasGiant

```typescript
interface GasGiant {
  id: string;
  orbitRadius: number;
  orbitSpeed: number;
  size: number;               // Размер (обычно большой, 4-5)
  type: GasGiantType;
  resources: {
    helium: number;           // Гелий-3 для топлива
    rareGases: number;        // Редкие газы
  };
  
  // Структуры у газового гиганта
  structures: string[];       // ID структур (газодобывающие станции)
}
```

### SpaceStructure

```typescript
interface SpaceStructure {
  id: string;
  type: StructureType;
  ownerId: string;            // ID игрока-владельца
  
  // Расположение
  location: StructureLocation;
  
  // Стоимость и требования
  cost: ResourceCost;
  buildTime: number;          // Время постройки (в секундах)
  buildProgress?: number;    // Прогресс постройки (0-100)
  
  // Производство/функции
  production?: Production;    // Что производит структура
  extraction?: Extraction;    // Что добывает структура
  
  // Состояние
  health: number;
  maxHealth: number;
  operational: boolean;       // Работает ли структура
}
```

### StructureType

```typescript
enum StructureType {
  // Добыча ресурсов
  MINING_STATION = 'mining_station',        // Шахта в астероидном поясе
  GAS_EXTRACTOR = 'gas_extractor',          // Добыча газа у газового гиганта
  PLANETARY_MINE = 'planetary_mine',        // Шахта на планете
  
  // Производство
  MANUFACTURING_PLANT = 'manufacturing_plant', // Завод на планете
  ORBITAL_SHIPYARD = 'orbital_shipyard',    // Верфь на орбите
  
  // Инфраструктура
  SPACE_STATION = 'space_station',          // Космическая станция
  RESEARCH_LAB = 'research_lab',            // Исследовательская лаборатория
  TRADING_POST = 'trading_post',            // Торговый пост
  
  // Защита
  DEFENSE_STATION = 'defense_station',      // Оборонительная станция
}
```

### StructureLocation

```typescript
interface StructureLocation {
  type: 'planet' | 'asteroid_belt' | 'gas_giant' | 'orbit';
  targetId: string;          // ID планеты/пояса/гиганта
  position?: {                // Позиция на орбите/поверхности
    angle: number;            // Угол на орбите (для орбитальных структур)
    radius?: number;          // Радиус от центра (для планет)
  };
}
```

### ResourceCost

```typescript
interface ResourceCost {
  credits: number;            // Кредиты (основная валюта)
  minerals?: number;          // Минералы
  energy?: number;            // Энергия
  rareMaterials?: number;     // Редкие материалы
}
```

### Production

```typescript
interface Production {
  output: {
    resource: ResourceType;
    amount: number;           // Количество в час
  };
  input?: {                   // Требуемые ресурсы
    resource: ResourceType;
    amount: number;
  }[];
  efficiency: number;         // Эффективность (0-1)
}
```

### Extraction

```typescript
interface Extraction {
  resource: ResourceType;
  rate: number;               // Скорость добычи (в час)
  efficiency: number;         // Эффективность (0-1)
  maxCapacity: number;        // Максимальная вместимость
  currentAmount: number;       // Текущее количество
}
```

### ResourceType

```typescript
enum ResourceType {
  CREDITS = 'credits',        // Кредиты (валюта)
  MINERALS = 'minerals',      // Минералы (из астероидов/планет)
  ENERGY = 'energy',          // Энергия
  HELIUM = 'helium',          // Гелий-3 (из газовых гигантов)
  RARE_MATERIALS = 'rare_materials', // Редкие материалы
  RESEARCH = 'research',      // Исследовательские очки
}
```

## Визуализация

### Компонент PlanetarySystemView

Новый компонент `client/src/components/planetary/PlanetarySystemView.tsx`:

**Функции:**
- Анимированная визуализация звездной системы
- Canvas или WebGL для рендеринга
- Интерактивные элементы (клик по планете/поясу для размещения структур)
- Панель управления структурами

**Элементы визуализации:**
1. **Звезда** - в центре, пульсирует/светится
2. **Планеты** - вращаются по орбитам вокруг звезды
3. **Астероидные пояса** - кольца из мелких точек, вращаются
4. **Газовые гиганты** - большие планеты с кольцами
5. **Структуры** - иконки на планетах/в поясах/на орбите

**Анимация:**
- Плавное вращение планет по орбитам
- Пульсация звезды
- Вращение астероидных поясов
- Партиклы для активных структур

### Интеграция с HexInfo

Модифицировать `HexInfo.tsx`:
- Если выбран гекс с `systemType === PLANETARY` и игрок находится в нем
- Показывать кнопку "Открыть систему" или автоматически открывать панель
- Панель `PlanetarySystemView` открывается как модальное окно или боковая панель

## Механики

### 1. Размещение структур

**Процесс:**
1. Игрок входит в планетарную систему
2. Кликает на планету/астероидный пояс/газовый гигант
3. Выбирает тип структуры из меню
4. Проверяется стоимость и требования
5. Если достаточно ресурсов - начинается постройка
6. Структура строится в течение `buildTime` секунд
7. После постройки структура начинает работать

**Ограничения:**
- Очень высокая стоимость (как указал пользователь)
- Ограничение на количество структур в системе (зависит от размера системы)
- Некоторые структуры требуют определенных типов планет/поясов

### 2. Добыча минералов из астероидных поясов

**Процесс:**
1. Игрок размещает `MINING_STATION` в астероидном поясе
2. Станция начинает добывать минералы с определенной скоростью
3. Минералы накапливаются в структуре (до `maxCapacity`)
4. Игрок может забрать минералы (действие "Собрать ресурсы")
5. Астероидный пояс имеет ограниченные ресурсы, которые регенерируются со временем

**Механика регенерации:**
- `regenerationRate` - минералов в час
- Регенерация происходит только если в поясе нет активных шахт
- Или регенерация замедляется при активной добыче

**Пример:**
```typescript
// Астероидный пояс
{
  resources: {
    minerals: 1000,        // Текущее количество
    maxMinerals: 5000,     // Максимум
    regenerationRate: 50,  // 50 минералов в час
  }
}

// Шахта добывает 100 минералов в час
// Через 10 часов: 1000 - 1000 = 0 минералов
// Если шахта остановлена, через 20 часов: 0 + 1000 = 1000 минералов
```

### 3. Производство (будущее)

Структуры типа `MANUFACTURING_PLANT` могут производить:
- Модули для кораблей
- Оружие
- Другие структуры
- Требуют входные ресурсы

## API и события

### Новые Socket.io события

#### Клиент → Сервер

```typescript
// Получить данные планетарной системы
'system:get' { coordinates: HexCoordinates }

// Разместить структуру
'system:build_structure' {
  coordinates: HexCoordinates;
  structureType: StructureType;
  location: StructureLocation;
}

// Собрать ресурсы со структуры
'system:collect_resources' {
  coordinates: HexCoordinates;
  structureId: string;
}

// Улучшить структуру
'system:upgrade_structure' {
  coordinates: HexCoordinates;
  structureId: string;
}

// Уничтожить структуру
'system:destroy_structure' {
  coordinates: HexCoordinates;
  structureId: string;
}
```

#### Сервер → Клиент

```typescript
// Данные планетарной системы
'system:data' {
  system: PlanetarySystem;
}

// Структура построена
'system:structure_built' {
  coordinates: HexCoordinates;
  structure: SpaceStructure;
}

// Ресурсы собраны
'system:resources_collected' {
  coordinates: HexCoordinates;
  structureId: string;
  resources: ResourceAmount;
}

// Обновление системы
'system:update' {
  coordinates: HexCoordinates;
  system: Partial<PlanetarySystem>;
}
```

## База данных

### Модель PlanetarySystemModel

```typescript
// server/src/database/models/PlanetarySystem.ts
interface PlanetarySystemDocument {
  hexKey: string;              // "q,r"
  system: PlanetarySystem;     // Полные данные системы
  lastUpdate: Date;
}
```

### Интеграция с GameWorld

- При генерации карты создавать `PlanetarySystem` для каждого гекса с `systemType === PLANETARY`
- Сохранять системы в БД вместе с картой
- Загружать системы при загрузке мира

## План реализации

### Фаза 1: Базовая структура данных (1-2 дня)
- [ ] Добавить типы в `shared/src/types/planetary.types.ts`
- [ ] Обновить `HexCell` для хранения ссылки на `PlanetarySystem`
- [ ] Создать модель БД для планетарных систем
- [ ] Генерация базовых систем при создании карты

### Фаза 2: Генерация систем (2-3 дня)
- [ ] Алгоритм генерации звезды (тип, размер)
- [ ] Генерация планет (количество, типы, орбиты)
- [ ] Генерация астероидных поясов
- [ ] Генерация газовых гигантов
- [ ] Балансировка параметров

### Фаза 3: Визуализация (3-5 дней)
- [ ] Компонент `PlanetarySystemView.tsx`
- [ ] Canvas рендеринг звезды, планет, поясов
- [ ] Анимация вращения
- [ ] Интерактивность (клик по элементам)
- [ ] Интеграция с `HexInfo`

### Фаза 4: Размещение структур (2-3 дня)
- [ ] API для размещения структур
- [ ] Валидация стоимости и требований
- [ ] Система постройки (таймер)
- [ ] Сохранение структур в БД
- [ ] Отображение структур на визуализации

### Фаза 5: Добыча ресурсов (2-3 дня)
- [ ] Логика добычи минералов из астероидных поясов
- [ ] Система регенерации ресурсов
- [ ] Сбор ресурсов игроком
- [ ] Обновление ресурсов в реальном времени

### Фаза 6: UI и UX (2-3 дня)
- [ ] Панель управления структурами
- [ ] Информация о структурах (здоровье, производство)
- [ ] Уведомления о завершении постройки
- [ ] Оптимизация производительности анимации

## Балансировка

### Стоимость структур

**Примерные значения (очень дорого):**
- `MINING_STATION`: 10,000 кредитов + 500 минералов
- `MANUFACTURING_PLANT`: 50,000 кредитов + 2,000 минералов
- `SPACE_STATION`: 100,000 кредитов + 5,000 минералов

### Время постройки

- Простые структуры: 5-10 минут
- Средние: 15-30 минут
- Сложные: 1-2 часа

### Добыча ресурсов

- Базовая шахта: 50-100 минералов в час
- Улучшенная шахта: 200-300 минералов в час
- Регенерация пояса: 20-50 минералов в час

## Расширения (будущее)

1. **Типы звезд влияют на ресурсы** - разные звезды дают разные ресурсы
2. **Обитаемые планеты** - можно колонизировать и строить города
3. **Торговля между системами** - автоматическая торговля ресурсами
4. **Исследования** - исследовательские лаборатории открывают новые технологии
5. **Война за системы** - захват чужих структур и систем
6. **Терраформирование** - изменение типа планеты

## Файлы для создания/изменения

### Новые файлы

```
shared/src/types/planetary.types.ts
shared/src/constants/planetary.constants.ts
server/src/database/models/PlanetarySystem.ts
server/src/game/PlanetarySystemGenerator.ts
server/src/game/StructureManager.ts
client/src/components/planetary/PlanetarySystemView.tsx
client/src/components/planetary/PlanetarySystemView.css
client/src/components/planetary/StructurePanel.tsx
client/src/store/slices/planetarySlice.ts
```

### Изменения в существующих

```
shared/src/types/hex.types.ts          # Добавить ссылку на PlanetarySystem
server/src/game/HexMap.ts              # Генерация систем
server/src/game/GameWorld.ts           # Управление системами
server/src/socket/gameSocket.ts        # Новые события
client/src/components/ui/HexInfo.tsx   # Интеграция с системой
```
