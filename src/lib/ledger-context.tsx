
"use client";

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { Customer, Transaction, UserProfile, CustomerStatus, TransactionType } from './types';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { 
  addCustomer as fsAddCustomer, 
  updateCustomer as fsUpdateCustomer, 
  updateCustomerStatus as fsUpdateCustomerStatus,
  deleteCustomer as fsDeleteCustomer,
  getCustomersQuery 
} from './services/customer-service';
import { 
  addTransaction as fsAddTransaction,
  deleteTransaction as fsDeleteTransaction,
  updateTransaction as fsUpdateTransaction,
  getTransactionsQuery 
} from './services/transaction-service';
import { getUserProfile } from './services/user-service';
import { toMillis } from './date-utils';

interface LedgerContextType {
  customers: Customer[];
  activeCustomers: Customer[];
  inactiveCustomers: Customer[];
  transactions: Transaction[];
  loading: boolean;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'status' | 'balance'>) => string;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  updateCustomerStatus: (id: string, status: CustomerStatus) => void;
  deleteCustomer: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'status'>) => void;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  deleteTransaction: (id: string, reason?: string) => void;
  getCustomerBalance: (customerId: string) => number;
  getCustomerTransactions: (customerId: string) => Transaction[];
  getStaffActivity: () => Array<{ name: string; count: number; volume: number }>;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useFirestore();
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  useEffect(() => {
    async function loadProfile() {
      if (db && user) {
        const profile = await getUserProfile(db, user.uid);
        setUserProfile(profile);
      }
    }
    loadProfile();
  }, [db, user]);

  const customersQuery = useMemo(() => (db && user) ? getCustomersQuery(db) : null, [db, user]);
  const transactionsQuery = useMemo(() => (db && user) ? getTransactionsQuery(db) : null, [db, user]);

  const { data: customersData, loading: customersLoading } = useCollection<Customer>(customersQuery);
  const { data: transactionsData, loading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);

  const customers = useMemo(() => customersData || [], [customersData]);
  const allTransactions = useMemo(() => transactionsData || [], [transactionsData]);
  const transactions = useMemo(() => allTransactions.filter(t => t.status !== 'deleted'), [allTransactions]);
  
  const loading = (!!customersQuery && customersLoading) || (!!transactionsQuery && transactionsLoading);

  const activeCustomers = useMemo(() => customers.filter(c => c.status === 'active' || !c.status), [customers]);
  const inactiveCustomers = useMemo(() => customers.filter(c => c.status === 'inactive'), [customers]);

  // Efficient indexing of transactions by customer ID
  const customerTransactionsMap = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      if (!map[t.customerId]) map[t.customerId] = [];
      map[t.customerId].push(t);
    });
    // Sort each customer's transactions by date
    Object.keys(map).forEach(cid => {
      map[cid].sort((a, b) => toMillis(b.date) - toMillis(a.date));
    });
    return map;
  }, [transactions]);

  const addCustomer = useCallback((customer: Omit<Customer, 'id' | 'createdAt' | 'status' | 'balance'>): string => {
    if (!db) return '';
    return fsAddCustomer(db, customer, user?.uid, userProfile?.fullName || user?.email || undefined);
  }, [db, user, userProfile]);

  const updateCustomer = useCallback((id: string, updated: Partial<Customer>) => {
    if (!db) return;
    const { id: _, createdAt: __, balance: ___, ...rest } = updated as any;
    fsUpdateCustomer(db, id, rest, user?.uid, userProfile?.fullName || user?.email || undefined);
  }, [db, user, userProfile]);

  const updateCustomerStatus = useCallback((id: string, status: CustomerStatus) => {
    if (!db) return;
    fsUpdateCustomerStatus(db, id, status, user?.uid, userProfile?.fullName || user?.email || undefined);
  }, [db, user, userProfile]);

  const deleteCustomer = useCallback((id: string) => {
    if (!db) return;
    fsDeleteCustomer(db, id, user?.uid, userProfile?.fullName || user?.email || undefined);
  }, [db, user, userProfile]);

  const addTransaction = useCallback((txn: Omit<Transaction, 'id' | 'createdAt' | 'status'>) => {
    if (!db) return;
    fsAddTransaction(db, txn, user?.uid, userProfile?.fullName || user?.email || undefined);
  }, [db, user, userProfile]);

  const updateTransaction = useCallback((id: string, data: Partial<Transaction>) => {
    if (!db || !user || !userProfile) return;
    fsUpdateTransaction(db, id, data, user.uid, userProfile.fullName || user.email || "User");
  }, [db, user, userProfile]);

  const deleteTransaction = useCallback((id: string, reason?: string) => {
    if (!db || !user || !userProfile) return;
    fsDeleteTransaction(db, id, user.uid, userProfile.fullName || user.email || "User", reason);
  }, [db, user, userProfile]);

  const getCustomerTransactions = useCallback((customerId: string) => {
    return customerTransactionsMap[customerId] || [];
  }, [customerTransactionsMap]);

  const getCustomerBalance = useCallback((customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    return cust?.balance || 0;
  }, [customers]);

  const getStaffActivity = useCallback(() => {
    const activityMap: Record<string, { count: number; volume: number }> = {};
    
    transactions.forEach(t => {
      const staffName = t.createdByName || 'System';
      if (!activityMap[staffName]) activityMap[staffName] = { count: 0, volume: 0 };
      activityMap[staffName].count += 1;
      activityMap[staffName].volume += t.quantity;
    });

    return Object.entries(activityMap).map(([name, stats]) => ({
      name,
      ...stats
    })).sort((a, b) => b.count - a.count);
  }, [transactions]);

  const value = useMemo(() => ({ 
    customers,
    activeCustomers,
    inactiveCustomers,
    transactions: allTransactions, 
    loading,
    addCustomer, 
    updateCustomer, 
    updateCustomerStatus,
    deleteCustomer, 
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getCustomerBalance,
    getCustomerTransactions,
    getStaffActivity
  }), [
    customers, 
    activeCustomers,
    inactiveCustomers,
    allTransactions, 
    loading, 
    addCustomer, 
    updateCustomer, 
    updateCustomerStatus,
    deleteCustomer, 
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getCustomerBalance, 
    getCustomerTransactions,
    getStaffActivity
  ]);

  return (
    <LedgerContext.Provider value={value}>
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = () => {
  const context = useContext(LedgerContext);
  if (!context) throw new Error('useLedger must be used within a LedgerProvider');
  return context;
};
