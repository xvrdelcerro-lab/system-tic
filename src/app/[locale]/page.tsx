
import { cookies } from 'next/headers';
import { redirect } from '@/navigation';

// This is a Server Component, so it can directly access cookies and perform redirects.
export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('firebaseIdToken');

  // If the user is not logged in, redirect to the login page.
  if (!session) {
    redirect('/login');
  }

  // If the user is logged in, redirect to the dashboard.
  redirect('/dashboard');
}