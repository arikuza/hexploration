import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { socketService } from '../../services/socketService';
import { SocketEvent, OrderType, OrderStatus } from '@hexploration/shared';
import { ITEM_REGISTRY, getItem } from '@hexploration/shared';
import './MarketView.css';

interface MarketViewProps {
  stationId: string;
}

const MarketView: React.FC<MarketViewProps> = ({ stationId }) => {
  const { marketOrders, storage } = useSelector((state: RootState) => state.station);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.BUY);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [executeQuantity, setExecuteQuantity] = useState<number>(1);

  // Получить доступные предметы для продажи (только те, что есть на станции)
  const getAvailableItemsForSell = () => {
    if (!storage || storage.items.length === 0) return [];
    return storage.items.map(stack => {
      const item = getItem(stack.itemId);
      return {
        itemId: stack.itemId,
        name: item?.name || stack.itemId,
        quantity: stack.quantity,
      };
    });
  };

  // Получить количество доступного предмета на станции
  const getAvailableQuantity = (itemId: string): number => {
    if (!storage) return 0;
    const stack = storage.items.find(s => s.itemId === itemId);
    return stack?.quantity || 0;
  };

  // Обработчик изменения типа ордера
  const handleOrderTypeChange = (newType: OrderType) => {
    setOrderType(newType);
    setSelectedItem('');
    setPrice(0);
    setQuantity(1);
  };

  // Обработчик выбора предмета
  const handleItemSelect = (itemId: string) => {
    setSelectedItem(itemId);
    if (orderType === OrderType.SELL && storage) {
      // Для ордеров на продажу установить максимальное количество
      const available = getAvailableQuantity(itemId);
      setQuantity(Math.min(quantity, available));
    }
  };

  useEffect(() => {
    socketService.emit(SocketEvent.STATION_MARKET_ORDERS_GET, { stationId });
  }, [stationId]);

  const handleCreateOrder = () => {
    if (!selectedItem || price <= 0 || quantity <= 0) return;

    socketService.emit(SocketEvent.STATION_MARKET_ORDER_CREATE, {
      stationId,
      type: orderType,
      itemId: selectedItem,
      price,
      quantity,
    });

    // Сбросить форму
    setSelectedItem('');
    setPrice(0);
    setQuantity(1);
  };

  const handleExecuteOrder = (orderId: string) => {
    socketService.emit(SocketEvent.STATION_MARKET_ORDER_EXECUTE, {
      stationId,
      orderId,
      quantity: executeQuantity,
    });
  };


  const buyOrders = marketOrders.filter(o => o.type === OrderType.BUY && o.status === OrderStatus.ACTIVE);
  const sellOrders = marketOrders.filter(o => o.type === OrderType.SELL && o.status === OrderStatus.ACTIVE);

  return (
    <div className="market-view">
      <div className="market-section">
        <h3>Создать ордер</h3>
        <div className="order-form">
          <div className="form-row">
            <label>Тип:</label>
            <select
              value={orderType}
              onChange={(e) => handleOrderTypeChange(e.target.value as OrderType)}
              className="form-select"
            >
              <option value={OrderType.BUY}>Покупка</option>
              <option value={OrderType.SELL}>Продажа</option>
            </select>
          </div>
          <div className="form-row">
            <label>Предмет:</label>
            <select
              value={selectedItem}
              onChange={(e) => handleItemSelect(e.target.value)}
              className="form-select"
            >
              <option value="">Выберите предмет</option>
              {orderType === OrderType.SELL ? (
                // Для продажи показывать только предметы на станции
                getAvailableItemsForSell().map((item) => (
                  <option key={item.itemId} value={item.itemId}>
                    {item.name} (доступно: {item.quantity})
                  </option>
                ))
              ) : (
                // Для покупки показывать все предметы
                Object.values(ITEM_REGISTRY).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
            {orderType === OrderType.SELL && selectedItem && (
              <span className="available-quantity-hint">
                Доступно на станции: {getAvailableQuantity(selectedItem)}
              </span>
            )}
          </div>
          <div className="form-row">
            <label>Цена за единицу:</label>
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="form-input"
            />
          </div>
          <div className="form-row">
            <label>Количество:</label>
            <input
              type="number"
              min="1"
              max={orderType === OrderType.SELL ? getAvailableQuantity(selectedItem) : undefined}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="form-input"
            />
            {orderType === OrderType.SELL && selectedItem && (
              <span className="quantity-hint">
                Макс: {getAvailableQuantity(selectedItem)}
              </span>
            )}
          </div>
          <button className="create-order-btn" onClick={handleCreateOrder}>
            Создать ордер
          </button>
        </div>
      </div>

      <div className="market-section">
        <h3>Ордера на покупку</h3>
        <div className="order-list">
          {buyOrders.length === 0 ? (
            <div className="empty-message">Нет ордеров на покупку</div>
          ) : (
            buyOrders.map((order) => {
              const item = getItem(order.itemId);
              const available = order.quantity - order.filledQuantity;
              return (
                <div key={order.id} className="order-card">
                  <div className="order-info">
                    <span className="order-item">{item?.name || order.itemId}</span>
                    <span className="order-price">{order.price} кредитов</span>
                    <span className="order-quantity">{available} доступно</span>
                  </div>
                  <div className="order-actions">
                    <input
                      type="number"
                      min="1"
                      max={available}
                      value={executeQuantity}
                      onChange={(e) => setExecuteQuantity(Number(e.target.value))}
                      className="quantity-input"
                    />
                    <button
                      className="execute-btn"
                      onClick={() => handleExecuteOrder(order.id)}
                    >
                      Продать
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="market-section">
        <h3>Ордера на продажу</h3>
        <div className="order-list">
          {sellOrders.length === 0 ? (
            <div className="empty-message">Нет ордеров на продажу</div>
          ) : (
            sellOrders.map((order) => {
              const item = getItem(order.itemId);
              const available = order.quantity - order.filledQuantity;
              return (
                <div key={order.id} className="order-card">
                  <div className="order-info">
                    <span className="order-item">{item?.name || order.itemId}</span>
                    <span className="order-price">{order.price} кредитов</span>
                    <span className="order-quantity">{available} доступно</span>
                  </div>
                  <div className="order-actions">
                    <input
                      type="number"
                      min="1"
                      max={available}
                      value={executeQuantity}
                      onChange={(e) => setExecuteQuantity(Number(e.target.value))}
                      className="quantity-input"
                    />
                    <button
                      className="execute-btn"
                      onClick={() => handleExecuteOrder(order.id)}
                    >
                      Купить
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketView;
