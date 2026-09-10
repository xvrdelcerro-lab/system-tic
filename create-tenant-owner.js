// One-time script: create the Tenants document that marks you as the
// owner of your own tenant in the new Systematic project.
//
// Requires new-service-account.json to already exist in this folder
// (same file used by migrate-to-new-project.js).
//
// RUN:
//   node create-tenant-owner.js

const admin = require('firebase-admin');
const path = require('path');

const newServiceAccount = require(path.join(__dirname, 'new-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(newServiceAccount),
  });
}

const db = admin.firestore();

const MY_UID = 'AiAgbrkR78W39bgCGy8RXEYcm0e2';
const TENANT_ID = `tenant_${MY_UID}`;

async function main() {
  await db.collection('Tenants').doc(TENANT_ID).set({
    OwnerId: MY_UID,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Success! Created /Tenants/${TENANT_ID} with OwnerId: ${MY_UID}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
});
