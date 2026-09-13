'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';
import { handleApiResponse } from '@/lib/api-helpers';

export type Account = {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
};

export type AccountCategory = {
  id: string;
  name: string;
};

export type AccountCategoryWithAccounts = {
  id: string;
  name: string;
  accounts: Account[];
};

type AccountsContextType = {
    accountCategories: AccountCategoryWithAccounts[];
    uncategorizedAccounts: Account[];
    allAccounts: Account[];
    loading: boolean;
    createCategory: (name: string) => Promise<void>;
    updateCategory: (id: string, name: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    createAccount: (accountData: Omit<Account, 'id'>) => Promise<void>;
    updateAccount: (id: string, accountData: Partial<Omit<Account, 'id'>>) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;
};

const AccountsContext = createContext<AccountsContextType | null>(null);

export function useAccounts() {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error('useAccounts must be used within an AccountsProvider');
  }
  return context;
}

export function AccountsProvider({ children }: { children: ReactNode }) {
    const [categories, setCategories] = useState<AccountCategory[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [catRes, accRes] = await Promise.all([
                fetch('/api/account-categories', { cache: 'no-store' }),
                fetch('/api/accounts', { cache: 'no-store' })
            ]);
            
            const catData = await handleApiResponse(catRes) || [];
            const accData = await handleApiResponse(accRes) || [];

            setCategories(catData);
            setAccounts(accData);
        } catch (error) {
            console.error('Failed to fetch accounts data:', error);
            setCategories([]);
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const { accountCategories, uncategorizedAccounts } = useMemo(() => {
        const categoryNames = new Set(categories.map(c => c.name));
        
        const grouped = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            accounts: accounts.filter(acc => acc.category === cat.name).sort((a,b) => a.name.localeCompare(b.name))
        })).sort((a,b) => a.name.localeCompare(b.name));
        
        const uncategorized = accounts
            .filter(acc => !acc.category || !categoryNames.has(acc.category))
            .sort((a,b) => a.name.localeCompare(b.name));

        return { accountCategories: grouped, uncategorizedAccounts: uncategorized };
    }, [categories, accounts]);

    const createCategory = async (name: string) => {
        const res = await fetch('/api/account-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        await handleApiResponse(res);
        await fetchData();
    };
    
    const updateCategory = async (id: string, name: string) => {
        const res = await fetch('/api/account-categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name }),
        });
        await handleApiResponse(res);
        await fetchData();
    };

    const deleteCategory = async (id: string) => {
        const res = await fetch(`/api/account-categories?id=${id}`, {
            method: 'DELETE',
        });
        await handleApiResponse(res);
        await fetchData();
    };

    const createAccount = async (accountData: Omit<Account, 'id'>) => {
        const res = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accountData),
        });
        await handleApiResponse(res);
        await fetchData();
    };

    const updateAccount = async (id: string, accountData: Partial<Omit<Account, 'id'>>) => {
        const res = await fetch('/api/accounts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...accountData }),
        });
        await handleApiResponse(res);
        await fetchData();
    };
    
    const deleteAccount = async (id: string) => {
        const res = await fetch(`/api/accounts?id=${id}`, {
            method: 'DELETE',
        });
        await handleApiResponse(res);
        await fetchData();
    };

    const value: AccountsContextType = {
        accountCategories,
        uncategorizedAccounts,
        allAccounts: accounts,
        loading,
        createCategory,
        updateCategory,
        deleteCategory,
        createAccount,
        updateAccount,
        deleteAccount,
    };

    return React.createElement(AccountsContext.Provider, { value }, children);
}
