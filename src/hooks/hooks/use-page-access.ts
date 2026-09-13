'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface AccessControl {
  loading: boolean;
  hasAccess: boolean;
  needsPassword: boolean;
  shouldRedirect: boolean;
  redirectUrl: string | null;
  checkPassword: (password: string) => Promise<boolean>;
  logout: () => void;
}

const STORAGE_KEY = 'page_access_password';

export function usePageAccess(pageName: string): AccessControl {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  // Check stored password on mount
  useEffect(() => {
    const checkStoredPassword = async () => {
      setLoading(true);
      
      console.log('🔍 Checking access for page:', pageName);
      
      // First, check if current user is admin - they bypass password system entirely
      const isAdmin = await checkIfAdmin();
      console.log('👤 Is admin?', isAdmin);
      
      if (isAdmin) {
        console.log('✅ Admin access granted');
        setHasAccess(true);
        setNeedsPassword(false);
        setLoading(false);
        return;
      }
      
      const pwd = sessionStorage.getItem(STORAGE_KEY);
      console.log('🔑 Stored password exists?', !!pwd);
      
      if (!pwd) {
        console.log('❌ No password - showing prompt');
        setNeedsPassword(true);
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setStoredPassword(pwd);
      
      console.log('🔐 Verifying password and permissions...');
      // Verify password and check permissions
      const result = await verifyPasswordPermissionAndRedirect(pwd, pageName);
      console.log('📊 Result:', result);
      
      if (result.hasPermission) {
        console.log('✅ Permission granted');
        setHasAccess(true);
        setNeedsPassword(false);
      } else if (result.redirectUrl) {
        console.log('🔀 Redirecting to:', result.redirectUrl);
        // Password is valid but user doesn't have permission for this page
        // Redirect IMMEDIATELY without showing anything
        window.location.href = result.redirectUrl;
        return; // Stop here, don't set any state
      } else {
        console.log('❌ No permission and no redirect');
        setHasAccess(false);
        setNeedsPassword(true);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      
      setLoading(false);
    };

    checkStoredPassword();
  }, [pageName]);

  const checkPassword = async (password: string): Promise<boolean> => {
    setLoading(true);
    
    const result = await verifyPasswordPermissionAndRedirect(password, pageName);
    
    if (result.hasPermission) {
      sessionStorage.setItem(STORAGE_KEY, password);
      setStoredPassword(password);
      setHasAccess(true);
      setNeedsPassword(false);
      setLoading(false);
      return true;
    } else if (result.redirectUrl) {
      // Password valid but no permission - redirect
      sessionStorage.setItem(STORAGE_KEY, password);
      setShouldRedirect(true);
      setRedirectUrl(result.redirectUrl);
      setLoading(false);
      window.location.href = result.redirectUrl;
      return false;
    } else {
      setHasAccess(false);
      setNeedsPassword(true);
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setStoredPassword(null);
    setHasAccess(false);
    setNeedsPassword(true);
  };

  return {
    loading,
    hasAccess,
    needsPassword,
    shouldRedirect,
    redirectUrl,
    checkPassword,
    logout,
  };
}

async function checkIfAdmin(): Promise<boolean> {
  try {
    const { auth } = await import('@/firebase/config');
    const currentUser = auth.currentUser;
    
    if (!currentUser) return false;
    
    // Check users collection for admin role
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', currentUser.email));
    const usersSnap = await getDocs(userQuery);
    
    if (!usersSnap.empty) {
      const userData = usersSnap.docs[0].data();
      return userData.role === 'admin';
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Helper to find first available page
function findFirstAvailablePage(permissions: any): string | null {
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

async function verifyPasswordPermissionAndRedirect(password: string, pageName: string): Promise<{ hasPermission: boolean; redirectUrl: string | null }> {
  try {
    // First check if user is admin
    const isAdmin = await checkIfAdmin();
    if (isAdmin) {
      return { hasPermission: true, redirectUrl: null };
    }

    // Search all teams for a member with this password
    const teamsRef = collection(db, 'teams');
    const teamsSnap = await getDocs(teamsRef);
    
    for (const teamDoc of teamsSnap.docs) {
      const membersRef = collection(db, 'teams', teamDoc.id, 'members');
      const memberQuery = query(membersRef, where('password', '==', password));
      const membersSnap = await getDocs(memberQuery);
      
      if (!membersSnap.empty) {
        const memberDoc = membersSnap.docs[0];
        const permissions = memberDoc.data().permissions || {};
        
        const hasPagePermission = checkPermission(permissions, pageName);
        
        if (hasPagePermission) {
          return { hasPermission: true, redirectUrl: null };
        } else {
          // Password is correct but no permission for this page
          // Find their first allowed page
          const firstPage = findFirstAvailablePage(permissions);
          return { hasPermission: false, redirectUrl: firstPage };
        }
      }
    }
    
    // Also check users collection directly
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('password', '==', password));
    const usersSnap = await getDocs(userQuery);
    
    if (!usersSnap.empty) {
      const userDoc = usersSnap.docs[0];
      const permissions = userDoc.data().permissions || {};
      
      const hasPagePermission = checkPermission(permissions, pageName);
      
      if (hasPagePermission) {
        return { hasPermission: true, redirectUrl: null };
      } else {
        const firstPage = findFirstAvailablePage(permissions);
        return { hasPermission: false, redirectUrl: firstPage };
      }
    }
    
    return { hasPermission: false, redirectUrl: null };
  } catch (error) {
    console.error('Error verifying password:', error);
    return { hasPermission: false, redirectUrl: null };
  }
}

// Helper function to check permission for a page
function checkPermission(permissions: any, pageName: string): boolean {
  const parts = pageName.split('.');
  
  if (parts.length === 1) {
    return permissions[pageName] === true;
  } else if (parts.length === 2) {
    const [parent, child] = parts;
    
    if (permissions[parent] && typeof permissions[parent] === 'object') {
      return permissions[parent][child] === true;
    }
    
    return permissions[pageName] === true;
  }
  
  return false;
}