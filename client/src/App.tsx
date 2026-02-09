import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { verifyToken } from './store/slices/authSlice';
import { socketService } from './services/socketService';
import { setupSocketListeners } from './store/middleware/socketMiddleware';
import { store } from './store/store';
import LoginPage from './pages/LoginPage';
import GamePage from './pages/GamePage';
import './App.css';

function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Проверить токен при загрузке
    const token = localStorage.getItem('token');
    if (token) {
      dispatch(verifyToken());
    }
  }, [dispatch]);

  useEffect(() => {
    // Подключиться к Socket.io после аутентификации
    if (isAuthenticated && token) {
      // ВАЖНО: Настроить callback для слушателей ДО подключения
      setupSocketListeners(store);
      // Затем подключиться - callback будет вызван внутри connect()
      socketService.connect(token);
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, token]);

  return (
    <div className="app">
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/game" /> : <LoginPage />}
        />
        <Route
          path="/game"
          element={isAuthenticated ? <GamePage /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/game' : '/login'} />} />
      </Routes>
    </div>
  );
}

export default App;
