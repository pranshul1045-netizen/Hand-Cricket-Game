import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const regSnap = await getDocs(collection(db, 'registrations'));
  const regs: any[] = [];
  regSnap.forEach(doc => {
    regs.push({ id: doc.id, ...doc.data() });
  });

  const profileSnap = await getDocs(collection(db, 'playerProfiles'));
  const profiles: any[] = [];
  profileSnap.forEach(doc => {
    profiles.push({ id: doc.id, ...doc.data() });
  });

  fs.writeFileSync('current-db.json', JSON.stringify({ registrations: regs, playerProfiles: profiles }, null, 2), 'utf8');
  console.log('Saved to current-db.json');
}

run().catch(console.error);
