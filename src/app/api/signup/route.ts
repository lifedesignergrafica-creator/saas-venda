import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createSubscription } from '@/lib/mercadopago-subscription';

/**
 * POST /api/signup
 * Cria uma nova loja (tenant) no sistema central e devolve o link do
 * Mercado Pago para o lojista autorizar a assinatura mensal do plano
 * escolhido. A loja começa em "trialing" (14 dias) mesmo antes de
 * autorizar o pagamento, para o lojista poder configurar tudo antes de
 * pagar; o acesso é bloqueado automaticamente se o trial acabar sem
 * assinatura ativa (ver checkStoreActive em plan-limits.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeName, slug, ownerEmail, notificationEmail, planSlug } = body;

    if (!storeName || !slug || !ownerEmail || !planSlug) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'O identificador da loja (slug) só pode ter letras minúsculas, números e hífen.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: plan } = await supabase.from('plans').select('*').eq('slug', planSlug).single();
    if (!plan) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }

    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        name: storeName,
        slug,
        owner_email: ownerEmail,
        notification_email: notificationEmail || ownerEmail,
        plan_id: plan.id,
        subscription_status: 'trialing',
      })
      .select()
      .single();

    if (error || !store) {
      if ((error as any)?.code === '23505') {
        return NextResponse.json({ error: 'Já existe uma loja com esse identificador.' }, { status: 409 });
      }
      throw error;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const subscription = await createSubscription({
      storeId: store.id,
      payerEmail: ownerEmail,
      planName: plan.name,
      priceCents: plan.price_cents,
      baseUrl,
    });

    return NextResponse.json({
      storeId: store.id,
      slug: store.slug,
      subscriptionCheckoutUrl: subscription.init_point,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}
