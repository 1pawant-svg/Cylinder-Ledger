import { 
  Firestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { AuditLog } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cleanFirestoreData } from '@/lib/utils';

export function logAction(db: Firestore, data: Omit<AuditLog, 'id' | 'timestamp'>) {
  const colRef = collection(db, 'audit_logs');
  const rawPayload = {
    ...data,
    timestamp: serverTimestamp(),
  };

  const payload = cleanFirestoreData(rawPayload);

  addDoc(colRef, payload).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: colRef.path,
      operation: 'create',
      requestResourceData: payload,
    }));
  });
}

export const getRecentLogsQuery = (db: Firestore, count: number = 50) => 
  query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(count));
