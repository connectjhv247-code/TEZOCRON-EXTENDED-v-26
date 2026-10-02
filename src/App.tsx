import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import SplashScreen from './components/SplashScreen';
import AuthScreen from './components/AuthScreen';
import RoleSelectionScreen from './components/RoleSelectionScreen';
import CreateAccountScreen from './components/CreateAccountScreen';
import AuthenticatedScreen from './components/AuthenticatedScreen';
import { initServices } from './lib/initServices';
import { auth, firestore, firebaseApp } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { initUserPresence } from './lib/firebase-realtime';
import {
  detectRelateIdFromLocation,
  resolveRelateLink,
  savePendingRelateTarget,
} from './lib/relateLinkService';
import { migrateCurrentUser } from './lib/migrationService';

type Screen = 'splash' | 'auth' | 'role-selection' | 'create-account' | 'authenticated';

// Enable Firebase Push Notification
async function enablePush(currentUser?: FirebaseUser | null) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const supported = await isSupported().catch(() => false);
      if (!supported) {
        console.warn('[FCM] Push messaging is not supported in this browser environment.');
        return;
      }

      // Register background service worker if supported
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
          console.warn('Service worker registration note:', err);
        });
      }

      const messaging = getMessaging(firebaseApp);
      const token = await getToken(messaging, {
        vapidKey: 'BHGOBqfOs1m0YSq9RoRF0ppp-JZ5v_zzG_MbxhmvJkBGJ5akremQFL6ecQIhT4izjamNYOpx2O5RigwpestODtg',
      });
      console.log('FCM Token:', token);

      const activeUser = currentUser || auth.currentUser;
      if (activeUser && token) {
        const userId = activeUser.uid;
        // Persist token in Firestore user document
        try {
          const userDocRef = doc(firestore, 'users', userId);
          await setDoc(userDocRef, { fcm_token: token }, { merge: true });
        } catch (e) {
          console.warn('Firestore profile update warning:', e);
        }
      }

      // Listen for foreground messages
      onMessage(messaging, (payload) => {
        console.log('[FCM Foreground Message]:', payload);
        if (payload.notification?.title) {
          new Notification(payload.notification.title, {
            body: payload.notification?.body,
            icon: payload.notification?.icon || '/tezocron_logo.svg',
          });
        }
      });
    }
  } catch (error) {
    console.warn('enablePush execution notice:', error);
  }
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [initializing, setInitializing] = useState(true);
  const [registrationCompleted, setRegistrationCompleted] = useState(false);
  const [pendingTargetUserId, setPendingTargetUserId] = useState<string | undefined>(undefined);
  const [pendingIsFromRelateLink, setPendingIsFromRelateLink] = useState<boolean>(false);

  // Check for incoming Relate Link on startup
  useEffect(() => {
    const detectedId = detectRelateIdFromLocation();
    if (detectedId) {
      savePendingRelateTarget(detectedId);
      resolveRelateLink(detectedId).then((res) => {
        if (res) {
          setPendingTargetUserId(res.userId);
          setPendingIsFromRelateLink(true);
          // Seamless backward-compatible redirect from /relate/tz_... to /@username
          if (res.wasLegacyRelateId && res.username) {
            window.history.replaceState({}, '', `/@${res.username}`);
          }
        }
      });
      // Route straight to auth if not already navigating
      setCurrentScreen((prev) => (prev === 'splash' ? 'auth' : prev));
    }
  }, []);

  useEffect(() => {
    initServices();

    let cleanupPresence: (() => void) | null = null;

    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);

        // Run user migration to guarantee clean @username and relateUrl
        migrateCurrentUser(authUser).catch((mErr) => {
          console.warn('Migration check notice:', mErr);
        });

        // Initialize Firebase Realtime Online Presence
        if (cleanupPresence) cleanupPresence();
        cleanupPresence = initUserPresence(authUser.uid);

        // Call enablePush after user login
        enablePush(authUser);

        try {
          // Check Firestore user document to verify role and account registration completion
          const userDocRef = doc(firestore, 'users', authUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data();
            const savedRole = data.play_role || data.role;
            setSelectedRole(savedRole || 'Member');
            setRegistrationCompleted(true);
          } else {
            // Check if user account was created prior to this session
            const creationTime = authUser.metadata.creationTime;
            const lastSignInTime = authUser.metadata.lastSignInTime;
            const isExistingAuthUser =
              creationTime && lastSignInTime && creationTime !== lastSignInTime;

            if (isExistingAuthUser) {
              setRegistrationCompleted(true);
            } else {
              setRegistrationCompleted(false);
              setCurrentScreen((prev) =>
                prev === 'splash' || prev === 'auth' ? 'role-selection' : prev
              );
            }
          }
        } catch (e) {
          console.warn('User profile check notice:', e);
          // Fallback to completed for existing authenticated user
          setRegistrationCompleted(true);
        }
      } else {
        if (cleanupPresence) {
          cleanupPresence();
          cleanupPresence = null;
        }
        setUser(null);
        setRegistrationCompleted(false);
      }
      setInitializing(false);
    });

    return () => {
      if (cleanupPresence) cleanupPresence();
      unsubscribe();
    };
  }, []);

  if (initializing) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 font-sans text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            TEZOCRON EXTENDED
          </p>
        </div>
      </div>
    );
  }

  // Active view routing
  const showAuthenticatedScreen = Boolean(user && registrationCompleted);

  return (
    <div className="min-h-screen w-full bg-slate-950 font-sans antialiased text-white selection:bg-pink-500 selection:text-white">
      <AnimatePresence mode="wait">
        {showAuthenticatedScreen && user ? (
          <motion.div
            key="authenticated"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <AuthenticatedScreen
              user={user}
              userRole={selectedRole}
              initialTargetProfileUserId={pendingTargetUserId}
              initialIsFromRelateLink={pendingIsFromRelateLink}
              onSignOut={() => {
                setUser(null);
                setRegistrationCompleted(false);
                setSelectedRole('');
                setPendingTargetUserId(undefined);
                setPendingIsFromRelateLink(false);
                setCurrentScreen('splash');
              }}
            />
          </motion.div>
        ) : currentScreen === 'splash' ? (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <SplashScreen onJoin={() => setCurrentScreen('auth')} />
          </motion.div>
        ) : currentScreen === 'auth' ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <AuthScreen
              onBack={() => setCurrentScreen('splash')}
              onContinue={() => {
                setRegistrationCompleted(false);
                setCurrentScreen('role-selection');
              }}
              onSuccess={() => {
                setRegistrationCompleted(true);
              }}
            />
          </motion.div>
        ) : currentScreen === 'role-selection' ? (
          <motion.div
            key="role-selection"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <RoleSelectionScreen
              onBack={() => setCurrentScreen('auth')}
              onContinue={(role) => {
                setSelectedRole(role);
                setCurrentScreen('create-account');
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="create-account"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <CreateAccountScreen
              selectedRole={selectedRole}
              googleUser={user}
              onBack={() => setCurrentScreen('role-selection')}
              onSuccess={() => {
                setRegistrationCompleted(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
