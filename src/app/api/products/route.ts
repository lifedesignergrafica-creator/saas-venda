import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyStoreAdminBySlug } from '@/lib/verify-admin';
import { checkProductLimit } from '@/lib/plan-limits';

/**
 * POST /api/products
 * Upsert (cria ou atualiza) um produto na loja online, a partir do cadastro
 * feito no PDV (/dashboard/inventory). Usa o MESMO id do produto local
 * (IndexedDB) como id no Supabase, para manter os dois catálogos em espelho
 * sem precisar de uma tabela de mapeamento.
 *
 * Exige o access_token do Google do ADMIN logado — sem isso, qualquer pessoa
 * que soubesse o slug da loja conseguiria criar, sobrescrever ou "envenenar"
 * o catálogo público (preço, estoque, foto) sem nunca passar pela tela.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeSlug, id, name, imageUrl, price, stockQuantity, minStockAlert, active } = body;

    if (!storeSlug || !id || !name) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }
    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json({ error: 'Preço inválido.' }, { status: 400 });
    }
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return NextResponse.json({ error: 'Estoque inválido.' }, { status: 400 });
    }

    const auth = await verifyStoreAdminBySlug(req, storeSlug);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();

    // Limite de produtos só se aplica a produtos NOVOS (não bloqueia editar
    // um produto já existente, mesmo que a loja esteja no limite).
    const { data: existing } = await supabase.from('products').select('id').eq('id', id).maybeSingle();
    if (!existing) {
      const limit = await checkProductLimit(auth.storeId);
      if (!limit.ok) {
        return NextResponse.json({ error: limit.error }, { status: limit.status });
      }
    }

    const { error: upsertError } = await supabase.from('products').upsert({
      id,
      store_id: auth.storeId,
      name,
      image_url: imageUrl || null,
      price,
      stock_quantity: stockQuantity,
      min_stock_alert: minStockAlert,
      active: active ?? true,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) throw upsertError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}
