'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/db';
import { useCartStore, useAuthStore } from '@/lib/store';
import { useSync } from '@/lib/use-sync';
import { PaymentMethod, Product } from '@/lib/types';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  CASH: 'Dinheiro',
};

function PosContent() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const [search, setSearch] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  const { items, paymentMethod, addItem, removeItem, setQuantity, setPaymentMethod, clear, total } =
    useCartStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { pushToDrive } = useSync();

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  function handleAdd(product: Product) {
    const inCart = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
    if (inCart + 1 > product.stockQuantity) {
      setMessage({ type: 'error', text: `Estoque insuficiente para "${product.name}".` });
      return;
    }
    addItem(product);
  }

  async function handleFinalize() {
    if (items.length === 0 || !currentUser) return;
    setFinalizing(true);
    setMessage(null);
    try {
      await db.transaction('rw', db.products, db.sales, async () => {
        for (const item of items) {
          const fresh = await db.products.get(item.product.id);
          if (!fresh || fresh.stockQuantity < item.quantity) {
            throw new Error(`Estoque insuficiente para "${item.product.name}".`);
          }
        }
        for (const item of items) {
          await db.products
            .where('id')
            .equals(item.product.id)
            .modify((p) => {
              p.stockQuantity -= item.quantity;
              p.updatedAt = new Date();
            });
        }
        await db.sales.add({
          id: crypto.randomUUID(),
          attendantId: currentUser.id,
          totalAmount: total(),
          paymentMethod,
          createdAt: new Date(),
          items: items.map((i) => ({
            productId: i.product.id,
            productName: i.product.name,
            quantity: i.quantity,
            unitPrice: i.product.price,
            totalPrice: i.product.price * i.quantity,
          })),
        });
      });
      clear();
      setMessage({ type: 'success', text: 'Venda finalizada com sucesso!' });
      pushToDrive();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message ?? 'Erro ao finalizar venda.' });
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg px-3 py-2 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((product) => {
            const low = product.stockQuantity <= product.minStockAlert;
            const out = product.stockQuantity <= 0;
            return (
              <button
                key={product.id}
                onClick={() => handleAdd(product)}
                disabled={out}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:shadow-md disabled:opacity-50"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <ShoppingCart size={28} />
                    </div>
                  )}
                  {low && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {out ? 'Sem estoque' : 'Estoque baixo'}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      R$ {product.price.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400">{product.stockQuantity} un.</span>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-slate-400">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-20">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ShoppingCart size={16} /> Carrinho
        </h2>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto">
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Carrinho vazio</p>
          )}
          {items.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 p-2"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {item.product.name}
                </p>
                <p className="text-xs text-slate-400">
                  R$ {item.product.price.toFixed(2)} un.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuantity(item.product.id, item.quantity - 1)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                >
                  <Minus size={14} />
                </button>
                <span className="w-5 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => {
                    if (item.quantity + 1 > item.product.stockQuantity) {
                      setMessage({ type: 'error', text: 'Estoque máximo atingido.' });
                      return;
                    }
                    setQuantity(item.product.id, item.quantity + 1);
                  }}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="rounded p-1 text-red-400 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Forma de pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                  paymentMethod === method
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {PAYMENT_LABELS[method]}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>R$ {total().toFixed(2)}</span>
          </div>

          <button
            onClick={handleFinalize}
            disabled={items.length === 0 || finalizing}
            className="mt-3 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {finalizing ? 'Finalizando...' : 'Finalizar Venda'}
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function PosPage() {
  return (
    <AuthGuard allow={['ADMIN', 'ATTENDANT']}>
      <AppShell>
        <PosContent />
      </AppShell>
    </AuthGuard>
  );
}
