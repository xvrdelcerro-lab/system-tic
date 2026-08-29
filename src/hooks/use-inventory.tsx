'use client';

import { useState, createContext, useContext, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/components/providers/auth-provider';
import type { Vendor } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { handleApiResponse } from '@/lib/api-helpers';

type InventoryContextType = {
  vendors: Vendor[];
  loading: boolean;
  createVendor: (vendor: any) => Promise<void>;
  updateVendor: (id: string, vendor: Partial<Omit<Vendor, 'id'>>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  allItems: (Vendor['items'][number] & { id: string; vendorName: string; vendorId: string; })[]
};

const InventoryContext = createContext<InventoryContextType | null>(null);

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}

export function InventoryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
        setVendors([]);
        setLoading(false);
        return;
    }

    setLoading(true);
    const vendorsRef = collection(db, 'vendors');
    const q = query(vendorsRef, orderBy('name'));

    const unsubscribe = onSnapshot(q,
        (snapshot) => {
            const fetchedVendors = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                joinDate: doc.data().joinDate?.toDate ? doc.data().joinDate.toDate().toISOString() : doc.data().joinDate,
            })) as Vendor[];
            setVendors(fetchedVendors);
            setLoading(false);
        },
        (err) => {
            console.error("Error fetching vendors:", err);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: vendorsRef.path,
                operation: 'list'
            }));
            setLoading(false);
            setVendors([]);
        }
    );

    return () => unsubscribe();
  }, [user]);

  const createVendor = async (vendorData: any) => {
    const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData),
    });
    await handleApiResponse(res);
  };
  
  const updateVendor = async (id: string, vendorData: Partial<Omit<Vendor, 'id'>>) => {
    const res = await fetch('/api/vendors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...vendorData }),
    });
    await handleApiResponse(res);
  };

  const deleteVendor = async (id: string) => {
    const res = await fetch(`/api/vendors?id=${id}`, {
        method: 'DELETE',
    });
    await handleApiResponse(res);
  };

  const allItems = useMemo(() => {
    return vendors.flatMap(vendor =>
      vendor.items?.map(item => ({
        id: `${vendor.id}-${item.sku}`,
        ...item,
        vendorName: vendor.name,
        vendorId: vendor.id,
      })) ?? []
    ).sort((a, b) => a.item.localeCompare(b.item));
  }, [vendors]);

  const value = {
      vendors,
      loading,
      createVendor,
      updateVendor,
      deleteVendor,
      allItems,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}
