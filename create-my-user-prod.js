// One-time script: create your Firestore user doc (with full permissions)
// in the systemweb-f9d72 project.
//
// RUN (from project root, same folder as .env.local):
//   node -r dotenv/config create-my-user-prod.js dotenv_config_path=.env.local

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
const MY_EMAIL = 'xcmmx@hotmail.com';

// Full permissions structure (matches what the Team page expects), all enabled
const FULL_PERMISSIONS = {
  dashboard: true,
  catalogs: {
    enabled: true,
    accounts: true,
    customers: true,
    materialTypes: true,
    phases: true,
    products: true,
    rawMaterials: true,
    scales: true,
    vendors: true,
  },
  expenses: true,
  intakes: true,
  inventories: {
    enabled: true,
    products: true,
    rawMaterials: true,
  },
  invoices: true,
  production: true,
  reports: {
    enabled: true,
    accessLog: true,
    customers: true,
    intakes: true,
    production: true,
    products: true,
    rawMaterials: true,
    sales: true,
    invoices: true,
    vendors: true,
    waste: true,
    wasteAnalytics: true,
    expenses: true,
    profitLoss: true,
  },
  waste: {
    enabled: true,
    waste: true,
    analytics: true,
  },
};

async function main() {
  const tenantId = `tenant_${MY_UID}`;

  await db.collection('users').doc(MY_UID).set({
    uid: MY_UID,
    email: MY_EMAIL,
    tenantId,
    role: 'admin',
    plan: 'free',
    permissions: FULL_PERMISSIONS,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Success! Created /users/${MY_UID} in systemweb-f9d72 with full permissions.`);
  console.log(`tenantId: ${tenantId}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
});
