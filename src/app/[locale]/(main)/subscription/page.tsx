'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Zap, Crown } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<'monthly' | 'lifetime' | null>(null);

  async function handleSubscribe(plan: 'monthly' | 'lifetime') {
    if (!user) return;

    setLoading(plan);
    try {
      // Get user's tenant ID
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const tenantId = userDoc.data()?.tenantId;

      if (!tenantId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Tenant not found' });
        setLoading(null);
        return;
      }

      const priceId = plan === 'monthly' 
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY 
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME;

      // Create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          tenantId,
          userId: user.uid,
        }),
      });

      const { sessionId, error } = await response.json();

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error });
        setLoading(null);
        return;
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      const { error: stripeError } = await stripe!.redirectToCheckout({ sessionId });

      if (stripeError) {
        toast({ variant: 'destructive', title: 'Error', description: stripeError.message });
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to start checkout' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground text-lg">Select the plan that works best for your business</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Monthly Plan */}
        <Card className="relative hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader>
          <div className="w-12 h-12 flex items-center justify-center mb-4">
  <Zap className="h-10 w-10 text-blue-600" />
</div>
            <CardTitle className="text-2xl">Monthly</CardTitle>
            <CardDescription>Perfect for growing businesses</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">$20</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Up to 6 team members</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Unlimited products</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Production tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Inventory management</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Reports & analytics</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Email support</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="mt-auto" 
              size="lg"
              onClick={() => handleSubscribe('monthly')}
              disabled={loading !== null}
            >
              {loading === 'monthly' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Subscribe Monthly
            </Button>
          </CardFooter>
        </Card>

        {/* Lifetime Plan */}
        <Card className="relative border-2 border-blue-500 hover:shadow-lg transition-shadow flex flex-col">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              BEST VALUE
            </span>
          </div>
          <CardHeader>
          <div className="w-12 h-12 flex items-center justify-center mb-4">
  <Crown className="h-10 w-10 text-yellow-600" />
</div>
            <CardTitle className="text-2xl">Lifetime</CardTitle>
            <CardDescription>One-time payment, forever access</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">$250</span>
              <span className="text-muted-foreground"> once</span>
            </div>
            <p className="text-sm text-green-600 font-medium mt-2">Save $190 in first year!</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Everything in Monthly, plus:</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Lifetime access (no recurring fees)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Priority support</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>All future updates included</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Early access to new features</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>Dedicated account manager</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="mt-auto" 
              size="lg"
              onClick={() => handleSubscribe('lifetime')}
              disabled={loading !== null}
            >
              {loading === 'lifetime' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Lifetime Access
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>✓ 14-day free trial included with all plans</p>
        <p>✓ Cancel anytime (monthly plan) • Secure payment by Stripe</p>
      </div>
    </div>
  );
}