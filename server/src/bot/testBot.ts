import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { HexCoordinates, hexDistance } from '@hexploration/shared';

const SERVER_URL = 'http://localhost:3050';
const BOT_USERNAME = 'BOT_' + Math.random().toString(36).substring(7);
const BOT_PASSWORD = 'bot123';

class GameBot {
  private socket: Socket | null = null;
  private token: string = '';
  private playerId: string = '';
  private currentPosition: HexCoordinates = { q: 0, r: 0 };
  private canMove: boolean = true;
  private moveTimer: number = 0;

  async start() {
    console.log(`🤖 Запуск бота: ${BOT_USERNAME}`);
    
    // Регистрация
    await this.register();
    
    // Подключение
    await this.connect();
    
    // Автоматическое движение
    this.startAutoMovement();
  }

  private async register() {
    try {
      const response = await axios.post(`${SERVER_URL}/api/auth/register`, {
        username: BOT_USERNAME,
        password: BOT_PASSWORD,
      });
      
      this.token = response.data.token;
      this.playerId = response.data.user.id;
      console.log(`✅ Бот зарегистрирован: ${BOT_USERNAME}`);
    } catch (error: any) {
      if (error.response?.data?.message === 'Пользователь уже существует') {
        // Попробовать войти
        const response = await axios.post(`${SERVER_URL}/api/auth/login`, {
          username: BOT_USERNAME,
          password: BOT_PASSWORD,
        });
        this.token = response.data.token;
        this.playerId = response.data.user.id;
        console.log(`✅ Бот вошел: ${BOT_USERNAME}`);
      } else {
        throw error;
      }
    }
  }

  private async connect() {
    return new Promise<void>((resolve) => {
      this.socket = io(SERVER_URL, {
        auth: { token: this.token },
      });

      this.socket.on('connect', () => {
        console.log(`🔌 Бот подключен к серверу`);
      });

      this.socket.on('auth:success', (data: any) => {
        this.currentPosition = data.player.position;
        this.canMove = data.player.canMove;
        this.moveTimer = data.player.moveTimer;
        resolve();
      });

      this.socket.on('game:state', (data: any) => {
        // Состояние игры получено
      });

      this.socket.on('game:update', (data: any) => {
        if (data.type === 'player_moved' && data.playerId === this.playerId) {
          this.currentPosition = data.position;
          this.moveTimer = data.moveTimer;
          this.canMove = data.canMove;
          
          const remaining = data.moveTimer ? Math.ceil((data.moveTimer - Date.now()) / 1000) : 0;
          console.log(`🚶 Бот переместился на ${data.position.q},${data.position.r}. Кулдаун: ${remaining}с`);
        }
      });

      this.socket.on('move:error', (data: any) => {
        console.log(`❌ Ошибка движения: ${data.message}`);
      });

      this.socket.on('combat:started', (data: any) => {
        console.log(`⚔️ БОЙ НАЧАЛСЯ! Combat ID: ${data.combat.id}`);
        console.log(`Участники:`, data.combat.participants);
        this.startCombatBehavior(data.combat.id);
      });

      this.socket.on('combat:update', (data: any) => {
        // Можно логировать состояние боя
      });

      this.socket.on('combat:ended', (data: any) => {
        console.log(`🏆 БОЙ ЗАВЕРШЕН! Победитель: ${data.winner}`);
      });

      this.socket.on('disconnect', () => {
        console.log(`❌ Бот отключен от сервера`);
      });
    });
  }

  private startAutoMovement() {
    setInterval(() => {
      if (!this.canMove || this.moveTimer > Date.now()) {
        return;
      }

      // Случайное направление (соседний гекс)
      const directions = [
        { q: 1, r: 0 },
        { q: 1, r: -1 },
        { q: 0, r: -1 },
        { q: -1, r: 0 },
        { q: -1, r: 1 },
        { q: 0, r: 1 },
      ];

      const randomDir = directions[Math.floor(Math.random() * directions.length)];
      const target: HexCoordinates = {
        q: this.currentPosition.q + randomDir.q,
        r: this.currentPosition.r + randomDir.r,
      };

      this.socket?.emit('player:move', { target });
    }, 2000); // Проверять каждые 2 секунды
  }

  private startCombatBehavior(combatId: string) {
    console.log(`🎮 Бот начинает боевое поведение`);
    
    // Простое AI: летать по кругу и стрелять
    let thrust = 1;
    let turn = 0.05;
    
    const combatInterval = setInterval(() => {
      if (!this.socket) {
        clearInterval(combatInterval);
        return;
      }

      // Тяга вперед
      this.socket.emit('combat:action', {
        combatId,
        action: 'thrust',
        value: thrust,
      });

      // Поворот
      this.socket.emit('combat:action', {
        combatId,
        action: 'turn',
        value: turn,
      });

      // Случайно менять направление поворота
      if (Math.random() > 0.95) {
        turn = -turn;
      }
    }, 50); // 20 раз в секунду

    // Слушать окончание боя
    const onCombatEnd = () => {
      clearInterval(combatInterval);
      this.socket?.off('combat:ended', onCombatEnd);
    };
    this.socket.on('combat:ended', onCombatEnd);
  }

  stop() {
    console.log(`🛑 Остановка бота`);
    this.socket?.disconnect();
  }
}

// Запуск бота
const bot = new GameBot();
bot.start().catch((error) => {
  console.error('❌ Ошибка запуска бота:', error);
  process.exit(1);
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.stop();
  process.exit(0);
});
