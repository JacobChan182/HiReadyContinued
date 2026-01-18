import mongoose, { Schema } from 'mongoose';
import { IRewindEvent } from './RewindEvent';

export interface ILecture {
  lectureId: string;
  lectureTitle: string;
  courseId: string;
  videoUrl?: string;
  createdAt: Date;
  studentRewindEvents: Array<{
    studentId: string;
    studentPseudonymId: string;
    rewindEvents: IRewindEvent[];
  }>;
  rawAiMetaData: Record<string, any>;
}

export interface ICourse {
  courseId: string; // Unique course ID (e.g., "CS 4820")
  courseName: string;
  instructorId: string;
  lectures: ILecture[];
  createdAt: Date;
  updatedAt: Date;
  rawAiMetaData?: Record<string, any>;
}

const StudentRewindEventsSchema = new Schema({
  studentId: { type: String, required: true },
  studentPseudonymId: { type: String, required: true },
  rewindEvents: { type: [Schema.Types.Mixed], default: [] },
});

const LectureSchema = new Schema<ILecture>({
  lectureId: { type: String, required: true }, // Not unique - same lectureId can exist in different courses
  lectureTitle: { type: String, required: true },
  courseId: { type: String, required: true },
  videoUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  studentRewindEvents: { type: [StudentRewindEventsSchema], default: [] },
  rawAiMetaData: { type: Object, default: {} },
}, { _id: false }); // Disable _id for subdocuments

const CourseSchema = new Schema<ICourse>({
  courseId: { type: String, required: true, unique: true },
  courseName: { type: String, required: true },
  instructorId: { type: String, required: true },
  lectures: { type: [LectureSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CourseSchema.pre('save', function() {
  this.updatedAt = new Date();
});

export const Course = mongoose.model<ICourse>('Course', CourseSchema);
