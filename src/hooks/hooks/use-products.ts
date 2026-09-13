'use client';

import * as React from 'react';
import type { Product } from '@/lib/types';
import { handleApiResponse } from '@/lib/api-helpers';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/components/providers/auth-provider';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type ProductsContextType = {
  products: Product[];
  loading: boolean;
  createProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Omit<Product, 'id'>>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
};

const ProductsContext = React.createContext<ProductsContextType | null>(null);

export function useProducts() {
  const context = React.useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('name'));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedProducts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];
        setProducts(fetchedProducts);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching products:", err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: productsRef.path,
          operation: 'list'
        }));
        setLoading(false);
        setProducts([]);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createProduct = async (productData: Omit<Product, 'id'>) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });
    await handleApiResponse(res);
  };

  const updateProduct = async (id: string, productData: Partial<Omit<Product, 'id'>>) => {
     const res = await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...productData }),
    });
    await handleApiResponse(res);
  };
  
  const deleteProduct = async (id: string) => {
    const res = await fetch(`/api/products?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
  };

  const value = { products, loading, createProduct, updateProduct, deleteProduct };

  return React.createElement(ProductsContext.Provider, { value }, children);
}
