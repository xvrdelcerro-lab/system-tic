'use client';

import { usePageAccess } from '@/hooks/use-page-access';
import { PasswordPrompt } from '@/components/password-prompt';
import { Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';

interface ProtectedPageProps {
  children: React.ReactNode;
  pageName: string;
  pageTitle?: string;
}

export function ProtectedPage({ children, pageName, pageTitle }: ProtectedPageProps) {
  const t = useTranslations('ProtectedPage');
  const { loading, hasAccess, needsPassword, checkPassword } = usePageAccess(pageName);

  // Show loader during initial check - prevents blank page flash
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsPassword) {
    return <PasswordPrompt onSubmit={checkPassword} pageName={pageTitle || pageName} />;
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>{t('accessDenied.title')}</AlertTitle>
          <AlertDescription>
            {t('accessDenied.description')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}