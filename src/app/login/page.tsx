'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Store, Loader2 } from 'lucide-react';
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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Store size={24} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">SaaS Venda</h1>
          <p className="text-sm text-slate-500">
            Gestão de vendas e estoque local-first, sincronizada com o seu Google Drive.
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? 'Entrando...' : 'Entrar com Google'}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Seus dados ficam no seu navegador e na pasta privada do seu Google Drive.
          Nenhum arquivo pessoal é acessado.
        </p>
      </div>
    </main>
  );
}
