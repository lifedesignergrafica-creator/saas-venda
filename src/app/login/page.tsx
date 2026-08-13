'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Store, Loader2, Zap, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { signInWithGoogle, fetchGoogleProfile } from '@/lib/google-auth';
import { useAuthStore } from '@/lib/store';
import { db } from '@/lib/db';
import { useSync } from '@/lib/use-sync';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pullFromDrive } = useSync();

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const accessToken = await signInWithGoogle();
      const profile = await fetchGoogleProfile(accessToken);

      // Determine role: first-ever user becomes ADMIN, others must already
      // be registered by an admin (see /dashboard/users) as ATTENDANT.
      let localUser = await db.users.where('email').equals(profile.email).first();
      const anyUsers = await db.users.count();

      setSession(
        localUser ?? {
          id: crypto.randomUUID(),
          name: profile.name,
          email: profile.email,
          role: anyUsers === 0 ? 'ADMIN' : 'ATTENDANT',
          createdAt: new Date(),
        },
        accessToken
      );

      await pullFromDrive(accessToken, profile.email, profile.name);

      localUser = await db.users.where('email').equals(profile.email).first();
      if (!localUser) {
        setError(
          'Seu e-mail ainda não foi cadastrado por um administrador. Peça para ser adicionado em Configurações > Usuários.'
        );
        setLoading(false);
        return;
      }
      setSession(localUser, accessToken);

      router.push(localUser.role === 'ADMIN' ? '/dashboard' : '/pos');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Falha ao entrar com o Google.');
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      {/* background texture + glow orbs */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-violet-600/30 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-40 h-[380px] w-[380px] rounded-full bg-indigo-500/30 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-cyan-400/10 blur-[100px]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-2">
        {/* Left: hero */}
        <div className="fade-in">
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-violet-300">
            <Zap size={12} /> Novo — licença única, sem mensalidade
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">
            Controle sua loja com um{' '}
            <span className="grad-text">PDV moderno</span> que roda no seu navegador
          </h1>
          <p className="mt-4 max-w-md text-sm text-slate-400">
            Vendas, estoque e sincronização com o seu Google Drive, sem servidor, sem
            assinatura. Seus dados são só seus.
          </p>

          <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
            <div className="glass rounded-xl p-3">
              <Zap className="h-4 w-4 text-amber-300" />
              <p className="mt-1.5 text-xs font-semibold">Instantâneo</p>
              <p className="text-[11px] text-slate-400">Sem espera de rede</p>
            </div>
            <div className="glass rounded-xl p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <p className="mt-1.5 text-xs font-semibold">Seus dados</p>
              <p className="text-[11px] text-slate-400">Ficam no seu Drive</p>
            </div>
            <div className="glass rounded-xl p-3">
              <ImageIcon className="h-4 w-4 text-sky-300" />
              <p className="mt-1.5 text-xs font-semibold">Fotos por item</p>
              <p className="text-[11px] text-slate-400">Catálogo visual</p>
            </div>
          </div>
        </div>

        {/* Right: login card */}
        <div className="glass glow fade-in rounded-3xl p-7">
          <div className="mb-6 flex flex-col items-center gap-1 text-center">
            <div className="grad-btn mb-2 flex h-14 w-14 items-center justify-center rounded-2xl">
              <Store className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-lg font-bold">Entrar no painel</h2>
            <p className="text-xs text-slate-400">
              Gestão de vendas e estoque local-first, sincronizada com o seu Google Drive.
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="grad-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'Entrando...' : 'Entrar com Google'}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <p className="mt-5 text-center text-[11px] text-slate-500">
            O login real usa Google OAuth com escopo restrito (drive.appdata). Nenhum
            arquivo pessoal é acessado.
          </p>
        </div>
      </div>
    </main>
  );
}
