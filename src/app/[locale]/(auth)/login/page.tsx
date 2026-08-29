'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, Link } from '@/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { signIn } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { LanguageToggle } from '@/components/language-toggle';
import { PlaceHolderImages } from '@/lib/placeholder-images';

// Helper function to find first allowed page
function findFirstAllowedPage(permissions: any): string | null {
  if (permissions.catalogs?.accounts) return '/catalogs/accounts';
  if (permissions.catalogs?.customers) return '/catalogs/customers';
  if (permissions.catalogs?.materialTypes) return '/catalogs/material-types';
  if (permissions.catalogs?.phases) return '/catalogs/phases';
  if (permissions.catalogs?.products) return '/catalogs/products';
  if (permissions.catalogs?.rawMaterials) return '/catalogs/raw-materials';
  if (permissions.catalogs?.scales) return '/catalogs/scales';
  if (permissions.catalogs?.vendors) return '/catalogs/vendors';
  if (permissions.expenses) return '/expenses';
  if (permissions.intakes) return '/intakes';
  if (permissions.invoices) return '/invoices';
  if (permissions.production) return '/production';
  if (permissions.inventories?.products) return '/inventories/products';
  if (permissions.inventories?.rawMaterials) return '/inventories/raw-materials';
  if (permissions.reports?.accessLog) return '/reports/access-log';
  if (permissions.reports?.customers) return '/reports/customers';
  if (permissions.reports?.expenses) return '/reports/expenses';
  if (permissions.reports?.intakes) return '/reports/intakes';
  if (permissions.reports?.invoiceStatus) return '/reports/invoice-status';
  if (permissions.reports?.production) return '/reports/production';
  if (permissions.reports?.products) return '/reports/products';
  if (permissions.reports?.profitLoss) return '/reports/profit-loss';
  if (permissions.reports?.rawMaterials) return '/reports/raw-materials';
  if (permissions.reports?.sales) return '/reports/sales';
  if (permissions.reports?.vendors) return '/reports/vendors';
  if (permissions.reports?.waste) return '/reports/waste';
  if (permissions.reports?.wasteAnalytics) return '/reports/waste-analytics';
  if (permissions.waste?.waste) return '/waste/waste';
  if (permissions.waste?.analytics) return '/waste/analytics';
  return null;
}

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('Login');

  const loginImage = PlaceHolderImages.find(p => p.id === 'login-background');

  const formSchema = useMemo(() => z.object({
    email: z.string().email({ message: t('validation.emailInvalid') }),
    password: z.string().min(1, { message: t('validation.passwordRequired') }),
  }), [t]);

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      // 1. Authenticate with Firebase
      const userCredential = await signIn(data.email, data.password);

      // 2. Fire-and-forget logging (don't let this block the redirect)
      fetch('/api/log-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userCredential.uid,
          email: userCredential.email,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      }).catch(err => console.error("Logging failed:", err));

      // 3. Check user role and permissions to determine redirect
      const { db } = await import('@/firebase/config');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', userCredential.email));
      const usersSnap = await getDocs(userQuery);
      
      let redirectPath = '/dashboard'; // Default for admin
      
      if (!usersSnap.empty) {
        const userData = usersSnap.docs[0].data();
        
        // Check if user is admin
        if (userData.role === 'admin') {
          redirectPath = '/dashboard';
        } else {
          // Regular user - find their first allowed page
          const permissions = userData.permissions || {};
          
          // Check dashboard first
          if (permissions.dashboard === true) {
            redirectPath = '/dashboard';
          } else {
            // Find first allowed page
            redirectPath = findFirstAllowedPage(permissions) || '/dashboard';
          }
        }
      }

      // 4. Show success message
      toast({
        title: t('successToast.title'),
        description: t('successToast.description'),
      });

      // 5. Redirect to appropriate page
      router.push(redirectPath);

    } catch (error: any) {
      console.error("Login Error:", error);
      let errorMessage = t('errorToast.unknown');
      
      if (error?.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = t('errorToast.invalidCredentials');
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      toast({
        variant: 'destructive',
        title: t('errorToast.title'),
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12 relative">
        <div className="absolute top-4 right-4 z-10">
          <LanguageToggle variant="default" />
        </div>
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Image src="/logo.png" alt="System@ic logo" width={53} height={53} />
              <h1 className="text-3xl font-bold font-headline" style={{color: '#3560AD'}}>System@ic</h1>
            </div>
            <p className="text-balance text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('emailLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t('emailPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('passwordLabel')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder={t('passwordPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading} style={{backgroundColor: '#3560AD'}}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('signInButton')}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            {t('signupPrompt')}{' '}
            <Link href="/signup" className="underline">
              {t('signupLink')}
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative">
        {loginImage && (
          <>
            <Image
              src={loginImage.imageUrl}
              alt={loginImage.description}
              width={1200}
              height={1800}
              className="h-full w-full object-cover grayscale"
            />
            <div className="absolute inset-0 bg-blue-900/25"></div>
          </>
        )}
      </div>
    </div>
  );
}