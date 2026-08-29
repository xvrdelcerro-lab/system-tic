/**
 * CREATE ADMIN USER IN FIRESTORE
 * 
 * This script creates a complete admin user document in Firestore
 * with all permissions set to true.
 * 
 * BEFORE RUNNING:
 * 1. Create the user in Firebase Authentication first
 * 2. Copy the UID
 * 3. Update the UID and email below
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

// Your production Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCibKDwy6aA41OV--DFql86RTIBm8ZQ8wg",
  authDomain: "studio-8004370713-f7a7c.firebaseapp.com",
  projectId: "studio-8004370713-f7a7c",
  storageBucket: "studio-8004370713-f7a7c.firebasestorage.app",
  messagingSenderId: "927576436964",
  appId: "1:927576436964:web:4c69aa4cb43c89ae4c3cf1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ⚠️ UPDATE THESE VALUES ⚠️
const NEW_USER_UID = "golP7BTW9rZWtOVD2oNLWZcPLwM2";
const USER_EMAIL = "xcmmx@hotmail.com";
const USER_PASSWORD = "YOUR_PASSWORD";  // Replace with your actual password
const TENANT_ID = "tenant_KS3v1FTumSaOdMGz8lxNbGBc7HW2";

async function createAdminUser() {
  console.log('🚀 Creating admin user...');
  console.log('');
  console.log('UID:', NEW_USER_UID);
  console.log('Email:', USER_EMAIL);
  console.log('Tenant:', TENANT_ID);
  console.log('');

  if (NEW_USER_UID === "PASTE_NEW_UID_HERE") {
    console.error('❌ ERROR: Please update NEW_USER_UID with the actual UID from Authentication!');
    process.exit(1);
  }

  const userData = {
    email: USER_EMAIL,
    password: USER_PASSWORD,
    uid: NEW_USER_UID,
    tenantId: TENANT_ID,
    role: "admin",
    plan: "free",
    createdAt: Timestamp.now(),
    permissions: {
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
        expenses: true,
        intakes: true,
        invoices: true,
        production: true,
        products: true,
        profitLoss: true,
        rawMaterials: true,
        sales: true,
        vendors: true,
        waste: true,
        wasteAnalytics: true,
      },
      waste: {
        enabled: true,
        waste: true,
        analytics: true,
      },
    }
  };

  try {
    await setDoc(doc(db, 'users', NEW_USER_UID), userData);
    
    console.log('✅ ==========================================');
    console.log('✅ ADMIN USER CREATED SUCCESSFULLY!');
    console.log('✅ ==========================================');
    console.log('');
    console.log('📧 Email:', USER_EMAIL);
    console.log('🔐 Password:', USER_PASSWORD);
    console.log('👤 UID:', NEW_USER_UID);
    console.log('🏢 Tenant:', TENANT_ID);
    console.log('👑 Role: admin');
    console.log('');
    console.log('🎉 You can now login to your app!');
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }
}

createAdminUser()
  .then(() => {
    console.log('\n✨ Done! Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });