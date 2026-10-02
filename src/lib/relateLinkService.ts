import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { firestore } from './firebase';
import {
  generateUsername,
  generateUniqueUsername,
  isValidUsername,
  checkUsernameExists,
} from './generateUsername';

export const TEZOCRON_WEB_BASE_URL = 'https://tezocron.com';
export const TEZOCRON_RELATE_BASE_URL = 'https://tezocron.com/relate';

export interface RelateLinkData {
  relateId: string;
  userId: string;
  username?: string;
  relateUrl: string;
  displayName?: string;
  createdAt: string;
}

export interface ResolvedRelateTarget {
  userId: string;
  relateId: string;
  relateUrl: string;
  username?: string;
  displayName?: string;
  wasLegacyRelateId?: boolean;
}

/**
 * Builds the official simple username link:
 * https://tezocron.com/@username
 */
export function buildUsernameUrl(username: string): string {
  const clean = (username || '').trim().toLowerCase().replace(/^@/, '');
  return `${TEZOCRON_WEB_BASE_URL}/@${clean}`;
}

/**
 * Builds the display URL for UI (e.g. tezocron.com/@username)
 */
export function buildSimpleDisplayUrl(username: string): string {
  const clean = (username || '').trim().toLowerCase().replace(/^@/, '');
  return `tezocron.com/@${clean}`;
}

/**
 * Builds a Relate URL given either a username or a legacy relate ID.
 * Prefers the simple username system https://tezocron.com/@username.
 */
export function buildRelateUrl(identifier: string): string {
  if (!identifier) return `${TEZOCRON_WEB_BASE_URL}/@user`;
  const clean = identifier.trim().replace(/^\/+|\/+$/g, '');
  if (clean.startsWith('@')) {
    return buildUsernameUrl(clean);
  }
  if (!clean.startsWith('tz_') && clean.length <= 15) {
    return buildUsernameUrl(clean);
  }
  return `${TEZOCRON_RELATE_BASE_URL}/${clean}`;
}

/**
 * Generates a safe, high-entropy, public Relate ID for backward compatibility.
 * Example format: tz_m9x2k7p4
 */
export function generatePublicRelateId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = 'tz_';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) {
      result += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * Extracts a username or public Relate ID from any user input:
 * - https://tezocron.com/@connectjhv247
 * - /@connectjhv247
 * - @connectjhv247
 * - connectjhv247
 * - /u/connectjhv247
 * - https://tezocron.com/relate/tz_3t8jrd8h
 * - /relate/tz_3t8jrd8h
 * - tz_3t8jrd8h
 */
export function extractRelateId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Matches @username style: https://tezocron.com/@username, /@username, or @username
  const atMatch = trimmed.match(/(?:tezocron\.com\/)?@([a-z0-9_]{3,15})/i);
  if (atMatch && atMatch[1]) {
    return `@${atMatch[1].toLowerCase()}`;
  }

  // 2. Matches /u/username style
  const uMatch = trimmed.match(/\/u\/([a-z0-9_]{3,15})/i);
  if (uMatch && uMatch[1]) {
    return `@${uMatch[1].toLowerCase()}`;
  }

  // 3. Matches /relate/identifier
  const urlMatch = trimmed.match(/\/relate\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    const val = urlMatch[1];
    return val.startsWith('tz_') ? val : `@${val.toLowerCase()}`;
  }

  // 4. Query param styles: ?u=username, ?username=username, ?relate=id
  const userParam = trimmed.match(/[?&](?:u|user|username)=([a-zA-Z0-9_]{3,15})/i);
  if (userParam && userParam[1]) {
    return `@${userParam[1].toLowerCase()}`;
  }
  const relateParam = trimmed.match(/[?&](?:relate|relateId|r)=([a-zA-Z0-9_-]+)/i);
  if (relateParam && relateParam[1]) {
    const val = relateParam[1];
    return val.startsWith('tz_') ? val : `@${val.toLowerCase()}`;
  }

  // 5. Raw @username string
  if (/^@[a-z0-9_]{3,15}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // 6. Raw legacy tz_xxx format
  if (/^tz_[a-z0-9_-]{4,32}$/i.test(trimmed)) {
    return trimmed;
  }

  // 7. Plain alphanumeric username string (3-15 chars)
  if (/^[a-z0-9_]{3,15}$/i.test(trimmed)) {
    return `@${trimmed.toLowerCase()}`;
  }

  return null;
}

/**
 * Ensures each registered user automatically has:
 * 1. A clean, unique, lowercase username (3-15 chars, letters/numbers/underscore).
 * 2. Official relateUrl = https://tezocron.com/@username.
 * 3. Backward compatible relateId (tz_xxx).
 * 4. Bidirectional mapping in Firestore (users collection and relate_links).
 */
export async function ensureUserRelateLink(
  userId: string,
  displayName?: string,
  preferredUsername?: string
): Promise<{ relateId: string; relateUrl: string; username: string }> {
  if (!userId) {
    throw new Error('User ID is required to guarantee Relate Link.');
  }

  const userDocRef = doc(firestore, 'users', userId);
  const userSnap = await getDoc(userDocRef);

  let existingRelateId: string | null = null;
  let existingUsername: string | null = null;
  let existingRelateUrl: string | null = null;

  if (userSnap.exists()) {
    const data = userSnap.data();
    if (data.relate_id) existingRelateId = String(data.relate_id);
    if (data.username) existingUsername = String(data.username).toLowerCase();
    if (data.relate_url) existingRelateUrl = String(data.relate_url);
  }

  // Special handle for primary user "Connect JHV247"
  const isConnectJHV =
    userId === 'mynyLj29o4bw1fYMIguxqFRkasR2' ||
    displayName === 'Connect JHV247' ||
    userSnap.data()?.email === 'connectjhv247@gmail.com';

  let finalUsername = existingUsername;
  if (!finalUsername) {
    if (preferredUsername && isValidUsername(preferredUsername).valid) {
      finalUsername = preferredUsername.toLowerCase();
    } else if (isConnectJHV) {
      finalUsername = 'connectjhv247';
    } else {
      finalUsername = await generateUniqueUsername(
        displayName || userSnap.data()?.full_name || 'User',
        userId
      );
    }
  }

  // Always enforce the simple https://tezocron.com/@username format
  const finalRelateUrl = buildUsernameUrl(finalUsername);
  const finalRelateId = existingRelateId || generatePublicRelateId();
  const now = new Date().toISOString();
  const resolvedDisplayName =
    displayName || userSnap.data()?.full_name || userSnap.data()?.display_name || 'TEZOCRON Member';

  // 1. Update/Save to 'users/{userId}'
  try {
    await setDoc(
      userDocRef,
      {
        username: finalUsername,
        relate_id: finalRelateId,
        relate_url: finalRelateUrl,
        updated_at: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('users doc update warning in ensureUserRelateLink:', err);
  }

  // 2. Save mapping in 'relate_links/{relateId}' (for backward compatibility)
  try {
    const legacyMappingRef = doc(firestore, 'relate_links', finalRelateId);
    await setDoc(
      legacyMappingRef,
      {
        relateId: finalRelateId,
        userId,
        username: finalUsername,
        relateUrl: finalRelateUrl,
        displayName: resolvedDisplayName,
        createdAt: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('relate_links legacy mapping note:', err);
  }

  // 3. Save mapping in 'relate_links/{username}' (for instant O(1) resolution of @username)
  try {
    const usernameMappingRef = doc(firestore, 'relate_links', finalUsername);
    await setDoc(
      usernameMappingRef,
      {
        relateId: finalRelateId,
        userId,
        username: finalUsername,
        relateUrl: finalRelateUrl,
        displayName: resolvedDisplayName,
        createdAt: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('relate_links username mapping note:', err);
  }

  return {
    relateId: finalRelateId,
    relateUrl: finalRelateUrl,
    username: finalUsername,
  };
}

/**
 * Resolves any username (@connectjhv247), user URL (tezocron.com/@connectjhv247),
 * or legacy public Relate ID (tz_3t8jrd8h) to the authentic matching user profile.
 *
 * If the input was a legacy tz_xxx ID, wasLegacyRelateId will be true so the UI
 * can redirect to /@username seamlessly!
 */
export async function resolveRelateLink(input: string): Promise<ResolvedRelateTarget | null> {
  const extracted = extractRelateId(input);
  if (!extracted) return null;

  const isUsernameQuery = extracted.startsWith('@');
  const cleanToken = isUsernameQuery ? extracted.substring(1).toLowerCase() : extracted;

  // 1. Direct O(1) lookup in relate_links
  try {
    const linkRef = doc(firestore, 'relate_links', cleanToken);
    const snap = await getDoc(linkRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.userId) {
        const username = data.username || (isUsernameQuery ? cleanToken : undefined);
        const resolvedRelateUrl = username
          ? buildUsernameUrl(username)
          : data.relateUrl || buildRelateUrl(data.relateId || cleanToken);

        return {
          userId: data.userId,
          relateId: data.relateId || cleanToken,
          relateUrl: resolvedRelateUrl,
          username,
          displayName: data.displayName,
          wasLegacyRelateId: !isUsernameQuery,
        };
      }
    }
  } catch (err) {
    console.warn('relate_links direct lookup error:', err);
  }

  // 2. Query in users collection by username
  if (isUsernameQuery) {
    try {
      const usersCol = collection(firestore, 'users');
      const q = query(usersCol, where('username', '==', cleanToken), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const userDocSnap = querySnap.docs[0];
        const userData = userDocSnap.data();
        return {
          userId: userDocSnap.id,
          relateId: userData.relate_id || generatePublicRelateId(),
          relateUrl: buildUsernameUrl(cleanToken),
          username: cleanToken,
          displayName: userData.full_name || userData.display_name,
          wasLegacyRelateId: false,
        };
      }
    } catch (err) {
      console.warn('users query by username note:', err);
    }
  }

  // 3. Fallback query in users collection by legacy relate_id
  if (!isUsernameQuery) {
    try {
      const usersCol = collection(firestore, 'users');
      const q = query(usersCol, where('relate_id', '==', cleanToken), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const userDocSnap = querySnap.docs[0];
        const userData = userDocSnap.data();
        const username = userData.username || generateUsername(userData.full_name || userData.display_name || 'user');
        return {
          userId: userDocSnap.id,
          relateId: cleanToken,
          relateUrl: buildUsernameUrl(username),
          username,
          displayName: userData.full_name || userData.display_name,
          wasLegacyRelateId: true,
        };
      }
    } catch (err) {
      console.warn('users fallback relate_id query note:', err);
    }
  }

  // 4. Known hardcoded baseline fallback for Connect JHV247 account
  if (
    cleanToken === 'connectjhv247' ||
    cleanToken === 'tz_3t8jrd8h' ||
    cleanToken === 'tz_4ffcfac7'
  ) {
    return {
      userId: 'mynyLj29o4bw1fYMIguxqFRkasR2',
      relateId: 'tz_3t8jrd8h',
      relateUrl: 'https://tezocron.com/@connectjhv247',
      username: 'connectjhv247',
      displayName: 'Connect JHV247',
      wasLegacyRelateId: cleanToken.startsWith('tz_'),
    };
  }

  return null;
}

/**
 * Detects Relate ID or username from the active browser location.
 * Supports:
 * - /@username
 * - /u/username
 * - /relate/tz_xxx
 * - ?u=username or ?username=username or ?relate=id
 * - hash #/@username
 * - sessionStorage pending target
 */
export function detectRelateIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  const pathname = window.location.pathname;

  // 1. Check pathname for /@username
  const atMatch = pathname.match(/^\/@([a-z0-9_]{3,15})/i);
  if (atMatch && atMatch[1]) {
    return `@${atMatch[1].toLowerCase()}`;
  }

  // 2. Check pathname for /u/username
  const uMatch = pathname.match(/^\/u\/([a-z0-9_]{3,15})/i);
  if (uMatch && uMatch[1]) {
    return `@${uMatch[1].toLowerCase()}`;
  }

  // 3. Check pathname for /relate/identifier
  const relateMatch = pathname.match(/\/relate\/([a-zA-Z0-9_-]+)/i);
  if (relateMatch && relateMatch[1]) {
    const val = relateMatch[1];
    return val.startsWith('tz_') ? val : `@${val.toLowerCase()}`;
  }

  // 4. Check query string parameters
  const params = new URLSearchParams(window.location.search);
  const uParam = params.get('u') || params.get('user') || params.get('username');
  if (uParam) {
    const extracted = extractRelateId(`@${uParam}`);
    if (extracted) return extracted;
  }
  const relParam = params.get('relate') || params.get('relateId') || params.get('r');
  if (relParam) {
    const extracted = extractRelateId(relParam);
    if (extracted) return extracted;
  }

  // 5. Check hash routes (e.g. #/@username or #/relate/tz_xxx)
  if (window.location.hash) {
    const hashAtMatch = window.location.hash.match(/#\/?@([a-z0-9_]{3,15})/i);
    if (hashAtMatch && hashAtMatch[1]) {
      return `@${hashAtMatch[1].toLowerCase()}`;
    }
    const hashRelMatch = window.location.hash.match(/#\/?relate\/([a-zA-Z0-9_-]+)/i);
    if (hashRelMatch && hashRelMatch[1]) {
      const val = hashRelMatch[1];
      return val.startsWith('tz_') ? val : `@${val.toLowerCase()}`;
    }
  }

  // 6. Check sessionStorage for pending relate link visited before login
  try {
    const pending = sessionStorage.getItem('tezocron_pending_relate_id');
    if (pending) {
      return pending;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Saves pending Relate ID / username in sessionStorage to open after login/registration.
 */
export function savePendingRelateTarget(target: string): void {
  try {
    sessionStorage.setItem('tezocron_pending_relate_id', target);
  } catch {
    // Ignore
  }
}

/**
 * Clears pending Relate ID.
 */
export function clearPendingRelateTarget(): void {
  try {
    sessionStorage.removeItem('tezocron_pending_relate_id');
  } catch {
    // Ignore
  }
}

/**
 * Copies the Relate URL to the user's clipboard.
 */
export async function copyRelateUrlToClipboard(relateUrl: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(relateUrl);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = relateUrl;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.warn('Clipboard write error:', err);
    return false;
  }
}

/**
 * Formats sharing message for third-party apps using simple username link.
 */
export function getRelateShareText(displayName: string, relateUrl: string, username?: string): string {
  const name = displayName?.trim() || (username ? `@${username}` : 'me');
  return `Connect and relate with ${name} on TEZOCRON: ${relateUrl}`;
}

/**
 * Direct share links for WhatsApp, Telegram, SMS, Email, and Native Share.
 */
export function getShareUrls(relateUrl: string, displayName: string, username?: string) {
  const text = getRelateShareText(displayName, relateUrl, username);
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(relateUrl);
  const subject = encodeURIComponent(`Relate with ${displayName || (username ? `@${username}` : 'TEZOCRON Member')} on TEZOCRON`);

  return {
    whatsapp: `https://api.whatsapp.com/send?text=${encodedText}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    sms: `sms:?&body=${encodedText}`,
    email: `mailto:?subject=${subject}&body=${encodedText}`,
    text,
  };
}

/**
 * Invokes native mobile/desktop sharing sheet if supported.
 */
export async function shareViaNativeSheet(
  relateUrl: string,
  displayName: string,
  username?: string
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `Relate with ${displayName || (username ? `@${username}` : 'TEZOCRON Member')}`,
        text: getRelateShareText(displayName, relateUrl, username),
        url: relateUrl,
      });
      return true;
    } catch (err) {
      console.info('Native share dismissed or failed:', err);
      return false;
    }
  }
  return false;
}

/**
 * Updates a user's username ONCE from the Settings Screen.
 * Enforces uniqueness, format rules (3-15 chars, lowercase letters/numbers/_),
 * and updates users collection and relate_links.
 */
export async function updateUserUsername(
  userId: string,
  newUsername: string,
  displayName?: string
): Promise<{ success: boolean; error?: string; username?: string; relateUrl?: string }> {
  if (!userId) return { success: false, error: 'User not authenticated.' };

  const validation = isValidUsername(newUsername);
  if (!validation.valid) {
    return { success: false, error: validation.error || 'Invalid username format.' };
  }

  const clean = newUsername.trim().toLowerCase();

  // 1. Verify user hasn't already edited username once
  const userRef = doc(firestore, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    return { success: false, error: 'User record not found.' };
  }

  const data = snap.data();
  if (data.username_changed === true) {
    return {
      success: false,
      error: 'Username can only be customized once. Your current username is permanently locked.',
    };
  }

  // If new username is identical to current, no-op
  if (data.username === clean) {
    return {
      success: true,
      username: clean,
      relateUrl: buildUsernameUrl(clean),
    };
  }

  // 2. Validate uniqueness against Firestore
  const isTaken = await checkUsernameExists(clean, userId);
  if (isTaken) {
    return {
      success: false,
      error: `Username @${clean} is already taken. Please choose another username.`,
    };
  }

  const now = new Date().toISOString();
  const relateId = data.relate_id || generatePublicRelateId();
  const newRelateUrl = buildUsernameUrl(clean);
  const resolvedDisplayName =
    displayName || data.full_name || data.display_name || 'TEZOCRON Member';

  try {
    // 3. Update users document
    await setDoc(
      userRef,
      {
        username: clean,
        username_changed: true,
        relate_url: newRelateUrl,
        updated_at: now,
      },
      { merge: true }
    );

    // 4. Update legacy relateId document
    const legacyRef = doc(firestore, 'relate_links', relateId);
    await setDoc(
      legacyRef,
      {
        relateId,
        userId,
        username: clean,
        relateUrl: newRelateUrl,
        displayName: resolvedDisplayName,
      },
      { merge: true }
    );

    // 5. Create new username lookup document
    const usernameDocRef = doc(firestore, 'relate_links', clean);
    await setDoc(
      usernameDocRef,
      {
        relateId,
        userId,
        username: clean,
        relateUrl: newRelateUrl,
        displayName: resolvedDisplayName,
        createdAt: now,
      },
      { merge: true }
    );

    return {
      success: true,
      username: clean,
      relateUrl: newRelateUrl,
    };
  } catch (err: unknown) {
    console.error('Error updating username:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg.includes('Missing or insufficient permissions')
        ? 'Permission denied while updating username.'
        : 'Failed to update username. Please try again.',
    };
  }
}
