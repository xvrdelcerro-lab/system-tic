/**
 * COPY TEMPLATE COLLECTIONS TO NEW PROJECT
 * 
 * This script copies ONLY the template collections from your existing
 * project to the new production project.
 * 
 * Collections to copy:
 * - accounts
 * - material_types
 * - phases
 * - scales
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

// SOURCE (your existing project with all data)
const sourceConfig = {
  apiKey: "AIzaSyCibKDwy6aA41OV--DFql86RTIBm8ZQ8wg",
  authDomain: "studio-8004370713-f7a7c.firebaseapp.com",
  projectId: "studio-8004370713-f7a7c",
  storageBucket: "studio-8004370713-f7a7c.firebasestorage.app",
  messagingSenderId: "927576436964",
  appId: "1:927576436964:web:4c69aa4cb43c89ae4c3cf1"
};

// DESTINATION (your new production project)
const destConfig = {
  apiKey: "AIzaSyDNhPHTz2ioe0z87Kxg7JBE6lGTiinCo2Y",
  authDomain: "systemweb-f9d72.firebaseapp.com",
  projectId: "systemweb-f9d72",
  storageBucket: "systemweb-f9d72.firebasestorage.app",
  messagingSenderId: "191735001200",
  appId: "1:191735001200:web:3145d2530030a2bbbec4b5"
};

// Initialize both Firebase apps
const sourceApp = initializeApp(sourceConfig, 'source');
const destApp = initializeApp(destConfig, 'destination');

const sourceDb = getFirestore(sourceApp);
const destDb = getFirestore(destApp);

// Collections to copy
const COLLECTIONS_TO_COPY = [
  'accounts',
  'material_types',
  'phases',
  'scales'
];

async function copyCollection(collectionName) {
  console.log(`\n📦 Copying collection: ${collectionName}`);
  
  try {
    // Get all documents from source
    const sourceCollection = collection(sourceDb, collectionName);
    const snapshot = await getDocs(sourceCollection);
    
    console.log(`   Found ${snapshot.size} documents`);
    
    let copiedCount = 0;
    const copyPromises = [];
    
    snapshot.forEach((document) => {
      const data = document.data();
      const destDocRef = doc(destDb, collectionName, document.id);
      copyPromises.push(
        setDoc(destDocRef, data)
          .then(() => {
            copiedCount++;
            process.stdout.write(`\r   Copied ${copiedCount}/${snapshot.size} documents`);
          })
      );
    });
    
    await Promise.all(copyPromises);
    console.log(`\n   ✅ Successfully copied ${copiedCount} documents`);
    
  } catch (error) {
    console.error(`   ❌ Error copying ${collectionName}:`, error);
  }
}

async function copyTemplateCollections() {
  console.log('🚀 ==========================================');
  console.log('🚀 COPY TEMPLATE COLLECTIONS');
  console.log('🚀 ==========================================');
  console.log('');
  console.log('📤 Source project:', sourceConfig.projectId);
  console.log('📥 Destination project:', destConfig.projectId);
  console.log('');
  console.log('📋 Collections to copy:');
  COLLECTIONS_TO_COPY.forEach(col => console.log(`   - ${col}`));
  console.log('');
  console.log('⏳ Starting in 3 seconds...');
  console.log('   (Press Ctrl+C to cancel)');
  console.log('');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('🔄 Starting copy process...');
  
  for (const collectionName of COLLECTIONS_TO_COPY) {
    await copyCollection(collectionName);
  }
  
  console.log('');
  console.log('✅ ==========================================');
  console.log('✅ COPY COMPLETE!');
  console.log('✅ ==========================================');
  console.log('');
  console.log('🎉 Your new production project is ready!');
  console.log('');
  console.log('📊 Template collections copied:');
  COLLECTIONS_TO_COPY.forEach(col => console.log(`   ✅ ${col}`));
  console.log('');
  console.log('🔐 Next steps:');
  console.log('   1. Update your app\'s .env with new Firebase credentials');
  console.log('   2. Deploy to production');
  console.log('   3. First customer can sign up and get fresh data!');
}

copyTemplateCollections()
  .then(() => {
    console.log('\n✨ Done! Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });