import mongoose from 'mongoose';

/**
 * Скрипт для полного сброса базы данных
 * Удаляет все коллекции из базы данных
 */
async function resetDatabase() {
  let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/hexploration';
  
  try {
    console.log('🔄 Подключение к базе данных...');
    
    // Проверяем есть ли имя базы данных в URI
    // URI должен заканчиваться на /имя_базы или иметь /имя_базы?параметры
    const hasDbName = mongoUri.match(/mongodb:\/\/[^\/]+\/([^?\/]+)/);
    if (!hasDbName) {
      // Добавляем имя базы данных если его нет
      if (mongoUri.endsWith('/')) {
        mongoUri = mongoUri + 'hexploration';
      } else if (mongoUri.includes('?')) {
        mongoUri = mongoUri.replace('?', '/hexploration?');
      } else {
        mongoUri = mongoUri + '/hexploration';
      }
      console.log('⚠️  Имя базы данных не указано в URI, добавляю "/hexploration"');
    }
    
    console.log(`📡 URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`); // Скрыть пароль
    
    // Парсим URI чтобы проверить имя базы данных
    const dbNameMatch = mongoUri.match(/mongodb:\/\/[^\/]+\/([^?]+)/);
    const dbNameFromUri = dbNameMatch ? dbNameMatch[1] : 'не указана';
    console.log(`📦 Имя базы данных из URI: ${dbNameFromUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Подключено к MongoDB');
    
    const dbName = mongoose.connection.db?.databaseName;
    console.log(`📊 Фактическая база данных: ${dbName}`);
    
    // Проверяем что подключились к правильной базе
    if (dbName === 'test' && mongoUri.includes('railway')) {
      console.error('⚠️  ВНИМАНИЕ: Подключились к базе "test" вместо продакшн базы!');
      console.error('   Используется дефолтная база данных MongoDB.');
    }
    
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
      console.log('ℹ️  База данных уже пуста - коллекций не найдено');
    } else {
      console.log(`\n📋 Найдено коллекций: ${collections.length}`);
      console.log('📝 Список коллекций:');
      for (const collection of collections) {
        const count = await mongoose.connection.db?.collection(collection.name).countDocuments() || 0;
        console.log(`   - ${collection.name}: ${count} документов`);
      }
      
      // Сначала удаляем все документы из коллекций
      console.log('\n🗑️  Удаление документов из коллекций...');
      for (const collection of collections) {
        try {
          const collectionName = collection.name;
          const count = await mongoose.connection.db?.collection(collectionName).countDocuments() || 0;
          
          if (count > 0) {
            await mongoose.connection.db?.collection(collectionName).deleteMany({});
            console.log(`   ✅ Удалено ${count} документов из коллекции "${collectionName}"`);
          } else {
            console.log(`   ℹ️  Коллекция "${collectionName}" уже пуста`);
          }
        } catch (error: any) {
          console.error(`   ❌ Ошибка при удалении документов из коллекции "${collection.name}":`, error.message);
        }
      }
    }
    
    // Удаляем все коллекции (включая пустые)
    console.log('\n🧹 Удаление всех коллекций...');
    const droppedCollections: string[] = [];
    try {
      for (const collection of collections || []) {
        try {
          await mongoose.connection.db?.collection(collection.name).drop();
          droppedCollections.push(collection.name);
          console.log(`   ✅ Удалена коллекция "${collection.name}"`);
        } catch (error: any) {
          if (error.codeName !== 'NamespaceNotFound') {
            console.error(`   ❌ Ошибка при удалении коллекции "${collection.name}":`, error.message);
          }
        }
      }
    } catch (error: any) {
      console.error('   ❌ Ошибка при удалении коллекций:', error.message);
    }
    
    // Дополнительно: удаляем всю базу данных для полной очистки
    console.log('\n🔥 Полная очистка базы данных...');
    try {
      await mongoose.connection.db?.dropDatabase();
      console.log('   ✅ База данных полностью удалена');
    } catch (error: any) {
      if (error.codeName !== 'NamespaceNotFound') {
        console.error('   ❌ Ошибка при удалении базы данных:', error.message);
      }
    }
    
    // Проверяем что все коллекции действительно удалены
    console.log('\n🔍 Проверка результата...');
    const remainingCollections = await mongoose.connection.db?.listCollections().toArray();
    if (!remainingCollections || remainingCollections.length === 0) {
      console.log('   ✅ Все коллекции успешно удалены');
    } else {
      console.log(`   ⚠️  Осталось коллекций: ${remainingCollections.length}`);
      for (const collection of remainingCollections) {
        console.log(`      - ${collection.name}`);
      }
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
