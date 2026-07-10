import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const collections = ['playerProfiles', 'registrations', 'schoolMatches', 'digitalTournamentMatches', 'leagueUpdates', 'gameChallenges'];
  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    snap.forEach(doc => {
      const str = JSON.stringify(doc.data()).toLowerCase();
      if (str.includes('mehul') || str.includes('mathur')) {
        console.log(`FOUND in ${col} | ID: ${doc.id} =>`, doc.data());
      }
    });
  }
}

run().catch(console.error);
