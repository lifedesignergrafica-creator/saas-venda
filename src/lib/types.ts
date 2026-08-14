export type Role = 'ADMIN' | 'ATTENDANT';
export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export type WholesaleMode = 'VALUE' | 'PERCENTAGE';

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  stockQuantity: number;
  minStockAlert: number;
  createdAt: Date;
  updatedAt: Date;
  // Preço de atacado: a partir de `wholesaleMinQty` unidades do MESMO
  // produto no carrinho, o preço unitário passa a usar a regra de atacado
  // em vez do preço normal (varejo). `wholesaleMode` decide como o valor de
  // atacado é lançado: 'VALUE' = preço fixo por unidade, 'PERCENTAGE' =
  // percentual de desconto aplicado sobre `price`.
  wholesaleEnabled?: boolean;
  wholesaleMinQty?: number;
  wholesaleMode?: WholesaleMode;
  wholesaleValue?: number;
  // Categoria livre do produto (ex.: "Bolos", "Doces", "Bebidas"), usada para
  // agrupar/filtrar no estoque e na loja online.
  category?: string;
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
