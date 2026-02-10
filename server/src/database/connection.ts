import mongoose from 'mongoose';

/**
 * Подключение к MongoDB
 */
export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hexploration';
  
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB подключена:', mongoUri.replace(/\/\/.*@/, '//***@'));
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    throw error;
  }
}

/**
 * Отключение от MongoDB
 */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('❌ MongoDB отключена');
}
