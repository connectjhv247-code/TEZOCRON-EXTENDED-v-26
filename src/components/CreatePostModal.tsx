import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Image as ImageIcon,
  Video,
  Globe,
  Lock,
  UploadCloud,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { createRealPost, UserPost } from '../lib/postService';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser;
  authorName: string;
  authorPhoto?: string;
  onPostCreated?: (newPost: UserPost) => void;
}

export default function CreatePostModal({
  isOpen,
  onClose,
  currentUser,
  authorName,
  authorPhoto,
  onPostCreated,
}: CreatePostModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');

  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      setErrorMessage('Please select a valid image or video file.');
      return;
    }

    // Step 18.5 limits: Video max 10MB, max 30s. Image max 10MB.
    if (isVideo && file.size > 10 * 1024 * 1024) {
      setErrorMessage('Video size exceeds the 10MB limit (Step 18.5).');
      return;
    }
    if (isImage && file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image size exceeds the 10MB limit.');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
    setMediaType(isVideo ? 'video' : 'image');

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    if (isVideo) {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        const dur = Math.round(tempVideo.duration || 0);
        if (dur > 30) {
          setErrorMessage('Video must be 30 seconds or shorter (Step 18.5).');
          handleClearSelected();
          return;
        }
        setVideoDuration(dur);
        setVideoCurrentTime(dur); // Defaults to show full badge e.g. 0:18 / 0:18
      };
    } else {
      setVideoDuration(0);
      setVideoCurrentTime(0);
    }
  };

  const handleClearSelected = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoDuration(0);
    setVideoCurrentTime(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select an image or video to post.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const newPost = await createRealPost({
        userId: currentUser.uid,
        authorName: authorName || currentUser.displayName || 'TEZOCRON Member',
        authorPhoto: authorPhoto || currentUser.photoURL || undefined,
        mediaFile: selectedFile,
        caption,
        privacy,
      });

      handleClearSelected();
      setCaption('');
      if (onPostCreated) {
        onPostCreated(newPost);
      }
      onClose();
    } catch (err: any) {
      console.warn('Post creation error:', err);
      setErrorMessage("We couldn't upload your media. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-5 sm:p-6 shadow-2xl backdrop-blur-2xl text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500/20 to-blue-500/20 text-pink-400 border border-pink-500/30">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Create Post</h3>
                <p className="text-[11px] text-slate-400">Share pictures and videos with your audience</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Media Selector & Real Preview */}
            <div>
              <label className="block mb-1.5 font-semibold text-slate-300">
                Media (Picture or Video)
              </label>

              {!previewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/5 p-6 text-center transition-all hover:border-pink-500/50 hover:bg-white/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 group-hover:scale-110 transition-transform mb-2.5">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-semibold text-white">Tap to choose from Gallery</p>
                  <p className="mt-1 text-[11px] text-slate-400">Supports JPG, PNG, WEBP, and MP4 videos</p>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                  {mediaType === 'image' ? (
                    <img
                      src={previewUrl}
                      alt="Post preview"
                      className="max-h-64 w-full object-contain bg-slate-950"
                    />
                  ) : (
                    <div className="relative">
                      <video
                        src={previewUrl}
                        controls
                        playsInline
                        onLoadedMetadata={(e) => {
                          const dur = Math.round(e.currentTarget.duration || 0);
                          if (dur > 0) {
                            setVideoDuration(dur);
                            if (videoCurrentTime === 0) setVideoCurrentTime(dur);
                          }
                        }}
                        onTimeUpdate={(e) => {
                          setVideoCurrentTime(Math.round(e.currentTarget.currentTime || 0));
                        }}
                        className="max-h-64 w-full bg-black object-contain"
                      />

                      {/* Video Duration Badge (e.g. 0:18 / 0:18) */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-mono font-medium text-white shadow-md backdrop-blur-md border border-white/15 pointer-events-none">
                        <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
                        <span>
                          {formatDuration(videoCurrentTime > 0 ? videoCurrentTime : videoDuration)} / {formatDuration(videoDuration)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleClearSelected}
                    disabled={uploading}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-md hover:bg-red-600 transition-colors z-10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleSelectFile}
                className="hidden"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="block mb-1.5 font-semibold text-slate-300">
                Caption <span className="font-normal text-slate-500">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write something about this post..."
                disabled={uploading}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none resize-none"
              />
            </div>

            {/* Real Post Privacy Selector */}
            <div>
              <label className="block mb-1.5 font-semibold text-slate-300">Post Privacy</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPrivacy('public')}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all ${
                    privacy === 'public'
                      ? 'border-blue-500 bg-blue-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                      privacy === 'public'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="block font-semibold text-white text-xs">Public</span>
                    <span className="block text-[10px] text-slate-400">All registered users</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrivacy('private')}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all ${
                    privacy === 'private'
                      ? 'border-pink-500 bg-pink-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                      privacy === 'private'
                        ? 'bg-pink-500 text-white'
                        : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="block font-semibold text-white text-xs">Private</span>
                    <span className="block text-[10px] text-slate-400">Only you can view</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="flex-1 rounded-full border border-white/10 bg-white/5 py-2.5 font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="flex-1 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 py-2.5 font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Post</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
