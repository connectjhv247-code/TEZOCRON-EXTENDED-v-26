import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Settings,
  Moon,
  Sun,
  Smartphone,
  Shield,
  Eye,
  Bell,
  KeyRound,
  LogOut,
  ShieldAlert,
  Camera,
  Mic,
  Trash2,
  Check,
  AlertTriangle,
  Mail,
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  Link2,
  Lock,
  Copy,
  Share2,
  CheckCircle2,
  Loader2,
  User,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import {
  User as FirebaseUser,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, firestore } from '../lib/firebase';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import {
  buildUsernameUrl,
  buildSimpleDisplayUrl,
  copyRelateUrlToClipboard,
  shareViaNativeSheet,
  updateUserUsername,
  ensureUserRelateLink,
} from '../lib/relateLinkService';
import { isValidUsername, checkUsernameExists } from '../lib/generateUsername';

interface SettingsScreenProps {
  user: FirebaseUser;
  onBack: () => void;
  onSignOut: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenAdminReports?: () => void;
  onOpenAdminRequests?: () => void;
}

type VisibilitySetting = 'public' | 'followers' | 'private';

interface UserSettingsState {
  theme: ThemePreference;
  brightness: number;
  privacy: {
    profileVisibility: VisibilitySetting;
    postVisibility: VisibilitySetting;
    relateVisibility: VisibilitySetting;
    showOnlineActivity: boolean;
  };
  notifications: {
    messages: boolean;
    relateActivity: boolean;
    securityAlerts: boolean;
    appUpdates: boolean;
  };
}

const DEFAULT_SETTINGS: UserSettingsState = {
  theme: 'dark',
  brightness: 100,
  privacy: {
    profileVisibility: 'public',
    postVisibility: 'public',
    relateVisibility: 'public',
    showOnlineActivity: true,
  },
  notifications: {
    messages: true,
    relateActivity: true,
    securityAlerts: true,
    appUpdates: true,
  },
};

export default function SettingsScreen({
  user,
  onBack,
  onSignOut,
  onOpenAdminDashboard,
  onOpenAdminReports,
  onOpenAdminRequests,
}: SettingsScreenProps) {
  const { theme, setTheme, brightness, setBrightness } = useTheme();

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [settings, setSettings] = useState<UserSettingsState>({
    ...DEFAULT_SETTINGS,
    theme,
    brightness,
  });

  // Security Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeFeedback, setRevokeFeedback] = useState<string | null>(null);

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Hardware Permissions State
  const [cameraState, setCameraState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const [micState, setMicState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const [notifPermState, setNotifPermState] = useState<NotificationPermission>('default');
  const [permissionFeedback, setPermissionFeedback] = useState<string | null>(null);

  // Email verification feedback
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Username State & Customization (Allowed ONCE)
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [usernameChanged, setUsernameChanged] = useState<boolean>(false);
  const [editUsernameInput, setEditUsernameInput] = useState<string>('');
  const [usernameValidation, setUsernameValidation] = useState<{
    status: 'idle' | 'validating' | 'available' | 'taken' | 'invalid';
    message?: string;
  }>({ status: 'idle' });
  const [savingUsername, setSavingUsername] = useState<boolean>(false);
  const [usernameFeedback, setUsernameFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showConfirmUsernameModal, setShowConfirmUsernameModal] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  // Load Settings from Firestore
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        setLoading(true);
        const userRef = doc(firestore, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists() && isMounted) {
          const data = snap.data();

          // Load username info
          let uName = data.username;
          const uChanged = Boolean(data.username_changed || data.usernameChanged);

          if (!uName) {
            try {
              const ensured = await ensureUserRelateLink(
                user.uid,
                data.full_name || data.display_name || user.displayName || undefined
              );
              uName = ensured.username;
            } catch (uErr) {
              console.warn('ensureUserRelateLink in settings note:', uErr);
            }
          }

          setCurrentUsername(uName || '');
          setUsernameChanged(uChanged);
          setEditUsernameInput(uName || '');

          if (data.settings) {
            const loadedTheme = (data.settings.theme as ThemePreference) || theme;
            const loadedBrightness = typeof data.settings.brightness === 'number' ? data.settings.brightness : brightness;
            setSettings({
              theme: loadedTheme,
              brightness: loadedBrightness,
              privacy: {
                profileVisibility: data.settings.privacy?.profileVisibility || 'public',
                postVisibility: data.settings.privacy?.postVisibility || 'public',
                relateVisibility: data.settings.privacy?.relateVisibility || 'public',
                showOnlineActivity: data.settings.privacy?.showOnlineActivity ?? true,
              },
              notifications: {
                messages: data.settings.notifications?.messages ?? true,
                relateActivity: data.settings.notifications?.relateActivity ?? true,
                securityAlerts: true, // Always safeguarded
                appUpdates: data.settings.notifications?.appUpdates ?? true,
              },
            });

            if (loadedTheme !== theme) {
              setTheme(loadedTheme);
            }
            if (loadedBrightness !== brightness) {
              setBrightness(loadedBrightness);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user settings:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSettings();

    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermState(Notification.permission);
    }

    // Check camera and microphone permissions where available
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((res) => setCameraState(res.state as 'granted' | 'prompt' | 'denied'))
        .catch(() => setCameraState('unknown'));

      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((res) => setMicState(res.state as 'granted' | 'prompt' | 'denied'))
        .catch(() => setMicState('unknown'));
    }

    return () => {
      isMounted = false;
    };
  }, [user.uid]);

  // Persist updated settings to Firestore
  const saveSettingsToBackend = useCallback(
    async (newSettings: UserSettingsState) => {
      setSavingStatus('saving');
      try {
        const userRef = doc(firestore, 'users', user.uid);
        await setDoc(
          userRef,
          {
            settings: {
              ...newSettings,
              updatedAt: new Date().toISOString(),
            },
          },
          { merge: true }
        );
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus('idle'), 2000);
      } catch (error) {
        setSavingStatus('error');
        setTimeout(() => setSavingStatus('idle'), 3000);
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [user.uid]
  );

  // Debounced real-time validation of editUsernameInput
  useEffect(() => {
    if (!editUsernameInput || editUsernameInput === currentUsername) {
      setUsernameValidation({ status: 'idle' });
      return;
    }

    const clean = editUsernameInput.trim().toLowerCase();
    const format = isValidUsername(clean);
    if (!format.valid) {
      setUsernameValidation({
        status: 'invalid',
        message: format.error || 'Must be 3-15 chars, lowercase letters, numbers, or underscores.',
      });
      return;
    }

    setUsernameValidation({
      status: 'validating',
      message: 'Checking username availability...',
    });

    const timer = setTimeout(async () => {
      try {
        const taken = await checkUsernameExists(clean, user.uid);
        if (taken) {
          setUsernameValidation({
            status: 'taken',
            message: `@${clean} is already taken. Please choose another.`,
          });
        } else {
          setUsernameValidation({
            status: 'available',
            message: `@${clean} is available!`,
          });
        }
      } catch {
        setUsernameValidation({
          status: 'invalid',
          message: 'Unable to check availability.',
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [editUsernameInput, currentUsername, user.uid]);

  const handleUsernameInputChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15);
    setEditUsernameInput(sanitized);
    setUsernameFeedback(null);
  };

  const handleConfirmSaveUsername = async () => {
    if (usernameChanged) return;
    const clean = editUsernameInput.trim().toLowerCase();
    if (!clean || clean === currentUsername) return;
    if (usernameValidation.status !== 'available') return;

    setSavingUsername(true);
    setUsernameFeedback(null);

    try {
      const res = await updateUserUsername(user.uid, clean, user.displayName || undefined);
      if (res.success) {
        setCurrentUsername(clean);
        setUsernameChanged(true);
        setShowConfirmUsernameModal(false);
        setUsernameFeedback({
          type: 'success',
          message: `Username updated to @${clean}! Your link is https://tezocron.com/@${clean}`,
        });
      } else {
        setUsernameFeedback({
          type: 'error',
          message: res.error || 'Failed to update username.',
        });
        setShowConfirmUsernameModal(false);
      }
    } catch {
      setUsernameFeedback({
        type: 'error',
        message: 'An error occurred while saving your username.',
      });
      setShowConfirmUsernameModal(false);
    } finally {
      setSavingUsername(false);
    }
  };

  const handleCopyProfileLink = async () => {
    const url = buildUsernameUrl(currentUsername || 'user');
    const ok = await copyRelateUrlToClipboard(url);
    if (ok) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  const handleShareProfileLink = async () => {
    const url = buildUsernameUrl(currentUsername || 'user');
    await shareViaNativeSheet(url, user.displayName || 'TEZOCRON Member', currentUsername);
  };

  // 1. APPEARANCE HANDLER
  const handleThemeChange = (newTheme: ThemePreference) => {
    setTheme(newTheme);
    const updated = { ...settings, theme: newTheme };
    setSettings(updated);
    saveSettingsToBackend(updated);
  };

  const handleBrightnessChange = (newBrightness: number) => {
    setBrightness(newBrightness);
    const updated = { ...settings, brightness: newBrightness };
    setSettings(updated);
    saveSettingsToBackend(updated);
  };

  // 2. PRIVACY HANDLERS
  const handlePrivacyChange = <K extends keyof UserSettingsState['privacy']>(
    key: K,
    value: UserSettingsState['privacy'][K]
  ) => {
    const updated = {
      ...settings,
      privacy: {
        ...settings.privacy,
        [key]: value,
      },
    };
    setSettings(updated);
    saveSettingsToBackend(updated);
  };

  // 3. NOTIFICATION HANDLERS
  const handleNotificationChange = (key: keyof UserSettingsState['notifications'], value: boolean) => {
    // Security notifications cannot be disabled
    if (key === 'securityAlerts' && !value) return;

    // If enabling and browser permissions are default, prompt for permission
    if (value && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        setNotifPermState(perm);
      });
    }

    const updated = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    };
    setSettings(updated);
    saveSettingsToBackend(updated);
  };

  // 4. SECURITY & ACCOUNT ACTIONS
  const isGoogleUser = user.providerData.some((p) => p.providerId === 'google.com');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'Passwords do not match. Please re-enter.' });
      return;
    }

    if (!user.email) {
      setPasswordFeedback({ type: 'error', message: 'User account email is unavailable.' });
      return;
    }

    setPasswordLoading(true);

    try {
      if (currentPassword) {
        const cred = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, cred);
      }

      await updatePassword(user, newPassword);
      setPasswordFeedback({ type: 'success', message: 'Your password has been securely updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'auth/wrong-password' || errObj.code === 'auth/invalid-credential') {
        setPasswordFeedback({ type: 'error', message: 'Current password entered is incorrect.' });
      } else if (errObj.code === 'auth/requires-recent-login') {
        setPasswordFeedback({ type: 'error', message: 'For security, please sign out and sign in again before changing password.' });
      } else {
        setPasswordFeedback({ type: 'error', message: 'Unable to update password. Please try again or request a reset link.' });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user.email) return;
    setPasswordLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setPasswordFeedback({ type: 'success', message: `Password reset instructions have been sent to ${user.email}.` });
    } catch {
      setPasswordFeedback({ type: 'error', message: 'Unable to dispatch reset email. Please try again shortly.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    setVerificationFeedback(null);
    try {
      await sendEmailVerification(user);
      setVerificationFeedback(`Verification link dispatched to ${user.email}. Check your inbox.`);
    } catch {
      setVerificationFeedback('Unable to send verification email. Please try again later.');
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokeFeedback(null);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await setDoc(
        userRef,
        {
          settings: {
            sessionVersion: Date.now(),
            revokedAt: new Date().toISOString(),
          },
        },
        { merge: true }
      );
      setRevokeFeedback('All other active device sessions have been invalidated.');
      setTimeout(() => {
        setShowRevokeModal(false);
        setRevokeFeedback(null);
      }, 2500);
    } catch {
      setRevokeFeedback('Failed to invalidate sessions. Please check your connection.');
    }
  };

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    try {
      await signOut(auth);
      onSignOut();
    } catch {
      onSignOut();
    }
  };

  // 5. DATA & PERMISSIONS ACTIONS
  const requestCameraPermission = async () => {
    setPermissionFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraState('granted');
      setPermissionFeedback('Camera access granted successfully for live streaming.');
    } catch {
      setCameraState('denied');
      setPermissionFeedback('Camera permission was not granted or was denied by your device.');
    }
  };

  const requestMicPermission = async () => {
    setPermissionFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicState('granted');
      setPermissionFeedback('Microphone access granted successfully.');
    } catch {
      setMicState('denied');
      setPermissionFeedback('Microphone permission was not granted or was denied by your device.');
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermState(perm);
      if (perm === 'granted') {
        setPermissionFeedback('Push notifications enabled for your device.');
      } else {
        setPermissionFeedback('Notifications are restricted by your browser settings.');
      }
    } catch {
      setPermissionFeedback('Unable to request notifications permission on this device.');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      setDeleteError('Please type "DELETE" exactly to confirm.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      // 1. Delete Firestore user document
      const userRef = doc(firestore, 'users', user.uid);
      await deleteDoc(userRef);

      // 2. Delete Auth user account
      await deleteUser(user);

      // 3. Complete sign-out
      onSignOut();
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'auth/requires-recent-login') {
        setDeleteError('For your security, account deletion requires a recent sign-in. Please sign out, log back in, and try again.');
      } else {
        setDeleteError('An error occurred while deleting your account. Please try again.');
      }
      setDeleteLoading(false);
    }
  };

  const creationDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  const lastLoginDate = user.metadata.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recent';

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-950 text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Ambient background accents */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl" />

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/80 px-4 py-3.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              aria-label="Go Back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Settings className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">Settings</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Real-time saving feedback */}
            {savingStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                Saving...
              </span>
            )}
            {savingStatus === 'saved' && (
              <span className="flex items-center gap-1 text-[11px] text-green-400 font-medium">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
            {savingStatus === 'error' && (
              <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
                <AlertTriangle className="h-3 w-3" />
                Unable to save
              </span>
            )}

            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-sm">
              <img
                src="/tezocron_logo.svg"
                alt="TEZOCRON EXTENDED"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Settings Container */}
      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {loading ? (
          <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Loading Settings...
            </p>
          </div>
        ) : (
          <>
            {/* ========================================================
                1. APPEARANCE — DARK / LIGHT MODE
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Sun className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Appearance</h2>
                  <p className="text-[11px] text-slate-400">Choose your preferred interface theme</p>
                </div>
              </div>

              {/* Real 3-Option Segment Selector */}
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
                {/* Dark Mode */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-xs font-semibold transition-all ${
                    settings.theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark Mode</span>
                </button>

                {/* Light Mode */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-xs font-semibold transition-all ${
                    settings.theme === 'light'
                      ? 'bg-gradient-to-r from-pink-600 to-pink-500 text-white shadow-md shadow-pink-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  <span>Light Mode</span>
                </button>

                {/* Follow System */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-xs font-semibold transition-all ${
                    settings.theme === 'system'
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-pink-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>System</span>
                </button>
              </div>

              {/* Display Brightness Setting */}
              <div className="mt-5 space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-semibold text-white">Display Brightness</span>
                      <p className="text-[10px] text-slate-400">Applies to all buttons, divs, spans, and messaging</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-pink-400 bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                    {settings.brightness ?? 100}%
                  </span>
                </div>

                {/* Slider */}
                <div className="flex items-center gap-3">
                  <Sun className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="40"
                    max="160"
                    step="5"
                    value={settings.brightness ?? 100}
                    onChange={(e) => handleBrightnessChange(Number(e.target.value))}
                    className="w-full h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-pink-500"
                  />
                  <Sun className="h-5 w-5 text-amber-300 shrink-0" />
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { label: 'Dim', val: 60 },
                    { label: 'Medium', val: 85 },
                    { label: 'Normal', val: 100 },
                    { label: 'Bright', val: 130 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleBrightnessChange(preset.val)}
                      className={`rounded-xl py-1.5 px-2 text-[11px] font-semibold transition-all ${
                        (settings.brightness ?? 100) === preset.val
                          ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300 font-bold'
                          : 'border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ========================================================
                USERNAME & PUBLIC RELATE LINK (EDITABLE ONCE)
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">Username & Relate Link</h2>
                    <p className="text-[11px] text-slate-400">Your unique public handle and shareable URL</p>
                  </div>
                </div>

                {usernameChanged ? (
                  <span className="flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-pink-300">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                ) : (
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">
                    Editable Once
                  </span>
                )}
              </div>

              {usernameFeedback && (
                <div
                  className={`mb-4 flex items-start gap-2.5 rounded-2xl p-3.5 text-xs border ${
                    usernameFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {usernameFeedback.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                  )}
                  <span>{usernameFeedback.message}</span>
                </div>
              )}

              {/* Public Link Card Preview */}
              <div className="rounded-2xl border border-white/5 bg-white/5 p-3.5 mb-4">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Your Public Link</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-mono text-xs font-semibold text-pink-300">
                      tezocron.com/@{currentUsername || 'user'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyProfileLink}
                      className="flex items-center gap-1 rounded-xl bg-pink-500/20 border border-pink-500/30 px-2.5 py-1 text-[11px] font-bold text-pink-300 hover:bg-pink-500/30 active:scale-95 transition-all"
                    >
                      {linkCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{linkCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareProfileLink}
                      className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/10 active:scale-95 transition-all"
                    >
                      <Share2 className="h-3 w-3 text-pink-400" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Username Input or Locked State */}
              {usernameChanged ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 text-[11px]">Current Handle</span>
                      <p className="font-mono text-sm font-bold text-white">@{currentUsername}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>Permanent Handle</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                    You have already customized your username once. For account security and URL stability, usernames can only be changed one time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Choose Your Custom Username
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">
                      You can edit your username <span className="font-bold text-pink-400">ONCE</span>. 3-15 lowercase letters, numbers, or underscores.
                    </p>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 font-mono text-sm font-bold text-pink-400 select-none">
                        @
                      </span>
                      <input
                        type="text"
                        value={editUsernameInput}
                        onChange={(e) => handleUsernameInputChange(e.target.value)}
                        placeholder="your_username"
                        maxLength={15}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 py-2.5 pl-8 pr-10 font-mono text-sm text-white placeholder-slate-500 outline-none focus:border-pink-500 focus:bg-white/10 focus:ring-2 focus:ring-pink-500/20"
                      />

                      {/* Status indicator icon inside input */}
                      <div className="absolute right-3 top-3">
                        {usernameValidation.status === 'validating' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        )}
                        {usernameValidation.status === 'available' && (
                          <Check className="h-4 w-4 text-emerald-400 stroke-[2.5]" />
                        )}
                        {(usernameValidation.status === 'taken' || usernameValidation.status === 'invalid') && (
                          <AlertTriangle className="h-4 w-4 text-pink-400" />
                        )}
                      </div>
                    </div>

                    {/* Validation Message */}
                    {usernameValidation.message && (
                      <p
                        className={`mt-1.5 text-[11px] font-medium ${
                          usernameValidation.status === 'available'
                            ? 'text-emerald-400'
                            : usernameValidation.status === 'validating'
                            ? 'text-blue-400'
                            : 'text-pink-400'
                        }`}
                      >
                        {usernameValidation.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={
                        usernameValidation.status !== 'available' ||
                        editUsernameInput === currentUsername ||
                        savingUsername
                      }
                      onClick={() => setShowConfirmUsernameModal(true)}
                      className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-pink-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {savingUsername ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Save Username (Once)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ========================================================
                2. PRIVACY SETTINGS
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Privacy Settings</h2>
                  <p className="text-[11px] text-slate-400">Control account visibility and data protections</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* Profile Visibility */}
                <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">Profile Visibility</span>
                      <p className="text-[11px] text-slate-400">Who can view your account profile</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {(['public', 'followers', 'private'] as VisibilitySetting[]).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePrivacyChange('profileVisibility', val)}
                        className={`rounded-xl py-2 px-2 text-[11px] font-semibold capitalize transition-all ${
                          settings.privacy.profileVisibility === val
                            ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                            : 'border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Post Visibility */}
                <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">Post Visibility</span>
                      <p className="text-[11px] text-slate-400">Who can see your posts and media uploads</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {(['public', 'followers', 'private'] as VisibilitySetting[]).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePrivacyChange('postVisibility', val)}
                        className={`rounded-xl py-2 px-2 text-[11px] font-semibold capitalize transition-all ${
                          settings.privacy.postVisibility === val
                            ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                            : 'border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Relate Visibility */}
                <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">Relate Visibility</span>
                      <p className="text-[11px] text-slate-400">Who can discover and match with you in Relate</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {(['public', 'followers', 'private'] as VisibilitySetting[]).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePrivacyChange('relateVisibility', val)}
                        className={`rounded-xl py-2 px-2 text-[11px] font-semibold capitalize transition-all ${
                          settings.privacy.relateVisibility === val
                            ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300'
                            : 'border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activity & Online Status Toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 mt-0.5">
                      <Eye className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white">Online Activity Status</span>
                      <p className="text-[11px] text-slate-400">Let others see when you are active on the app</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handlePrivacyChange('showOnlineActivity', !settings.privacy.showOnlineActivity)
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.privacy.showOnlineActivity ? 'bg-pink-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.privacy.showOnlineActivity ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* ========================================================
                3. NOTIFICATION SETTINGS
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Notification Settings</h2>
                  <p className="text-[11px] text-slate-400">Manage real-time alerts and delivered notifications</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {/* Direct Messages */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div>
                    <span className="font-semibold text-white">Direct Messages</span>
                    <p className="text-[11px] text-slate-400">Alerts when someone sends you a message</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleNotificationChange('messages', !settings.notifications.messages)
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.notifications.messages ? 'bg-pink-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.notifications.messages ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Relate Activity */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div>
                    <span className="font-semibold text-white">Relate Activity</span>
                    <p className="text-[11px] text-slate-400">New matches, profile reactions, and mentions</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleNotificationChange('relateActivity', !settings.notifications.relateActivity)
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.notifications.relateActivity ? 'bg-pink-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.notifications.relateActivity ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Account & Security Alerts */}
                <div className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white">Account & Security Alerts</span>
                      <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                        Always On
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Login alerts and password updates required to protect your account
                    </p>
                  </div>
                  <div className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-blue-600 opacity-90">
                    <span className="inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0" />
                  </div>
                </div>

                {/* App Announcements */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div>
                    <span className="font-semibold text-white">App Updates & News</span>
                    <p className="text-[11px] text-slate-400">New feature releases and platform highlights</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleNotificationChange('appUpdates', !settings.notifications.appUpdates)
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.notifications.appUpdates ? 'bg-pink-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.notifications.appUpdates ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* ========================================================
                4. SECURITY & ACCOUNT
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <KeyRound className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Security & Account</h2>
                  <p className="text-[11px] text-slate-400">Authentication, password, and session controls</p>
                </div>
              </div>

              {/* Account Details Card */}
              <div className="mb-4 rounded-2xl border border-white/5 bg-white/5 p-4 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    <span>Account Email</span>
                  </div>
                  <span className="font-mono text-white text-[11px]">{user.email}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Shield className="h-3.5 w-3.5 text-pink-400" />
                    <span>Email Verification</span>
                  </div>
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-400">
                      <Check className="h-3 w-3" /> Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendVerificationEmail}
                      className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 underline"
                    >
                      Send Verification Link
                    </button>
                  )}
                </div>

                {verificationFeedback && (
                  <p className="text-[11px] text-pink-300 bg-pink-500/10 p-2 rounded-lg border border-pink-500/20">
                    {verificationFeedback}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Member Since</span>
                  </div>
                  <span className="text-slate-300 text-[11px]">{creationDate}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Last Sign In</span>
                  </div>
                  <span className="text-slate-300 text-[11px]">{lastLoginDate}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {/* Change Password Button */}
                <button
                  type="button"
                  onClick={() => {
                    setPasswordFeedback(null);
                    setShowPasswordModal(true);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="h-4 w-4 text-blue-400" />
                    <span>Change Password</span>
                  </div>
                  <span className="text-[11px] text-blue-400 font-medium">Update &rarr;</span>
                </button>

                {/* Sign Out of Other Sessions */}
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(true)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="h-4 w-4 text-pink-400" />
                    <span>Sign Out of Other Devices</span>
                  </div>
                  <span className="text-[11px] text-pink-400 font-medium">Revoke &rarr;</span>
                </button>

                {/* Admin Moderation Reports (/admin/reports) */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAdminReports) {
                      onOpenAdminReports();
                    } else {
                      window.history.pushState({}, '', '/admin/reports');
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-pink-500/30 bg-pink-500/10 p-3.5 text-xs font-semibold text-white transition-all hover:bg-pink-500/20 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="h-4 w-4 text-pink-400" />
                    <div className="text-left">
                      <p className="font-bold text-white">Admin Moderation Reports</p>
                      <p className="text-[10px] text-pink-300 font-mono">/admin/reports • RTDB asia-southeast1</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-pink-400 font-bold">Open &rarr;</span>
                </button>

                {/* Admin User Requests Inbox (/admin/requests) */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAdminRequests) {
                      onOpenAdminRequests();
                    } else {
                      window.history.pushState({}, '', '/admin/requests');
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs font-semibold text-white transition-all hover:bg-blue-500/20 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5">
                    <Inbox className="h-4 w-4 text-blue-400" />
                    <div className="text-left">
                      <p className="font-bold text-white">Inbox — User Requests</p>
                      <p className="text-[10px] text-blue-300 font-mono">/admin/requests</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-blue-400 font-bold">Open &rarr;</span>
                </button>

                {/* Main Sign Out Button */}
                <button
                  type="button"
                  onClick={() => setShowSignOutModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-500/30 bg-pink-500/10 py-3 text-xs font-bold text-pink-300 transition-all hover:bg-pink-500/20 hover:text-white active:scale-95"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </section>

            {/* ========================================================
                5. DATA & PERMISSIONS
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Data & Permissions</h2>
                  <p className="text-[11px] text-slate-400">Hardware device access and account data deletion</p>
                </div>
              </div>

              {permissionFeedback && (
                <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                  {permissionFeedback}
                </div>
              )}

              {/* Permissions List */}
              <div className="space-y-3 text-xs">
                {/* Camera Permission */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                      <Camera className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white">Camera Access</span>
                      <p className="text-[11px] text-slate-400">Used for broadcasting live in Go Live</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestCameraPermission}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      cameraState === 'granted'
                        ? 'bg-green-500/20 border border-green-500/40 text-green-300'
                        : 'bg-white/10 border border-white/10 text-slate-200 hover:bg-white/15'
                    }`}
                  >
                    {cameraState === 'granted' ? 'Granted' : 'Grant Permission'}
                  </button>
                </div>

                {/* Microphone Permission */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                      <Mic className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white">Microphone Access</span>
                      <p className="text-[11px] text-slate-400">Used for live audio streaming and voice notes</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestMicPermission}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      micState === 'granted'
                        ? 'bg-green-500/20 border border-green-500/40 text-green-300'
                        : 'bg-white/10 border border-white/10 text-slate-200 hover:bg-white/15'
                    }`}
                  >
                    {micState === 'granted' ? 'Granted' : 'Grant Permission'}
                  </button>
                </div>

                {/* Browser Notifications Permission */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 mt-0.5">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white">Device Notifications</span>
                      <p className="text-[11px] text-slate-400">Used for real-time messages & alerts</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      notifPermState === 'granted'
                        ? 'bg-green-500/20 border border-green-500/40 text-green-300'
                        : notifPermState === 'denied'
                        ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                        : 'bg-white/10 border border-white/10 text-slate-200 hover:bg-white/15'
                    }`}
                  >
                    {notifPermState === 'granted'
                      ? 'Granted'
                      : notifPermState === 'denied'
                      ? 'Blocked'
                      : 'Grant Permission'}
                  </button>
                </div>

                {/* ========================================================
                    ADMINISTRATOR ACCESS (connectjhv247@gmail.com only)
                ======================================================== */}
                {user.email?.trim().toLowerCase() === 'connectjhv247@gmail.com' && onOpenAdminDashboard && (
                  <div className="mt-6 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/30 via-slate-900/80 to-slate-900/90 p-4 text-xs shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-xs">Administrator Console</h3>
                          <p className="text-[10px] text-slate-300">Authorized SuperAdmin Controls</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[9px] font-bold text-blue-300">
                        Verified Admin
                      </span>
                    </div>

                    <p className="text-slate-300 text-[11px] leading-relaxed mb-3">
                      Review community safety reports, user requests inbox, and manage platform controls in the secure Admin Dashboard.
                    </p>

                    <button
                      type="button"
                      onClick={onOpenAdminDashboard}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.01] active:scale-95"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Open Admin Dashboard (/admin-dashboard)</span>
                    </button>
                  </div>
                )}

                {/* Account Deletion Section */}
                <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-xs">
                  <div className="flex items-center gap-2 text-red-400 font-bold mb-1">
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Account & Data</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed mb-3">
                    Permanently delete your profile, role, stored preferences, and personal data from TEZOCRON EXTENDED. This action is irreversible.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteConfirmationText('');
                      setShowDeleteAccountModal(true);
                    }}
                    className="rounded-xl border border-red-500/40 bg-red-500/20 px-3.5 py-2 text-xs font-bold text-red-200 transition-all hover:bg-red-500/30 hover:text-white active:scale-95"
                  >
                    Permanently Delete Account
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* ========================================================
          MODALS
      ======================================================== */}

      {/* 1. CHANGE PASSWORD MODAL */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Change Password</h3>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
              </div>

              {isGoogleUser ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-slate-200 leading-relaxed">
                    <p className="font-semibold text-blue-300 mb-1">Google Authentication</p>
                    Your account is securely managed via Google. Password updates are handled directly through your Google Account security center.
                  </div>

                  <p className="text-xs text-slate-400">
                    Alternatively, you can request an official password reset link dispatched to your verified email:
                  </p>

                  <button
                    type="button"
                    disabled={passwordLoading}
                    onClick={handleSendResetEmail}
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                  >
                    {passwordLoading ? 'Sending...' : 'Send Password Reset Email'}
                  </button>

                  {passwordFeedback && (
                    <p
                      className={`text-xs p-3 rounded-xl border ${
                        passwordFeedback.type === 'success'
                          ? 'bg-green-500/10 border-green-500/30 text-green-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-300'
                      }`}
                    >
                      {passwordFeedback.message}
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="mt-4 space-y-3.5 text-xs">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-white placeholder-slate-500 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-white placeholder-slate-500 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-white placeholder-slate-500 outline-none focus:border-blue-500"
                    />
                  </div>

                  {passwordFeedback && (
                    <p
                      className={`text-xs p-3 rounded-xl border ${
                        passwordFeedback.type === 'success'
                          ? 'bg-green-500/10 border-green-500/30 text-green-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-300'
                      }`}
                    >
                      {passwordFeedback.message}
                    </p>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-slate-300 hover:text-white"
                    >
                      Email Reset Link
                    </button>
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="flex-1 rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 py-2.5 font-bold text-white shadow-lg shadow-pink-500/20 active:scale-95 disabled:opacity-50"
                    >
                      {passwordLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. SIGN OUT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showSignOutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-center shadow-2xl backdrop-blur-2xl"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                <LogOut className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Sign Out</h3>
              <p className="mt-1.5 text-xs text-slate-400">
                Are you sure you want to end your current session?
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 py-3 px-4 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex-1 rounded-full bg-gradient-to-r from-pink-600 to-pink-500 py-3 px-4 text-xs font-bold text-white shadow-lg shadow-pink-500/20 active:scale-95"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. REVOKE OTHER SESSIONS MODAL */}
      <AnimatePresence>
        {showRevokeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-center shadow-2xl backdrop-blur-2xl"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">Sign Out of Other Devices</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                This will end active sessions across other browsers and devices. Your current device will remain logged in.
              </p>

              {revokeFeedback && (
                <p className="mt-3 text-xs text-blue-300 bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20">
                  {revokeFeedback}
                </p>
              )}

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 py-3 px-4 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  className="flex-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 px-4 text-xs font-bold text-white shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  Revoke Others
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. PERMANENT ACCOUNT DELETION MODAL */}
      <AnimatePresence>
        {showDeleteAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="relative w-full max-w-md rounded-3xl border border-red-500/30 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl text-left"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Delete Account & Data</h3>
                  <p className="text-xs text-red-400">Permanent and irreversible</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-slate-200 leading-relaxed space-y-2">
                <p>
                  This action will immediately delete your TEZOCRON EXTENDED user profile, play role, custom preferences, and associated data from our servers.
                </p>
                <p className="font-semibold text-red-300">
                  To confirm, type <span className="font-mono underline">DELETE</span> below:
                </p>
              </div>

              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="mt-3 w-full rounded-xl border border-red-500/30 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 font-mono uppercase"
              />

              {deleteError && (
                <p className="mt-2 text-xs text-red-300 bg-red-500/10 p-2.5 rounded-xl border border-red-500/30">
                  {deleteError}
                </p>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setShowDeleteAccountModal(false)}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 py-3 px-4 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLoading || deleteConfirmationText !== 'DELETE'}
                  onClick={handleDeleteAccount}
                  className="flex-1 rounded-full bg-gradient-to-r from-red-600 to-red-500 py-3 px-4 text-xs font-bold text-white shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Confirm Deletion'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM USERNAME CHANGE MODAL */}
      <AnimatePresence>
        {showConfirmUsernameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="relative w-full max-w-md rounded-3xl border border-pink-500/30 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Confirm Username Change</h3>
                  <p className="text-[11px] text-pink-300">This action can only be completed ONCE</p>
                </div>
              </div>

              <div className="rounded-2xl border border-pink-500/20 bg-pink-500/10 p-3.5 text-xs text-slate-200 mb-4 leading-relaxed">
                Are you sure you want to change your username to <span className="font-mono font-bold text-pink-300">@{editUsernameInput}</span>?
                <br /><br />
                Your new permanent profile link will be:
                <br />
                <span className="font-mono font-bold text-white text-[11px] block mt-1">
                  https://tezocron.com/@{editUsernameInput}
                </span>
                <br />
                <span className="text-pink-300 font-semibold">Note: You will NOT be able to change this username again.</span>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={savingUsername}
                  onClick={() => setShowConfirmUsernameModal(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingUsername}
                  onClick={handleConfirmSaveUsername}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {savingUsername ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Confirm & Lock Handle'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
