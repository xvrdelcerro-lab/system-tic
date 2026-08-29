'use server';

import { adminDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';

export async function logUserAccess(params: {
  uid: string;
  email: string;
  timezone: string;
}) {
  try {
    if (!adminDb) {
      console.error("Firestore Admin DB not available, skipping access log.");
      return;
    }
    const h = await headers();
    const userAgent = h.get('user-agent') ?? 'unknown';

    await adminDb.collection('access_logs').add({
      uid: params.uid,
      email: params.email,
      timezone: params.timezone,
      userAgent,
      accessedAt: new Date(), // server time (UTC, safe)
    });
  } catch (e) {
    console.error('Failed to log access', e);
  }
}