'use client';

import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { ReactNode } from 'react';

export function FirebaseErrorProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FirebaseErrorListener />
    </>
  );
}
