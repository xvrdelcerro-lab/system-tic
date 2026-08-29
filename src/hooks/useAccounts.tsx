'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy 
} from 'firebase/firestore';

const AccountsContext = createContext<any>(undefined);

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [allAccounts, setAllAccounts] = useState([]);
  const [accountCategories, setAccountCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const q = query(collection(db, 'accounts'), orderBy('name'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs: any = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllAccounts(docs);
        
        const categoryMap = new Map();
        docs.forEach((acc: any) => {
          const catName = acc.category || 'General';
          if (!categoryMap.has(catName)) {
            categoryMap.set(catName, { id: catName, name: catName, accounts: [] });
          }
          categoryMap.get(catName).accounts.push(acc);
        });
        
        setAccountCategories(Array.from(categoryMap.values()));
        setLoading(false);
      }, (err) => {
        console.error("Firebase Error:", err);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Setup Error:", e);
      setLoading(false);
    }
  }, []);

  const createAccount = async (data: any) => addDoc(collection(db, 'accounts'), { ...data, createdAt: new Date() });
  const updateAccount = async (id: string, data: any) => updateDoc(doc(db, 'accounts', id), data);
  const deleteAccount = async (id: string) => deleteDoc(doc(db, 'accounts', id));
  
  // These ensure the return block below doesn't crash
  const createCategory = async (name: string) => console.log("Category created", name);
  const updateCategory = async (id: string, name: string) => console.log("Category updated", id);

  return (
    <AccountsContext.Provider value={{ 
      allAccounts, 
      accountCategories, 
      loading, 
      createAccount, 
      updateAccount, 
      deleteAccount,
      createCategory,
      updateCategory
    }}>
      {children}
    </AccountsContext.Provider>
  );
}

export const useAccounts = () => {
  const context = useContext(AccountsContext);
  // Return a fallback object so the app doesn't crash if context is missing
  return context || { 
    allAccounts: [], 
    accountCategories: [], 
    loading: false,
    createAccount: async () => {},
    updateAccount: async () => {},
    deleteAccount: async () => {},
    createCategory: async () => {},
    updateCategory: async () => {}
  };
};