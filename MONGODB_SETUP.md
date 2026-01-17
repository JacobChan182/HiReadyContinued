# MongoDB Atlas Setup Guide

## 1. Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up for a free account
3. Create a new cluster (free tier M0 is sufficient)

## 2. Configure Database Access

1. Go to **Database Access** in the left sidebar
2. Click **Add New Database User**
3. Create a user with username and password
4. Set privileges to **Read and write to any database**
5. Click **Add User**

## 3. Configure Network Access

1. Go to **Network Access** in the left sidebar
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (for development) or add your specific IP
4. Click **Confirm**

## 4. Get Connection String

1. Go to **Database** in the left sidebar
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Copy the connection string (it looks like: `mongodb+srv://<username>:<password>@cluster.mongodb.net/`)
5. Replace `<username>` and `<password>` with your database user credentials
6. Append your database name: `?retryWrites=true&w=majority`

Example:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/no-more-tears?retryWrites=true&w=majority
```

## 5. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your MongoDB connection string:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/no-more-tears?retryWrites=true&w=majority
   PORT=3001
   VITE_API_URL=http://localhost:3001/api
   ```
   
   **Important:** Replace `<username>` and `<password>` with your actual MongoDB Atlas credentials.

## 6. Start the Server

Run the server:
```bash
npm run server
```

Or run both frontend and backend together:
```bash
npm run dev:all
```

## Collections Structure

The application creates three main collections:

### 1. **students** Collection
Stores student data with assigned lectures and rewind events:
```javascript
{
  userId: "student-123",
  pseudonymId: "SwiftFox456",
  courseIds: ["course-1"],
  cluster: "high-replay",
  lectures: [
    {
      lectureId: "lecture-1",
      lectureTitle: "Introduction to Neural Networks",
      assignedAt: Date,
      rewindEvents: [
        {
          id: "rewind-123",
          fromTime: 120.5,
          toTime: 100.0,
          rewindAmount: 20.5,
          fromConceptId: "concept-2",
          toConceptId: "concept-1",
          timestamp: 1234567890,
          createdAt: Date
        }
      ],
      lastAccessedAt: Date
    }
  ]
}
```

### 2. **lecturers** Collection
Stores lecturer data with lectures and student rewind events:
```javascript
{
  userId: "instructor-1",
  lectures: [
    {
      lectureId: "lecture-1",
      lectureTitle: "Introduction to Neural Networks",
      courseId: "course-1",
      createdAt: Date,
      studentRewindEvents: [
        {
          studentId: "student-123",
          studentPseudonymId: "SwiftFox456",
          rewindEvents: [
            {
              id: "rewind-123",
              fromTime: 120.5,
              toTime: 100.0,
              rewindAmount: 20.5,
              timestamp: 1234567890,
              createdAt: Date
            }
          ]
        }
      ]
    }
  ]
}
```

### 3. **logins** Collection
Stores login/signup events:
```javascript
{
  userId: "student-123",
  pseudonymId: "SwiftFox456",
  role: "student",
  action: "signin", // or "signup"
  timestamp: Date,
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0..."
}
```

## Testing the Connection

1. Start the server: `npm run server`
2. You should see: `✅ MongoDB Atlas connected successfully`
3. Login to the app and rewind a video
4. Check MongoDB Atlas to see the data being stored
