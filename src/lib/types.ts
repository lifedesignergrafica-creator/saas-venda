export type Role = 'ADMIN' | 'ATTENDANT';
export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  stockQuantity: number;
  minStockAlert: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  attendantId: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  items: SaleItem[];
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';
