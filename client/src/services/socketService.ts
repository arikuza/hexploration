import { io, Socket } from 'socket.io-client';
import { SocketEvent, HexCoordinates } from '@hexploration/shared';

// In production (when MODE is production and no VITE_WS_URL is set), use relative paths (empty string for same domain)
// In development, use localhost
const SERVER_URL = import.meta.env.VITE_WS_URL || (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3050');

class SocketService {
  private socket: Socket | null = null;
  private listenersCallback: ((socket: Socket) => void) | null = null;

  /**
   * Установить callback для регистрации слушателей
   */
  setListenersCallback(callback: (socket: Socket) => void): void {
    this.listenersCallback = callback;
  }

  /**
   * Подключиться к серверу
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      console.log('Уже подключено');
      return;
    }

    this.socket = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    // ВАЖНО: Зарегистрировать слушателей СРАЗУ после создания socket
    if (this.listenersCallback && this.socket) {
      this.listenersCallback(this.socket);
    }

    this.socket.on('connect', () => {
      console.log('Socket подключен:', this.socket?.id);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Ошибка подключения:', error.message);
    });
  }

  /**
   * Отключиться от сервера
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Подписаться на событие (используется напрямую, когда socket уже создан)
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Отписаться от события
   */
  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  /**
   * Отправить событие
   */
  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  /**
   * Переместиться на гекс
   */
  move(target: HexCoordinates): void {
    this.emit(SocketEvent.MOVE, { target });
  }

  /**
   * Боевое действие
   */
  combatAction(action: string, value?: number, weaponId?: string): void {
    this.emit(SocketEvent.COMBAT_ACTION, { action, value, weaponId });
  }

  /**
   * Проверить, подключен ли
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
