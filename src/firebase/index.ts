
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

export function initializeFirebase(): { 
  app: FirebaseApp | null; 
  firestore: Firestore | null; 
  auth: Auth | null 
} {
  const isConfigValid = !!firebaseConfig.apiKey && 
                        firebaseConfig.apiKey !== 'undefined' && 
                        firebaseConfig.apiKey !== '';
  
  if (!isConfigValid) {
    if (typeof window !== 'undefined') {
      console.warn('Firebase configuration is missing or invalid. Please check your environment variables.');
    }
    return { app: null, firestore: null, auth: null };
  }

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const firestore = getFirestore(app);
    const auth = getAuth(app);

    return { app, firestore, auth };
  } catch (error) {
    console.error('Failed to initialize Firebase services:', error);
    return { app: null, firestore: null, auth: null };
  }
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
