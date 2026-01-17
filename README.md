# EduPulse.tech - Identity-Aware Learning Analytics Platform

**Built for UofTHacks 13**

An intelligent training and analytics platform that uses AI-powered video intelligence to detect learning friction and provide actionable insights for trainers and HR departments. Built with privacy-first design principles, EduPulse transforms workplace training and educational content delivery through advanced analytics and behavioral clustering.

## 🎯 Problem Statement

Traditional training platforms lack visibility into how employees actually consume and understand training materials. Instructors and HR teams struggle to identify:
- Which concepts cause confusion
- When learners struggle with specific content
- Patterns in learning behavior across groups
- Optimal intervention points for struggling learners

EduPulse solves this by providing real-time analytics powered by AI video intelligence while maintaining user privacy through pseudonymization.

## ✨ Key Features

### For Employees/Trainees
- **Video Streaming**: Seamless video playback with seeking and concept navigation
- **Concept Search**: Jump to specific concepts within training videos
- **Progress Tracking**: Monitor your learning journey and review completion
- **Personalized Insights**: Get catch-up summaries and concept recommendations

### For Trainers/HR
- **Aggregated Analytics**: View class-wide analytics without exposing individual identities
- **Concept Difficulty Insights**: Identify which concepts cause the most confusion
- **Behavioral Clustering**: Discover learning patterns across employee groups
- **Student Management**: Easily assign employees to training programs, manage course settings
- **Video Upload**: Upload training videos with automatic AI indexing and segmentation

### Privacy & Security
- **Pseudonymization**: All user identities are replaced with pseudonyms
- **Aggregated Data Only**: Trainers see insights, never individual identities
- **Secure Storage**: Videos stored on Cloudflare R2 with presigned URLs

## 🏗️ Architecture

### Frontend
- **React** with TypeScript
- **Vite** for fast development and builds
- **Shadcn UI** components with Tailwind CSS
- **Framer Motion** for animations
- **Recharts** for data visualization

### Backend
- **Node.js/Express** (TypeScript) - Main API server
- **Flask** (Python) - Video indexing and AI services
- **MongoDB Atlas** - Database with Mongoose ODM
- **Cloudflare R2** - Video storage with streaming support

### AI & External Services
- **Twelve Labs API** - Video indexing and concept extraction
- **Backboard API** - AI-powered chat assistant for training support
- **Cloudflare R2** - Object storage for video files

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.12+ with pip
- MongoDB Atlas account (free tier works)
- Cloudflare R2 account (for video storage)
- Twelve Labs API key
- Backboard API key (optional, for chat features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JacobChan182/NoMoreTears.git
   cd NoMoreTears
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   ```

4. **Configure environment variables**

   Create `server/.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/no-more-tears?retryWrites=true&w=majority
   PORT=3001
   R2_ACCOUNT_ID=your_r2_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key
   R2_SECRET_ACCESS_KEY=your_r2_secret_key
   R2_BUCKET_NAME=your_bucket_name
   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
   ```

   Create `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/no-more-tears?retryWrites=true&w=majority
   TWELVELABS_API_KEY=your_twelve_labs_api_key
   BACKBOARD_API_KEY=your_backboard_api_key
   FLASK_PORT=5001
   ```

   Create `frontend/.env` (optional):
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

5. **Start the development servers**
   ```bash
   # Start all services (frontend, Express server, Flask)
   npm run dev

   # Or start individually:
   npm run dev:frontend   # Frontend on http://localhost:5173
   npm run dev:server     # Express server on http://localhost:3001
   npm run dev:flask      # Flask server on http://localhost:5001
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 📁 Project Structure

```
NoMoreTears/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Main page components
│   │   ├── contexts/      # React contexts (Auth, Analytics)
│   │   ├── lib/           # API client and utilities
│   │   └── types/         # TypeScript type definitions
│   └── vite.config.ts
├── server/                # Node.js/Express backend
│   ├── models/            # Mongoose models
│   ├── routes/            # API route handlers
│   └── utils/             # Utility functions (R2, pseudonym)
├── backend/               # Flask Python backend
│   ├── services/          # Video indexing services
│   └── app.py             # Flask application
└── package.json
```

## 🔑 Key Technologies

### Frontend Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Shadcn UI** - Component library
- **Framer Motion** - Animation library
- **Recharts** - Data visualization

### Backend Stack
- **Express.js** - REST API server
- **Mongoose** - MongoDB ODM
- **Flask** - Python microframework for AI services
- **AWS SDK (S3-compatible)** - Cloudflare R2 integration
- **PyMongo** - Python MongoDB driver

### AI & Cloud Services
- **Twelve Labs API** - Video indexing and concept extraction
- **Backboard SDK** - AI chat assistant
- **Cloudflare R2** - Object storage and CDN
- **MongoDB Atlas** - Managed database

## 🎨 Features in Detail

### Video Streaming
- Videos stored on Cloudflare R2 with presigned URLs
- HTTP range request support for seamless seeking
- Automatic video duration detection
- Progressive loading for optimal performance

### Analytics Dashboard
- **Concept Insights**: Track replay counts, drop-off points, and struggle scores
- **Behavioral Clusters**: Group learners by behavior patterns (high-replay, fast-watcher, note-taker, etc.)
- **Timeline Visualization**: View retention and engagement over time
- **Cluster-Concept Matrix**: Identify which groups struggle with which concepts

### Course Management
- Create training programs with course codes and names
- Assign employees by email during creation or via settings
- Search and manage enrolled students
- Update course information (name, code)
- Track lecture counts and course statistics

### Privacy Features
- All users assigned pseudonymous IDs
- Individual identities never exposed to trainers
- Data aggregated at concept and cluster levels
- Secure authentication with bcrypt password hashing

## 📚 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - User login

### Courses/Training Programs
- `GET /api/courses/instructor/:instructorId` - Get all courses for instructor
- `POST /api/courses` - Create new course
- `PUT /api/courses/:courseId` - Update course settings
- `GET /api/courses/:courseId/students` - Get enrolled students
- `POST /api/courses/:courseId/students` - Add students to course
- `DELETE /api/courses/:courseId/students/:userId` - Remove student from course

### Video Upload & Streaming
- `POST /api/upload/direct` - Direct video upload to R2
- `POST /api/upload/complete` - Complete upload and trigger indexing
- `GET /api/upload/stream/:videoKey` - Get presigned streaming URL

### Analytics
- `POST /api/analytics/rewind` - Track video rewind events
- Analytics data aggregated and served through dashboard

### AI Services (Flask)
- `POST /api/index-video` - Index video with Twelve Labs
- `POST /api/segment-video` - Extract video segments
- `POST /api/backboard/chat` - AI-powered chat assistant

## 🔐 Environment Variables

See [MONGODB_SETUP.md](./MONGODB_SETUP.md) for detailed MongoDB setup instructions.

Required environment variables:
- `MONGODB_URI` - MongoDB Atlas connection string
- `TWELVELABS_API_KEY` - Twelve Labs API key for video indexing
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - Cloudflare R2 credentials
- `BACKBOARD_API_KEY` - Backboard API key (optional, for chat features)

## 🤝 Contributing

This project was built for UofTHacks 13. Contributions, issues, and feature requests are welcome!

## 📄 License

This project is part of the UofTHacks 13 hackathon submission.

## 🙏 Acknowledgments

- **Twelve Labs** for video intelligence API
- **Backboard** for AI chat assistant capabilities
- **Cloudflare** for R2 object storage
- **UofTHacks** for the hackathon platform

## 📞 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ for UofTHacks 13**
