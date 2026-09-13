'use client';

import * as React from 'react';
import type { Product } from '@/lib/types';
import { handleApiResponse } from '@/lib/api-helpers';

export type ProductCategory = {
  id: string;
  name: string;
};

type ProductCategoriesContextType = {
  categories: ProductCategory[];
  loading: boolean;
  createCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
};

const ProductCategoriesContext = React.createContext<ProductCategoriesContextType | null>(null);

export function useProductCategories() {
  const context = React.useContext(ProductCategoriesContext);
  if (!context) {
    throw new Error('useProductCategories must be used within a ProductCategoriesProvider');
  }
  return context;
}

export function ProductCategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchCategories = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/product-categories', { cache: 'no-store' });
      const data = await handleApiResponse(res);
      setCategories(data || []);
    } catch (error) {
      console.error('Fetch product categories error:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (name: string) => {
    const res = await fetch('/api/product-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await handleApiResponse(res);
    await fetchCategories();
  };

  const updateCategory = async (id: string, name: string) => {
     const res = await fetch('/api/product-categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    await handleApiResponse(res);
    await fetchCategories();
  };
  
  const deleteCategory = async (id: string) => {
    const res = await fetch(`/api/product-categories?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
    await fetchCategories();
  };

  const value = { categories, loading, createCategory, updateCategory, deleteCategory };

  return React.createElement(ProductCategoriesContext.Provider, { value }, children);
}
