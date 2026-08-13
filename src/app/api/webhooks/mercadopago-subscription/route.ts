import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { fetchSubscription } from '@/lib/mercadopago-subscription';

/**
 * POST /api/webhooks/mercadopago-subscription
 * Notificação do Mercado Pago sobre mudanças na assinatura recorrente do
 * lojista (autorizada, pausada, cancelada, pagamento recorrente falhou...).
 * Assim como no webhook de pedidos, nunca confiamos no payload — sempre
 * rebuscamos o status real da assinatura na API do Mercado Pago.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const preapprovalId: string | undefined =
      body?.data?.id ?? req.nextUrl.searchParams.get('id') ?? undefined;

    if (!preapprovalId) {
      return NextResponse.json({ ok: true });
    }

    const subscription = await fetchSubscription(preapprovalId);
    const storeId = subscription.external_reference;
    if (!storeId) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin();

    await supabase.from('subscription_events').insert({
      store_id: storeId,
      mp_preapproval_id: preapprovalId,
      status: subscription.status,
      raw_payload: body,
    });

    // Mapeamento status Mercado Pago -> status interno da loja.
    // authorized = pagamento em dia; paused/cancelled = acesso deve ser
    // suspenso; pending = ainda aguardando autorização inicial.
    let newStatus: 'active' | 'past_due' | 'canceled' | 'suspended' | null = null;
    if (subscription.status === 'authorized') newStatus = 'active';
    else if (subscription.status === 'paused') newStatus = 'past_due';
    else if (subscription.status === 'cancelled') newStatus = 'canceled';

    if (newStatus) {
      await supabase
        .from('stores')
        .update({ subscription_status: newStatus, mp_preapproval_id: preapprovalId })
        .eq('id', storeId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro no webhook de assinatura do Mercado Pago:', err);
    return NextResponse.json({ ok: true });
  }
}
