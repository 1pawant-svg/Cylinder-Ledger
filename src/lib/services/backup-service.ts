
import { 
  Firestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { logAction } from './audit-service';

export interface BackupData {
  customers: any[];
  transactions: any[];
  settings: any;
  exportedAt: string;
  version: string;
}

export async function exportBackup(db: Firestore, userId: string, userName: string): Promise<BackupData> {
  const customersSnap = await getDocs(collection(db, 'customers'));
  const transactionsSnap = await getDocs(collection(db, 'transactions'));
  const settingsSnap = await getDocs(collection(db, 'settings'));

  const data: BackupData = {
    customers: customersSnap.docs.map(d => ({ ...d.data(), id: d.id })),
    transactions: transactionsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
    settings: settingsSnap.docs.find(d => d.id === 'config')?.data() || {},
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

  await batch.commit();

  logAction(db, {
    userId,
    userName,
    action: 'RESTORE_BACKUP',
    entityType: 'SYSTEM',
    entityId: 'restore',
    details: `Database restored from backup dated ${backup.exportedAt}.`,
  });
}
