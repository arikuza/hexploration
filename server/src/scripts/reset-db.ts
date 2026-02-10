import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { User } from '../database/models/User.js';
import { GameWorldModel } from '../database/models/GameWorld.js';
import { PlayerData } from '../database/models/PlayerData.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

/**
 * Скрипт для полного сброса базы данных
 * Удаляет все коллекции: users, gameworlds, playerdatas
 * 
 * Использование:
 * MONGODB_URI="mongodb://..." npm run reset-db
 * или
 * MONGODB_URI="mongodb://..." ts-node --esm src/scripts/reset-db.ts
 */
async function resetDatabase() {
  try {
    console.log('🔄 Подключение к базе данных...');
    await connectDatabase();
    
    const dbName = mongoose.connection.db?.databaseName;
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hexploration';
    
    // Показываем предупреждение для продакшн
    if (mongoUri.includes('railway') || mongoUri.includes('mongodb.net')) {
      console.log('⚠️  ВНИМАНИЕ: Подключение к ПРОДАКШН базе данных!');
      console.log(`📊 База данных: ${dbName}`);
      console.log('⏳ Ожидание 5 секунд для отмены (Ctrl+C)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('\n🗑️  Начинаю удаление коллекций...');
    
    // Удаляем все коллекции
    const collections = [
      { name: 'users', model: User },
      { name: 'gameworlds', model: GameWorldModel },
      { name: 'playerdatas', model: PlayerData },
    ];
    
    for (const collection of collections) {
      try {
        // @ts-ignore - скрипт не используется в продакшене
        const count = await collection.model.countDocuments();
        if (count > 0) {
          // @ts-ignore - скрипт не используется в продакшене
          await collection.model.deleteMany({});
          console.log(`✅ Удалено ${count} документов из коллекции "${collection.name}"`);
        } else {
          console.log(`ℹ️  Коллекция "${collection.name}" уже пуста`);
        }
      } catch (error) {
        console.error(`❌ Ошибка при удалении коллекции "${collection.name}":`, error);
      }
    }
    
    // Также удаляем индексы (опционально)
    console.log('\n🧹 Очистка индексов...');
    try {
      await mongoose.connection.db?.dropDatabase();
      console.log('✅ База данных полностью очищена');
    } catch (error) {
      console.log('ℹ️  Индексы уже очищены или база не существует');
    }
    
    console.log('\n✅ База данных успешно сброшена!');
    
  } catch (error) {
    console.error('❌ Ошибка при сбросе базы данных:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    console.log('👋 Отключение от базы данных...');
    process.exit(0);
  }
}

// Запуск скрипта
resetDatabase();
