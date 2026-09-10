// One-time script: copy the missing System@ic collections
// (customers, account_categories, expense_categories, product_categories)
// from the shared Icystem project into systemweb-f9d72.
//
// SETUP:
// 1. Make sure old-service-account.json (Icystem's key) is in this folder.
// 2. Target project credentials are read from .env.local (systemweb-f9d72).
//
// RUN:
//   node -r dotenv/config migrate-missing-collections.js dotenv_config_path=.env.local

const admin = require('firebase-admin');
const path = require('path');

const oldServiceAccount = require(path.join(__dirname, 'old-service-account.json'));

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(oldServiceAccount) },
  'oldApp'
);

const newApp = admin.initializeApp(
  {
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  },
  'newApp'
);

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

// Only the collections missing from systemweb-f9d72
const COLLECTIONS_TO_MIGRATE = [
  'customers',
  'account_categories',
  'expense_categories',
  'product_categories',
];

async function migrateCollection(name) {
  const snapshot = await oldDb.collection(name).get();
  if (snapshot.empty) {
    console.log(`  (skipped) '${name}' - no documents found`);
    return;
  }

  const docs = snapshot.docs;
  let batch = newDb.batch();
  let count = 0;

  for (const doc of docs) {
    const ref = newDb.collection(name).doc(doc.id);
    batch.set(ref, doc.data());
    count++;

    if (count % 450 === 0) {
      await batch.commit();
      batch = newDb.batch();
    }
  }

  await batch.commit();
  console.log(`  Migrated '${name}': ${docs.length} document(s)`);
}

async function main() {
  console.log('Migrating missing collections into systemweb-f9d72:\n');
  for (const name of COLLECTIONS_TO_MIGRATE) {
    await migrateCollection(name);
  }
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
});
