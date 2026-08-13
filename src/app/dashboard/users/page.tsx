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
      <h1 className="text-lg font-semibold text-slate-900">Usuários</h1>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-slate-500">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-500">
            E-mail (deve ser a conta Google do atendente)
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus size={14} /> Adicionar Atendente
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Perfil</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="flex items-center gap-2 px-4 py-2.5 font-medium text-slate-800">
                  <UserCog size={14} className="text-slate-400" />
                  {u.name}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === 'ADMIN'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {u.role === 'ADMIN' ? 'Administrador' : 'Atendente'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleRemove(u.id)}
                      className="rounded p-1.5 text-red-400 hover:bg-red-50"
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
