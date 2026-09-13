
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { handleApiResponse } from '@/lib/api-helpers';
import type { Expense, ExpenseCategory } from '@/lib/types';
import { toDateSafe } from '@/lib/date';

type ExpensesContextType = {
  expenses: Expense[];
  categories: ExpenseCategory[];
  loading: boolean;
  createExpense: (data: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
};

const ExpensesContext = createContext<ExpensesContextType | null>(null);

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpensesProvider');
  }
  return context;
}

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        fetch('/api/expenses', { cache: 'no-store' }),
        fetch('/api/expense-categories', { cache: 'no-store' }),
      ]);
      
      const expData = (await handleApiResponse(expRes) || []).map((e: any) => ({...e, date: toDateSafe(e.date)}));
      const catData = await handleApiResponse(catRes) || [];
      
      setExpenses(expData);
      setCategories(catData);
    } catch (error) {
      console.error('Failed to fetch expenses data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createExpense = async (data: Omit<Expense, 'id'>) => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await handleApiResponse(res);
    await fetchData();
  };

  const deleteExpense = async (id: string) => {
    const res = await fetch(`/api/expenses?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
    await fetchData();
  };

  const createCategory = async (name: string) => {
    const res = await fetch('/api/expense-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await handleApiResponse(res);
    await fetchData();
  };

  const deleteCategory = async (id: string) => {
    const res = await fetch(`/api/expense-categories?id=${id}`, {
      method: 'DELETE',
    });
    await handleApiResponse(res);
    await fetchData();
  };
  
  const value: ExpensesContextType = {
    expenses,
    categories,
    loading,
    createExpense,
    deleteExpense,
    createCategory,
    deleteCategory,
  };

  return React.createElement(ExpensesContext.Provider, { value }, children);
}
