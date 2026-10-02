import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { firestore, auth } from './firebase';

export type LiveViewerAmountOption = 'min' | 'max' | 'extended';
export type LiveViewerDeductionOption = 'special_event' | 'favourite' | 'hot';

export interface UserOverviewData {
  role: string;
  coinBalance: number;
  creditCoinBalance: number;
  giftCount: number;
  savedAmount: number;
  nairaBalance: number;
  liveViewerAmount: LiveViewerAmountOption | null;
  liveViewerDeduction: LiveViewerDeductionOption | null;
}

export interface CoinPriceItem {
  id: string;
  name?: string;
  coins?: number;
  price?: number;
  currency?: string;
  description?: string;
}

export interface LastLiveInfo {
  viewersCount: number;
  reactionsCount: number;
  giftsCount: number;
  endedAt?: any;
}

export interface DailyEventInfo {
  title?: string;
  description?: string;
  date?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
  };
  console.warn('Firestore Notice:', JSON.stringify(errInfo));
}

/**
 * Subscribes to real user overview fields from `users/{userId}`:
 * - role / play_role
 * - coinBalance (defaults to 0 for current user if field does not exist)
 * - giftCount / gifts
 */
export function subscribeToUserOverview(
  userId: string,
  onUpdate: (data: UserOverviewData) => void
): () => void {
  if (!userId) {
    onUpdate({
      role: '',
      coinBalance: 0,
      creditCoinBalance: 0,
      giftCount: 0,
      savedAmount: 0,
      nairaBalance: 0,
      liveViewerAmount: null,
      liveViewerDeduction: null,
    });
    return () => {};
  }

  const userDocRef = doc(firestore, 'users', userId);

  return onSnapshot(
    userDocRef,
    async (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        const role = d.role || d.play_role || '';
        const coinBalance = typeof d.coinBalance === 'number' ? d.coinBalance : (typeof d.coins === 'number' ? d.coins : 0);
        const creditCoinBalance = typeof d.creditCoinBalance === 'number'
          ? d.creditCoinBalance
          : (typeof d.credit_coins === 'number'
              ? d.credit_coins
              : (typeof d.creditedCoins === 'number'
                  ? d.creditedCoins
                  : (typeof d.creditCoins === 'number' ? d.creditCoins : 0)));
        const giftCount = typeof d.giftCount === 'number' ? d.giftCount : (typeof d.gifts === 'number' ? d.gifts : 0);
        const savedAmount = typeof d.savedAmount === 'number'
          ? d.savedAmount
          : (typeof d.savedBalance === 'number'
              ? d.savedBalance
              : (typeof d.savedCoins === 'number' ? d.savedCoins : 0));

        const nairaBalance = typeof d.nairaBalance === 'number'
          ? d.nairaBalance
          : (typeof d.naira_balance === 'number'
              ? d.naira_balance
              : (typeof d.naira === 'number'
                  ? d.naira
                  : (typeof d.walletBalance === 'number' ? d.walletBalance : coinBalance * 1)));

        const liveViewerAmount = (d.liveViewerAmount || d.live_viewer_amount || d.liveSettings?.viewerAmount || null) as LiveViewerAmountOption | null;
        const liveViewerDeduction = (d.liveViewerDeduction || d.live_viewer_deduction || d.liveSettings?.deductionSetting || null) as LiveViewerDeductionOption | null;

        // If coinBalance field does not exist in user doc, create field with default 0 ONLY for current user
        if (d.coinBalance === undefined && auth.currentUser?.uid === userId) {
          try {
            await setDoc(userDocRef, { coinBalance: 0 }, { merge: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
          }
        }

        onUpdate({
          role,
          coinBalance,
          creditCoinBalance,
          giftCount,
          savedAmount,
          nairaBalance,
          liveViewerAmount,
          liveViewerDeduction,
        });
      } else {
        // Doc doesn't exist yet, initialize default for current user
        if (auth.currentUser?.uid === userId) {
          try {
            await setDoc(userDocRef, {
              coinBalance: 0,
              creditCoinBalance: 0,
              giftCount: 0,
              savedAmount: 0,
              nairaBalance: 0,
            }, { merge: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
          }
        }
        onUpdate({
          role: '',
          coinBalance: 0,
          creditCoinBalance: 0,
          giftCount: 0,
          savedAmount: 0,
          nairaBalance: 0,
          liveViewerAmount: null,
          liveViewerDeduction: null,
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      onUpdate({
        role: '',
        coinBalance: 0,
        creditCoinBalance: 0,
        giftCount: 0,
        savedAmount: 0,
        nairaBalance: 0,
        liveViewerAmount: null,
        liveViewerDeduction: null,
      });
    }
  );
}

/**
 * Updates the user's viewer amount setting in Firestore.
 * Capped to: 'min' (50), 'max' (250), 'extended' (500).
 */
export async function updateLiveViewerAmount(
  userId: string,
  option: LiveViewerAmountOption
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'User not authenticated' };
  const capacityMap: Record<LiveViewerAmountOption, number> = {
    min: 50,
    max: 250,
    extended: 500,
  };
  const capacity = capacityMap[option] || 50;

  try {
    const userRef = doc(firestore, 'users', userId);
    await updateDoc(userRef, {
      liveViewerAmount: option,
      live_viewer_amount: option,
      'liveSettings.viewerAmount': option,
      'liveSettings.viewerCapacity': capacity,
      'liveSettings.updatedAt': new Date().toISOString(),
    });

    // Also update any currently active broadcasting stream for this user
    try {
      const streamsQuery = query(
        collection(firestore, 'live_streams'),
        where('hostUid', '==', userId),
        where('status', '==', 'live'),
        limit(1)
      );
      const snap = await getDocs(streamsQuery);
      if (!snap.empty) {
        const streamDoc = snap.docs[0];
        await updateDoc(streamDoc.ref, {
          maxViewers: capacity,
        });
      }
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('Failed to update live viewer amount setting:', err);
    return { success: false, error: err?.message || 'Failed to update viewer amount setting' };
  }
}

/**
 * Updates the user's viewer count deduction setting in Firestore.
 * 'special_event' (+1), 'favourite' (+1), 'hot' (+2).
 */
export async function updateLiveViewerDeduction(
  userId: string,
  option: LiveViewerDeductionOption
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'User not authenticated' };
  const addMap: Record<LiveViewerDeductionOption, number> = {
    special_event: 1,
    favourite: 1,
    hot: 2,
  };
  const additional = addMap[option] || 1;

  try {
    const userRef = doc(firestore, 'users', userId);
    await updateDoc(userRef, {
      liveViewerDeduction: option,
      live_viewer_deduction: option,
      'liveSettings.deductionSetting': option,
      'liveSettings.additionalDeductionPerSec': additional,
      'liveSettings.updatedAt': new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    console.error('Failed to update live deduction setting:', err);
    return { success: false, error: err?.message || 'Failed to update deduction setting' };
  }
}

/**
 * Safely transfers coins from coinBalance to savedAmount using an atomic Firestore transaction.
 * Strictly guarantees coinBalance cannot become negative.
 */
export async function addCoinsToSavings(
  userId: string,
  amount: number
): Promise<{ success: boolean; newCoinBalance: number; newSavedAmount: number; error?: string }> {
  if (!userId || amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, newCoinBalance: 0, newSavedAmount: 0, error: 'Please enter a valid positive coin amount.' };
  }

  const userDocRef = doc(firestore, 'users', userId);

  try {
    const result = await runTransaction(firestore, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists()) {
        throw new Error('User account not found.');
      }

      const data = userDoc.data();
      const currentCoinBalance = typeof data.coinBalance === 'number'
        ? data.coinBalance
        : (typeof data.coins === 'number' ? data.coins : 0);
      const currentSavedAmount = typeof data.savedAmount === 'number'
        ? data.savedAmount
        : (typeof data.savedBalance === 'number'
            ? data.savedBalance
            : (typeof data.savedCoins === 'number' ? data.savedCoins : 0));

      if (currentCoinBalance < amount) {
        throw new Error(`Insufficient coin balance. You have ${currentCoinBalance} coins.`);
      }

      const newCoinBalance = currentCoinBalance - amount;
      const newSavedAmount = currentSavedAmount + amount;

      transaction.update(userDocRef, {
        coinBalance: newCoinBalance,
        savedAmount: newSavedAmount,
        lastSavingsUpdate: new Date().toISOString(),
      });

      return { newCoinBalance, newSavedAmount };
    });

    return {
      success: true,
      newCoinBalance: result.newCoinBalance,
      newSavedAmount: result.newSavedAmount,
    };
  } catch (err: any) {
    console.error('Error adding to savings:', err);
    return {
      success: false,
      newCoinBalance: 0,
      newSavedAmount: 0,
      error: err?.message || 'Transaction could not be completed.',
    };
  }
}

/**
 * Loads real coin pricing from Firestore collection `coin_pricing`.
 * Returns empty array if no pricing is configured. DO NOT invent prices or packages.
 */
export async function getRealCoinPricing(): Promise<CoinPriceItem[]> {
  const path = 'coin_pricing';
  try {
    const colRef = collection(firestore, path);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as CoinPriceItem[];
    }
    return [];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

/**
 * Loads real daily event from Firestore collection `daily_events` if it exists.
 * Returns null if collection is empty or no event found. DO NOT invent events.
 */
export async function getRealDailyEvent(): Promise<DailyEventInfo | null> {
  const path = 'daily_events';
  try {
    const dailyEventsCol = collection(firestore, path);
    const snap = await getDocs(query(dailyEventsCol, limit(1)));
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return {
        title: data.title || data.name || data.event || '',
        description: data.description || '',
        date: data.date || '',
      };
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return null;
  }
}

/**
 * Loads REAL last live stream for the authenticated user:
 * 1. Checks `livestreams` collection where userId == auth.uid
 * 2. If not found, checks `live_streams` collection where hostUid == auth.uid or userId == auth.uid
 * If no live stream exists, returns null ("No live history yet").
 */
export async function getRealLastLiveStream(userId: string): Promise<LastLiveInfo | null> {
  if (!userId) return null;

  // 1. Try `livestreams` collection
  try {
    const livestreamsCol = collection(firestore, 'livestreams');
    const q1 = query(livestreamsCol, where('userId', '==', userId));
    const snap1 = await getDocs(q1);

    if (!snap1.empty) {
      // Find the most recent stream by endedAt or createdAt
      const docs = snap1.docs.map((d) => d.data());
      docs.sort((a, b) => {
        const timeA = a.endedAt?.toMillis ? a.endedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
        const timeB = b.endedAt?.toMillis ? b.endedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
        return timeB - timeA;
      });

      const latest = docs[0];
      return {
        viewersCount: latest.viewersCount ?? latest.viewerCount ?? 0,
        reactionsCount: latest.reactionsCount ?? latest.emojiCount ?? 0,
        giftsCount: latest.giftsCount ?? latest.giftCount ?? 0,
        endedAt: latest.endedAt,
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'livestreams');
  }

  // 2. Fallback to `live_streams` (used by Go Live area)
  try {
    const liveStreamsCol = collection(firestore, 'live_streams');
    const q2 = query(liveStreamsCol, where('hostUid', '==', userId));
    const snap2 = await getDocs(q2);

    if (!snap2.empty) {
      const docs = snap2.docs.map((d) => d.data());
      docs.sort((a, b) => {
        const timeA = a.endedAt?.toMillis ? a.endedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
        const timeB = b.endedAt?.toMillis ? b.endedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
        return timeB - timeA;
      });

      const latest = docs[0];
      return {
        viewersCount: latest.viewersCount ?? latest.viewerCount ?? 0,
        reactionsCount: latest.reactionsCount ?? latest.emojiCount ?? 0,
        giftsCount: latest.giftsCount ?? latest.giftCount ?? 0,
        endedAt: latest.endedAt,
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'live_streams');
  }

  return null;
}
