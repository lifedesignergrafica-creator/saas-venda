'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/db';
import { useSync } from '@/lib/use-sync';
import { Product, WholesaleMode } from '@/lib/types';
import { DEFAULT_WHOLESALE_MIN_QTY } from '@/lib/pricing';
import { syncProductToOnlineStore, removeProductFromOnlineStore } from '@/lib/online-store-sync';

type FormState = {
  id?: string;
  name: string;
  imageUrl: string;
  price: string;
  stockQuantity: string;
  minStockAlert: string;
  wholesaleEnabled: boolean;
  wholesaleMinQty: string;
  wholesaleMode: WholesaleMode;
  wholesaleValue: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  imageUrl: '',
  price: '',
  stockQuantity: '',
  minStockAlert: '5',
  wholesaleEnabled: false,
  wholesaleMinQty: String(DEFAULT_WHOLESALE_MIN_QTY),
  wholesaleMode: 'VALUE',
  wholesaleValue: '',
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
      wholesaleEnabled: form.wholesaleEnabled,
      wholesaleMinQty: parseInt(form.wholesaleMinQty, 10) || DEFAULT_WHOLESALE_MIN_QTY,
      wholesaleMode: form.wholesaleMode,
      wholesaleValue: form.wholesaleValue ? parseFloat(form.wholesaleValue) : undefined,
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="glass fade-in w-full max-w-md rounded-2xl p-5"
        style={{ background: 'rgba(15,17,28,0.95)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            {form.id ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400">Nome</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400">Imagem (upload ou URL)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="mt-1 text-xs text-slate-400"
          />
            <input
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-400">Preço (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Estoque</label>
              <input
                required
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Alerta mín.</label>
              <input
                required
                type="number"
                min="0"
                value={form.minStockAlert}
                onChange={(e) => setForm((f) => ({ ...f, minStockAlert: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={listedOnline}
              onChange={(e) => setListedOnline(e.target.checked)}
            />
            Exibir este produto na loja online (link de venda)
          </label>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={form.wholesaleEnabled}
                onChange={(e) => setForm((f) => ({ ...f, wholesaleEnabled: e.target.checked }))}
              />
              Ativar preço de atacado
            </label>

            {form.wholesaleEnabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-400">
                    A partir de quantas unidades
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={form.wholesaleMinQty}
                    onChange={(e) => setForm((f) => ({ ...f, wholesaleMinQty: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400">
                    Como o valor de atacado é lançado
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, wholesaleMode: 'VALUE' }))}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                        form.wholesaleMode === 'VALUE'
                          ? 'grad-btn border-transparent text-white'
                          : 'border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Valor fixo (R$)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, wholesaleMode: 'PERCENTAGE' }))}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                        form.wholesaleMode === 'PERCENTAGE'
                          ? 'grad-btn border-transparent text-white'
                          : 'border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Desconto (%)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400">
                    {form.wholesaleMode === 'PERCENTAGE'
                      ? 'Percentual de desconto sobre o preço normal'
                      : 'Preço por unidade no atacado (R$)'}
                  </label>
                  <input
                    required={form.wholesaleEnabled}
                    type="number"
                    step="0.01"
                    min="0"
                    max={form.wholesaleMode === 'PERCENTAGE' ? 100 : undefined}
                    value={form.wholesaleValue}
                    onChange={(e) => setForm((f) => ({ ...f, wholesaleValue: e.target.value }))}
                    placeholder={form.wholesaleMode === 'PERCENTAGE' ? 'ex: 15' : 'ex: 39.90'}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="grad-btn mt-2 w-full rounded-lg py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-900/40 disabled:opacity-60"
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
      wholesaleEnabled: !!p.wholesaleEnabled,
      wholesaleMinQty: String(p.wholesaleMinQty ?? DEFAULT_WHOLESALE_MIN_QTY),
      wholesaleMode: p.wholesaleMode ?? 'VALUE',
      wholesaleValue: p.wholesaleValue != null ? String(p.wholesaleValue) : '',
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
        <h1 className="text-lg font-semibold text-slate-100">Estoque</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
            />
            Apenas estoque baixo
          </label>
          <button
            onClick={() => setEditing(EMPTY_FORM)}
            className="grad-btn flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-violet-900/40"
          >
            <Plus size={14} /> Novo Produto
          </button>
        </div>
      </div>

      <div className="glass overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-slate-400">
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
                  className={`border-b border-white/5 ${low ? 'bg-red-500/5' : ''}`}
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
                      <div className="h-8 w-8 rounded bg-white/5" />
                    )}
                    <span className="font-medium text-slate-200">{p.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">
                    R$ {p.price.toFixed(2)}
                    {p.wholesaleEnabled && p.wholesaleValue != null && (
                      <span className="ml-1.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                        atacado {p.wholesaleMinQty ?? DEFAULT_WHOLESALE_MIN_QTY}+
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 ${low ? 'font-semibold text-red-300' : 'text-slate-300'}`}>
                    {p.stockQuantity}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{p.minStockAlert}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="rounded p-1.5 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
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
