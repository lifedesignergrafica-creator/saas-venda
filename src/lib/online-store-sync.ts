'use client';

import { Product } from './types';
import { useAuthStore } from './store';

/**
 * Replica o catálogo do PDV local (IndexedDB) para a loja online (Supabase),
 * em segundo plano — "best effort": se a loja online ainda não estiver
 * configurada (sem NEXT_PUBLIC_STORE_SLUG) ou o Supabase estiver fora do ar,
 * o PDV local continua funcionando normalmente, apenas a réplica falha
 * silenciosamente (log no console).
 *
 * As rotas /api/products exigem o access_token do Google do ADMIN logado
 * (verificado no servidor) — por isso ele é enviado aqui no header
 * Authorization, e não apenas confiado a partir da tela.
 */

const STORE_SLUG = process.env.NEXT_PUBLIC_STORE_SLUG || '';

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function syncProductToOnlineStore(product: Product, active = true) {
  if (!STORE_SLUG) return; // loja online não configurada neste ambiente
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        storeSlug: STORE_SLUG,
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price,
        stockQuantity: product.stockQuantity,
        minStockAlert: product.minStockAlert,
        active,
        category: product.category || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn('Loja online não sincronizada:', data.error ?? res.status);
    }
  } catch (e) {
    console.warn('Falha ao sincronizar produto com a loja online:', e);
  }
}

export async function removeProductFromOnlineStore(productId: string) {
  if (!STORE_SLUG) return;
  try {
    await fetch(`/api/products/${productId}?storeSlug=${STORE_SLUG}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch (e) {
    console.warn('Falha ao remover produto da loja online:', e);
  }
}
