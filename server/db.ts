import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    // If connection is in progress (state 2), wait a bit or disconnect and retry
    if (mongoose.connection.readyState === 2) {
      console.log('⚠️  Connection in progress, waiting...');
      // Wait up to 5 seconds for connection to complete
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (mongoose.connection.readyState === 1) {
          console.log('✅ Connection completed');
          return mongoose.connection;
        }
        if (mongoose.connection.readyState === 0) {
          console.log('⚠️  Connection failed, will retry...');
          break;
        }
      }
      // If still connecting after 5 seconds, disconnect and retry
      if (mongoose.connection.readyState === 2) {
        console.log('⚠️  Connection stuck, disconnecting and retrying...');
        await mongoose.disconnect();
      }
    }

    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string-here';
    
    // Add connection timeout and options
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      connectTimeoutMS: 10000,
    });
    console.log('✅ MongoDB Atlas connected successfully');
    
    // Clean up old indexes from Lecturer model migration
    try {
      const collection = mongoose.connection.collection('courses');
      const indexes = await collection.indexes();
      
      // Drop userId index if it exists (leftover from Lecturer model)
      const userIdIndex = indexes.find(idx => idx.key && idx.key.userId);
      if (userIdIndex) {
        await collection.dropIndex('userId_1');
        console.log('✅ Dropped old userId index from courses collection');
      }
      
      // Drop lectures.lectureId unique index if it exists (leftover from Lecturer model)
      const lectureIdIndex = indexes.find(idx => idx.key && idx.key['lectures.lectureId']);
      if (lectureIdIndex) {
        await collection.dropIndex('lectures.lectureId_1');
        console.log('✅ Dropped old lectures.lectureId index from courses collection');
      }
    } catch (error) {
      // Index might not exist, which is fine
      if ((error as any).code !== 27) { // 27 = IndexNotFound
        console.warn('Warning cleaning up indexes:', error);
      }
    }
    
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

export default connectDB;
