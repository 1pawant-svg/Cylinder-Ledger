
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
  where,
  getDocs,
  runTransaction
} from 'firebase/firestore';
import { Customer, CustomerStatus, Transaction } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { logAction } from './audit-service';
import { cleanFirestoreData } from '@/lib/utils';

/**
 * Checks if a phone number is already in use by another customer.
 */
export async function isPhoneUnique(db: Firestore, phone: string, excludeCustomerId?: string): Promise<boolean> {
  const colRef = collection(db, 'customers');
  const q = query(colRef, where('phone', '==', phone));
  const snap = await getDocs(q);
  
  if (snap.empty) return true;
  
  // If we are updating an existing customer, the one result found should be them
  if (excludeCustomerId && snap.docs.length === 1 && snap.docs[0].id === excludeCustomerId) {
    return true;
  }
  
  return false;
}

export async function addCustomer(db: Firestore, data: Omit<Customer, 'id' | 'createdAt' | 'status' | 'balance'>, userId?: string, userName?: string) {
  // Check uniqueness
  const isUnique = await isPhoneUnique(db, data.phone);
  if (!isUnique) {
    throw new Error('DUPLICATE_PHONE');
  }

  const colRef = collection(db, 'customers');
  const docRef = doc(colRef);
  const rawPayload = {
    ...data,
    status: 'active' as CustomerStatus,
    balance: 0, // Initial denormalized balance
    createdAt: serverTimestamp(),
  };

  const payload = cleanFirestoreData(rawPayload);

  try {
    await setDoc(docRef, payload);
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
    return docRef.id;
  } catch (error: any) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'create',
      requestResourceData: payload,
    }));
    throw error;
  }
}

export async function updateCustomer(db: Firestore, id: string, data: Partial<Omit<Customer, 'id' | 'createdAt' | 'balance'>>, userId?: string, userName?: string) {
  // Check uniqueness if phone is being changed
  if (data.phone) {
    const isUnique = await isPhoneUnique(db, data.phone, id);
    if (!isUnique) {
      throw new Error('DUPLICATE_PHONE');
    }
  }

  const docRef = doc(db, 'customers', id);
  const { id: _, createdAt: __, balance: ___, ...sanitizedData } = data as any;
  const updateData = cleanFirestoreData(sanitizedData);

  try {
    await updateDoc(docRef, updateData);
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
  } catch (error: any) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: updateData,
    }));
    throw error;
  }
}

export async function updateCustomerStatus(db: Firestore, id: string, status: CustomerStatus, userId?: string, userName?: string) {
  const docRef = doc(db, 'customers', id);
  const updateData = cleanFirestoreData({ status });

  try {
    await updateDoc(docRef, updateData);
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
  } catch (error: any) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: updateData,
    }));
    throw error;
  }
}

export async function deleteCustomer(db: Firestore, id: string, userId?: string, userName?: string) {
  const docRef = doc(db, 'customers', id);
  try {
    await deleteDoc(docRef);
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
  } catch (error: any) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    }));
    throw error;
  }
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
