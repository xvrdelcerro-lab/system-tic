'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import type { Scale } from '@/lib/types';
import { handleApiResponse } from '@/lib/api-helpers';

type ScalesContextType = {
  scales: Scale[];
  loading: boolean;
  createScale: (name: string, type: string) => Promise<void>;
  updateScale: (id: string, name: string, type: string) => Promise<void>;
  deleteScale: (id: string) => Promise<void>;
};

const ScalesContext = createContext<ScalesContextType | null>(null);

export function useScales() {
  const context = useContext(ScalesContext);
  if (!context) {
    throw new Error('useScales must be used within a ScalesProvider');
  }
  return context;
}

export function ScalesProvider({ children }: { children: ReactNode }) {
  const [scales, setScales] = useState<Scale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scales', { cache: 'no-store' });
      const data = await handleApiResponse(res);
      setScales(data || []);
    } catch (err) {
      console.error('Fetch scales error:', err);
      setScales([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScales();
  }, [fetchScales]);

  const createScale = async (name: string, type: string) => {
    const res = await fetch('/api/scales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    });
    await handleApiResponse(res);
    await fetchScales();
  };

  const updateScale = async (id: string, name: string, type: string) => {
    const res = await fetch('/api/scales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, type }),
    });
    await handleApiResponse(res);
    await fetchScales();
  };

  const deleteScale = async (id: string) => {
    const res = await fetch(`/api/scales?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
    await fetchScales();
  };

  const value = { scales, loading, createScale, updateScale, deleteScale };

  return React.createElement(ScalesContext.Provider, { value }, children);
}
