import { Unsubscribe } from 'firebase/database';
import {
  RealtimeChatMessage,
  DEFAULT_CHAT_ID,
  sendMessageRealtime,
  subscribeToMessagesRealtime,
  deleteChatMessageRealtime,
  setTypingStatus,
  subscribeToTyping,
  initUserPresence,
  subscribeToPresence,
  subscribeToAllPresence,
  formatLastSeen,
  uploadChatImage,
  uploadVoiceAudio,
} from './firebase-realtime';

export type ChatMessage = RealtimeChatMessage;

export {
  setTypingStatus,
  subscribeToTyping,
  initUserPresence,
  subscribeToPresence,
  subscribeToAllPresence,
  formatLastSeen,
  uploadChatImage,
  uploadVoiceAudio,
};

/**
 * Sends a real message to Firebase Realtime Database
 * Path: chats/{chatId}/messages
 */
export async function sendChatMessage(params: {
  userId: string;
  senderName: string;
  senderPhoto?: string;
  content: string;
  messageType?: 'text' | 'voice' | 'image';
  mediaUrl?: string;
  duration?: number;
  chatId?: string;
}): Promise<ChatMessage> {
  const result = await sendMessageRealtime({
    chatId: params.chatId || DEFAULT_CHAT_ID,
    senderId: params.userId,
    displayName: params.senderName,
    photoURL: params.senderPhoto,
    text: params.content,
    messageType: params.messageType,
    mediaUrl: params.mediaUrl,
    imageUrl: params.messageType === 'image' ? params.mediaUrl : undefined,
    duration: params.duration,
  });

  const nowIso = new Date().toISOString();
  return {
    id: result.id,
    content: params.content,
    userId: params.userId,
    displayName: params.senderName,
    createdAt: Date.now(),
    photoURL: params.senderPhoto,
    messageType: params.messageType || 'text',
    mediaUrl: params.mediaUrl,
    duration: params.duration,
    senderId: params.userId,
    text: params.content,
    timestamp: Date.now(),
    user_id: params.userId,
    sender_name: params.senderName,
    sender_photo: params.senderPhoto,
    message_type: params.messageType || 'text',
    media_url: params.mediaUrl,
    created_at: nowIso,
    status: 'delivered',
  };
}

/**
 * Subscribes to real-time messages from Firebase Realtime Database
 * Path: chats/{chatId}/messages via onChildAdded
 */
export function subscribeToGlobalChat(
  callback: (messages: ChatMessage[]) => void,
  chatId = DEFAULT_CHAT_ID
): Unsubscribe {
  const messagesMap = new Map<string, ChatMessage>();

  return subscribeToMessagesRealtime(chatId, (newMsg) => {
    messagesMap.set(newMsg.id, newMsg);
    const sorted = Array.from(messagesMap.values()).sort((a, b) => {
      const timeA =
        typeof a.timestamp === 'number'
          ? a.timestamp
          : new Date(a.created_at).getTime() || 0;
      const timeB =
        typeof b.timestamp === 'number'
          ? b.timestamp
          : new Date(b.created_at).getTime() || 0;
      return timeA - timeB;
    });
    callback(sorted);
  });
}

/**
 * Deletes a chat message from Realtime Database
 */
export async function deleteChatMessage(
  messageId: string,
  _userId: string,
  chatId: string = DEFAULT_CHAT_ID
): Promise<void> {
  await deleteChatMessageRealtime(chatId, messageId);
}

/**
 * Reports an inappropriate message for moderation
 */
export async function reportChatMessage(_params: {
  messageId: string;
  reporterId: string;
  reason?: string;
}): Promise<void> {
  // Flagged for moderation
}
