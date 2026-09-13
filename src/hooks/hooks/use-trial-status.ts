import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

type TrialStatus = {
  plan: 'trial' | 'active' | 'expired';
  trialEndsAt: Date | null;
  daysLeft: number;
  isExpired: boolean;
  loading: boolean;
};

const CACHE_KEY = 'trial_status_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useTrialStatus(): TrialStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<TrialStatus>(() => {
    // Try to load from cache immediately
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_DURATION) {
            return {
              ...parsed.data,
              trialEndsAt: parsed.data.trialEndsAt ? new Date(parsed.data.trialEndsAt) : null,
              loading: false,
            };
          }
        } catch (e) {
          // Invalid cache, ignore
        }
      }
    }
    
    return {
      plan: 'trial',
      trialEndsAt: null,
      daysLeft: 0,
      isExpired: false,
      loading: true,
    };
  });

  useEffect(() => {
    async function checkTrialStatus() {
      if (!user) {
        setStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const tenantId = userDoc.data()?.tenantId;

        if (!tenantId) {
          setStatus(prev => ({ ...prev, loading: false }));
          return;
        }

        const tenantDoc = await getDoc(doc(db, 'Tenants', tenantId));
        const tenantData = tenantDoc.data();

        if (!tenantData) {
          setStatus(prev => ({ ...prev, loading: false }));
          return;
        }

        const plan = tenantData.plan || 'trial';
        const trialEndsAt = tenantData.trialEndsAt?.toDate() || null;
        
        let daysLeft = 0;
        let isExpired = false;

        if (trialEndsAt) {
          const now = new Date();
          const diffTime = trialEndsAt.getTime() - now.getTime();
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          isExpired = daysLeft <= 0;
        }

        const newStatus = {
          plan,
          trialEndsAt,
          daysLeft: Math.max(0, daysLeft),
          isExpired: plan === 'trial' && isExpired,
          loading: false,
        };

        setStatus(newStatus);

        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: {
            ...newStatus,
            trialEndsAt: trialEndsAt?.toISOString() || null,
          }
        }));
      } catch (error) {
        console.error('Error checking trial status:', error);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    }

    checkTrialStatus();
  }, [user]);

  return status;
}