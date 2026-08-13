import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyStoreAdminBySlug } from '@/lib/verify-admin';

/**
 * GET /api/store/status?storeSlug=minha-loja
 * Usado pelo painel (/dashboard/assinatura) para mostrar o status atual da
 * assinatura, o plano contratado e os limites de uso.
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
    const { data: store } = await supabase
      .from('stores')
      .select('*, plans(*)')
      .eq('id', auth.storeId)
      .single();

    const { count: productCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', auth.storeId)
      .eq('active', true);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { count: orderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', auth.storeId)
      .gte('created_at', startOfMonth.toISOString());

    return NextResponse.json({
      store,
      usage: { products: productCount ?? 0, ordersThisMonth: orderCount ?? 0 },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}
