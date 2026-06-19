
import { 
  Firestore, 
  doc, 
  getDoc, 
  Transaction as FsTransaction 
} from 'firebase/firestore';
import { Inventory, TransactionType } from '@/lib/types';

const INVENTORY_DOC_ID = 'current';

export const getInventoryRef = (db: Firestore) => doc(db, 'inventory', INVENTORY_DOC_ID);

export async function getInventory(db: Firestore): Promise<Inventory | null> {
  const snap = await getDoc(getInventoryRef(db));
  return snap.exists() ? (snap.data() as Inventory) : null;
}

/**
 * Calculates the inventory impact of a specific transaction type.
 * Note: Impact on "Stock" (the business's warehouse).
 * OUT_FULL: Business loses a full cylinder.
 * IN_EMPTY: Business gains an empty cylinder.
 */
export function getInventoryImpact(type: TransactionType, quantity: number) {
  const t = type.toUpperCase();
  let filledDelta = 0;
  let emptyDelta = 0;

  switch (t) {
    case 'OUT_FULL':
    case 'OUT':
      filledDelta = -quantity;
      break;
    case 'IN_EMPTY':
    case 'IN':
      emptyDelta = quantity;
      break;
    case 'LEAKAGE':
      // Business gets back a leaking cylinder (usually treated as empty/to-refill)
      emptyDelta = quantity;
      break;
    case 'LOST':
      // No stock return, business effectively loses the shell from circulation
      break;
    case 'ADJUSTMENT':
      // Manual adjustment handled specifically if needed
      break;
  }

  return { filledDelta, emptyDelta };
}
