'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PaymentMethod, Product, SyncStatus, User } from './types';
import { getUnitPrice } from './pricing';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clear: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  paymentMethod: 'PIX',
  addItem: (product) =>
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { product, quantity: 1 }] };
    }),
  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) })),
  setQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.product.id === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0),
    })),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  clear: () => set({ items: [] }),
  total: () =>
    get().items.reduce((sum, i) => sum + getUnitPrice(i.product, i.quantity) * i.quantity, 0),
}));

interface AuthState {
  currentUser: User | null;
  accessToken: string | null;
  setSession: (user: User | null, token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      accessToken: null,
      setSession: (user, token) => set({ currentUser: user, accessToken: token }),
      logout: () => set({ currentUser: null, accessToken: null }),
    }),
    {
      name: 'saas_venda_auth',
      // O accessToken do Google NUNCA é persistido em localStorage — ele é
      // sensível (dá acesso ao Drive/identidade do usuário) e expira em
      // ~1h. Persistir só o currentUser deixa a sessão "lembrada" para a
      // troca de tela ser instantânea, mas exige um novo login (silencioso,
      // via GIS) para renovar o token antes de qualquer chamada real —
      // reduz a janela de exposição em caso de XSS.
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
);

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  setStatus: (status: SyncStatus) => void;
  markSynced: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'offline',
  lastSyncedAt: null,
  setStatus: (status) => set({ status }),
  markSynced: () => set({ status: 'synced', lastSyncedAt: new Date() }),
}));
