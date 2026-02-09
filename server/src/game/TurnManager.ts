import { EventEmitter } from 'events';

export class TurnManager extends EventEmitter {
  private players: string[] = [];
  private currentTurnIndex: number = 0;
  private turnNumber: number = 0;

  /**
   * Добавить игрока
   */
  addPlayer(playerId: string): void {
    if (!this.players.includes(playerId)) {
      this.players.push(playerId);
      this.emit('player:added', playerId);
    }
  }

  /**
   * Удалить игрока
   */
  removePlayer(playerId: string): void {
    const index = this.players.indexOf(playerId);
    if (index !== -1) {
      this.players.splice(index, 1);
      
      // Если удалили текущего игрока, перейти к следующему
      if (index === this.currentTurnIndex && this.players.length > 0) {
        this.currentTurnIndex = this.currentTurnIndex % this.players.length;
        this.emit('turn:changed', this.getCurrentPlayer());
      }
      
      this.emit('player:removed', playerId);
    }
  }

  /**
   * Получить текущего игрока
   */
  getCurrentPlayer(): string | null {
    if (this.players.length === 0) return null;
    return this.players[this.currentTurnIndex];
  }

  /**
   * Следующий ход
   */
  nextTurn(): void {
    if (this.players.length === 0) return;
    
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    
    // Если вернулись к первому игроку, увеличить номер хода
    if (this.currentTurnIndex === 0) {
      this.turnNumber++;
      this.emit('round:complete', this.turnNumber);
    }
    
    this.emit('turn:changed', this.getCurrentPlayer());
  }

  /**
   * Получить номер текущего хода
   */
  getTurnNumber(): number {
    return this.turnNumber;
  }

  /**
   * Получить всех игроков
   */
  getPlayers(): string[] {
    return [...this.players];
  }

  /**
   * Проверка, что сейчас ход этого игрока
   */
  isPlayerTurn(playerId: string): boolean {
    return this.getCurrentPlayer() === playerId;
  }
}
