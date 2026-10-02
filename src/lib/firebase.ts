import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Log databaseURL to verify as requested
console.log("DB URL:", import.meta.env.VITE_FIREBASE_DATABASE_URL);

const databaseURL =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  'https://tezocron-extended-v2-default-rtdb.asia-southeast1.firebasedatabase.app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  databaseURL,
};

// Initialize Firebase App
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const app = firebaseApp;

// Initialize Realtime Database with app and explicit asia-southeast1 URL
export const rtdb = getDatabase(app, databaseURL);
export const realtimeDb = rtdb;

// Initialize Auth service
export const auth = getAuth(firebaseApp);

// Initialize Firestore with long-polling fallback and persistent cache for iframe resilience
const dbId = firebaseConfigJson.firestoreDatabaseId;

function initFirestoreInstance() {
  try {
    const firestoreDbOptions = {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    };
    return dbId && dbId !== '(default)'
      ? initializeFirestore(firebaseApp, firestoreDbOptions, dbId)
      : initializeFirestore(firebaseApp, firestoreDbOptions);
  } catch {
    return dbId && dbId !== '(default)'
      ? getFirestore(firebaseApp, dbId)
      : getFirestore(firebaseApp);
  }
}

export const firestore = initFirestoreInstance();

// Standard db export for Firestore collection queries
export const db = firestore;

export const storage = getStorage(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
