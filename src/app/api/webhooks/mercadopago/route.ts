import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { fetchPayment } from '@/lib/mercadopago';
import { sendCustomerStatusEmail, sendNewOrderNotificationEmail } from '@/lib/email';

/**
 * POST /api/webhooks/mercadopago
 * O Mercado Pago chama esta rota quando o status de um pagamento muda.
 * Nunca confiamos apenas no payload do webhook — sempre buscamos o
 * pagamento de volta na API do Mercado Pago para confirmar o status real
 * antes de liberar o pedido (evita fraude via webhook falsificado).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const paymentId: string | undefined = body?.data?.id ?? req.nextUrl.searchParams.get('id') ?? undefined;

    if (!paymentId) {
      // Mercado Pago também manda notificações de outros tipos (ex: merchant_order);
      // respondemos 200 para não gerar retentativas desnecessárias.
      return NextResponse.json({ ok: true });
    }

    const payment = await fetchPayment(paymentId);
    const orderId = payment.external_reference;
    if (!orderId) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin();
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) {
      return NextResponse.json({ ok: true });
    }

    // Defesa em profundidade: além de confirmar o status direto na API do
    // Mercado Pago (nunca no payload do webhook), conferimos que o valor
    // pago bate com o total do pedido. Isso não deveria divergir em uso
    // normal (a preferência é criada pelo nosso backend com os valores
    // corretos), mas barra qualquer tentativa de pagar um valor menor e
    // ainda assim liberar o pedido.
    const amountMatches =
      typeof payment.transaction_amount === 'number' &&
      Math.abs(payment.transaction_amount - Number(order.total_amount)) < 0.01;

    if (payment.status === 'approved' && !amountMatches) {
      console.error(
        `Webhook MP: valor pago (${payment.transaction_amount}) não bate com o pedido ${order.id} (${order.total_amount}). Pedido NÃO liberado.`
      );
      return NextResponse.json({ ok: true });
    }

    if (payment.status === 'approved' && order.payment_status !== 'paid') {
      // Baixa de estoque + confirmação do pedido (idempotente: só roda na primeira aprovação)
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      for (const item of items ?? []) {
        if (!item.product_id) continue;
        await supabase.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        }).then(async (res) => {
          // Fallback simples caso a function RPC não exista no projeto ainda:
          if (res.error) {
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .single();
            if (product) {
              await supabase
                .from('products')
                .update({ stock_quantity: Math.max(0, product.stock_quantity - item.quantity) })
                .eq('id', item.product_id);
            }
          }
        });
      }

      await supabase
        .from('orders')
        .update({ payment_status: 'paid', gateway_payment_id: String(payment.id), status: 'RECEIVED' })
        .eq('id', order.id);

      await supabase.from('order_status_history').insert({ order_id: order.id, status: 'RECEIVED' });

      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', order.customer_id)
        .single();
      const { data: store } = await supabase
        .from('stores')
        .select('*')
        .eq('id', order.store_id)
        .single();

      if (customer && store && items) {
        if (customer.email) {
          await sendCustomerStatusEmail({
            to: customer.email,
            customerName: customer.name,
            storeName: store.name,
            orderShortId: order.id.slice(0, 8),
            status: 'RECEIVED',
            fulfillmentType: order.fulfillment_type,
            items,
            totalAmount: order.total_amount,
          }).catch((e) => console.error('Falha ao enviar e-mail ao cliente:', e));
        }
        await sendNewOrderNotificationEmail({
          to: store.notification_email,
          storeName: store.name,
          orderShortId: order.id.slice(0, 8),
          customerName: customer.name,
          customerPhone: customer.phone,
          fulfillmentType: order.fulfillment_type,
          deliveryAddress: order.delivery_address,
          items,
          totalAmount: order.total_amount,
        }).catch((e) => console.error('Falha ao notificar lojista:', e));
      }
    } else if (['rejected', 'cancelled'].includes(payment.status ?? '')) {
      await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', order.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro no webhook do Mercado Pago:', err);
    // Retornamos 200 mesmo em erro para evitar reenvio agressivo do MP;
    // o erro fica registrado no log do servidor para investigação.
    return NextResponse.json({ ok: true });
  }
}
