import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login, register, clearError } from '../store/slices/authSlice';
import './LoginPage.css';

function LoginPage() {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());

    if (isRegister) {
      await dispatch(register({ username, password }));
    } else {
      await dispatch(login({ username, password }));
    }
  };

  return (
    <div className="login-page">
      <div className="stars"></div>
      <div className="login-container">
        <div className="login-card">
          <h1 className="game-title">HEXPLORATION</h1>
          <p className="game-subtitle">Космическая MMORPG</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Имя пользователя</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Введите имя"
                required
                minLength={3}
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
                minLength={6}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Загрузка...' : isRegister ? 'Регистрация' : 'Вход'}
            </button>

            <button
              type="button"
              className="toggle-button"
              onClick={() => {
                setIsRegister(!isRegister);
                dispatch(clearError());
              }}
            >
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
