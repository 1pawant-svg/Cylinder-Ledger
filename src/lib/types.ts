import { Timestamp } from 'firebase/firestore';

export type TransactionType = 'IN' | 'OUT' | 'OUT_FULL' | 'IN_EMPTY' | 'LEAKAGE' | 'LOST' | 'ADJUSTMENT';
export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  pan?: string;
  notes?: string;
  remarks?: string;
  specialInstructions?: string;
  collectionNotes?: string;
  status: CustomerStatus;
  balance: number; // Denormalized field for performance
  createdAt: Timestamp | string;
}

export interface Transaction {
  id: string;
  customerId: string;
  date: Timestamp | string;
  bsDate: string; 
  dueDate?: string; 
  type: TransactionType;
  quantity: number;
  remark?: string;
  status: 'active' | 'deleted';
  createdAt: Timestamp | string;
  createdBy?: string;
  createdByName?: string;
  editedAt?: Timestamp | string;
  editedBy?: string;
  editedByName?: string;
  deletedAt?: Timestamp | string;
  deletedBy?: string;
  deletedByName?: string;
  deleteReason?: string;
}

export interface Inventory {
  filledStock: number;
  emptyStock: number;
  updatedAt: Timestamp | string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  fullName: string | null;
  createdAt: Timestamp | string;
}

export interface Setting {
  businessName: string;
  address: string;
  phone: string;
  panNumber?: string;
  vatPercentage?: number;
  lastBackupAt?: Timestamp | string | Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: Timestamp | string;
}
