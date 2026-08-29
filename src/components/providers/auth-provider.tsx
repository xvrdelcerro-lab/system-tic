'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from '@/navigation';
import Cookies from 'js-cookie';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthState();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        const token = await currentUser.getIdToken();
        Cookies.set('firebaseIdToken', token, { expires: 1, path: '/' });

        // Check if user needs onboarding (only if not already on onboarding page)
        if (
          pathname !== '/onboarding' && 
          pathname !== '/login' && 
          pathname !== '/signup' &&
          pathname !== '/subscription' &&
          !pathname.startsWith('/subscription/') &&
          !pathname.startsWith('/api/')
        ) {
          try {
            // Check cache first for faster subsequent logins
            const cacheKey = `user_onboarded_${currentUser.uid}`;
            const cached = localStorage.getItem(cacheKey);
            
            if (cached === 'true') {
              // User already onboarded (from cache), skip Firestore check
              console.log('User onboarding status found in cache');
            } else {
              // Check Firestore
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
              if (!userDoc.exists()) {
                // User doesn't have Firestore document, needs onboarding
                router.push('/onboarding');
                setLoading(false);
                return;
              }
              // Cache the result for next time
              localStorage.setItem(cacheKey, 'true');
            }
          } catch (error) {
            console.error('Error checking user document:', error);
          }
        }
      } else {
        setUser(null);
        Cookies.remove('firebaseIdToken', { path: '/' });
        
        // Not logged in, redirect to login (except if already on login/signup)
        if (pathname !== '/login' && pathname !== '/signup') {
          router.push('/login');
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  return { user, loading };
}