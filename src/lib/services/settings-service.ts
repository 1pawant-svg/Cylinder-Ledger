import { 
  Firestore, 
  doc, 
  setDoc,
  getDoc
} from 'firebase/firestore';
import { Setting } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cleanFirestoreData } from '@/lib/utils';

export function saveSettings(db: Firestore, data: Setting) {
  const docRef = doc(db, 'settings', 'config');
  const payload = cleanFirestoreData(data);

  console.log("Settings before cleanup", data);
  console.log("Settings after cleanup", payload);

  setDoc(docRef, payload, { merge: true }).catch(async (error) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: payload,
    }));
  });
}

export async function getSettings(db: Firestore): Promise<Setting | null> {
  const docRef = doc(db, 'settings', 'config');
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as Setting) : null;
}

export const getSettingsRef = (db: Firestore) => doc(db, 'settings', 'config');
