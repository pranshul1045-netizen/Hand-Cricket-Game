import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const matchesSnap = await getDocs(collection(db, 'schoolMatches'));
  console.log(`--- SCHOOL MATCHES (${matchesSnap.size}) ---`);
  matchesSnap.forEach(doc => {
    console.log(`ID: ${doc.id} =>`, doc.data());
  });
}

run().catch(console.error);
