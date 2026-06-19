
import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cleanFirestoreData } from '@/lib/utils';

export async function createUserProfile(db: Firestore, profile: Omit<UserProfile, 'createdAt'>) {
  const docRef = doc(db, 'users', profile.uid);
  const rawData = {
    ...profile,
    createdAt: serverTimestamp(),
  };

  const data = cleanFirestoreData(rawData);

  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'write',
      requestResourceData: data,
    }));
  }
}

export async function getUserProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
