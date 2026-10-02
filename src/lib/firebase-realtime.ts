import {
  getDatabase,
  ref,
  push,
  onValue,
  onChildAdded,
  set,
  remove,
  onDisconnect,
  serverTimestamp,
  Database,
  Unsubscribe,
} from 'firebase/database';
import { firebaseApp, auth, rtdb as db } from './firebase';
import { uploadImage, uploadAudio, CLOUDINARY_CONFIG } from './cloudinaryService';

// Re-export core Firebase Realtime Database methods as requested
export {
  getDatabase,
  ref,
  push,
  onValue,
  onChildAdded,
  set,
  remove,
  onDisconnect,
  serverTimestamp,
  db,
};

// Realtime Database endpoint for project tezocron-extended-v2 (asia-southeast1)
export const RTDB_URL =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  'https://tezocron-extended-v2-default-rtdb.asia-southeast1.firebasedatabase.app';

export const realtimeDb: Database = db;

// Push initial data to DB to remove null
try {
  set(ref(db, "test"), { created: Date.now() }).catch((err) => {
    console.log("Initial DB test notice:", err?.message || err);
  });
} catch (err) {
  console.log("Initial DB test notice:", err);
}

export interface RealtimeChatMessage {
  id: string;
  senderId: string;
  displayName: string;
  text: string;
  timestamp: number | null | unknown;
  imageUrl?: string;
  photoURL?: string;
  messageType?: 'text' | 'voice' | 'image';
  mediaUrl?: string;
  duration?: number;

  // Normalized properties for components to access smoothly
  userId?: string;
  createdAt?: unknown;
  user_id: string;
  sender_name: string;
  sender_photo?: string;
  content: string;
  message_type: 'text' | 'voice' | 'image';
  media_url?: string;
  created_at: string;
  status?: 'sending' | 'delivered' | 'error';
}

export interface UserPresence {
  online: boolean;
  lastSeen?: number | unknown;
}

export const DEFAULT_CHAT_ID = 'global';

/**
 * 2. CHAT MESSAGES:
 * Path: chats/{chatId}/messages
 * When user sends: push(ref(db, chats/${chatId}/messages), { senderId: auth.currentUser.uid, displayName, text, timestamp: serverTimestamp(), imageUrl: optional })
 */
export async function sendMessageRealtime(params: {
  chatId?: string;
  text: string;
  displayName: string;
  senderId?: string;
  imageUrl?: string;
  photoURL?: string;
  messageType?: 'text' | 'voice' | 'image';
  mediaUrl?: string;
  duration?: number;
}): Promise<{ id: string; delivered: boolean }> {
  const currentUid = params.senderId || auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('User must be signed in to send messages');
  }

  const chatId = params.chatId || DEFAULT_CHAT_ID;
  const messagesRef = ref(db, `chats/${chatId}/messages`);

  const payload: Record<string, unknown> = {
    senderId: currentUid,
    displayName: params.displayName || 'Member',
    text: params.text || '',
    timestamp: serverTimestamp(),
  };

  if (params.imageUrl || (params.messageType === 'image' && params.mediaUrl)) {
    payload.imageUrl = params.imageUrl || params.mediaUrl;
  }
  if (params.photoURL) {
    payload.photoURL = params.photoURL;
  }
  if (params.messageType) {
    payload.messageType = params.messageType;
  }
  if (params.mediaUrl) {
    payload.mediaUrl = params.mediaUrl;
  }
  if (typeof params.duration === 'number') {
    payload.duration = params.duration;
  }

  const newMsgRef = await push(messagesRef, payload);
  return { id: newMsgRef.key || '', delivered: true };
}

/**
 * 2. CHAT MESSAGES: Receive messages in real-time
 * To receive: onChildAdded(ref(db, chats/${chatId}/messages), snapshot => add to UI)
 */
export function subscribeToMessagesRealtime(
  chatId: string,
  onMessageReceived: (message: RealtimeChatMessage) => void
): Unsubscribe {
  const targetChatId = chatId || DEFAULT_CHAT_ID;
  const messagesRef = ref(db, `chats/${targetChatId}/messages`);

  return onChildAdded(
    messagesRef,
    (snapshot) => {
      const val = snapshot.val();
      if (!val) return;

      const rawTimestamp = val.timestamp;
      let dateIso = new Date().toISOString();
      if (typeof rawTimestamp === 'number') {
        dateIso = new Date(rawTimestamp).toISOString();
      }

      const msgType = (val.messageType || (val.imageUrl ? 'image' : (val.duration ? 'voice' : 'text'))) as 'text' | 'voice' | 'image';
      const senderUid = val.senderId || val.userId || '';
      const name = val.displayName || val.sender_name || 'Member';
      const photo = val.photoURL || val.sender_photo || '';
      const text = val.text || val.content || '';
      const media = val.imageUrl || val.mediaUrl || val.media_url || '';

      const normalizedMsg: RealtimeChatMessage = {
        id: snapshot.key as string,
        senderId: senderUid,
        displayName: name,
        text: text,
        timestamp: rawTimestamp,
        imageUrl: val.imageUrl,
        photoURL: photo,
        messageType: msgType,
        mediaUrl: media,
        duration: val.duration,
        // UI interoperability
        user_id: senderUid,
        sender_name: name,
        sender_photo: photo,
        content: text,
        message_type: msgType,
        media_url: media,
        created_at: dateIso,
        status: 'delivered',
      };

      onMessageReceived(normalizedMsg);
    },
    (error) => {
      console.warn('Realtime messages listener error:', error);
    }
  );
}

/**
 * 3. TYPING INDICATOR:
 * Path: typing/{chatId}/{userId}
 * When user starts typing: set(ref(db, typing/${chatId}/${userId}), { displayName, typing: true })
 * When stops typing (after 2 sec no input) or sends message: remove(ref(db, typing/${chatId}/${userId}))
 */
export async function setTypingStatus(
  chatId: string,
  userId: string,
  displayName: string,
  isTyping: boolean
): Promise<void> {
  if (!userId) return;
  const targetChatId = chatId || DEFAULT_CHAT_ID;
  const typingRef = ref(db, `typing/${targetChatId}/${userId}`);

  try {
    if (isTyping) {
      await set(typingRef, {
        displayName: displayName || 'Member',
        typing: true,
      });
      // Automatically clean up on disconnect if user abruptly leaves
      onDisconnect(typingRef).remove().catch(() => {});
    } else {
      await remove(typingRef);
    }
  } catch (err) {
    console.warn('Typing indicator update notice:', err);
  }
}

/**
 * 3. TYPING INDICATOR:
 * Listen: onValue(ref(db, typing/${chatId}), snap => if someone else typing, show "John is typing...")
 */
export function subscribeToTyping(
  chatId: string,
  currentUserId: string,
  onTypingChange: (typingDisplayNames: string[]) => void
): Unsubscribe {
  const targetChatId = chatId || DEFAULT_CHAT_ID;
  const typingChatRef = ref(db, `typing/${targetChatId}`);

  return onValue(
    typingChatRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== 'object') {
        onTypingChange([]);
        return;
      }

      const activeTypingNames: string[] = [];
      Object.entries(data).forEach(([uid, val]) => {
        // Exclude current user and ensure typing is active
        if (uid !== currentUserId && val && typeof val === 'object' && (val as { typing?: boolean }).typing) {
          const name = (val as { displayName?: string }).displayName || 'Someone';
          activeTypingNames.push(name);
        }
      });

      onTypingChange(activeTypingNames);
    },
    (err) => {
      console.warn('Typing subscription notice:', err);
    }
  );
}

/**
 * 4. ONLINE PRESENCE:
 * Path: presence/{userId}
 * When user opens app: set(ref(db, presence/${userId}), { online: true, lastSeen: serverTimestamp() })
 * Use onDisconnect(ref(db, presence/${userId})) to set { online: false, lastSeen: serverTimestamp() }
 */
export function initUserPresence(userId: string): () => void {
  if (!userId) return () => {};

  const userPresenceRef = ref(db, `presence/${userId}`);
  const connectedRef = ref(db, '.info/connected');

  const unsubscribe = onValue(connectedRef, async (snap) => {
    if (snap.val() === true) {
      try {
        // Register server-side disconnect handler
        await onDisconnect(userPresenceRef).set({
          online: false,
          lastSeen: serverTimestamp(),
        });

        // Set online status
        await set(userPresenceRef, {
          online: true,
          lastSeen: serverTimestamp(),
        });
      } catch (err) {
        console.warn('User presence init notice:', err);
      }
    }
  });

  return () => {
    unsubscribe();
    // Mark user offline when cleanly leaving
    set(userPresenceRef, {
      online: false,
      lastSeen: serverTimestamp(),
    }).catch(() => {});
  };
}

/**
 * 4. ONLINE PRESENCE:
 * Listen to a single user's presence
 */
export function subscribeToPresence(
  userId: string,
  onPresenceChange: (presence: UserPresence) => void
): Unsubscribe {
  const userPresenceRef = ref(db, `presence/${userId}`);

  return onValue(userPresenceRef, (snapshot) => {
    const val = snapshot.val();
    if (!val) {
      onPresenceChange({ online: false });
    } else {
      onPresenceChange({
        online: Boolean(val.online),
        lastSeen: val.lastSeen,
      });
    }
  });
}

/**
 * 4. ONLINE PRESENCE:
 * Listen to all users' presence in real-time
 */
export function subscribeToAllPresence(
  onAllPresenceChange: (presenceMap: Record<string, UserPresence>) => void
): Unsubscribe {
  const presenceColRef = ref(db, 'presence');

  return onValue(
    presenceColRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== 'object') {
        onAllPresenceChange({});
        return;
      }

      const map: Record<string, UserPresence> = {};
      Object.entries(data).forEach(([uid, val]) => {
        if (val && typeof val === 'object') {
          map[uid] = {
            online: Boolean((val as { online?: boolean }).online),
            lastSeen: (val as { lastSeen?: number | unknown }).lastSeen,
          };
        }
      });
      onAllPresenceChange(map);
    },
    (err) => {
      console.warn('All presence listener notice:', err);
    }
  );
}

/**
 * Helper to format last seen timestamp
 */
export function formatLastSeen(lastSeen: number | null | undefined): string {
  if (!lastSeen) return 'Offline';
  const now = Date.now();
  const diffMs = Math.max(0, now - Number(lastSeen));
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'last seen just now';
  if (diffMin < 60) return `last seen ${diffMin}m ago`;
  if (diffHours < 24) return `last seen ${diffHours}h ago`;
  if (diffDays === 1) return 'last seen yesterday';
  return `last seen ${new Date(Number(lastSeen)).toLocaleDateString()}`;
}

/**
 * Deletes a chat message from Realtime Database
 */
export async function deleteChatMessageRealtime(
  chatId: string,
  messageId: string
): Promise<void> {
  const targetChatId = chatId || DEFAULT_CHAT_ID;
  const msgRef = ref(db, `chats/${targetChatId}/messages/${messageId}`);
  await remove(msgRef);
}

/**
 * Uploads voice audio blob to Cloudinary Media Storage (folder: tezocron/chat_media)
 */
export async function uploadVoiceAudio(
  audioBlob: Blob,
  userId: string
): Promise<string> {
  const extension = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `voice_${userId}_${Date.now()}.${extension}`;

  const cloudinaryUrl = await uploadAudio(
    audioBlob,
    CLOUDINARY_CONFIG.folders.chatMedia,
    fileName
  );
  if (!cloudinaryUrl || cloudinaryUrl.startsWith('data:')) {
    throw new Error("We couldn't upload your media. Please try again.");
  }
  return cloudinaryUrl;
}

/**
 * Uploads chat image attachment to Cloudinary Media Storage (folder: tezocron/chat_media)
 */
export async function uploadChatImage(
  file: File,
  userId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `chat_${userId}_${Date.now()}.${fileExt}`;

  const cloudinaryUrl = await uploadImage(
    file,
    CLOUDINARY_CONFIG.folders.chatMedia,
    fileName
  );
  if (!cloudinaryUrl || cloudinaryUrl.startsWith('data:')) {
    throw new Error("We couldn't upload your media. Please try again.");
  }
  return cloudinaryUrl;
}
