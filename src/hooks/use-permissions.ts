import { useAuth } from '@/components/providers/auth-provider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useState, useEffect } from 'react';

type Permission = {
  dashboard?: boolean;
  products?: boolean;
  production?: boolean;
  inventory?: boolean;
  customers?: boolean;
  invoices?: boolean;
  expenses?: boolean;
  reports?: boolean;
  [key: string]: boolean | undefined;
};

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPermissions() {
      if (!user?.uid) {
        setPermissions({});
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsAdmin(userData.role === 'admin');
          setPermissions(userData.permissions || {});
        } else {
            setIsAdmin(false);
            setPermissions({});
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [user?.uid]);

  function hasAccess(page: string): boolean {
    if (isAdmin) return true;
    
    // For things like catalogs.customers we take just 'customers'
    const key = page.includes('.') ? page.split('.')[1] : page;
    return !!permissions[key as keyof Permission];
  }

  return { permissions, isAdmin, hasAccess, loading };
}