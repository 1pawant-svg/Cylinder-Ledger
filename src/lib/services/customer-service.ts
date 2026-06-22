
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { Customer, CustomerStatus } from '@/lib/types';
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

export const getCustomersQuery = (db: Firestore) => query(collection(db, 'customers'), orderBy('name', 'asc'));
