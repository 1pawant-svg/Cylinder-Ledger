import { Timestamp } from 'firebase/firestore';

export type TransactionType = 'IN' | 'OUT' | 'OUT_FULL' | 'IN_EMPTY' | 'LEAKAGE' | 'LOST' | 'ADJUSTMENT';
export type UserRole = 'admin' | 'staff';
export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  remarks?: string;
  specialInstructions?: string;
  collectionNotes?: string;
  status: CustomerStatus;
  createdAt: Timestamp | string;
}

export interface Transaction {
  id: string;
  customerId: string;
  date: Timestamp | string;
  bsDate: string; // The explicit Nepali date string (e.g., "2083-02-28")
  dueDate?: string; // Optional AD date string for return reminders
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
  displayName: string | null;
  role: UserRole;
  createdAt: Timestamp | string;
}

export interface Setting {
  businessName: string;
  address: string;
  phone: string;
  panNumber?: string;
  vatPercentage?: number;
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
