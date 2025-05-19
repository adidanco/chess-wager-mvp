const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function listAllUsers() {
  const snapshot = await db.collection('users').get();
  if (snapshot.empty) {
    console.log('No users found.');
    return;
  }
  console.log('User documents:');
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- ${doc.id}: ${data.email || 'no email'}${data.username ? ' (' + data.username + ')' : ''}`);
  });
}

listAllUsers().then(() => process.exit(0)).catch(err => {
  console.error('Error listing users:', err);
  process.exit(1);
}); 