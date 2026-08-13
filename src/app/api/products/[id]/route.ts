import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyStoreAdminBySlug } from '@/lib/verify-admin';

/**
 * DELETE /api/products/[id]?storeSlug=minha-loja
 * Remove o produto da loja online quando ele é excluído no PDV local.
 * Exige o access_token do Google do ADMIN logado (mesma razão do POST).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const storeSlug = req.nextUrl.searchParams.get('storeSlug');
    if (!storeSlug) {
      return NextResponse.json({ error: 'storeSlug é obrigatório.' }, { status: 400 });
    }

    const auth = await verifyStoreAdminBySlug(req, storeSlug);
    if (!auth.ok) {
      if (auth.status === 404) {
        // Loja online ainda não configurada — não é um erro fatal para o PDV local.
        return NextResponse.json({ ok: true, skipped: true });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    await supabase.from('products').delete().eq('id', id).eq('store_id', auth.storeId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}
