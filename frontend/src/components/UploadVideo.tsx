import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

// Use explicit URL from env or fallback to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface UploadVideoProps {
  courseId: string;
  onUploadComplete?: (lectureId: string, videoUrl: string) => void;
}

const UploadVideo = ({ courseId, onUploadComplete }: UploadVideoProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [lectureTitle, setLectureTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateLectureId = () => {
    return `lecture-${Date.now()}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Invalid file type. Please upload a video file (MP4, WebM, MOV, AVI).');
        return;
      }

      // Validate file size (e.g., 500MB max)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (selectedFile.size > maxSize) {
        setError('File size exceeds 500MB limit.');
        return;
      }

      setFile(selectedFile);
      setError(null);
      
      // Auto-fill lecture title from filename if empty
      if (!lectureTitle) {
        const filenameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        setLectureTitle(filenameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !user) {
      setError('Please select a file and ensure you are logged in.');
      return;
    }

    if (!lectureTitle.trim()) {
      setError('Please enter a lecture title.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const lectureId = generateLectureId();

      // Upload file directly to our server, which then uploads to R2 (avoids CORS)
      const uploadResponse = await fetch(`${API_URL}/upload/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'X-User-Id': user.id,
          'X-Lecture-Id': lectureId,
          'X-Filename': file.name,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to upload file' };
        }
        const errorMessage = errorData.error || errorData.details || `HTTP ${uploadResponse.status}: Failed to upload file`;
        console.error('Upload error response:', errorData);
        throw new Error(errorMessage);
      }

      const uploadResult = await uploadResponse.json();
      const { key, videoUrl } = uploadResult.data;

      // Save video metadata to lecture
      const completeResponse = await fetch(`${API_URL}/upload/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          lectureId,
          videoKey: key,
          lectureTitle: lectureTitle.trim(),
          courseId,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.error || 'Failed to save video metadata');
      }

      setUploadProgress(100);
      setSuccess(true);
      
      // Call callback if provided
      if (onUploadComplete) {
        onUploadComplete(lectureId, videoUrl);
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload video';
      console.error('Upload error:', err);
      console.error('API URL:', API_URL);
      setError(`${errorMessage}. Check console for details.`);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setIsOpen(false);
      setFile(null);
      setLectureTitle('');
      setError(null);
      setSuccess(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className="h-9 gradient-bg"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Video
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Upload Lecture Video</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    disabled={isUploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* File Input */}
                  <div className="space-y-2">
                    <Label htmlFor="video-file">Video File</Label>
                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                      onClick={() => fileInputRef.current?.click?.()}
                    >
                      <input
                        ref={fileInputRef}
                        id="video-file"
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isUploading}
                      />
                      {file ? (
                        <div className="space-y-2">
                          <Check className="w-8 h-8 text-primary mx-auto" />
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                          <p className="text-sm text-muted-foreground">
                            Click to select or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">
                            MP4, WebM, MOV, AVI (max 500MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lecture Title */}
                  <div className="space-y-2">
                    <Label htmlFor="lecture-title">Lecture Title</Label>
                    <Input
                      id="lecture-title"
                      placeholder="e.g., Introduction to Neural Networks"
                      value={lectureTitle}
                      onChange={(e) => setLectureTitle(e.target.value)}
                      disabled={isUploading}
                    />
                  </div>

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Uploading...</span>
                        <span className="text-muted-foreground">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <motion.div
                          className="h-2 bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </motion.div>
                  )}

                  {/* Success Message */}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Video uploaded successfully!
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={!file || !lectureTitle.trim() || isUploading}
                      className="flex-1 gradient-bg"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default UploadVideo;
