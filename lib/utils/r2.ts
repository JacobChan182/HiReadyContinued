// @ts-expect-error - AWS SDK types are not resolving correctly in TypeScript, but work at runtime
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

// 1. Get the directory of the current file (server/utils/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists (for local dev)
// On Vercel, environment variables are provided via process.env automatically
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  try {
    const envPath = path.resolve(__dirname, '../../.env'); // Go up from server/utils/ to project root
    dotenv.config({ path: envPath });
  } catch (error) {
    // .env file doesn't exist, which is fine - Vercel uses environment variables
    console.debug('No .env file found in r2.ts, using environment variables from Vercel');
  }
}

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // e.g., https://pub-xxxxx.r2.dev

// Validate R2 configuration
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn('⚠️  R2 configuration incomplete. Missing one or more required variables:');
  console.warn(`   R2_ACCOUNT_ID: ${R2_ACCOUNT_ID ? '✓' : '✗'}`);
  console.warn(`   R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID ? '✓' : '✗'}`);
  console.warn(`   R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY ? '✓' : '✗'}`);
  console.warn(`   R2_BUCKET_NAME: ${R2_BUCKET_NAME ? '✓' : '✗'}`);
}

// Create S3 client for R2 (R2 is S3-compatible)
export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = process.env.R2_BUCKET_NAME;
export const PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Helper to generate a unique file key
export const generateVideoKey = (userId: string, lectureId: string, filename: string): string => {
  const extension = filename.split('.').pop();
  const timestamp = Date.now();
  return `videos/${userId}/${lectureId}-${timestamp}.${extension}`;
};

// Helper to get public URL for a video key
export const getVideoUrl = (key: string): string => {
  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/${key}`;
  }
  // Fallback if no public URL configured
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`;
};
