'use client';

import * as React from 'react';
import type { Phase } from '@/lib/types';
import { handleApiResponse } from '@/lib/api-helpers';

type PhasesContextType = {
  phases: Phase[];
  loading: boolean;
  createPhase: (data: Omit<Phase, 'id' | 'order' | 'isDefault'>) => Promise<void>;
  updatePhase: (id: string, data: Partial<Omit<Phase, 'id'>>) => Promise<void>;
  deletePhase: (id: string) => Promise<void>;
};

const PhasesContext = React.createContext<PhasesContextType | null>(null);

export function usePhases() {
  const context = React.useContext(PhasesContext);
  if (!context) {
    throw new Error('usePhases must be used within a PhasesProvider');
  }
  return context;
}

export function PhasesProvider({ children }: { children: React.ReactNode }) {
  const [phases, setPhases] = React.useState<Phase[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchPhases = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/phases', { cache: 'no-store' });
      const data = await handleApiResponse(res);
      setPhases(data || []);
    } catch (error) {
      console.error('Fetch phases error:', error);
      setPhases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPhases();
  }, [fetchPhases]);
  
  const createPhase = async (data: Omit<Phase, 'id' | 'order' | 'isDefault'>) => {
    const res = await fetch('/api/phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await handleApiResponse(res);
    await fetchPhases();
  };

  const updatePhase = async (id: string, data: Partial<Omit<Phase, 'id'>>) => {
    const res = await fetch('/api/phases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    await handleApiResponse(res);
    await fetchPhases();
  };

  const deletePhase = async (id: string) => {
    const res = await fetch(`/api/phases?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
    await fetchPhases();
  };

  const value = { phases, loading, createPhase, updatePhase, deletePhase };

  return React.createElement(PhasesContext.Provider, { value }, children);
}
