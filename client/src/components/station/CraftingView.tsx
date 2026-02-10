import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { socketService } from '../../services/socketService';
import { SocketEvent, Recipe } from '@hexploration/shared';
import { getItem } from '@hexploration/shared';
import './CraftingView.css';

interface CraftingViewProps {
  stationId: string;
  recipes: Recipe[];
}

const CraftingView: React.FC<CraftingViewProps> = ({ stationId, recipes }) => {
  const { craftingJobs } = useSelector((state: RootState) => state.station);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // Отладочный лог для проверки обновлений
  useEffect(() => {
    const activeJobs = craftingJobs.filter(j => j.stationId === stationId);
    console.log('[CraftingView] Активные задачи:', activeJobs.map(j => ({ id: j.id, progress: j.progress })));
  }, [craftingJobs, stationId]);

  const handleStartCrafting = () => {
    if (!selectedRecipe) return;

    socketService.emit(SocketEvent.STATION_CRAFT_START, {
      stationId,
      recipeId: selectedRecipe,
      quantity,
    });

    // Сбросить выбранный рецепт после начала крафта
    setSelectedRecipe(null);
    setQuantity(1);
  };

  const handleCancelCrafting = (jobId: string) => {
    socketService.emit(SocketEvent.STATION_CRAFT_CANCEL, {
      stationId,
      jobId,
    });
  };

  const activeJobs = craftingJobs.filter(j => j.stationId === stationId);

  return (
    <div className="crafting-view">
      <div className="crafting-section">
        <h3>Доступные рецепты</h3>
        <div className="recipe-list">
          {recipes.length === 0 ? (
            <div className="empty-message">Рецепты не найдены</div>
          ) : (
            recipes.map((recipe) => (
              <div
                key={recipe.id}
                className={`recipe-card ${selectedRecipe === recipe.id ? 'selected' : ''}`}
                onClick={() => setSelectedRecipe(recipe.id)}
              >
                <div className="recipe-header">
                  <h4>{recipe.name}</h4>
                  <span className="recipe-time">{recipe.craftingTime}с</span>
                </div>
                <div className="recipe-description">{recipe.description}</div>
                <div className="recipe-inputs">
                  <div className="recipe-label">Требуется:</div>
                  {recipe.inputs.map((input, idx) => {
                    const item = getItem(input.itemId);
                    return (
                      <div key={idx} className="recipe-item">
                        {item?.name} x{input.quantity}
                      </div>
                    );
                  })}
                </div>
                <div className="recipe-output">
                  <div className="recipe-label">Результат:</div>
                  <div className="recipe-item">
                    {getItem(recipe.output.itemId)?.name} x{recipe.output.quantity}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedRecipe && (
        <div className="crafting-controls">
          <div className="quantity-control">
            <label>Количество:</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="quantity-input"
            />
          </div>
          <button className="craft-btn" onClick={handleStartCrafting}>
            Начать крафт
          </button>
        </div>
      )}

      {activeJobs.length > 0 && (
        <div className="crafting-section">
          <h3>Активные задачи</h3>
          <div className="job-list">
            {activeJobs.map((job) => {
              const recipe = recipes.find(r => r.id === job.recipeId);
              return (
                <div key={job.id} className="job-card">
                  <div className="job-header">
                    <span>{recipe?.name || 'Крафт'}</span>
                    <span className="job-quantity">x{job.quantity}</span>
                  </div>
                  <div className="job-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ 
                          width: `${Math.max(0, Math.min(100, job.progress || 0))}%`,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                    <span className="progress-text">{Math.max(0, Math.min(100, job.progress || 0)).toFixed(1)}%</span>
                  </div>
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancelCrafting(job.id)}
                  >
                    Отменить
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CraftingView;
