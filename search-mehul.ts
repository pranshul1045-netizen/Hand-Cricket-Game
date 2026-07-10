import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'gameChallenges'));
  console.log(`--- MATCHING CHALLENGES FOR MEHUL ---`);
  snap.forEach(doc => {
    const data = doc.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('mehul')) {
      console.log(`ID: ${doc.id} =>`, data);
    }
  });
}

run().catch(console.error);
