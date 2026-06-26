
import { 
  Firestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc,
  getDoc
} from 'firebase/firestore';
import { logAction } from './audit-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface BackupData {
  customers: any[];
  transactions: any[];
  settings: any;
  exportedAt: string;
  version: string;
}

export async function exportBackup(db: Firestore, userId: string, userName: string): Promise<BackupData | null> {
  try {
    const [customersSnap, transactionsSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'customers')),
      getDocs(collection(db, 'transactions')),
      getDoc(doc(db, 'settings', 'config'))
    ]);

    const data: BackupData = {
      customers: customersSnap.docs.map(d => ({ ...d.data(), id: d.id })),
      transactions: transactionsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
      settings: settingsSnap.exists() ? settingsSnap.data() : {},
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    logAction(db, {
      userId,
      userName,
      action: 'EXPORT_BACKUP',
      entityType: 'SYSTEM',
      entityId: 'backup',
      details: `Database backup exported containing ${data.customers.length} customers and ${data.transactions.length} transactions.`,
    });

    return data;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'collections/backup',
        operation: 'list',
      }));
    }
    throw error;
  }
}

export async function restoreBackup(db: Firestore, backup: BackupData, userId: string, userName: string) {
  const batch = writeBatch(db);

  // Restore Settings
  if (backup.settings) {
    const settingsRef = doc(db, 'settings', 'config');
    batch.set(settingsRef, backup.settings, { merge: true });
  }

  // Restore Customers
  backup.customers.forEach(cust => {
    const { id, ...data } = cust;
    const ref = doc(db, 'customers', id);
    batch.set(ref, data, { merge: true });
  });

  // Restore Transactions
  backup.transactions.forEach(txn => {
    const { id, ...data } = txn;
    const ref = doc(db, 'transactions', id);
    batch.set(ref, data, { merge: true });
  });

  try {
    await batch.commit();

    logAction(db, {
      userId,
      userName,
      action: 'RESTORE_BACKUP',
      entityType: 'SYSTEM',
      entityId: 'restore',
      details: `Database restored from backup dated ${backup.exportedAt}.`,
    });
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'collections/restore',
        operation: 'write',
        requestResourceData: backup,
      }));
    }
    throw error;
  }
}
