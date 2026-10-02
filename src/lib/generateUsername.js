import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';

/**
 * Standard generator converting displayName to a base username.
 * Rules: lowercase, alphanumeric only, 3-15 chars.
 */
export function generateUsername(displayName) {
  let base = (displayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (base.length < 3) base = 'user' + Math.random().toString(36).substring(2, 6);
  return base.substring(0, 15);
}

/**
 * Validates a username against strict system requirements:
 * - String type
 * - Lowercase letters, numbers, underscores only
 * - 3 to 15 characters long
 */
export function isValidUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required.' };
  }
  const clean = username.trim().toLowerCase();
  if (clean.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters.' };
  }
  if (clean.length > 15) {
    return { valid: false, error: 'Username cannot exceed 15 characters.' };
  }
  const regex = /^[a-z0-9_]{3,15}$/;
  if (!regex.test(clean)) {
    return {
      valid: false,
      error: 'Username can only contain lowercase letters, numbers, and underscores (_).',
    };
  }
  return { valid: true, error: null };
}

/**
 * Checks if a candidate username is already taken in Firestore.
 * Searches both 'users' and 'relate_links' collections.
 *
 * @param {string} username
 * @param {string|null} currentUserId - If provided, ignores matches belonging to this user
 * @returns {Promise<boolean>} - true if username is taken, false if available
 */
export async function checkUsernameExists(username, currentUserId = null) {
  if (!username) return false;
  const clean = username.trim().toLowerCase();
  const validation = isValidUsername(clean);
  if (!validation.valid) return false;

  try {
    // 1. Check in 'users' collection
    const usersCol = collection(firestore, 'users');
    const qUsers = query(usersCol, where('username', '==', clean), limit(2));
    const userSnap = await getDocs(qUsers);

    for (const d of userSnap.docs) {
      if (!currentUserId || d.id !== currentUserId) {
        return true;
      }
    }

    // 2. Direct document lookup in 'relate_links'
    const directRelateRef = doc(firestore, 'relate_links', clean);
    const directRelateSnap = await getDoc(directRelateRef);
    if (directRelateSnap.exists()) {
      const data = directRelateSnap.data();
      if (!currentUserId || data.userId !== currentUserId) {
        return true;
      }
    }

    // 3. Query 'relate_links' by username field
    const relateCol = collection(firestore, 'relate_links');
    const qRelate = query(relateCol, where('username', '==', clean), limit(2));
    const relateSnap = await getDocs(qRelate);

    for (const d of relateSnap.docs) {
      const data = d.data();
      if (!currentUserId || data.userId !== currentUserId) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('checkUsernameExists note:', err);
    // In case of network/permission restrictions on collection queries, fallback gracefully
    return false;
  }
}

/**
 * Generates a unique username from displayName.
 * If candidate already exists in Firestore, appends a random 2-digit number until unique.
 *
 * @param {string} displayName
 * @param {string|null} currentUserId
 * @returns {Promise<string>}
 */
export async function generateUniqueUsername(displayName, currentUserId = null) {
  let candidate = generateUsername(displayName);
  let exists = await checkUsernameExists(candidate, currentUserId);

  let attempts = 0;
  while (exists && attempts < 20) {
    const random2Digits = Math.floor(10 + Math.random() * 90).toString();
    const prefix = candidate.substring(0, 13);
    candidate = (prefix + random2Digits).substring(0, 15);
    exists = await checkUsernameExists(candidate, currentUserId);
    attempts++;
  }

  return candidate;
}
