import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendCustomerStatusEmail } from '@/lib/email';
import { OrderStatus } from '@/lib/store-types';
import { verifyStoreAdminByStoreId } from '@/lib/verify-admin';

const VALID_STATUSES: OrderStatus[] = [
  'RECEIVED',
  'IN_PRODUCTION',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DONE',
];

/**
 * PATCH /api/orders/[id]/status
 * Body: { status: 'IN_PRODUCTION' | 'SHIPPED' | 'READY_FOR_PICKUP' | 'DONE' }
 *
 * Usado pelo painel do lojista (/dashboard/orders) para avançar o pedido.
 * Cada chamada dispara automaticamente o e-mail de status para o cliente —
 * é este endpoint que substitui o disparo de WhatsApp.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = (await req.json()) as { status: OrderStatus };

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (orderError || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    const auth = await verifyStoreAdminByStoreId(req, order.store_id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Só é possível avançar o status de pedidos com pagamento confirmado.' },
        { status: 409 }
      );
    }

    await supabase.from('orders').update({ status }).eq('id', id);

    const { data: historyRow } = await supabase
      .from('order_status_history')
      .insert({ order_id: id, status })
      .select()
      .single();

    const [{ data: customer }, { data: store }, { data: items }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', order.customer_id).single(),
      supabase.from('stores').select('*').eq('id', order.store_id).single(),
      supabase.from('order_items').select('*').eq('order_id', id),
    ]);

    let emailSent = false;
    if (customer?.email && store && items) {
      try {
        await sendCustomerStatusEmail({
          to: customer.email,
          customerName: customer.name,
          storeName: store.name,
          orderShortId: id.slice(0, 8),
          status,
          fulfillmentType: order.fulfillment_type,
          items,
          totalAmount: order.total_amount,
        });
        emailSent = true;
      } catch (e) {
        console.error('Falha ao enviar e-mail de status:', e);
      }
    }

    if (emailSent && historyRow) {
      await supabase
        .from('order_status_history')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', historyRow.id);
    }

    return NextResponse.json({ ok: true, emailSent });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}
