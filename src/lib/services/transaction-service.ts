import { 
  Firestore, 
  collection, 
  doc, 
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { Transaction, Inventory } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { logAction } from './audit-service';
import { getInventoryRef, getInventoryImpact } from './inventory-service';
import { cleanFirestoreData } from '@/lib/utils';

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

  console.log("[DEV] Transaction Before Cleanup:", rawPayload);
  console.log("[DEV] Transaction After Cleanup (Saving):", payload);

  try {
    await runTransaction(db, async (transaction) => {
      const colRef = collection(db, 'transactions');
      const txnDocRef = doc(colRef);
      txnId = txnDocRef.id;
      const inventoryRef = getInventoryRef(db);
      
      const invSnap = await transaction.get(inventoryRef);
      let currentInv: Inventory = invSnap.exists() 
        ? invSnap.data() as Inventory 
        : { filledStock: 0, emptyStock: 0, updatedAt: new Date().toISOString() };

      const { filledDelta, emptyDelta } = getInventoryImpact(data.type, data.quantity);
      
      transaction.set(txnDocRef, payload);

      const updatePayload = cleanFirestoreData({
        filledStock: (currentInv.filledStock || 0) + filledDelta,
        emptyStock: (currentInv.emptyStock || 0) + emptyDelta,
        updatedAt: serverTimestamp()
      });

      if (!invSnap.exists()) {
        transaction.set(inventoryRef, updatePayload);
      } else {
        transaction.update(inventoryRef, updatePayload);
      }
    });

    if (userId && userName && txnId) {
      logAction(db, {
        userId,
        userName,
        action: 'CREATE_TRANSACTION',
        entityType: 'TRANSACTION',
        entityId: txnId,
        details: `${data.type} transaction of ${data.quantity} PCS recorded.`,
      });
    }
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'transactions/atomic',
        operation: 'create',
        requestResourceData: payload,
      } satisfies SecurityRuleContext));
    }
    throw error;
  }
}

export function updateTransaction(db: Firestore, id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt' | 'status'>>, userId: string, userName: string) {
  const docRef = doc(db, 'transactions', id);
  const rawUpdateData = {
    ...data,
    editedAt: serverTimestamp(),
    editedBy: userId,
    editedByName: userName,
  };

  const updateData = cleanFirestoreData(rawUpdateData);

  console.log("[DEV] Transaction Update Before Cleanup:", rawUpdateData);
  console.log("[DEV] Transaction Update After Cleanup:", updateData);

  updateDoc(docRef, updateData).then(() => {
    logAction(db, {
      userId,
      userName,
      action: 'UPDATE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: id,
      details: `Updated transaction ${id}`,
    });
  }).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: updateData,
    } satisfies SecurityRuleContext));
  });
}

export function deleteTransaction(db: Firestore, id: string, userId: string, userName: string, reason: string = "Deleted by admin") {
  const docRef = doc(db, 'transactions', id);
  const rawDeleteData = {
    status: 'deleted' as const,
    deletedAt: serverTimestamp(),
    deletedBy: userId,
    deletedByName: userName,
    deleteReason: reason || "No reason provided",
  };

  const deleteData = cleanFirestoreData(rawDeleteData);

  updateDoc(docRef, deleteData).then(() => {
    logAction(db, {
      userId,
      userName,
      action: 'DELETE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: id,
      details: `Soft deleted transaction ${id}.`,
    });
  }).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: deleteData,
    } satisfies SecurityRuleContext));
  });
}

export const getTransactionsQuery = (db: Firestore) => query(collection(db, 'transactions'), orderBy('date', 'desc'));
