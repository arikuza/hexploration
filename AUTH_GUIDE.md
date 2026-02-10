# Руководство по системе аутентификации

## Обзор

Система аутентификации использует **JWT (JSON Web Tokens)** для безопасной аутентификации пользователей. Реализована на сервере через Express routes и на клиенте через Redux.

## Архитектура

### Серверная часть

Файл `server/src/routes/auth.ts` содержит endpoints для:
- Регистрации новых пользователей
- Входа существующих пользователей
- Проверки валидности токенов

### Клиентская часть

- `client/src/store/slices/authSlice.ts` - Redux управление аутентификацией
- `client/src/services/apiService.ts` - HTTP клиент для API запросов
- `client/src/pages/LoginPage.tsx` - UI для входа/регистрации

## Регистрация

### Endpoint: `POST /api/auth/register`

Создает нового пользователя в системе.

**Запрос:**
```typescript
{
  username: string;  // 3-20 символов
  password: string;  // минимум 6 символов
}
```

**Валидация:**
- `username`: от 3 до 20 символов
- `password`: минимум 6 символов
- `username` должен быть уникальным

**Процесс:**
1. Проверяет валидность данных
2. Проверяет, что username не занят
3. Хеширует пароль через `bcrypt` (10 rounds)
4. Создает пользователя в MongoDB
5. Генерирует JWT токен (expiresIn: 7 дней)
6. Возвращает токен и данные пользователя

**Ответ (успех):**
```typescript
{
  token: string;      // JWT токен
  user: {
    id: string;       // UUID пользователя
    username: string;
  }
}
```

**Ответ (ошибка):**
```typescript
{
  error: string;      // Описание ошибки
}
```

**Коды ошибок:**
- `400` - невалидные данные
- `409` - username уже занят
- `500` - ошибка сервера

### Использование на клиенте

```typescript
import { useAppDispatch } from '../store/hooks';
import { register } from '../store/slices/authSlice';

const dispatch = useAppDispatch();

const handleRegister = async (username: string, password: string) => {
  try {
    await dispatch(register({ username, password })).unwrap();
    // Регистрация успешна, токен сохранен в localStorage
  } catch (error) {
    // Ошибка в state.auth.error
    console.error('Ошибка регистрации:', error);
  }
};
```

## Вход

### Endpoint: `POST /api/auth/login`

Аутентифицирует существующего пользователя.

**Запрос:**
```typescript
{
  username: string;
  password: string;
}
```

**Процесс:**
1. Находит пользователя по username
2. Проверяет пароль через `bcrypt.compare()`
3. Обновляет `lastLogin` в БД
4. Генерирует новый JWT токен (expiresIn: 7 дней)
5. Возвращает токен и данные пользователя

**Ответ (успех):**
```typescript
{
  token: string;
  user: {
    id: string;
    username: string;
  }
}
```

**Ответ (ошибка):**
```typescript
{
  error: string;  // "Неверные credentials"
}
```

**Коды ошибок:**
- `400` - отсутствуют данные
- `401` - неверные credentials
- `500` - ошибка сервера

### Использование на клиенте

```typescript
import { useAppDispatch } from '../store/hooks';
import { login } from '../store/slices/authSlice';

const dispatch = useAppDispatch();

const handleLogin = async (username: string, password: string) => {
  try {
    await dispatch(login({ username, password })).unwrap();
    // Вход успешен, токен сохранен в localStorage
  } catch (error) {
    console.error('Ошибка входа:', error);
  }
};
```

## Проверка токена

### Endpoint: `GET /api/auth/verify`

Проверяет валидность JWT токена.

**Заголовки:**
```
Authorization: Bearer <token>
```

**Процесс:**
1. Извлекает токен из заголовка `Authorization`
2. Проверяет токен через `jwt.verify()`
3. Возвращает данные пользователя если токен валиден

**Ответ (успех):**
```typescript
{
  valid: true;
  user: {
    id: string;
    username: string;
  }
}
```

**Ответ (ошибка):**
```typescript
{
  valid: false;
  error: string;  // "Недействительный токен"
}
```

**Коды ошибок:**
- `401` - токен отсутствует или невалиден

### Использование на клиенте

```typescript
import { useAppDispatch } from '../store/hooks';
import { verifyToken } from '../store/slices/authSlice';

const dispatch = useAppDispatch();

// Проверить токен при загрузке приложения
useEffect(() => {
  dispatch(verifyToken());
}, []);
```

## JWT токены

### Структура токена

JWT состоит из трех частей:
1. **Header** - алгоритм и тип токена
2. **Payload** - данные пользователя (`userId`, `username`)
3. **Signature** - подпись для проверки

### Параметры токена

- **Алгоритм**: HS256
- **Секретный ключ**: `process.env.JWT_SECRET` (или 'default-secret')
- **Время жизни**: 7 дней (`expiresIn: '7d'`)

### Хранение токена

Токен хранится в `localStorage` на клиенте:

```typescript
// Сохранение
localStorage.setItem('token', token);

// Получение
const token = localStorage.getItem('token');

// Удаление
localStorage.removeItem('token');
```

## Socket.io аутентификация

### Middleware аутентификации

При подключении к Socket.io токен проверяется через middleware:

```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Токен не предоставлен'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthToken;
    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    next();
  } catch (error) {
    next(new Error('Недействительный токен'));
  }
});
```

### Подключение с токеном

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3050', {
  auth: {
    token: localStorage.getItem('token'),
  },
});
```

## Redux состояние

### authSlice

Управляет состоянием аутентификации:

```typescript
{
  token: string | null;        // JWT токен
  user: {                      // Данные пользователя
    id: string;
    username: string;
  } | null;
  isAuthenticated: boolean;    // Флаг аутентификации
  loading: boolean;           // Загрузка
  error: string | null;       // Ошибка
}
```

### Actions

#### `login(credentials)`
Асинхронный вход пользователя.

**Параметры:**
```typescript
{ username: string; password: string; }
```

**Процесс:**
1. Вызывает `authService.login()`
2. Сохраняет токен в `localStorage`
3. Обновляет Redux state

#### `register(credentials)`
Асинхронная регистрация пользователя.

**Параметры:**
```typescript
{ username: string; password: string; }
```

**Процесс:**
1. Вызывает `authService.register()`
2. Сохраняет токен в `localStorage`
3. Обновляет Redux state

#### `verifyToken()`
Проверяет валидность сохраненного токена.

**Процесс:**
1. Получает токен из `localStorage`
2. Вызывает `authService.verify()`
3. Обновляет Redux state или удаляет токен при ошибке

#### `logout()`
Выход пользователя.

**Процесс:**
1. Очищает Redux state
2. Удаляет токен из `localStorage`
3. Отключает Socket.io соединение

#### `clearError()`
Очищает ошибку аутентификации.

## Безопасность

### Хеширование паролей

Пароли хранятся как хеши через `bcrypt`:
- **Алгоритм**: bcrypt
- **Rounds**: 10
- **Соль**: автоматически генерируется

### Защита токенов

- Токены подписываются секретным ключом
- Валидация на сервере при каждом запросе
- Токены имеют срок действия (7 дней)

### Рекомендации

1. **Используйте HTTPS** в production для защиты токенов
2. **Храните JWT_SECRET** в переменных окружения
3. **Реализуйте refresh tokens** для долгосрочных сессий
4. **Добавьте rate limiting** для защиты от брутфорса
5. **Логируйте** подозрительную активность

## Примеры использования

### Полный цикл аутентификации

```typescript
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login, logout, verifyToken } from '../store/slices/authSlice';
import { useEffect } from 'react';

const App = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user, loading } = useAppSelector(state => state.auth);

  // Проверить токен при загрузке
  useEffect(() => {
    dispatch(verifyToken());
  }, [dispatch]);

  const handleLogin = async (username: string, password: string) => {
    await dispatch(login({ username, password }));
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Добро пожаловать, {user?.username}!</p>
          <button onClick={handleLogout}>Выйти</button>
        </div>
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
};
```

### Защита маршрутов

```typescript
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAppSelector(state => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
};
```

## Обработка ошибок

### Типичные ошибки

1. **"Требуются username и password"** - отсутствуют данные
2. **"Username должен быть от 3 до 20 символов"** - невалидный username
3. **"Пароль должен быть минимум 6 символов"** - невалидный пароль
4. **"Username уже занят"** - пользователь существует
5. **"Неверные credentials"** - неправильный username/password
6. **"Недействительный токен"** - токен истек или невалиден

### Отображение ошибок

```typescript
const { error } = useAppSelector(state => state.auth);

{error && (
  <div className="error-message">
    {error}
  </div>
)}
```

## Связанные компоненты

- `server/src/routes/auth.ts` - серверные endpoints
- `server/src/database/models/User.ts` - модель пользователя
- `client/src/store/slices/authSlice.ts` - Redux slice
- `client/src/services/apiService.ts` - HTTP клиент
- `client/src/pages/LoginPage.tsx` - UI компонент
- `server/src/socket/gameSocket.ts` - Socket.io middleware
