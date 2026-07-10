import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log("Starting deletion of all players and registrations...");

  // 1. Delete all playerProfiles
  const profileSnap = await getDocs(collection(db, 'playerProfiles'));
  console.log(`Found ${profileSnap.size} player profiles to delete.`);
  for (const document of profileSnap.docs) {
    await deleteDoc(doc(db, 'playerProfiles', document.id));
    console.log(`Deleted playerProfile: ${document.id}`);
  }

  // 2. Delete all registrations
  const regSnap = await getDocs(collection(db, 'registrations'));
  console.log(`Found ${regSnap.size} registrations to delete.`);
  for (const document of regSnap.docs) {
    await deleteDoc(doc(db, 'registrations', document.id));
    console.log(`Deleted registration: ${document.id}`);
  }

  console.log("All players and registrations successfully deleted!");
}

run().catch(console.error);
