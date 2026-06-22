
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { Customer, CustomerStatus, Transaction } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { logAction } from './audit-service';
import { cleanFirestoreData } from '@/lib/utils';

export function addCustomer(db: Firestore, data: Omit<Customer, 'id' | 'createdAt' | 'status' | 'balance'>, userId?: string, userName?: string) {
  const colRef = collection(db, 'customers');
  const docRef = doc(colRef);
  const rawPayload = {
    ...data,
    status: 'active' as CustomerStatus,
    balance: 0, // Initial denormalized balance
    createdAt: serverTimestamp(),
  };

  const payload = cleanFirestoreData(rawPayload);

  setDoc(docRef, payload).then(() => {
    if (userId && userName) {
      logAction(db, {
        userId,
        userName,
        action: 'CREATE_CUSTOMER',
        entityType: 'CUSTOMER',
        entityId: docRef.id,
        details: `Created customer profile for ${data.name}`,
      });
    }
  }).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'create',
      requestResourceData: payload,
    }));
  });

  return docRef.id;
}

export function updateCustomer(db: Firestore, id: string, data: Partial<Omit<Customer, 'id' | 'createdAt' | 'balance'>>, userId?: string, userName?: string) {
  const docRef = doc(db, 'customers', id);
  const { id: _, createdAt: __, balance: ___, ...sanitizedData } = data as any;
  const updateData = cleanFirestoreData(sanitizedData);

  updateDoc(docRef, updateData).then(() => {
    if (userId && userName) {
      const isNoteUpdate = Object.keys(data).length === 1 && ('notes' in data || 'remarks' in data || 'collectionNotes' in data || 'specialInstructions' in data);
      logAction(db, {
        userId,
        userName,
        action: isNoteUpdate ? 'UPDATE_NOTES' : 'UPDATE_CUSTOMER',
        entityType: 'CUSTOMER',
        entityId: id,
        details: `Updated details for customer ${id}`,
      });
    }
  }).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: updateData,
    }));
  });
}

export function updateCustomerStatus(db: Firestore, id: string, status: CustomerStatus, userId?: string, userName?: string) {
  const docRef = doc(db, 'customers', id);
  const updateData = cleanFirestoreData({ status });

  updateDoc(docRef, updateData).then(() => {
    if (userId && userName) {
      logAction(db, {
        userId,
        userName,
        action: 'UPDATE_CUSTOMER_STATUS',
        entityType: 'CUSTOMER',
        entityId: id,
        details: `Status changed to ${status} for customer ${id}`,
      });
    }
  }).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: updateData,
    }));
  });
}

export function deleteCustomer(db: Firestore, id: string, userId?: string, userName?: string) {
  const docRef = doc(db, 'customers', id);
  deleteDoc(docRef).then(() => {
    if (userId && userName) {
      logAction(db, {
        userId,
        userName,
        action: 'DELETE_CUSTOMER',
        entityType: 'CUSTOMER',
        entityId: id,
        details: `Deleted customer profile ${id}`,
      });
    }
  }).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    }));
  });
}

/**
 * Re-calculates and fixes the denormalized balance of a customer based on all their transactions.
 */
export async function recalculateCustomerBalance(db: Firestore, customerId: string, transactions: Transaction[], userId: string, userName: string) {
  const activeTransactions = transactions.filter(t => t.customerId === customerId && t.status !== 'deleted');
  
  let calculatedBalance = 0;
  activeTransactions.forEach(t => {
    const type = t.type.toUpperCase();
    if (type === 'OUT' || type === 'OUT_FULL') calculatedBalance += t.quantity;
    else if (type === 'IN' || type === 'IN_EMPTY' || type === 'LEAKAGE' || type === 'LOST' || type === 'ADJUSTMENT') calculatedBalance -= t.quantity;
  });

  const customerRef = doc(db, 'customers', customerId);
  
  try {
    await updateDoc(customerRef, { balance: calculatedBalance });
    logAction(db, {
      userId,
      userName,
      action: 'RECALCULATE_BALANCE',
      entityType: 'CUSTOMER',
      entityId: customerId,
      details: `Manually recalculated balance to ${calculatedBalance} PCS.`,
    });
    return calculatedBalance;
  } catch (error) {
    console.error("Failed to recalculate balance:", error);
    throw error;
  }
}

export const getCustomersQuery = (db: Firestore) => query(collection(db, 'customers'), orderBy('name', 'asc'));
