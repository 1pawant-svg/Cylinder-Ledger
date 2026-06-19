
"use client";

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { Customer, Transaction, UserProfile, CustomerStatus, TransactionType } from './types';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
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
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'status'>) => string;
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

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
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

  const stats = useMemo(() => {
    const tMap: Record<string, Transaction[]> = {};
    const bMap: Record<string, number> = {};

    transactions.forEach(t => {
      const cid = t.customerId;
      if (!tMap[cid]) tMap[cid] = [];
      tMap[cid].push(t);

      const q = t.quantity || 0;
      const impact = getTransactionImpact(t.type);
      
      if (!bMap[cid]) bMap[cid] = 0;
      bMap[cid] += (q * impact);
    });

    customers.forEach(c => {
      if (bMap[c.id] === undefined) bMap[c.id] = 0;
      if (tMap[c.id]) {
        tMap[c.id].sort((a, b) => toMillis(b.date) - toMillis(a.date));
      } else {
        tMap[c.id] = [];
      }
    });

    return { balanceMap: bMap, customerTransactionsMap: tMap };
  }, [customers, transactions]);

  const addCustomer = useCallback((customer: Omit<Customer, 'id' | 'createdAt' | 'status'>): string => {
    if (!db) return '';
    return fsAddCustomer(db, customer, user?.uid, userProfile?.fullName || user?.email || undefined);
  }, [db, user, userProfile]);

  const updateCustomer = useCallback((id: string, updated: Partial<Customer>) => {
    if (!db) return;
    const { id: _, createdAt: __, ...rest } = updated;
    fsUpdateCustomer(db, id, rest as any, user?.uid, userProfile?.fullName || user?.email || undefined);
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
    fsUpdateTransaction(db, id, data as any, user.uid, userProfile.fullName || user.email || "User");
  }, [db, user, userProfile]);

  const deleteTransaction = useCallback((id: string, reason?: string) => {
    if (!db || !user || !userProfile) return;
    fsDeleteTransaction(db, id, user.uid, userProfile.fullName || user.email || "User", reason);
  }, [db, user, userProfile]);

  const getCustomerTransactions = useCallback((customerId: string) => {
    return stats.customerTransactionsMap[customerId] || [];
  }, [stats.customerTransactionsMap]);

  const getCustomerBalance = useCallback((customerId: string) => {
    return stats.balanceMap[customerId] || 0;
  }, [stats.balanceMap]);

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
