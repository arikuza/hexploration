import { useState } from 'react';
import './IconPanel.css';

export interface IconItem {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
}

interface IconPanelProps {
  icons: IconItem[];
}

export function IconPanel({ icons }: IconPanelProps) {
  const [iconOrder, setIconOrder] = useState<string[]>(icons.map(i => i.id));

  const moveIcon = (id: string, direction: 'up' | 'down') => {
    setIconOrder((order) => {
      const index = order.indexOf(id);
      if (index === -1) return order;
      const newOrder = [...order];
      if (direction === 'up' && index > 0) {
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      } else if (direction === 'down' && index < newOrder.length - 1) {
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      }
      return newOrder;
    });
  };

  const orderedIcons = iconOrder
    .map((id) => icons.find((i) => i.id === id))
    .filter((i): i is IconItem => i !== undefined);

  return (
    <div className="icon-panel">
      {orderedIcons.map((icon, index) => (
        <div key={icon.id} className="icon-panel__item">
          <button
            type="button"
            className="icon-panel__button"
            onClick={icon.onClick}
            title={icon.label}
          >
            {icon.icon}
          </button>
          <div className="icon-panel__controls">
            <button
              type="button"
              className="icon-panel__move"
              onClick={() => moveIcon(icon.id, 'up')}
              disabled={index === 0}
              title="Вверх"
            >
              ↑
            </button>
            <button
              type="button"
              className="icon-panel__move"
              onClick={() => moveIcon(icon.id, 'down')}
              disabled={index === orderedIcons.length - 1}
              title="Вниз"
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
