'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import type { Customer } from '@/lib/types';
import { handleApiResponse } from '@/lib/api-helpers';

type CustomersContextType = {
  customers: Customer[];
  loading: boolean;
  createCustomer: (customerData: Omit<Customer, 'id' | 'joinDate' | 'contact'> & { email?: string }) => Promise<void>;
  updateCustomer: (id: string, customerData: Partial<Omit<Customer, 'id' | 'joinDate' | 'contact'>>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
};

const CustomersContext = createContext<CustomersContextType | null>(null);

export function useCustomers() {
  const context = useContext(CustomersContext);
  if (!context) {
    throw new Error('useCustomers must be used within a CustomersProvider');
  }
  return context;
}

export function CustomersProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers', { cache: 'no-store' });
      const data = await handleApiResponse(res);
      setCustomers(data || []);
    } catch (error) {
      console.error('Fetch customers error:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCustomer = async (customerData: Omit<Customer, 'id' | 'joinDate' | 'contact'> & { email?: string }) => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerData),
    });
    await handleApiResponse(res);
    await fetchCustomers();
  };

  const updateCustomer = async (id: string, customerData: Partial<Omit<Customer, 'id' | 'joinDate' | 'contact'>> & { email?: string }) => {
    const res = await fetch('/api/customers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...customerData }),
    });
    await handleApiResponse(res);
    await fetchCustomers();
  };

  const deleteCustomer = async (id: string) => {
    const res = await fetch(`/api/customers?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
    await fetchCustomers();
  };

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const value: CustomersContextType = {
    customers,
    loading,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  };

  return React.createElement(CustomersContext.Provider, { value }, children);
}
