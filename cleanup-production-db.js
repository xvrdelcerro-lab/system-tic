/**
 * CLEANUP SCRIPT FOR PRODUCTION DATABASE
 * 
 * This script deletes ALL data except:
 * - accounts
 * - material_types
 * - phases
 * - scales
 * 
 * DANGER: This is irreversible! Make sure you're running this on the
 * CORRECT Firebase project (your new blank production copy)!
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// IMPORTANT: These are your PRODUCTION project credentials (the clone to be cleaned)
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

// Collections to KEEP (do not delete)
const KEEP_COLLECTIONS = [
  'accounts',
  'material_types', 
  'phases',
  'scales'
];

// Collections to DELETE
const DELETE_COLLECTIONS = [
  'users',
  'Tenants',
  'teams',
  'access_logs',
  'customers',
  'products',
  'raw_materials',
  'vendors',
  'production_events',
  'invoices',
  'expenses',
  'inventories',
  'sales_events',
  'waste_entries',
  'waste_analytics',
  'intakes',
  'product_categories',
  'account_categories',
  'expense_categories'
];

async function deleteCollection(collectionName) {
  console.log(`🗑️  Deleting collection: ${collectionName}...`);
  
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    let deleteCount = 0;
    const deletePromises = [];
    
    snapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, collectionName, document.id)));
      deleteCount++;
    });
    
    await Promise.all(deletePromises);
    console.log(`   ✅ Deleted ${deleteCount} documents from ${collectionName}`);
  } catch (error) {
    console.error(`   ❌ Error deleting ${collectionName}:`, error);
  }
}

async function cleanupDatabase() {
  console.log('🚨 ==========================================');
  console.log('🚨 DATABASE CLEANUP SCRIPT');
  console.log('🚨 ==========================================');
  console.log('');
  console.log('⚠️  WARNING: This will DELETE all data except:');
  KEEP_COLLECTIONS.forEach(col => console.log(`   ✅ ${col}`));
  console.log('');
  console.log('❌ Collections to be DELETED:');
  DELETE_COLLECTIONS.forEach(col => console.log(`   🗑️  ${col}`));
  console.log('');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('');
  console.log('⏳ Starting cleanup in 5 seconds...');
  console.log('   (Press Ctrl+C to cancel)');
  console.log('');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('🚀 Starting cleanup...\n');
  
  for (const collectionName of DELETE_COLLECTIONS) {
    await deleteCollection(collectionName);
  }
  
  console.log('');
  console.log('✅ ==========================================');
  console.log('✅ CLEANUP COMPLETE!');
  console.log('✅ ==========================================');
  console.log('');
  console.log('📊 Remaining collections:');
  KEEP_COLLECTIONS.forEach(col => console.log(`   ✅ ${col}`));
  console.log('');
  console.log('🎉 Your production database is now ready for customers!');
}

// Run the cleanup
cleanupDatabase()
  .then(() => {
    console.log('\n✨ All done! Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });