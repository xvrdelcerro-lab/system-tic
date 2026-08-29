'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth, db } from '@/firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from '@/navigation';
import { Building2, Users, Loader2, LogOut } from 'lucide-react';
import Image from 'next/image';
import { LanguageToggle } from '@/components/language-toggle';
import { useTranslations } from 'next-intl';
import { signOut } from '@/lib/auth';

export default function OnboardingPage() {
  const t = useTranslations('OnboardingPage');
  const { toast } = useToast();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [loading, setLoading] = useState(false);
  
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        router.push('/dashboard');
      } else {
        setUser(currentUser);
        setCheckingStatus(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  async function createOrganization() {
    if (!user || !companyName.trim()) {
      toast({ variant: 'destructive', title: t('createOrg.emptyNameError') });
      return;
    }

    setLoading(true);
    try {
      const tenantId = `tenant_${user.uid}`;
      
      // Calculate trial end date (14 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      // Create tenant document with trial period
      await setDoc(doc(db, 'Tenants', tenantId), {
        name: companyName,
        ownerId: user.uid,
        userLimit: 6,
        members: [user.uid],
        createdAt: new Date(),
        plan: 'trial',
        trialEndsAt: trialEndsAt,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });

      // Create user document with admin role and NEW hierarchical permissions
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        uid: user.uid,
        tenantId: tenantId,
        role: 'admin',
        plan: 'free',
        createdAt: new Date(),
        permissions: {
          dashboard: true,
          catalogs: {
            enabled: true,
            accounts: true,
            customers: true,
            materialTypes: true,
            phases: true,
            products: true,
            rawMaterials: true,
            scales: true,
            vendors: true,
          },
          expenses: true,
          intakes: true,
          inventories: {
            enabled: true,
            products: true,
            rawMaterials: true,
          },
          invoices: true,
          production: true,
          reports: {
            enabled: true,
            accessLog: true,
            customers: true,
            intakes: true,
            production: true,
            products: true,
            rawMaterials: true,
            sales: true,
            invoices: true,
            vendors: true,
            waste: true,
            wasteAnalytics: true,
            expenses: true,
            profitLoss: true,
          },
          waste: {
            enabled: true,
            waste: true,
            analytics: true,
          },
        }
      });

      toast({ 
        title: t('createOrg.successTitle'), 
        description: t('createOrg.successDescription', { companyName }) 
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({ 
        variant: 'destructive', 
        title: t('createOrg.errorTitle'), 
        description: String(error) 
      });
    } finally {
      setLoading(false);
    }
  }

  async function joinOrganization() {
    if (!user || !inviteCode.trim()) {
      toast({ variant: 'destructive', title: t('joinOrg.emptyCodeError') });
      return;
    }

    setLoading(true);
    try {
      const tenantId = inviteCode.trim();
      const tenantDoc = await getDoc(doc(db, 'Tenants', tenantId));

      if (!tenantDoc.exists()) {
        toast({ variant: 'destructive', title: t('joinOrg.invalidCodeError') });
        setLoading(false);
        return;
      }

      const tenantData = tenantDoc.data();
      
      if (tenantData.members?.length >= tenantData.userLimit) {
        toast({ variant: 'destructive', title: t('joinOrg.maxCapacityError') });
        setLoading(false);
        return;
      }

      const updatedMembers = [...(tenantData.members || []), user.uid];
      await setDoc(doc(db, 'Tenants', tenantId), {
        ...tenantData,
        members: updatedMembers,
      });

      // Create user document with NEW hierarchical permissions (all disabled for new team members)
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        uid: user.uid,
        tenantId: tenantId,
        role: 'user',
        plan: 'free',
        createdAt: new Date(),
        permissions: {
          dashboard: false,
          catalogs: {
            enabled: false,
            accounts: false,
            customers: false,
            materialTypes: false,
            phases: false,
            products: false,
            rawMaterials: false,
            scales: false,
            vendors: false,
          },
          expenses: false,
          intakes: false,
          inventories: {
            enabled: false,
            products: false,
            rawMaterials: false,
          },
          invoices: false,
          production: false,
          reports: {
            enabled: false,
            accessLog: false,
            customers: false,
            intakes: false,
            production: false,
            products: false,
            rawMaterials: false,
            sales: false,
            invoices: false,
            vendors: false,
            waste: false,
            wasteAnalytics: false,
            expenses: false,
            profitLoss: false,
          },
          waste: {
            enabled: false,
            waste: false,
            analytics: false,
          },
        }
      });

      toast({ 
        title: t('joinOrg.successTitle'), 
        description: t('joinOrg.successDescription', { organizationName: tenantData.name }) 
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error joining organization:', error);
      toast({ 
        variant: 'destructive', 
        title: t('joinOrg.errorTitle'), 
        description: String(error) 
      });
    } finally {
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Onboarding form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
        {/* Logout button - top left */}
        <div className="absolute top-4 left-4 z-10">
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Language toggle - top right */}
        <div className="absolute top-4 right-4 z-10">
          <LanguageToggle variant="default" />
        </div>

        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('welcome')}</h1>
            <p className="text-gray-600">{t('subtitle')}</p>
          </div>

          {mode === 'choice' && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow flex flex-col" onClick={() => setMode('create')}>
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle>{t('createOrg.title')}</CardTitle>
                  <CardDescription>{t('createOrg.description')}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button className="w-full" variant="default">{t('createOrg.button')}</Button>
                </CardFooter>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow flex flex-col" onClick={() => setMode('join')}>
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle>{t('joinOrg.title')}</CardTitle>
                  <CardDescription>{t('joinOrg.description')}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button className="w-full" variant="outline">{t('joinOrg.button')}</Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {mode === 'create' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('createOrg.formTitle')}</CardTitle>
                <CardDescription>{t('createOrg.formDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="company-name">{t('createOrg.companyNameLabel')}</Label>
                  <Input
                    id="company-name"
                    placeholder={t('createOrg.companyNamePlaceholder')}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => setMode('choice')} disabled={loading}>
                  {t('createOrg.backButton')}
                </Button>
                <Button onClick={createOrganization} disabled={loading || !companyName.trim()}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('createOrg.createButton')}
                </Button>
              </CardFooter>
            </Card>
          )}

          {mode === 'join' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('joinOrg.formTitle')}</CardTitle>
                <CardDescription>{t('joinOrg.formDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="invite-code">{t('joinOrg.inviteCodeLabel')}</Label>
                  <Input
                    id="invite-code"
                    placeholder={t('joinOrg.inviteCodePlaceholder')}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('joinOrg.inviteCodeHelp')}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => setMode('choice')} disabled={loading}>
                  {t('joinOrg.backButton')}
                </Button>
                <Button onClick={joinOrganization} disabled={loading || !inviteCode.trim()}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('joinOrg.joinButton')}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>

      {/* Right side - Corporate image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <Image
          src="/INT.png"
          alt="Manufacturing"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/35 to-indigo-900/35"></div>
        <div className="relative h-full flex items-center justify-center p-12">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-4">{t('imageTitle')}</h2>
            <p className="text-xl text-blue-100">{t('imageDescription')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}