// One-time migration script:
// Copies System@ic's collections + your user doc from the shared
// Icystem project into the new dedicated Systematic project.
//
// SETUP (do this first):
// 1. Save the OLD project's service account key as:  old-service-account.json
// 2. Save the NEW project's service account key as:   new-service-account.json
//    (both in the same folder as this script - project root)
// 3. Make sure both filenames are added to .gitignore
//
// RUN:
//   node migrate-to-new-project.js

const admin = require('firebase-admin');
const path = require('path');

const oldServiceAccount = require(path.join(__dirname, 'old-service-account.json'));
const newServiceAccount = require(path.join(__dirname, 'new-service-account.json'));

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(oldServiceAccount) },
  'oldApp'
);
const newApp = admin.initializeApp(
  { credential: admin.credential.cert(newServiceAccount) },
  'newApp'
);

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

// Only the collections System@ic actually uses (NOT icystemShared, NOT users - handled separately below)
const COLLECTIONS_TO_MIGRATE = [
  'accounts',
  'account_categories',
  'customers',
  'expenses',
  'expense_categories',
  'material_types',
  'phases',
  'product_categories',
  'products',
  'scales',
  'vendors',
];

// Your user record details
const OLD_USER_UID = 'golP7BTW9rZWtOVD2oNLWZcPLwM2';   // your user doc in the OLD shared project (has full permissions already)
const NEW_USER_UID = 'AiAgbrkR78W39bgCGy8RXEYcm0e2';   // your new Auth UID in the NEW dedicated project
const NEW_USER_EMAIL = 'xcmmx@hotmail.com';

async function migrateCollection(name) {
  const snapshot = await oldDb.collection(name).get();
  if (snapshot.empty) {
    console.log(`  (skipped) '${name}' - no documents found`);
    return;
  }

  // Firestore batches max out at 500 writes
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

async function migrateUserDoc() {
  const sourceSnap = await oldDb.collection('users').doc(OLD_USER_UID).get();

  if (!sourceSnap.exists) {
    console.error(`  User doc ${OLD_USER_UID} not found in old project - skipping user migration.`);
    return;
  }

  const sourceData = sourceSnap.data();
  const newData = {
    ...sourceData,
    uid: NEW_USER_UID,
    email: NEW_USER_EMAIL,
    tenantId: `tenant_${NEW_USER_UID}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await newDb.collection('users').doc(NEW_USER_UID).set(newData);
  console.log(`  Created /users/${NEW_USER_UID} in new project with full permissions`);
}

async function main() {
  console.log('Starting migration...\n');

  console.log('Migrating collections:');
  for (const name of COLLECTIONS_TO_MIGRATE) {
    await migrateCollection(name);
  }

  console.log('\nMigrating user record:');
  await migrateUserDoc();

  console.log('\nDone! Verify the data in the new project console before switching your app over.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
});
