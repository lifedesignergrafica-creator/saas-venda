import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabase-server';

/**
 * Verifica que quem está chamando uma rota administrativa (listar pedidos,
 * mudar status, criar/excluir produto) é de fato o dono da loja — e não
 * apenas "alguém que descobriu a URL".
 *
 * Reaproveita o login Google que o painel já usa para o Drive: o navegador
 * envia o access_token do Google (obtido no /login) no header Authorization.
 * Aqui validamos esse token DIRETO com o Google (nunca confiamos em um
 * e-mail que o próprio cliente alegue ser seu) e conferimos se o e-mail
 * retornado bate com o `owner_email` cadastrado para a loja.
 *
 * Isso é propositalmente simples (sem sessão de servidor, sem cookies) para
 * caber na arquitetura atual — mas fecha o buraco mais grave: hoje o
 * RBAC do painel é só visual (Zustand/localStorage), e sem essa checagem
 * qualquer pessoa que soubesse a URL da API conseguiria ler pedidos e
 * dados de clientes, ou alterar o catálogo, sem nunca passar pela tela.
 */

type VerifyResult =
  | { ok: true; storeId: string; email: string }
  | { ok: false; status: number; error: string };

async function getVerifiedGoogleEmail(req: NextRequest): Promise<
  { ok: true; email: string } | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, status: 401, error: 'Não autenticado.' };
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!profileRes.ok) {
    return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
  }
  const profile: { email?: string } = await profileRes.json();
  if (!profile.email) {
    return { ok: false, status: 401, error: 'Não foi possível verificar o e-mail.' };
  }
  return { ok: true, email: profile.email };
}

/** Usa quando a rota já sabe o slug da loja (ex: vindo do body ou query string). */
export async function verifyStoreAdminBySlug(req: NextRequest, storeSlug: string): Promise<VerifyResult> {
  const auth = await getVerifiedGoogleEmail(req);
  if (!auth.ok) return auth;

  const supabase = getSupabaseAdmin();
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, owner_email')
    .eq('slug', storeSlug)
    .single();
  if (error || !store) {
    return { ok: false, status: 404, error: 'Loja não encontrada.' };
  }
  if (store.owner_email.toLowerCase() !== auth.email.toLowerCase()) {
    return { ok: false, status: 403, error: 'Sem permissão para esta loja.' };
  }
  return { ok: true, storeId: store.id, email: auth.email };
}

/** Usa quando a rota só tem o store_id à mão (ex: depois de já ter buscado um pedido/produto). */
export async function verifyStoreAdminByStoreId(req: NextRequest, storeId: string): Promise<VerifyResult> {
  const auth = await getVerifiedGoogleEmail(req);
  if (!auth.ok) return auth;

  const supabase = getSupabaseAdmin();
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, owner_email')
    .eq('id', storeId)
    .single();
  if (error || !store) {
    return { ok: false, status: 404, error: 'Loja não encontrada.' };
  }
  if (store.owner_email.toLowerCase() !== auth.email.toLowerCase()) {
    return { ok: false, status: 403, error: 'Sem permissão para esta loja.' };
  }
  return { ok: true, storeId: store.id, email: auth.email };
}
