import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const matchesSnap = await getDocs(collection(db, 'schoolMatches'));
  const matches: any[] = [];
  matchesSnap.forEach(doc => {
    matches.push({ id: doc.id, ...doc.data() });
  });

  const rbMatches = matches.filter(m => 
    m.player1.toLowerCase().includes('rb') || m.player2.toLowerCase().includes('rb')
  );

  console.log("RB MATCHES:");
  rbMatches.forEach(m => {
    console.log(`- Match ${m.id}: ${m.player1} (${m.player1Runs}) vs ${m.player2} (${m.player2Runs}) | Status: ${m.status} | Winner: ${m.winner}`);
  });
}

run().catch(console.error);
