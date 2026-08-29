/**
 * CREATE MEMBERS SUBCOLLECTION
 * 
 * This script creates the members subcollection under the Tenant document
 * so the Team page can display team members properly.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCibKDwy6aA41OV--DFql86RTIBm8ZQ8wg",
  authDomain: "studio-8004370713-f7a7c.firebaseapp.com",
  projectId: "studio-8004370713-f7a7c",
  storageBucket: "studio-8004370713-f7a7c.firebasestorage.app",
  messagingSenderId: "927576436964",
  appId: "1:927576436964:web:4c69aa4cb43c89ae4c3cf1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TENANT_ID = "XCM01";  // Changed to your actual tenant
const USER_UID = "golP7BTW9rZWtOVD2oNLWZcPLwM2";

async function createMembersSubcollection() {
  console.log('🚀 Creating members subcollection...');
  console.log('');
  console.log('Tenant ID:', TENANT_ID);
  console.log('User UID:', USER_UID);
  console.log('');

  try {
    // Get user data from users collection
    console.log('📖 Reading user data from users collection...');
    const userDoc = await getDoc(doc(db, 'users', USER_UID));
    
    if (!userDoc.exists()) {
      console.error('❌ User document not found!');
      process.exit(1);
    }
    
    const userData = userDoc.data();
    console.log('✅ User data retrieved');
    console.log('   Email:', userData.email);
    console.log('   Role:', userData.role);
    console.log('');

    // Create member document in Tenants/{tenantId}/members subcollection
    console.log('📝 Creating member document in subcollection...');
    
    const memberData = {
      email: userData.email,
      role: userData.role,
      password: userData.password || "",
      permissions: userData.permissions || {},
      joinedAt: Timestamp.now(),
      uid: USER_UID
    };

    const memberRef = doc(db, 'Tenants', TENANT_ID, 'members', USER_UID);
    await setDoc(memberRef, memberData);
    
    console.log('✅ ==========================================');
    console.log('✅ MEMBER SUBCOLLECTION CREATED!');
    console.log('✅ ==========================================');
    console.log('');
    console.log('📍 Location: Tenants/' + TENANT_ID + '/members/' + USER_UID);
    console.log('👤 Email:', userData.email);
    console.log('👑 Role:', userData.role);
    console.log('');
    console.log('🎉 Team page should now work!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createMembersSubcollection()
  .then(() => {
    console.log('\n✨ Done! Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });