import { firebaseApp } from './firebase';
import { AGORA_APP_ID, AgoraRTC } from './agora';
import { runUsersMigration } from './migrationService';

export async function initServices() {
  const firebaseOk = Boolean(firebaseApp && firebaseApp.name);
  const agoraOk = Boolean(AgoraRTC && AGORA_APP_ID);

  if (firebaseOk && agoraOk) {
    console.log("Firebase OK, Agora SDK Ready");
  } else {
    console.warn("Service initialization status:", { firebaseOk, agoraOk });
  }

  // Run username migration check
  runUsersMigration().catch((err) => console.warn('Migration run notice:', err));
}
