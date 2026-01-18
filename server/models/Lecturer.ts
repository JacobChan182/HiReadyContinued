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

export interface ILecturer {
  userId: string;
  lectures: ILecture[];
  createdAt: Date;
  updatedAt: Date;
}

const StudentRewindEventsSchema = new Schema({
  studentId: { type: String, required: true },
  studentPseudonymId: { type: String, required: true },
  rewindEvents: { type: [Schema.Types.Mixed], default: [] },
});

const LectureSchema = new Schema<ILecture>({
  lectureId: { type: String, required: true, unique: true },
  lectureTitle: { type: String, required: true },
  courseId: { type: String, required: true },
  videoUrl: { type: String },
  rawAiMetaData: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  studentRewindEvents: { type: [StudentRewindEventsSchema], default: [] },
});

const LecturerSchema = new Schema<ILecturer>({
  userId: { type: String, required: true, unique: true },
  lectures: { type: [LectureSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

LecturerSchema.pre('save', function(this: ILecturer) {
  this.updatedAt = new Date();
});

export const Lecturer = mongoose.model<ILecturer>('Lecturer', LecturerSchema);
