import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from './firebase';
import { assertFirestoreDocSize } from './cloudinaryService';

export type NotificationCategory = 'personal' | 'system';

export type NotificationType =
  | 'comment'
  | 'views_milestone'
  | 'relate'
  | 'report_notice'
  | 'live_invite'
  | 'system_announcement'
  | 'account_welcome'
  | 'security_alert';

export interface AppNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actorId?: string;
  actorName?: string;
  actorPhoto?: string;
  targetId?: string;
  metadata?: {
    postId?: string;
    postCaption?: string;
    postMediaUrl?: string;
    postOwnerId?: string;
    commentId?: string;
    commentText?: string;
    streamId?: string;
    channelName?: string;
    streamTitle?: string;
    hostName?: string;
    hostPhoto?: string;
    relaterId?: string;
    relaterName?: string;
    reportId?: string;
    reportReason?: string;
    reportTimestamp?: string;
    viewsCount?: number;
    details?: string;
    [key: string]: any;
  };
}

export interface CreateNotificationParams {
  userId: string; // Recipient User ID
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  actorId?: string;
  actorName?: string;
  actorPhoto?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a real notification in the recipient's Firestore notifications subcollection.
 * Validates document size and avoids base64 payloads.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<AppNotification | null> {
  if (!params.userId) return null;

  try {
    const notifCol = collection(firestore, 'users', params.userId, 'notifications');
    const notifDocRef = doc(notifCol);
    const id = notifDocRef.id;
    const now = new Date().toISOString();

    const notif: AppNotification = {
      id,
      userId: params.userId,
      category: params.category,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      read: false,
      createdAt: now,
      actorId: params.actorId || undefined,
      actorName: params.actorName || undefined,
      actorPhoto: params.actorPhoto || undefined,
      targetId: params.targetId || undefined,
      metadata: params.metadata || {},
    };

    assertFirestoreDocSize(notif, `users/${params.userId}/notifications/${id}`);
    await setDoc(notifDocRef, notif);
    return notif;
  } catch (err) {
    console.warn('Failed to create notification:', err);
    return null;
  }
}

/**
 * Creates a notification with a deterministic ID to prevent duplicates (e.g. milestones).
 */
export async function createNotificationWithId(
  notificationId: string,
  params: CreateNotificationParams
): Promise<AppNotification | null> {
  if (!params.userId || !notificationId) return null;

  try {
    const notifDocRef = doc(firestore, 'users', params.userId, 'notifications', notificationId);
    const existing = await getDoc(notifDocRef);
    if (existing.exists()) {
      return existing.data() as AppNotification;
    }

    const now = new Date().toISOString();
    const notif: AppNotification = {
      id: notificationId,
      userId: params.userId,
      category: params.category,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      read: false,
      createdAt: now,
      actorId: params.actorId || undefined,
      actorName: params.actorName || undefined,
      actorPhoto: params.actorPhoto || undefined,
      targetId: params.targetId || undefined,
      metadata: params.metadata || {},
    };

    assertFirestoreDocSize(notif, `users/${params.userId}/notifications/${notificationId}`);
    await setDoc(notifDocRef, notif);
    return notif;
  } catch (err) {
    console.warn('Failed to create deterministic notification:', err);
    return null;
  }
}

/**
 * Real-time listener for user notifications.
 * Automatically sorts client-side by date descending to guarantee instant updates without index hurdles.
 */
export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
): Unsubscribe {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const notifCol = collection(firestore, 'users', userId, 'notifications');

  return onSnapshot(
    notifCol,
    (snapshot) => {
      const items: AppNotification[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId,
          category: data.category || 'personal',
          type: data.type || 'comment',
          title: data.title || 'Notification',
          message: data.message || '',
          read: Boolean(data.read),
          createdAt: data.createdAt || new Date().toISOString(),
          actorId: data.actorId,
          actorName: data.actorName,
          actorPhoto: data.actorPhoto,
          targetId: data.targetId,
          metadata: data.metadata || {},
        };
      });

      // Sort newest first
      items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      callback(items);
    },
    (err) => {
      console.warn('Notifications subscription notice:', err.message);
      callback([]);
    }
  );
}

/**
 * Real-time listener for unread notifications count.
 */
export function subscribeToUnreadNotificationsCount(
  userId: string,
  callback: (count: number) => void
): Unsubscribe {
  if (!userId) {
    callback(0);
    return () => {};
  }

  const notifCol = collection(firestore, 'users', userId, 'notifications');

  return onSnapshot(
    notifCol,
    (snapshot) => {
      let unreadCount = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (!data.read) {
          unreadCount += 1;
        }
      });
      callback(unreadCount);
    },
    (err) => {
      console.warn('Unread count subscription notice:', err.message);
      callback(0);
    }
  );
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!userId || !notificationId) return;
  try {
    const ref = doc(firestore, 'users', userId, 'notifications', notificationId);
    await updateDoc(ref, { read: true });
  } catch (err) {
    console.warn('Failed to mark notification read:', err);
  }
}

/**
 * Marks all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const notifCol = collection(firestore, 'users', userId, 'notifications');
    const snap = await getDocs(notifCol);
    if (snap.empty) return;

    const batch = writeBatch(firestore);
    snap.docs.forEach((d) => {
      if (!d.data().read) {
        batch.update(d.ref, { read: true });
      }
    });
    await batch.commit();
  } catch (err) {
    console.warn('Failed to mark all notifications read:', err);
  }
}

/**
 * Deletes a single notification.
 */
export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!userId || !notificationId) return;
  try {
    const ref = doc(firestore, 'users', userId, 'notifications', notificationId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Failed to delete notification:', err);
  }
}

/**
 * Clears all notifications for a user.
 */
export async function clearAllNotifications(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const notifCol = collection(firestore, 'users', userId, 'notifications');
    const snap = await getDocs(notifCol);
    if (snap.empty) return;

    const batch = writeBatch(firestore);
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Failed to clear notifications:', err);
  }
}

/**
 * Ensures a genuine system welcome and security notice exists for the authenticated user.
 */
export async function ensureSystemWelcomeNotification(
  userId: string,
  userName?: string
): Promise<void> {
  if (!userId) return;
  const deterministicId = `system_welcome_${userId}`;
  await createNotificationWithId(deterministicId, {
    userId,
    category: 'system',
    type: 'account_welcome',
    title: 'Welcome to TEZOCRON EXTENDED',
    message: `Hello ${userName || 'Member'}, your account is securely authenticated. Explore Relate feeds, go live, and connect with other community members safely.`,
    targetId: 'welcome',
    metadata: {
      accountUserId: userId,
      verifiedTimestamp: new Date().toISOString(),
    },
  });
}
