import mongoose from 'mongoose';

/**
 * Скрипт для полного сброса базы данных
 * Удаляет все коллекции из базы данных
 */
async function resetDatabase() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/hexploration';
  
  try {
    console.log('🔄 Подключение к базе данных...');
    console.log(`📡 URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`); // Скрыть пароль
    
    await mongoose.connect(mongoUri);
    console.log('✅ Подключено к MongoDB');
    
    const dbName = mongoose.connection.db?.databaseName;
    console.log(`📊 База данных: ${dbName}`);
    
    // Показываем предупреждение для продакшн
    if (mongoUri.includes('railway') || mongoUri.includes('mongodb.net')) {
      console.log('⚠️  ВНИМАНИЕ: Подключение к ПРОДАКШН базе данных!');
      console.log('⏳ Ожидание 5 секунд для отмены (Ctrl+C)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('\n🗑️  Начинаю удаление коллекций...');
    
    // Получаем список всех коллекций
    const collections = await mongoose.connection.db?.listCollections().toArray();
    
    if (!collections || collections.length === 0) {
      console.log('ℹ️  База данных уже пуста');
    } else {
      for (const collection of collections) {
        try {
          const collectionName = collection.name;
          const count = await mongoose.connection.db?.collection(collectionName).countDocuments() || 0;
          
          if (count > 0) {
            await mongoose.connection.db?.collection(collectionName).deleteMany({});
            console.log(`✅ Удалено ${count} документов из коллекции "${collectionName}"`);
          } else {
            console.log(`ℹ️  Коллекция "${collectionName}" уже пуста`);
          }
        } catch (error) {
          console.error(`❌ Ошибка при удалении коллекции "${collection.name}":`, error);
        }
      }
    }
    
    // Удаляем все коллекции (включая пустые)
    console.log('\n🧹 Удаление всех коллекций...');
    try {
      for (const collection of collections || []) {
        try {
          await mongoose.connection.db?.collection(collection.name).drop();
          console.log(`✅ Удалена коллекция "${collection.name}"`);
        } catch (error: any) {
          if (error.codeName !== 'NamespaceNotFound') {
            console.error(`❌ Ошибка при удалении коллекции "${collection.name}":`, error.message);
          }
        }
      }
    } catch (error) {
      console.log('ℹ️  Ошибка при удалении коллекций:', error);
    }
    
    console.log('\n✅ База данных успешно очищена!');
    
  } catch (error) {
    console.error('❌ Ошибка при сбросе базы данных:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Отключение от базы данных...');
    process.exit(0);
  }
}

// Запуск скрипта
resetDatabase();
