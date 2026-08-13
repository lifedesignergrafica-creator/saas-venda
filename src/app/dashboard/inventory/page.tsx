'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/db';
import { useSync } from '@/lib/use-sync';
import { Product } from '@/lib/types';
import { syncProductToOnlineStore, removeProductFromOnlineStore } from '@/lib/online-store-sync';

type FormState = {
  id?: string;
  name: string;
  imageUrl: string;
  price: string;
  stockQuantity: string;
  minStockAlert: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  imageUrl: '',
  price: '',
  stockQuantity: '',
  minStockAlert: '5',
};

function ProductModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [listedOnline, setListedOnline] = useState(true);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const now = new Date();

    const product: Product = {
      id: form.id ?? crypto.randomUUID(),
      name: form.name,
      imageUrl: form.imageUrl,
      price: parseFloat(form.price) || 0,
      stockQuantity: parseInt(form.stockQuantity, 10) || 0,
      minStockAlert: parseInt(form.minStockAlert, 10) || 5,
      createdAt: form.id ? (await db.products.get(form.id))?.createdAt ?? now : now,
      updatedAt: now,
    };

    if (form.id) {
      await db.products.update(form.id, product);
    } else {
      await db.products.add(product);
    }

    // Replica para a loja online (Supabase) em segundo plano — não bloqueia
    // o salvamento local, que continua instantâneo.
    syncProductToOnlineStore(product, listedOnline);

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {form.id ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Nome</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Imagem (upload ou URL)</label>
            <input type="file" accept="image/*" onChange={handleFile} className="mt-1 text-xs" />
            <input
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Preço (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Estoque</label>
              <input
                required
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Alerta mín.</label>
              <input
                required
                type="number"
                min="0"
                value={form.minStockAlert}
                onChange={(e) => setForm((f) => ({ ...f, minStockAlert: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={listedOnline}
              onChange={(e) => setListedOnline(e.target.checked)}
            />
            Exibir este produto na loja online (link de venda)
          </label>
          <button
            type="submit"
            disabled={saving}
            className="mt-2 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar Produto'}
          </button>
        </form>
      </div>
    </div>
  );
}

function InventoryContent() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const [editing, setEditing] = useState<FormState | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const { pushToDrive } = useSync();

  const visible = onlyLow
    ? products.filter((p) => p.stockQuantity <= p.minStockAlert)
    : products;

  function openEdit(p: Product) {
    setEditing({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      price: String(p.price),
      stockQuantity: String(p.stockQuantity),
      minStockAlert: String(p.minStockAlert),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este produto?')) return;
    await db.products.delete(id);
    removeProductFromOnlineStore(id);
    pushToDrive();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Estoque</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
            />
            Apenas estoque baixo
          </label>
          <button
            onClick={() => setEditing(EMPTY_FORM)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Plus size={14} /> Novo Produto
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2">Preço</th>
              <th className="px-4 py-2">Estoque</th>
              <th className="px-4 py-2">Alerta</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const low = p.stockQuantity <= p.minStockAlert;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-slate-50 ${low ? 'bg-red-50/60' : ''}`}
                >
                  <td className="flex items-center gap-2 px-4 py-2.5">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-100" />
                    )}
                    <span className="font-medium text-slate-800">{p.name}</span>
                  </td>
                  <td className="px-4 py-2.5">R$ {p.price.toFixed(2)}</td>
                  <td className={`px-4 py-2.5 ${low ? 'font-semibold text-red-600' : ''}`}>
                    {p.stockQuantity}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{p.minStockAlert}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="rounded p-1.5 text-red-400 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            pushToDrive();
          }}
        />
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <AuthGuard allow={['ADMIN']}>
      <AppShell>
        <InventoryContent />
      </AppShell>
    </AuthGuard>
  );
}
