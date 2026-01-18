import mongoose, { Schema } from 'mongoose';

export interface ILogin {
  userId: string;
  pseudonymId: string;
  role: 'student' | 'instructor';
  action: 'signin' | 'signup';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

const LoginSchema = new Schema<ILogin>({
  userId: { type: String, required: true },
  pseudonymId: { type: String, required: true },
  role: { type: String, enum: ['student', 'instructor'], required: true },
  action: { type: String, enum: ['signin', 'signup'], required: true },
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
});

LoginSchema.index({ userId: 1, timestamp: -1 });
LoginSchema.index({ timestamp: -1 });

export const Login = mongoose.model<ILogin>('Login', LoginSchema);
