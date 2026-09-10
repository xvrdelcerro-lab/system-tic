// One-time script: create the Tenants document that marks you as owner
// in the systemweb-f9d72 project.
//
// RUN:
//   node -r dotenv/config create-tenant-owner-prod.js dotenv_config_path=.env.local

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const MY_UID = 'yFZhNCvPYJM8DkYqHHM8PnKtrIx2';
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
