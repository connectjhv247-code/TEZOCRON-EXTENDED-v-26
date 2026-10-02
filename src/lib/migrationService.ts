import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { firestore, auth } from './firebase';
import {
  generateUsername,
  generateUniqueUsername,
} from './generateUsername';
import { buildUsernameUrl, ensureUserRelateLink } from './relateLinkService';

/**
 * Known baseline user mappings to guarantee exact username assignment during migration.
 */
const KNOWN_USER_MAPPINGS: Record<string, { username: string; displayName: string }> = {
  mynyLj29o4bw1fYMIguxqFRkasR2: {
    username: 'connectjhv247',
    displayName: 'Connect JHV247',
  },
  s9pzrHInRkXf2A36CRcLfJo2CMe2: {
    username: 'rockeyalott',
    displayName: 'rockey alott',
  },
  RrLB2VisNlSHiRHyRwmkZNfil0g1: {
    username: 'jaspiblack',
    displayName: 'jaspiblack',
  },
};

/**
 * Migrates a single authenticated user document and its relate link
 * to the new simple username system.
 */
export async function migrateCurrentUser(currentUser = auth.currentUser): Promise<{
  migrated: boolean;
  username: string;
  relateUrl: string;
} | null> {
  if (!currentUser) return null;
  const uid = currentUser.uid;

  try {
    const userRef = doc(firestore, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const hasUsername = Boolean(data.username && typeof data.username === 'string');
      const hasModernUrl = Boolean(data.relate_url && data.relate_url.includes('/@'));

      // If already fully migrated with clean @username URL, just return
      if (hasUsername && hasModernUrl) {
        return {
          migrated: false,
          username: data.username,
          relateUrl: data.relate_url,
        };
      }

      // Determine proper username
      let targetUsername: string;
      const known = KNOWN_USER_MAPPINGS[uid];
      if (known) {
        targetUsername = known.username;
      } else if (
        currentUser.email === 'connectjhv247@gmail.com' ||
        data.display_name === 'Connect JHV247' ||
        data.full_name === 'Connect JHV247'
      ) {
        targetUsername = 'connectjhv247';
      } else if (data.username) {
        targetUsername = String(data.username).toLowerCase();
      } else {
        targetUsername = await generateUniqueUsername(
          data.full_name || data.display_name || currentUser.displayName || 'User',
          uid
        );
      }

      const relateUrl = buildUsernameUrl(targetUsername);
      const relateId = data.relate_id || 'tz_3t8jrd8h';
      const now = new Date().toISOString();
      const displayName =
        data.full_name || data.display_name || currentUser.displayName || 'TEZOCRON Member';

      // Update user document
      await setDoc(
        userRef,
        {
          username: targetUsername,
          relate_url: relateUrl,
          relate_id: relateId,
          updated_at: now,
        },
        { merge: true }
      );

      // Update relate_links
      try {
        const legacyRef = doc(firestore, 'relate_links', relateId);
        await setDoc(
          legacyRef,
          {
            relateId,
            userId: uid,
            username: targetUsername,
            relateUrl,
            displayName,
          },
          { merge: true }
        );

        const usernameRef = doc(firestore, 'relate_links', targetUsername);
        await setDoc(
          usernameRef,
          {
            relateId,
            userId: uid,
            username: targetUsername,
            relateUrl,
            displayName,
            createdAt: now,
          },
          { merge: true }
        );
      } catch (relateErr) {
        console.warn('relate_links sync note during migration:', relateErr);
      }

      console.log(`[Migration] Successfully migrated user ${uid} to @${targetUsername}`);
      return {
        migrated: true,
        username: targetUsername,
        relateUrl,
      };
    } else {
      // User doc not created yet, initialize via ensureUserRelateLink
      const res = await ensureUserRelateLink(uid, currentUser.displayName || undefined);
      return {
        migrated: true,
        username: res.username,
        relateUrl: res.relateUrl,
      };
    }
  } catch (err) {
    console.warn('migrateCurrentUser warning:', err);
    return null;
  }
}

/**
 * One-time migration scanner for all users without a username.
 * Can be triggered on app load or admin initialization.
 */
export async function runUsersMigration(): Promise<{
  totalChecked: number;
  migratedCount: number;
}> {
  console.log('[Migration] Checking for users requiring username migration...');
  let totalChecked = 0;
  let migratedCount = 0;

  try {
    // Check current authenticated user first
    if (auth.currentUser) {
      const res = await migrateCurrentUser(auth.currentUser);
      totalChecked++;
      if (res?.migrated) migratedCount++;
    }

    // Scan users collection if signed in
    if (auth.currentUser) {
      const usersCol = collection(firestore, 'users');
      const snap = await getDocs(usersCol).catch(() => null);

      if (snap) {
        for (const userDoc of snap.docs) {
          totalChecked++;
          const data = userDoc.data();
          const uid = userDoc.id;

          // If this user document belongs to currentUser or matches known users
          if (uid === auth.currentUser.uid && (!data.username || !data.relate_url?.includes('/@'))) {
            const res = await migrateCurrentUser(auth.currentUser);
            if (res?.migrated) migratedCount++;
          }
        }
      }
    }
  } catch (err) {
    console.warn('runUsersMigration error:', err);
  }

  return { totalChecked, migratedCount };
}
