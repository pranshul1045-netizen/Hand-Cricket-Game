import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const regSnap = await getDocs(collection(db, 'registrations'));
  console.log(`--- CURRENT REGISTRATIONS (${regSnap.size}) ---`);
  regSnap.forEach(doc => {
    console.log(`ID: ${doc.id} =>`, doc.data());
  });

  const profileSnap = await getDocs(collection(db, 'playerProfiles'));
  console.log(`\n--- CURRENT PLAYER PROFILES (${profileSnap.size}) ---`);
  profileSnap.forEach(doc => {
    console.log(`ID: ${doc.id} =>`, doc.data());
  });
}

run().catch(console.error);
