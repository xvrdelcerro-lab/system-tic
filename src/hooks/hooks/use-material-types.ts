'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import type { MaterialType } from '@/lib/types';
import { handleApiResponse } from '@/lib/api-helpers';

type MaterialTypesContextType = {
  materialTypes: MaterialType[];
  loading: boolean;
  createMaterialType: (data: Omit<MaterialType, 'id'>) => Promise<void>;
  updateMaterialType: (id: string, data: Partial<Omit<MaterialType, 'id'>>) => Promise<void>;
  deleteMaterialType: (id: string) => Promise<void>;
};

const MaterialTypesContext = createContext<MaterialTypesContextType | null>(null);

export function useMaterialTypes() {
  const context = useContext(MaterialTypesContext);
  if (!context) {
    throw new Error('useMaterialTypes must be used within a MaterialTypesProvider');
  }
  return context;
}

export function MaterialTypesProvider({ children }: { children: ReactNode }) {
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaterialTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/material-types', { cache: 'no-store' });
      const data = await handleApiResponse(res);
      setMaterialTypes(data || []);
    } catch (error) {
      console.error('Fetch material types error:', error);
      setMaterialTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterialTypes();
  }, [fetchMaterialTypes]);

  const createMaterialType = async (data: Omit<MaterialType, 'id'>) => {
    const res = await fetch('/api/material-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await handleApiResponse(res);
    await fetchMaterialTypes();
  };

  const updateMaterialType = async (id: string, data: Partial<Omit<MaterialType, 'id'>>) => {
    const res = await fetch('/api/material-types', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    await handleApiResponse(res);
    await fetchMaterialTypes();
  };

  const deleteMaterialType = async (id: string) => {
    const res = await fetch(`/api/material-types?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
    await fetchMaterialTypes();
  };

  const value = { materialTypes, loading, createMaterialType, updateMaterialType, deleteMaterialType };

  return React.createElement(MaterialTypesContext.Provider, { value }, children);
}
