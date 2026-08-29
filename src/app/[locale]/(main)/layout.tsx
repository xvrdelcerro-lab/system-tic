
import { ReactNode } from 'react';
import { MainLayoutProviders } from '../main-layout-providers';
import MainLayoutClient from '@/components/layout/main-layout-client';
import { AuthProvider } from '@/components/providers/auth-provider';
import { FirebaseErrorProvider } from '@/components/providers/firebase-error-provider';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FirebaseErrorProvider>
        <MainLayoutProviders>
          <MainLayoutClient>{children}</MainLayoutClient>
        </MainLayoutProviders>
      </FirebaseErrorProvider>
    </AuthProvider>
  );
}
