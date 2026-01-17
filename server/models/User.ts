import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser {
  email: string;
  password: string;
  role: 'student' | 'instructor';
  pseudonymId: string;
  courseIds: string[];
  cluster?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'instructor'], required: true },
  pseudonymId: { type: String, required: true, unique: true },
  courseIds: { type: [String], default: [] },
  cluster: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.updatedAt = new Date();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.index({ email: 1 });
UserSchema.index({ pseudonymId: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
