import mongoose, { Schema } from 'mongoose';

export interface IRewindEvent {
  id: string;
  fromTime: number;
  toTime: number;
  rewindAmount: number;
  fromConceptId?: string;
  fromConceptName?: string;
  toConceptId?: string;
  toConceptName?: string;
  timestamp: number;
  createdAt: Date;
}

const RewindEventSchema = new Schema<IRewindEvent>({
  id: { type: String, required: true },
  fromTime: { type: Number, required: true },
  toTime: { type: Number, required: true },
  rewindAmount: { type: Number, required: true },
  fromConceptId: { type: String },
  fromConceptName: { type: String },
  toConceptId: { type: String },
  toConceptName: { type: String },
  timestamp: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const RewindEvent = mongoose.model<IRewindEvent>('RewindEvent', RewindEventSchema);
