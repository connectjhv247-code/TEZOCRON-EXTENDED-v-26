import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { firestore } from './firebase';

export const AUTHORIZED_ADMIN_EMAIL = 'connectjhv247@gmail.com';

/**
 * Checks whether an email address matches the designated admin email.
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
}

export interface AdminVerificationResult {
  isAdmin: boolean;
  docExists: boolean;
  emailMatch: boolean;
  reason?: string;
}

/**
 * Verifies if the authenticated user has verified admin access:
 * 1. Email strictly matches connectjhv247@gmail.com
 * 2. Document exists in Firestore collection "admins" where doc ID = user.uid
 */
export async function verifyAdminStatus(
  user: FirebaseUser | null
): Promise<AdminVerificationResult> {
  if (!user || !user.email) {
    return {
      isAdmin: false,
      docExists: false,
      emailMatch: false,
      reason: 'No authenticated user session found.',
    };
  }

  const emailMatch = isAuthorizedAdminEmail(user.email);
  if (!emailMatch) {
    return {
      isAdmin: false,
      docExists: false,
      emailMatch: false,
      reason: 'Access denied: Your email is not authorized for administrator access.',
    };
  }

  try {
    const adminDocRef = doc(firestore, 'admins', user.uid);
    const snap = await getDoc(adminDocRef);

    if (snap.exists()) {
      return {
        isAdmin: true,
        docExists: true,
        emailMatch: true,
      };
    } else {
      return {
        isAdmin: false,
        docExists: false,
        emailMatch: true,
        reason: 'Admin account record does not exist in Firestore "admins" collection.',
      };
    }
  } catch (err: any) {
    console.warn('Error verifying admin document existence in Firestore:', err);
    return {
      isAdmin: false,
      docExists: false,
      emailMatch: true,
      reason: err?.message || 'Database error during admin verification.',
    };
  }
}

/**
 * Creates/initializes the admin document in Firestore collection "admins" with doc ID = user.uid.
 * Strictly allowed only if email is connectjhv247@gmail.com.
 */
export async function provisionAdminDocument(
  user: FirebaseUser
): Promise<{ success: boolean; error?: string }> {
  if (!isAuthorizedAdminEmail(user.email)) {
    return {
      success: false,
      error: 'Unauthorized email cannot initialize admin document.',
    };
  }

  try {
    const adminDocRef = doc(firestore, 'admins', user.uid);
    await setDoc(
      adminDocRef,
      {
        uid: user.uid,
        email: AUTHORIZED_ADMIN_EMAIL,
        role: 'Super Administrator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (err: any) {
    console.error('Failed to create admin document in Firestore:', err);
    return { success: false, error: err?.message || 'Failed to initialize admin record.' };
  }
}
