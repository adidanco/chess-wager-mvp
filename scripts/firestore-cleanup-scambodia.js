const admin = require('firebase-admin');
const path = require('path');

// Path to your service account key JSON file
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteAllScambodiaGames() {
  const snapshot = await db.collection('scambodiaGames').get();
  if (snapshot.empty) {
    console.log('No scambodiaGames found.');
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Deleted ${snapshot.size} scambodiaGames.`);
}

deleteAllScambodiaGames().then(() => process.exit(0)).catch(err => {
  console.error('Error deleting scambodiaGames:', err);
  process.exit(1);
}); 