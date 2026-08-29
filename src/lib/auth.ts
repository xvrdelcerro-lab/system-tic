// src/lib/auth.ts
// CLIENT-SIDE AUTH ONLY

import { auth } from '@/firebase/config';
import { db } from '@/firebase/config';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';

import {
  doc,
  getDoc,
} from 'firebase/firestore';

// ---------- LOGIN ----------
export async function signIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return credential.user;
}

// ---------- SIGN UP ----------
export async function signUp(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = credential.user;

  // DO NOT create user document here anymore!
  // User will be created in onboarding page after they choose create/join organization

  return user;
}

// ---------- CHECK IF USER NEEDS ONBOARDING ----------
export async function needsOnboarding(uid: string): Promise<boolean> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return !userDoc.exists(); // If no user doc, needs onboarding
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}