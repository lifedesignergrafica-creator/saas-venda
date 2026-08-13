'use client';

/**
 * Thin wrapper around Google Identity Services (GIS) for client-side OAuth.
 * We intentionally avoid a backend: this is a local-first app, so the
 * access token lives only in memory + sessionStorage on the client.
 *
 * Required env var: NEXT_PUBLIC_GOOGLE_CLIENT_ID
 *
 * Scopes:
 *  - drive.appdata: estritamente para o backup/sincronização no Drive
 *    (PRD seção 5.1 — nunca acessa arquivos pessoais do usuário).
 *  - userinfo.email: necessário para identificar QUEM está logado (usado
 *    para decidir ADMIN vs ATENDENTE e, no backend, para verificar que
 *    quem chama as rotas administrativas é de fato o dono da loja — ver
 *    src/lib/verify-admin.ts). Sem este escopo, o endpoint de userinfo do
 *    Google recusa o token com "insufficient scope" e a app não consegue
 *    saber o e-mail de quem entrou.
 */
const SCOPE =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';
const TOKEN_STORAGE_KEY = 'gdrive_access_token';
const TOKEN_EXPIRY_KEY = 'gdrive_token_expiry';

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoaded: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoaded;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    clearStoredToken();
    return null;
  }
  return token;
}

export function clearStoredToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
}

function storeToken(token: string, expiresInSeconds: number) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  sessionStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + expiresInSeconds * 1000 - 60_000)
  );
}

/**
 * Triggers the Google OAuth consent popup and resolves with an access
 * token scoped strictamente a drive.appdata.
 */
export async function signInWithGoogle(): Promise<string> {
  await loadGisScript();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado. Defina no arquivo .env.local'
    );
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        storeToken(response.access_token, response.expires_in ?? 3600);
        resolve(response.access_token);
      },
      error_callback: (err: any) => reject(err),
    });
    client.requestAccessToken();
  });
}

export async function fetchGoogleProfile(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Não foi possível obter o perfil do Google');
  return res.json() as Promise<{ email: string; name: string; picture?: string }>;
}

export function signOutGoogle() {
  const token = getStoredToken();
  clearStoredToken();
  if (token && typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}
