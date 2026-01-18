import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string-here';
    await mongoose.connect(MONGODB_URI);
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
