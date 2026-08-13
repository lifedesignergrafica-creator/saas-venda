export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type FulfillmentType = 'PICKUP' | 'DELIVERY';
export type OrderStatus = 'RECEIVED' | 'IN_PRODUCTION' | 'SHIPPED' | 'READY_FOR_PICKUP' | 'DONE';

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  notification_email: string;
}

export interface ProductRow {
  id: string;
  store_id: string;
  name: string;
  image_url: string | null;
  price: number;
  stock_quantity: number;
  min_stock_alert: number;
  active: boolean;
}

export interface CustomerRow {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface DeliveryAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface OrderRow {
  id: string;
  store_id: string;
  customer_id: string;
  total_amount: number;
  payment_method: string;
  payment_status: PaymentStatus;
  fulfillment_type: FulfillmentType;
  delivery_address: DeliveryAddress | null;
  status: OrderStatus;
  gateway_payment_id: string | null;
  gateway_preference_id: string | null;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: 'Pedido recebido',
  IN_PRODUCTION: 'Em produção',
  SHIPPED: 'Enviado',
  READY_FOR_PICKUP: 'Pronto para retirada',
  DONE: 'Concluído',
};

// Ordem em que o lojista costuma avançar o pedido no painel.
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'RECEIVED',
  'IN_PRODUCTION',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DONE',
];
