import { ref, set, get, serverTimestamp, onValue, Unsubscribe } from 'firebase/database';
import { doc, setDoc } from 'firebase/firestore';
import { rtdb as db, firestore, auth } from './firebase';
import { createNotification } from './notificationService';

export const REPORT_REASONS = [
  'Indiscipline',
  'Fake Account',
  'Suspected Fraud',
  'Privacy Violation',
  'Other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterEmail: string;
  reportedId: string;
  reportedEmail: string;
  reportedUsername: string;
  reason: string;
  details: string;
  messageId: string | null;
  messageContent: string | null;
  timestamp: number | null | unknown;
  status: 'pending' | 'reviewed' | 'resolved';
}

export interface SubmitReportParams {
  reporterId: string;
  reporterEmail?: string;
  reportedId: string;
  reportedEmail?: string;
  reportedUsername: string;
  reason: string;
  details?: string;
  messageId?: string | null;
  messageContent?: string | null;
}

export interface SubmitReportResult {
  success: boolean;
  reportKey?: string;
  error?: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Checks whether the current user has already reported the target user within the past 1 hour.
 * Enforces: "A user can only report same user once per 1 hour."
 */
export async function canUserReportTarget(
  reporterId: string,
  reportedId: string
): Promise<{ allowed: boolean; remainingMinutes?: number }> {
  try {
    // 1. Immediate localStorage check
    const localKey = `tezocron_last_report_${reporterId}_${reportedId}`;
    const localTimeStr = localStorage.getItem(localKey);
    if (localTimeStr) {
      const localTime = parseInt(localTimeStr, 10);
      const elapsed = Date.now() - localTime;
      if (elapsed < ONE_HOUR_MS) {
        const remainingMinutes = Math.max(1, Math.ceil((ONE_HOUR_MS - elapsed) / 60000));
        return { allowed: false, remainingMinutes };
      }
    }

    // 2. Realtime Database check
    const reportsRef = ref(db, 'reports');
    const snapshot = await get(reportsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const [key, val] of Object.entries<any>(data)) {
        if (val && val.reporterId === reporterId && val.reportedId === reportedId) {
          // Determine report creation timestamp
          let reportTime: number | null = null;
          if (typeof val.timestamp === 'number') {
            reportTime = val.timestamp;
          } else {
            const keyTime = parseInt(key.split('_')[0], 10);
            if (!isNaN(keyTime)) reportTime = keyTime;
          }

          if (reportTime && Date.now() - reportTime < ONE_HOUR_MS) {
            const remainingMinutes = Math.max(
              1,
              Math.ceil((ONE_HOUR_MS - (Date.now() - reportTime)) / 60000)
            );
            return { allowed: false, remainingMinutes };
          }
        }
      }
    }

    return { allowed: true };
  } catch (err) {
    console.warn('Notice checking rate limits:', err);
    return { allowed: true };
  }
}

/**
 * Submits a moderation report to both Firebase Realtime Database and Firestore.
 * Conforms to:
 * ref(db, `reports/${Date.now()}_${reporterId}`) = {
 *   reporterId, reporterEmail, reportedId, reportedEmail, reportedUsername,
 *   reason, details, messageId, messageContent, timestamp: serverTimestamp(), status: "pending"
 * }
 */
export async function submitRealtimeReport(
  params: SubmitReportParams
): Promise<SubmitReportResult> {
  const currentAuthUser = auth.currentUser;
  const reporterId = currentAuthUser?.uid || params.reporterId;
  const reporterEmail = currentAuthUser?.email || params.reporterEmail || '';
  const reportedId = params.reportedId;

  if (!reporterId || !reportedId) {
    return { success: false, error: 'Unable to identify account. Please try again.' };
  }

  if (reporterId === reportedId) {
    return { success: false, error: 'You cannot report your own account.' };
  }

  if (!params.reason || params.reason.trim() === '') {
    return { success: false, error: 'Please select a report reason.' };
  }

  // 1. Abuse check: 1 report per target per 1 hour
  const check = await canUserReportTarget(reporterId, reportedId);
  if (!check.allowed) {
    return {
      success: false,
      error: `You have already reported this account recently. Please wait ${check.remainingMinutes} minute(s) before submitting another report.`,
    };
  }

  const timestampNow = Date.now();
  const reportKey = `${timestampNow}_${reporterId}`;

  const reportData = {
    reporterId,
    reporterEmail,
    reportedId,
    reportedEmail: params.reportedEmail || '',
    reportedUsername: params.reportedUsername || 'TEZOCRON Member',
    reason: params.reason,
    details: params.details || '',
    messageId: params.messageId || null,
    messageContent: params.messageContent || null,
    timestamp: serverTimestamp(),
    status: 'pending',
  };

  try {
    // 2. Save to Firebase Realtime Database (asia-southeast1)
    const reportRef = ref(db, `reports/${reportKey}`);
    await set(reportRef, reportData);

    // 3. Save to Firestore collection "reports"
    try {
      const firestoreDocRef = doc(firestore, 'reports', reportKey);
      await setDoc(firestoreDocRef, {
        ...reportData,
        id: reportKey,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    } catch (firestoreErr) {
      console.warn('Firestore report sync notice:', firestoreErr);
    }

    // 4. Update local abuse prevention timestamp
    localStorage.setItem(
      `tezocron_last_report_${reporterId}_${reportedId}`,
      timestampNow.toString()
    );

    // 5. Admin Notification Log as required:
    console.log('Report saved, admin should be notified at connectjhv247@gmail.com');

    // 6. Notify the reported user anonymously (NEVER expose reporter identity)
    createNotification({
      userId: reportedId,
      category: 'personal',
      type: 'report_notice',
      title: 'Community Safety Notice: Account Reported',
      message: `A report has been submitted regarding your account under the category "${params.reason}". TEZOCRON Trust & Safety reviews all reports carefully.`,
      targetId: reportKey,
      metadata: {
        reportId: reportKey,
        reportReason: params.reason,
        details: params.details || '',
        reportTimestamp: new Date().toISOString(),
      },
    }).catch((notifErr) => console.warn('Report notification warning:', notifErr));

    // 7. Also dispatch to server backend for secure logging and delivery
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: reportKey,
        reporterId,
        reporterName: currentAuthUser?.displayName || reporterEmail || 'Member',
        reporterEmail,
        reportedUserId: reportedId,
        reportedName: params.reportedUsername,
        reportedEmail: params.reportedEmail || '',
        reasons: [params.reason],
        contentRef: params.messageContent
          ? `Message (${params.messageId || 'direct'}): "${params.messageContent}"`
          : 'Profile Interaction',
        createdAt: new Date().toISOString(),
      }),
    }).catch(() => {});

    return { success: true, reportKey };
  } catch (error) {
    console.error('Error saving report:', error);
    return {
      success: false,
      error: 'Unable to submit your report. Please try again.',
    };
  }
}

/**
 * Subscribes to all reports from Realtime Database for the Admin panel.
 */
export function subscribeToAllReports(
  callback: (reports: ReportItem[]) => void
): Unsubscribe {
  const reportsRef = ref(db, 'reports');
  return onValue(reportsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const raw = snapshot.val();
    const list: ReportItem[] = [];
    for (const [key, val] of Object.entries<any>(raw)) {
      if (val) {
        list.push({
          id: key,
          reporterId: val.reporterId || '',
          reporterEmail: val.reporterEmail || '',
          reportedId: val.reportedId || '',
          reportedEmail: val.reportedEmail || '',
          reportedUsername: val.reportedUsername || 'TEZOCRON Member',
          reason: val.reason || 'General Report',
          details: val.details || '',
          messageId: val.messageId || null,
          messageContent: val.messageContent || null,
          timestamp: val.timestamp || null,
          status: val.status || 'pending',
        });
      }
    }

    // Sort newest first
    list.sort((a, b) => {
      const tA = typeof a.timestamp === 'number' ? a.timestamp : parseInt(a.id.split('_')[0], 10) || 0;
      const tB = typeof b.timestamp === 'number' ? b.timestamp : parseInt(b.id.split('_')[0], 10) || 0;
      return tB - tA;
    });

    callback(list);
  });
}

/**
 * Updates report status in Realtime Database (Admin action).
 */
export async function updateReportStatus(
  reportId: string,
  newStatus: 'pending' | 'reviewed' | 'resolved'
): Promise<boolean> {
  try {
    const reportRef = ref(db, `reports/${reportId}/status`);
    await set(reportRef, newStatus);
    return true;
  } catch (err) {
    console.error('Failed to update report status:', err);
    return false;
  }
}
