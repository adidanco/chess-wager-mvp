const admin = require('firebase-admin');
const path = require('path');

// Path to your service account key JSON file
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function listCollections() {
  const collections = await db.listCollections();
  console.log('Top-level Firestore collections:');
  collections.forEach(col => console.log(' -', col.id));
}

listCollections().then(() => process.exit(0)).catch(err => {
  console.error('Error listing collections:', err);
  process.exit(1);
}); 