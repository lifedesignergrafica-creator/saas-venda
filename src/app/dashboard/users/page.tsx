'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, UserCog } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/db';
import { useSync } from '@/lib/use-sync';
import { useAuthStore } from '@/lib/store';

function UsersContent() {
  const users = useLiveQuery(() => db.users.toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { pushToDrive } = useSync();
  const currentUser = useAuthStore((s) => s.currentUser);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const exists = await db.users.where('email').equals(email.trim().toLowerCase()).first();
    if (exists) {
      setError('Já existe um usuário com este e-mail.');
      return;
    }
    await db.users.add({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'ATTENDANT',
      createdAt: new Date(),
    });
    setName('');
    setEmail('');
    pushToDrive();
  }

  async function handleRemove(id: string) {
    if (id === currentUser?.id) {
      setError('Você não pode remover seu próprio usuário.');
      return;
    }
    if (!confirm('Remover este atendente?')) return;
    await db.users.delete(id);
    pushToDrive();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-100">Usuários</h1>

      <form onSubmit={handleAdd} className="glass flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div className="min-w-[160px] flex-1">
          <label className="text-xs font-medium text-slate-400">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="text-xs font-medium text-slate-400">
            E-mail (deve ser a conta Google do atendente)
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60"
          />
        </div>
        <button
          type="submit"
          className="grad-btn flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/40"
        >
          <Plus size={14} /> Adicionar Atendente
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-slate-400">
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Perfil</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="flex items-center gap-2 px-4 py-2.5 font-medium text-slate-200">
                  <UserCog size={14} className="text-slate-500" />
                  {u.name}
                </td>
                <td className="px-4 py-2.5 text-slate-400">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === 'ADMIN'
                        ? 'grad-btn text-white'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {u.role === 'ADMIN' ? 'Administrador' : 'Atendente'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleRemove(u.id)}
                      className="rounded p-1.5 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AuthGuard allow={['ADMIN']}>
      <AppShell>
        <UsersContent />
      </AppShell>
    </AuthGuard>
  );
}
