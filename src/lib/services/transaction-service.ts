
import { 
  Firestore, 
  collection, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  runTransaction 
} from 'firebase/firestore';
import { Transaction, Inventory, Customer, TransactionType } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { logAction } from './audit-service';
import { getInventoryRef, getInventoryImpact } from './inventory-service';
import { cleanFirestoreData } from '@/lib/utils';

/**
 * Calculates the balance impact of a transaction type on the customer.
 */
function getCustomerBalanceImpact(type: TransactionType, quantity: number): number {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return quantity;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -quantity;
  return 0;
}

export async function addTransaction(db: Firestore, data: Omit<Transaction, 'id' | 'createdAt' | 'status'>, userId?: string, userName?: string) {
  let txnId = '';
  
  const rawPayload = {
    ...data,
    status: 'active' as const,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
    createdByName: userName || null,
  };

  const payload = cleanFirestoreData(rawPayload);

  try {
    await runTransaction(db, async (transaction) => {
      const colRef = collection(db, 'transactions');
      const txnDocRef = doc(colRef);
      txnId = txnDocRef.id;

      const customerRef = doc(db, 'customers', data.customerId);
      const inventoryRef = getInventoryRef(db);
      
      const [custSnap, invSnap] = await Promise.all([
        transaction.get(customerRef),
        transaction.get(inventoryRef)
      ]);

      if (!custSnap.exists()) throw new Error("Customer not found");

      // 1. Update Inventory
      let currentInv: Inventory = invSnap.exists() 
        ? invSnap.data() as Inventory 
        : { filledStock: 0, emptyStock: 0, updatedAt: new Date().toISOString() };

      const { filledDelta, emptyDelta } = getInventoryImpact(data.type, data.quantity);
      
      // 2. Update Customer Balance
      const currentCust = custSnap.data() as Customer;
      const balanceDelta = getCustomerBalanceImpact(data.type, data.quantity);
      const newBalance = (currentCust.balance || 0) + balanceDelta;

      // Commit Operations
      transaction.set(txnDocRef, payload);
      transaction.update(customerRef, { balance: newBalance });

      const invUpdatePayload = cleanFirestoreData({
        filledStock: (currentInv.filledStock || 0) + filledDelta,
        emptyStock: (currentInv.emptyStock || 0) + emptyDelta,
        updatedAt: serverTimestamp()
      });

      if (!invSnap.exists()) {
        transaction.set(inventoryRef, invUpdatePayload);
      } else {
        transaction.update(inventoryRef, invUpdatePayload);
      }
    });

    if (userId && userName && txnId) {
      logAction(db, {
        userId,
        userName,
        action: 'CREATE_TRANSACTION',
        entityType: 'TRANSACTION',
        entityId: txnId,
        details: `${data.type} transaction of ${data.quantity} PCS recorded for ${data.customerId}. Balance updated.`,
      });
    }
    return txnId;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'transactions/atomic',
        operation: 'create',
        requestResourceData: payload,
      } satisfies SecurityRuleContext));
    }
    throw error;
  }
}

export async function updateTransaction(db: Firestore, id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'status'>>, userId: string, userName: string) {
  const docRef = doc(db, 'transactions', id);
  const rawUpdateData = {
    ...data,
    editedAt: serverTimestamp(),
    editedBy: userId,
    editedByName: userName,
  };

  const updateData = cleanFirestoreData(rawUpdateData);

  try {
    await runTransaction(db, async (transaction) => {
      const txnSnap = await transaction.get(docRef);
      if (!txnSnap.exists()) throw new Error("Transaction not found");
      
      const oldTxn = txnSnap.data() as Transaction;
      const customerRef = doc(db, 'customers', oldTxn.customerId);
      const inventoryRef = getInventoryRef(db);
      
      const [custSnap, invSnap] = await Promise.all([
        transaction.get(customerRef),
        transaction.get(inventoryRef)
      ]);

      if (!custSnap.exists()) throw new Error("Customer not found");

      // Calculate Deltas
      const oldInvImpact = getInventoryImpact(oldTxn.type, oldTxn.quantity);
      const newType = data.type || oldTxn.type;
      const newQty = data.quantity !== undefined ? data.quantity : oldTxn.quantity;
      const newInvImpact = getInventoryImpact(newType, newQty);

      const oldBalImpact = getCustomerBalanceImpact(oldTxn.type, oldTxn.quantity);
      const newBalImpact = getCustomerBalanceImpact(newType, newQty);

      const filledDelta = newInvImpact.filledDelta - oldInvImpact.filledDelta;
      const emptyDelta = newInvImpact.emptyDelta - oldInvImpact.emptyDelta;
      const balanceDelta = newBalImpact - oldBalImpact;

      const currentCust = custSnap.data() as Customer;
      const currentInv: Inventory = invSnap.exists() 
        ? invSnap.data() as Inventory 
        : { filledStock: 0, emptyStock: 0, updatedAt: new Date().toISOString() };

      // Commit
      transaction.update(docRef, updateData);
      transaction.update(customerRef, { balance: (currentCust.balance || 0) + balanceDelta });

      const invUpdatePayload = cleanFirestoreData({
        filledStock: (currentInv.filledStock || 0) + filledDelta,
        emptyStock: (currentInv.emptyStock || 0) + emptyDelta,
        updatedAt: serverTimestamp()
      });

      if (!invSnap.exists()) {
        transaction.set(inventoryRef, invUpdatePayload);
      } else {
        transaction.update(inventoryRef, invUpdatePayload);
      }
    });

    logAction(db, {
      userId,
      userName,
      action: 'UPDATE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: id,
      details: `Updated transaction ${id}. Adjusted balance and inventory impact.`,
    });
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: updateData,
      } satisfies SecurityRuleContext));
    }
    throw error;
  }
}

export async function deleteTransaction(db: Firestore, id: string, userId: string, userName: string, reason: string = "Deleted by admin") {
  const docRef = doc(db, 'transactions', id);
  
  try {
    await runTransaction(db, async (transaction) => {
      const txnSnap = await transaction.get(docRef);
      if (!txnSnap.exists()) return;
      
      const oldTxn = txnSnap.data() as Transaction;
      if (oldTxn.status === 'deleted') return;

      const customerRef = doc(db, 'customers', oldTxn.customerId);
      const inventoryRef = getInventoryRef(db);
      
      const [custSnap, invSnap] = await Promise.all([
        transaction.get(customerRef),
        transaction.get(inventoryRef)
      ]);

      const impact = getInventoryImpact(oldTxn.type, oldTxn.quantity);
      const balImpact = getCustomerBalanceImpact(oldTxn.type, oldTxn.quantity);
      
      const deleteData = cleanFirestoreData({
        status: 'deleted' as const,
        deletedAt: serverTimestamp(),
        deletedBy: userId,
        deletedByName: userName,
        deleteReason: reason,
      });

      transaction.update(docRef, deleteData);

      if (custSnap.exists()) {
        const currentCust = custSnap.data() as Customer;
        transaction.update(customerRef, { balance: (currentCust.balance || 0) - balImpact });
      }

      const currentInv: Inventory = invSnap.exists() 
        ? invSnap.data() as Inventory 
        : { filledStock: 0, emptyStock: 0, updatedAt: new Date().toISOString() };

      const invUpdatePayload = cleanFirestoreData({
        filledStock: (currentInv.filledStock || 0) - impact.filledDelta,
        emptyStock: (currentInv.emptyStock || 0) - impact.emptyDelta,
        updatedAt: serverTimestamp()
      });

      if (!invSnap.exists()) {
        transaction.set(inventoryRef, invUpdatePayload);
      } else {
        transaction.update(inventoryRef, invUpdatePayload);
      }
    });

    logAction(db, {
      userId,
      userName,
      action: 'DELETE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: id,
      details: `Soft deleted transaction ${id}. Reversed balance and inventory impact.`,
    });
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: { status: 'deleted' },
      } satisfies SecurityRuleContext));
    }
    throw error;
  }
}

export const getTransactionsQuery = (db: Firestore) => query(collection(db, 'transactions'), orderBy('date', 'desc'));
