import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Removes undefined properties from an object before sending to Firestore.
 * Firestore accepts null but crashes on undefined.
 */
export function cleanFirestoreData<T extends object>(data: T): T {
  const cleaned = { ...data } as any;
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    } else if (cleaned[key] !== null && typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key]) && !(cleaned[key] instanceof Date)) {
      // Recursively clean nested objects (but skip arrays and Dates)
      // Check if it's a plain object (not a Firestore Timestamp or other class instance)
      if (cleaned[key].constructor === Object) {
        cleaned[key] = cleanFirestoreData(cleaned[key]);
      }
    }
  });
  return cleaned as T;
}
