import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const KNOWN_USERS = [
  {
    userId: 'mynyLj29o4bw1fYMIguxqFRkasR2',
    displayName: 'Connect JHV247',
    username: 'connectjhv247',
    relateId: 'tz_3t8jrd8h',
  },
  {
    userId: 's9pzrHInRkXf2A36CRcLfJo2CMe2',
    displayName: 'rockey alott',
    username: 'rockeyalott',
    relateId: 'tz_4u9pbhy9',
  },
  {
    userId: 'RrLB2VisNlSHiRHyRwmkZNfil0g1',
    displayName: 'jaspiblack',
    username: 'jaspiblack',
    relateId: 'tz_tnfz4kbb',
  },
];

async function main() {
  console.log('========================================================');
  console.log('TEZOCRON EXTENDED — USERNAME SYSTEM MIGRATION SCRIPT');
  console.log('Database:', firebaseConfig.firestoreDatabaseId);
  console.log('========================================================');

  // Check relate_links collection
  try {
    const snap = await getDocs(collection(db, 'relate_links'));
    console.log(`Found ${snap.size} documents in relate_links collection:`);
    snap.forEach((d) => {
      console.log(` - ID: ${d.id}`, d.data());
    });
  } catch (err) {
    console.warn('relate_links check warning:', err);
  }

  // Attempt authentication if credentials provided
  const adminEmail = process.env.ADMIN_EMAIL || 'connectjhv247@gmail.com';
  const adminPass = process.env.ADMIN_PASSWORD;

  if (adminPass) {
    try {
      console.log(`Attempting sign-in for admin ${adminEmail}...`);
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);
      console.log('Authenticated successfully.');

      for (const u of KNOWN_USERS) {
        console.log(`Migrating user ${u.displayName} (@${u.username})...`);
        const userRef = doc(db, 'users', u.userId);
        const relateUrl = `https://tezocron.com/@${u.username}`;
        const now = new Date().toISOString();

        await setDoc(
          userRef,
          {
            username: u.username,
            relate_url: relateUrl,
            relate_id: u.relateId,
            updated_at: now,
          },
          { merge: true }
        );

        const linkRef = doc(db, 'relate_links', u.relateId);
        await setDoc(
          linkRef,
          {
            relateId: u.relateId,
            userId: u.userId,
            username: u.username,
            relateUrl,
            displayName: u.displayName,
          },
          { merge: true }
        );

        const usernameRef = doc(db, 'relate_links', u.username);
        await setDoc(
          usernameRef,
          {
            relateId: u.relateId,
            userId: u.userId,
            username: u.username,
            relateUrl,
            displayName: u.displayName,
            createdAt: now,
          },
          { merge: true }
        );
        console.log(`  ✓ Migrated @${u.username} -> ${relateUrl}`);
      }
    } catch (authErr) {
      console.warn('CLI Auth failed. Client-side auto-migration will run on user sign-in.', authErr);
    }
  } else {
    console.log('Note: To run CLI migration directly, pass ADMIN_PASSWORD. Otherwise, client-side auto-migration runs automatically on app boot / user login.');
  }

  console.log('Migration script complete.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
