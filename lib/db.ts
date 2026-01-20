import mongoose from 'mongoose';

// Serverless-friendly connection caching
// In Vercel, global object persists across function invocations (warm starts)
declare global {
  var mongoose: { 
    conn: typeof mongoose | null; 
    promise: Promise<typeof mongoose> | null;
  };
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string-here';
    
    // Debug logging for Vercel
    if (process.env.VERCEL) {
      const maskedUri = MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
      console.log('[Vercel DB] Connection string present:', !!process.env.MONGODB_URI);
      console.log('[Vercel DB] Connection string (masked):', maskedUri);
      console.log('[Vercel DB] Connection string length:', MONGODB_URI.length);
      const dbName = MONGODB_URI.includes('.mongodb.net/') ? MONGODB_URI.split('.mongodb.net/')[1]?.split('?')[0] : 'missing';
      console.log('[Vercel DB] Database name:', dbName);
      console.log('[Vercel DB] Current mongoose state:', mongoose.connection.readyState);
      console.log('[Vercel DB] Cached connection exists:', !!cached.conn);
    }
    
    if (!process.env.MONGODB_URI || MONGODB_URI === 'mongodb+srv://your-connection-string-here') {
      throw new Error('MONGODB_URI environment variable is not set or is using default placeholder value');
    }

    // If already connected, return cached connection
    if (cached.conn) {
      if (process.env.VERCEL) {
        console.log('[Vercel DB] Using cached connection, state:', cached.conn.connection.readyState);
      }
      return cached.conn.connection;
    }

    // If connection is in progress, wait for it
    if (!cached.promise) {
      if (process.env.VERCEL) {
        console.log('[Vercel DB] Creating new connection...');
      }
      
      // Close any stale connection first (important for serverless)
      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
          if (process.env.VERCEL) {
            console.log('[Vercel DB] Disconnected stale connection');
          }
        } catch (e) {
          // Ignore disconnect errors
        }
      }

      // Create new connection with serverless-optimized options
      // CRITICAL: bufferCommands: false is required for serverless functions
      cached.promise = mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // 5 seconds - faster for serverless
        connectTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        // CRITICAL for serverless: disable mongoose buffering
        bufferCommands: false,
        bufferMaxEntries: 0,
        // Connection pool settings for serverless
        maxPoolSize: 1, // Single connection per serverless function
        minPoolSize: 0,
        maxIdleTimeMS: 30000,
        // Retry settings
        retryWrites: true,
        w: 'majority',
      }).then((mongoose) => {
        if (process.env.VERCEL) {
          console.log('✅ MongoDB Atlas connected successfully (Vercel)');
        } else {
          console.log('✅ MongoDB Atlas connected successfully');
        }
        return mongoose;
      }).catch((error) => {
        cached.promise = null;
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (process.env.VERCEL) {
          console.error('[Vercel DB] Connection failed:', errorMsg);
          console.error('[Vercel DB] Error details:', error);
        }
        throw error;
      });
    }

    cached.conn = await cached.promise;
    
    // Clean up old indexes from Lecturer model migration (skip in Vercel to avoid slow cold starts)
    if (!process.env.VERCEL) {
      try {
        const collection = cached.conn.connection.collection('courses');
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
    }
    
    return cached.conn.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

export default connectDB;