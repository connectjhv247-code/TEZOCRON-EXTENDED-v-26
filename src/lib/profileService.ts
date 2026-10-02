import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, getCountFromServer, query } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, firestore } from './firebase';
import { uploadImage, assertFirestoreDocSize, CLOUDINARY_CONFIG } from './cloudinaryService';
import { createNotification } from './notificationService';

export interface UserProfileData {
  uid: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  username?: string;
  username_changed?: boolean;
  photo_url?: string;
  bio?: string;
  play_role?: string;
  privacy_accepted?: boolean;
  account_created_at?: string;
  relate_id?: string;
  relate_url?: string;
  settings?: {
    theme?: string;
    privacy?: {
      profileVisibility?: 'public' | 'followers' | 'private';
      postVisibility?: 'public' | 'followers' | 'private';
      relateVisibility?: 'public' | 'followers' | 'private';
      showOnlineActivity?: boolean;
    };
  };
}

/**
 * Uploads a profile picture permanently to Cloudinary and persists in auth + firestore.
 * Stores ONLY the remote URL string in Firestore (NEVER base64 or raw bytes).
 */
export async function uploadProfilePicture(file: File, userId: string): Promise<string> {
  // 1. Upload to Cloudinary (unsigned preset "tezocron_upload")
  const cloudinaryUrl = await uploadImage(file, CLOUDINARY_CONFIG.folders.profilePics);

  if (!cloudinaryUrl || cloudinaryUrl.startsWith('data:')) {
    console.warn('Invalid avatar URL detected in uploadProfilePicture');
    throw new Error("We couldn't upload your media. Please try again.");
  }

  // 2. Update Firebase Auth Profile
  if (auth.currentUser && auth.currentUser.uid === userId) {
    try {
      await updateProfile(auth.currentUser, {
        photoURL: cloudinaryUrl,
      });
    } catch (authErr) {
      console.warn('Auth photoURL update warning:', authErr);
    }
  }

  // 3. Persist in Firestore user document (URL string only)
  const userRef = doc(firestore, 'users', userId);
  const payload = {
    photo_url: cloudinaryUrl,
    updated_at: new Date().toISOString(),
  };

  assertFirestoreDocSize(payload, `users/${userId}`);

  await setDoc(userRef, payload, { merge: true });

  return cloudinaryUrl;
}

/**
 * Fetches real profile document from Firestore
 */
export async function fetchUserProfile(userId: string): Promise<UserProfileData | null> {
  const userRef = doc(firestore, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    return null;
  }
  return { uid: userId, ...snap.data() } as UserProfileData;
}

/**
 * Updates public profile details (full_name, bio, play_role)
 */
export async function updateUserProfileDetails(
  userId: string,
  details: { full_name?: string; bio?: string; play_role?: string }
): Promise<void> {
  if (auth.currentUser && auth.currentUser.uid === userId && details.full_name) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: details.full_name,
      });
    } catch (err) {
      console.warn('Auth displayName update warning:', err);
    }
  }

  const userRef = doc(firestore, 'users', userId);
  await setDoc(
    userRef,
    {
      ...details,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Records a real profile view if viewer != profileOwner
 */
export async function recordProfileView(profileUserId: string, viewerUserId: string): Promise<void> {
  if (!viewerUserId || viewerUserId === profileUserId) {
    // Do not increase the count simply because the owner refreshes their own profile
    return;
  }

  try {
    const viewRef = doc(firestore, 'users', profileUserId, 'views', viewerUserId);
    await setDoc(
      viewRef,
      {
        viewerId: viewerUserId,
        viewedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Record profile view warning:', err);
  }
}

/**
 * Retrieves total real profile views count
 */
export async function getProfileViewsCount(profileUserId: string): Promise<number> {
  try {
    const viewsCol = collection(firestore, 'users', profileUserId, 'views');
    const snapshot = await getCountFromServer(viewsCol);
    return snapshot.data().count;
  } catch {
    try {
      const viewsCol = collection(firestore, 'users', profileUserId, 'views');
      const snap = await getDocs(query(viewsCol));
      return snap.size;
    } catch {
      return 0;
    }
  }
}

/**
 * Retrieves total real Relate count
 */
export async function getRelateCount(profileUserId: string): Promise<number> {
  try {
    const relatesCol = collection(firestore, 'users', profileUserId, 'relates');
    const snapshot = await getCountFromServer(relatesCol);
    return snapshot.data().count;
  } catch {
    try {
      const relatesCol = collection(firestore, 'users', profileUserId, 'relates');
      const snap = await getDocs(query(relatesCol));
      return snap.size;
    } catch {
      return 0;
    }
  }
}

/**
 * Checks if current user is related to profile user
 */
export async function isUserRelated(profileUserId: string, currentUserId: string): Promise<boolean> {
  if (!currentUserId) return false;
  try {
    const relRef = doc(firestore, 'users', profileUserId, 'relates', currentUserId);
    const snap = await getDoc(relRef);
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Toggles relate relationship between current user and profile user
 */
export async function toggleRelate(profileUserId: string, currentUserId: string): Promise<{ related: boolean; newCount: number }> {
  if (!currentUserId || currentUserId === profileUserId) {
    const count = await getRelateCount(profileUserId);
    return { related: false, newCount: count };
  }

  const profileRelRef = doc(firestore, 'users', profileUserId, 'relates', currentUserId);
  const myRelRef = doc(firestore, 'users', currentUserId, 'relates', profileUserId);
  const snap = await getDoc(profileRelRef);

  if (snap.exists()) {
    // Remove relationship
    await deleteDoc(profileRelRef);
    await deleteDoc(myRelRef).catch(() => {});
    const newCount = await getRelateCount(profileUserId);
    return { related: false, newCount };
  } else {
    // Create relationship
    const now = new Date().toISOString();
    await setDoc(profileRelRef, { relaterId: currentUserId, createdAt: now });
    await setDoc(myRelRef, { relaterId: profileUserId, createdAt: now }).catch(() => {});
    const newCount = await getRelateCount(profileUserId);

    // Trigger real notification for profile user
    try {
      const userASnap = await getDoc(doc(firestore, 'users', currentUserId));
      const userAData = userASnap.data();
      const userAName =
        userAData?.display_name ||
        userAData?.full_name ||
        auth.currentUser?.displayName ||
        'TEZOCRON Member';
      const userAPhoto =
        userAData?.photo_url || auth.currentUser?.photoURL || undefined;

      createNotification({
        userId: profileUserId,
        category: 'personal',
        type: 'relate',
        title: `${userAName} related with you`,
        message: 'Started relating with your profile and activity on TEZOCRON EXTENDED.',
        actorId: currentUserId,
        actorName: userAName,
        actorPhoto: userAPhoto,
        targetId: currentUserId,
        metadata: {
          relaterId: currentUserId,
          relaterName: userAName,
          relaterPhoto: userAPhoto,
        },
      }).catch((err) => console.warn('Relate notification warning:', err));
    } catch (notifErr) {
      console.warn('Relate notification lookup warning:', notifErr);
    }

    return { related: true, newCount };
  }
}

/**
 * Retrieves total real Love ❤️ count
 */
export async function getLoveCount(profileUserId: string): Promise<number> {
  try {
    const lovesCol = collection(firestore, 'users', profileUserId, 'loves');
    const snapshot = await getCountFromServer(lovesCol);
    return snapshot.data().count;
  } catch {
    try {
      const lovesCol = collection(firestore, 'users', profileUserId, 'loves');
      const snap = await getDocs(query(lovesCol));
      return snap.size;
    } catch {
      return 0;
    }
  }
}

/**
 * Checks if current user has loved this profile
 */
export async function hasUserLoved(profileUserId: string, currentUserId: string): Promise<boolean> {
  if (!currentUserId) return false;
  try {
    const loveRef = doc(firestore, 'users', profileUserId, 'loves', currentUserId);
    const snap = await getDoc(loveRef);
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Toggles Love ❤️ for a profile
 */
export async function toggleProfileLove(profileUserId: string, currentUserId: string): Promise<{ loved: boolean; newCount: number }> {
  if (!currentUserId) {
    const count = await getLoveCount(profileUserId);
    return { loved: false, newCount: count };
  }

  const loveRef = doc(firestore, 'users', profileUserId, 'loves', currentUserId);
  const snap = await getDoc(loveRef);

  if (snap.exists()) {
    // Remove Love
    await deleteDoc(loveRef);
    const newCount = await getLoveCount(profileUserId);
    return { loved: false, newCount };
  } else {
    // Add Love
    await setDoc(loveRef, {
      loverId: currentUserId,
      createdAt: new Date().toISOString(),
    });
    const newCount = await getLoveCount(profileUserId);
    return { loved: true, newCount };
  }
}
