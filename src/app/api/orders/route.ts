import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createPaymentPreference } from '@/lib/mercadopago';
import { DeliveryAddress, FulfillmentType } from '@/lib/store-types';
import { verifyStoreAdminBySlug } from '@/lib/verify-admin';
import { checkOrderLimit } from '@/lib/plan-limits';

/**
 * GET /api/orders?storeSlug=minha-loja
 * Usado pelo painel do lojista (/dashboard/orders) para listar os pedidos
 * da loja online, com os itens e os dados do cliente já resolvidos.
 *
 * Exige o access_token do Google do ADMIN logado (header Authorization) —
 * esta rota expõe nome/telefone/e-mail/endereço de clientes, então não pode
 * ficar aberta para quem apenas souber a URL.
 */
export async function GET(req: NextRequest) {
  try {
    const storeSlug = req.nextUrl.searchParams.get('storeSlug');
    if (!storeSlug) {
      return NextResponse.json({ error: 'storeSlug é obrigatório.' }, { status: 400 });
    }

    const auth = await verifyStoreAdminBySlug(req, storeSlug);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*)')
      .eq('store_id', auth.storeId)
      .order('created_at', { ascending: false });
    if (ordersError) throw ordersError;

    return NextResponse.json({ orders: orders ?? [] });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}

interface CreateOrderBody {
  storeSlug: string;
  customer: { name: string; phone: string; email?: string };
  fulfillmentType: FulfillmentType;
  deliveryAddress?: DeliveryAddress;
  items: { productId: string; quantity: number }[];
}

/**
 * POST /api/orders
 * Cria o pedido (payment_status = pending) e devolve a URL de checkout do
 * Mercado Pago. O pedido só é confirmado de fato quando o webhook recebe a
 * notificação de pagamento aprovado (ver /api/webhooks/mercadopago).
 */
export async function POST(req: NextRequest) {
  try {
    const body: CreateOrderBody = await req.json();

    if (!body.storeSlug || !body.customer?.name || !body.customer?.phone || !body.items?.length) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    // Limites de tamanho e sanitização básica — este é um formulário público,
    // sem login, então qualquer texto pode chegar aqui. Além de UX (evitar
    // nomes gigantes quebrando a UI/e-mails), corta tentativas de injetar
    // quebras de linha (usadas depois no assunto do e-mail) ou payloads
    // enormes.
    const MAX_TEXT_LEN = 200;
    if (
      body.customer.name.length > MAX_TEXT_LEN ||
      body.customer.phone.length > 40 ||
      (body.customer.email && body.customer.email.length > MAX_TEXT_LEN)
    ) {
      return NextResponse.json({ error: 'Dados do cliente muito longos.' }, { status: 400 });
    }
    if (body.customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer.email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }
    body.customer.name = body.customer.name.replace(/[\r\n]/g, ' ').trim();
    if (body.items.length > 50) {
      return NextResponse.json({ error: 'Pedido com muitos itens.' }, { status: 400 });
    }

    // Nunca confiar em quantidades vindas do cliente sem validar: um valor
    // negativo ou fracionário poderia ser usado para manipular o total
    // cobrado ou, pior, "devolver" estoque via decrement_stock na confirmação.
    const MAX_QTY_PER_ITEM = 999;
    for (const item of body.items) {
      if (
        !item.productId ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > MAX_QTY_PER_ITEM
      ) {
        return NextResponse.json({ error: 'Quantidade de item inválida.' }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', body.storeSlug)
      .single();
    if (storeError || !store) {
      return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
    }

    // Loja com assinatura vencida/cancelada, ou que já bateu o limite de
    // pedidos/mês do plano, não pode receber novos pedidos pagos — evita que
    // o lojista use o sistema de graça além do contratado.
    const orderLimit = await checkOrderLimit(store.id);
    if (!orderLimit.ok) {
      return NextResponse.json({ error: orderLimit.error }, { status: orderLimit.status });
    }

    const productIds = body.items.map((i) => i.productId);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('store_id', store.id);
    if (productsError || !products || products.length !== productIds.length) {
      return NextResponse.json({ error: 'Um ou mais produtos não foram encontrados.' }, { status: 404 });
    }

    for (const item of body.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.stock_quantity < item.quantity) {
        return NextResponse.json(
          { error: `Estoque insuficiente para "${product?.name ?? item.productId}".` },
          { status: 409 }
        );
      }
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        store_id: store.id,
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email ?? null,
      })
      .select()
      .single();
    if (customerError || !customer) {
      return NextResponse.json({ error: 'Erro ao registrar cliente.' }, { status: 500 });
    }

    const totalAmount = body.items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return sum + product.price * item.quantity;
    }, 0);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        store_id: store.id,
        customer_id: customer.id,
        total_amount: totalAmount,
        payment_method: 'PIX',
        payment_status: 'pending',
        fulfillment_type: body.fulfillmentType,
        delivery_address: body.fulfillmentType === 'DELIVERY' ? body.deliveryAddress : null,
        status: 'RECEIVED',
      })
      .select()
      .single();
    if (orderError || !order) {
      return NextResponse.json({ error: 'Erro ao criar pedido.' }, { status: 500 });
    }

    const orderItemsPayload = body.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
      };
    });
    await supabase.from('order_items').insert(orderItemsPayload);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const preference = await createPaymentPreference({
      orderId: order.id,
      payerEmail: body.customer.email,
      baseUrl,
      items: orderItemsPayload.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
    });

    await supabase
      .from('orders')
      .update({ gateway_preference_id: preference.id })
      .eq('id', order.id);

    return NextResponse.json({
      orderId: order.id,
      checkoutUrl: preference.init_point,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}
