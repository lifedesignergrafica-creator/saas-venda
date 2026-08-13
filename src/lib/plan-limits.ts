import { getSupabaseAdmin } from './supabase-server';

/**
 * Verifica se uma loja pode continuar operando (assinatura em dia) e se um
 * novo produto/pedido ainda cabe no limite do plano contratado. Chamado
 * pelas rotas de API antes de criar produto ou pedido — nunca confiamos
 * apenas no que o painel do lojista mostra na tela.
 */

type LimitCheck = { ok: true } | { ok: false; status: number; error: string };

export async function checkStoreActive(storeId: string): Promise<LimitCheck> {
  const supabase = getSupabaseAdmin();
  const { data: store } = await supabase
    .from('stores')
    .select('subscription_status, trial_ends_at')
    .eq('id', storeId)
    .single();

  if (!store) return { ok: false, status: 404, error: 'Loja não encontrada.' };

  if (store.subscription_status === 'active' || store.subscription_status === 'trialing') {
    if (store.subscription_status === 'trialing' && store.trial_ends_at) {
      if (new Date(store.trial_ends_at) < new Date()) {
        return {
          ok: false,
          status: 402,
          error: 'Período de teste encerrado. Assine um plano para continuar usando a loja online.',
        };
      }
    }
    return { ok: true };
  }

  return {
    ok: false,
    status: 402,
    error: 'Assinatura inativa. Regularize o pagamento para continuar usando a loja online.',
  };
}

export async function checkProductLimit(storeId: string): Promise<LimitCheck> {
  const active = await checkStoreActive(storeId);
  if (!active.ok) return active;

  const supabase = getSupabaseAdmin();
  const { data: store } = await supabase
    .from('stores')
    .select('plan_id, plans(max_products)')
    .eq('id', storeId)
    .single();

  const maxProducts = (store as any)?.plans?.max_products;
  if (maxProducts == null) return { ok: true }; // sem plano definido ou ilimitado

  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('active', true);

  if ((count ?? 0) >= maxProducts) {
    return {
      ok: false,
      status: 402,
      error: `Limite de ${maxProducts} produtos do seu plano atingido. Faça upgrade para cadastrar mais.`,
    };
  }
  return { ok: true };
}

export async function checkOrderLimit(storeId: string): Promise<LimitCheck> {
  const active = await checkStoreActive(storeId);
  if (!active.ok) return active;

  const supabase = getSupabaseAdmin();
  const { data: store } = await supabase
    .from('stores')
    .select('plan_id, plans(max_orders_per_month)')
    .eq('id', storeId)
    .single();

  const maxOrders = (store as any)?.plans?.max_orders_per_month;
  if (maxOrders == null) return { ok: true };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('created_at', startOfMonth.toISOString());

  if ((count ?? 0) >= maxOrders) {
    return {
      ok: false,
      status: 402,
      error: `Limite de ${maxOrders} pedidos/mês do seu plano atingido. Faça upgrade para continuar recebendo pedidos.`,
    };
  }
  return { ok: true };
}
