/**
 * Cloudinary Media Storage Service for TEZOCRON EXTENDED
 * Cloud Name: jx3vpewq
 * Unsigned Upload Preset: tezocron_upload
 * 
 * Replaces Firebase Storage for all media uploads (profile pictures, posts, chat media, live thumbnails).
 * Automatically delivers optimized URLs with f_auto,q_auto.
 * STOPS base64 / binary media from ever being written to Firestore documents.
 */

export const CLOUDINARY_CONFIG = {
  cloudName: 'jx3vpewq',
  uploadPreset: 'tezocron_upload',
  folders: {
    profilePics: 'tezocron/profile_pics',
    posts: 'tezocron/posts',
    chatMedia: 'tezocron/chat_media',
    liveThumbnails: 'tezocron/live_thumbnails',
  },
};

export interface CloudinaryUploadResponse {
  asset_id?: string;
  public_id: string;
  version: number;
  width?: number;
  height?: number;
  format: string;
  resource_type: string;
  created_at: string;
  bytes: number;
  type: string;
  url: string;
  secure_url: string;
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format?: string;
  resource_type?: string;
}

/**
 * Enforces Firestore document size limit and verifies that NO large base64 or binary data is written.
 * If firestoreDocSize > 900,000 bytes, logs error and throws an exception.
 */
export function assertFirestoreDocSize(data: Record<string, any>, contextName = 'Firestore document'): void {
  // Reject base64 strings in media fields
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && (value.startsWith('data:') || value.length > 50000)) {
      if (
        value.startsWith('data:image/') ||
        value.startsWith('data:video/') ||
        value.startsWith('data:audio/') ||
        value.startsWith('data:application/')
      ) {
        console.warn('Large file payload check triggered:', {
          field: key,
          sizeBytes: value.length,
          context: contextName,
        });
        throw new Error("We couldn't upload your media. Please try again.");
      }
    }
  }

  const jsonStr = JSON.stringify(data);
  const docSizeBytes = new TextEncoder().encode(jsonStr).length;
  if (docSizeBytes > 900000) {
    console.warn('Document size limit check triggered:', {
      docSizeBytes,
      limit: 900000,
      context: contextName,
    });
    throw new Error("We couldn't upload your media. Please try again.");
  }
}

/**
 * Optimizes a Cloudinary delivery URL by injecting f_auto,q_auto
 */
export function optimizeCloudinaryUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  // Only apply to Cloudinary URLs
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }

  // Avoid duplicate transformations
  if (url.includes('f_auto') || url.includes('q_auto')) {
    return url;
  }

  // Insert f_auto,q_auto immediately after /upload/
  return url.replace('/upload/', '/upload/f_auto,q_auto/');
}

/**
 * Core upload handler for Cloudinary unsigned uploads returning full details
 */
export async function uploadToCloudinaryDetailed(
  file: File | Blob,
  resourceType: 'image' | 'video' | 'raw' | 'auto',
  folder: string,
  fileName?: string
): Promise<CloudinaryUploadResult> {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', file, fileName || (file instanceof File ? file.name : 'upload'));
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', folder);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorDetail = errorJson.error?.message || response.statusText;
      console.warn('Media upload warning:', errorDetail);
      throw new Error("We couldn't upload your media. Please try again.");
    }

    const data: CloudinaryUploadResponse = await response.json();
    if (!data.secure_url) {
      throw new Error("We couldn't upload your media. Please try again.");
    }

    return {
      secure_url: optimizeCloudinaryUrl(data.secure_url),
      public_id: data.public_id || '',
      format: data.format,
      resource_type: data.resource_type,
    };
  } catch (err: any) {
    console.warn('Media upload notice:', err);
    throw new Error("We couldn't upload your media. Please try again.");
  }
}

/**
 * Upload an image file or blob to Cloudinary (returns secure optimized URL)
 */
export async function uploadImage(
  file: File | Blob,
  folder: string = CLOUDINARY_CONFIG.folders.profilePics,
  fileName?: string
): Promise<string> {
  const res = await uploadToCloudinaryDetailed(file, 'image', folder, fileName);
  return res.secure_url;
}

/**
 * Upload a video file or blob to Cloudinary (returns secure optimized URL)
 */
export async function uploadVideo(
  file: File | Blob,
  folder: string = CLOUDINARY_CONFIG.folders.posts,
  fileName?: string
): Promise<string> {
  const res = await uploadToCloudinaryDetailed(file, 'video', folder, fileName);
  return res.secure_url;
}

/**
 * Upload an audio file or voice recording blob to Cloudinary (returns secure optimized URL)
 */
export async function uploadAudio(
  audioBlob: Blob,
  folder: string = CLOUDINARY_CONFIG.folders.chatMedia,
  fileName?: string
): Promise<string> {
  const name = fileName || `voice_${Date.now()}.${audioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`;
  const res = await uploadToCloudinaryDetailed(audioBlob, 'video', folder, name);
  return res.secure_url;
}

/**
 * Upload any general media file (image/video/audio) and return full details
 */
export async function uploadMedia(
  file: File | Blob,
  folder: string = CLOUDINARY_CONFIG.folders.posts
): Promise<{ url: string; mediaType: 'image' | 'video' | 'audio'; public_id: string }> {
  const type = file.type || '';
  if (type.startsWith('video/')) {
    const res = await uploadToCloudinaryDetailed(file, 'video', folder);
    return { url: res.secure_url, mediaType: 'video', public_id: res.public_id };
  } else if (type.startsWith('audio/')) {
    const res = await uploadToCloudinaryDetailed(file, 'video', folder);
    return { url: res.secure_url, mediaType: 'audio', public_id: res.public_id };
  } else {
    const res = await uploadToCloudinaryDetailed(file, 'image', folder);
    return { url: res.secure_url, mediaType: 'image', public_id: res.public_id };
  }
}

