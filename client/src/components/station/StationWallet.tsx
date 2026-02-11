import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { socketService } from '../../services/socketService';
import { SocketEvent } from '@hexploration/shared';
import './StationWallet.css';

interface StationWalletProps {
  stationId: string;
}

export const StationWallet: React.FC<StationWalletProps> = ({ stationId }) => {
  const { currentStation, storage } = useSelector((state: RootState) => state.station);
  const currentPlayer = useSelector((state: RootState) => state.player.currentPlayer);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (data: { message?: string }) => {
      setError(data.message || 'Ошибка');
    };
    const onSuccess = () => setError(null);
    socketService.on(SocketEvent.STATION_WALLET_ERROR, onError);
    socketService.on(SocketEvent.STATION_WALLET_SUCCESS, onSuccess);
    return () => {
      socketService.off(SocketEvent.STATION_WALLET_ERROR, onError);
      socketService.off(SocketEvent.STATION_WALLET_SUCCESS, onSuccess);
    };
  }, []);

  const isOwner = currentStation?.ownerId === currentPlayer?.id && currentStation?.ownerId !== 'npc';
  const balance = storage?.walletCredits ?? 0;

  if (!isOwner) return null;

  const handleDeposit = () => {
    const amount = parseInt(depositAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setError('Введите корректную сумму');
      return;
    }
    setError(null);
    socketService.emit(SocketEvent.STATION_WALLET_DEPOSIT, { stationId, amount });
    setDepositAmount('');
  };

  const handleWithdraw = () => {
    const amount = parseInt(withdrawAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setError('Введите корректную сумму');
      return;
    }
    if (amount > balance) {
      setError('Недостаточно средств на кошельке');
      return;
    }
    setError(null);
    socketService.emit(SocketEvent.STATION_WALLET_WITHDRAW, { stationId, amount });
    setWithdrawAmount('');
  };

  return (
    <div className="station-wallet">
      <h4>Кошелёк станции</h4>
      <div className="wallet-balance">
        Баланс: <strong>{balance}</strong> кредитов
      </div>
      <div className="wallet-actions">
        <div className="wallet-action">
          <input
            type="number"
            min={1}
            placeholder="Сумма"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <button onClick={handleDeposit}>Пополнить</button>
        </div>
        <div className="wallet-action">
          <input
            type="number"
            min={1}
            placeholder="Сумма"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />
          <button onClick={handleWithdraw}>Снять</button>
        </div>
      </div>
      {error && <div className="wallet-error">{error}</div>}
    </div>
  );
};
