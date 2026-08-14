'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabasePublic } from '@/lib/supabase-public';
import { ProductRow, StoreRow, DeliveryAddress, FulfillmentType } from '@/lib/store-types';
import { Store, ShoppingCart, Minus, Plus, X, Loader2 } from 'lucide-react';

interface CartItem {
  product: ProductRow;
  quantity: number;
}

function fmt(v: number) {
  return 'R$ ' + Number(v).toFixed(2);
}

export default function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabasePublic();
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('slug', slug)
          .single();
        if (storeError || !storeData) throw new Error('Loja não encontrada.');
        setStore(storeData as unknown as StoreRow);

        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('store_id', (storeData as any).id)
          .eq('active', true)
          .order('name');
        if (productsError) throw productsError;
        setProducts((productsData as unknown as ProductRow[]) ?? []);
      } catch (e: any) {
        setError(e.message ?? 'Erro ao carregar a loja.');
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  function addToCart(product: ProductRow) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stock_quantity) return prev;
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  const total = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((n, i) => n + i.quantity, 0);

  const categories = [
    'Todos',
    ...Array.from(new Set(products.map((p) => p.category?.trim()).filter((c): c is string => !!c))).sort(
      (a, b) => a.localeCompare(b)
    ),
  ];
  const visibleProducts =
    activeCategory === 'Todos' ? products : products.filter((p) => p.category === activeCategory);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-slate-400"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(124,58,237,0.18), transparent 45%), radial-gradient(circle at 100% 20%, rgba(56,189,248,0.10), transparent 40%), #060714',
        }}
      >
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (error || !store) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-red-400 text-sm"
        style={{ background: '#060714' }}
      >
        {error ?? 'Loja não encontrada.'}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100"
      style={{
        background:
          'radial-gradient(circle at 15% 0%, rgba(124,58,237,0.22), transparent 45%), radial-gradient(circle at 100% 15%, rgba(56,189,248,0.12), transparent 40%), #060714',
      }}
    >
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#060714]/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-900/40">
            <Store size={16} />
          </span>
          <span className="tracking-tight">{store.name}</span>
        </div>
        <button
          onClick={() => setCheckoutOpen(true)}
          disabled={cart.length === 0}
          className="relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
        >
          <ShoppingCart size={16} /> {fmt(total)}
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      <section className="relative overflow-hidden border-b border-white/5 px-4 py-10 text-center sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Loja Online</p>
        <h1 className="mt-2 bg-gradient-to-r from-violet-300 via-fuchsia-200 to-sky-200 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
          {store.name}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          Escolha seus produtos, finalize o pedido e receba em casa ou retire na loja.
        </p>
      </section>

      {categories.length > 1 && (
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pt-6 pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                activeCategory === c
                  ? 'border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-900/40'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {visibleProducts.map((p) => {
          const inCart = cart.find((i) => i.product.id === p.id)?.quantity ?? 0;
          const out = p.stock_quantity <= 0;
          return (
            <div
              key={p.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm transition hover:border-violet-400/40 hover:bg-white/[0.06]"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-white/5">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-600">
                    <ShoppingCart size={26} />
                  </div>
                )}
                {out && (
                  <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Esgotado
                  </span>
                )}
              </div>
              <div className="p-3">
                {p.category && (
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-violet-300/80">
                    {p.category}
                  </p>
                )}
                <p className="truncate text-sm font-semibold text-slate-100">{p.name}</p>
                <p className="mt-0.5 bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-sm font-bold text-transparent">
                  {fmt(p.price)}
                </p>
                <button
                  onClick={() => addToCart(p)}
                  disabled={out || inCart >= p.stock_quantity}
                  className="mt-2.5 w-full rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-1.5 text-xs font-semibold shadow-md shadow-violet-900/30 transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
                >
                  {out ? 'Esgotado' : inCart > 0 ? `No carrinho (${inCart})` : 'Adicionar'}
                </button>
              </div>
            </div>
          );
        })}
        {visibleProducts.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-slate-500">
            Nenhum produto disponível {activeCategory !== 'Todos' ? 'nesta categoria' : 'no momento'}.
          </p>
        )}
      </main>

      <footer className="border-t border-white/5 px-4 py-6 text-center text-xs text-slate-600">
        Loja criada com SaaS Venda
      </footer>

      {checkoutOpen && (
        <CheckoutModal
          store={store}
          cart={cart}
          onChangeQty={changeQty}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </div>
  );
}

function CheckoutModal({
  store,
  cart,
  onChangeQty,
  onClose,
}: {
  store: StoreRow;
  cart: CartItem[];
  onChangeQty: (id: string, delta: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('PICKUP');
  const [address, setAddress] = useState<DeliveryAddress>({
    street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  async function handleSubmit() {
    if (!name || !phone || cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug: store.slug,
          customer: { name, phone, email: email || undefined },
          fulfillmentType: fulfillment,
          deliveryAddress: fulfillment === 'DELIVERY' ? address : undefined,
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar pedido.');
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setError(e.message ?? 'Erro ao finalizar pedido.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-5 shadow-2xl shadow-black/50"
        style={{ background: 'rgba(15,17,28,0.97)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100">Finalizar pedido</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          {cart.map((i) => (
            <div key={i.product.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-slate-200">{i.product.name}</span>
              <button onClick={() => onChangeQty(i.product.id, -1)} className="rounded p-1 text-slate-400 hover:bg-white/10"><Minus size={13} /></button>
              <span className="w-5 text-center text-slate-200">{i.quantity}</span>
              <button onClick={() => onChangeQty(i.product.id, 1)} className="rounded p-1 text-slate-400 hover:bg-white/10"><Plus size={13} /></button>
              <span className="w-16 text-right font-semibold text-slate-200">{fmt(i.product.price * i.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
          <input placeholder="Telefone (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
          <input placeholder="E-mail (para receber atualizações do pedido)" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">Como você quer receber?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFulfillment('PICKUP')}
                className={`rounded-lg border py-2 text-xs font-semibold transition ${fulfillment === 'PICKUP' ? 'border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-900/40' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                Retirar na loja
              </button>
              <button onClick={() => setFulfillment('DELIVERY')}
                className={`rounded-lg border py-2 text-xs font-semibold transition ${fulfillment === 'DELIVERY' ? 'border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-900/40' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                Receber em casa
              </button>
            </div>
          </div>

          {fulfillment === 'DELIVERY' && (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Rua" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })}
                className="col-span-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
              <input placeholder="Número" value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
              <input placeholder="Bairro" value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
              <input placeholder="Cidade" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
              <input placeholder="UF" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
              <input placeholder="CEP" value={address.zipCode} onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                className="col-span-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/60" />
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-sm text-slate-400">Total</span>
            <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-lg font-bold text-transparent">{fmt(total)}</span>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting || !name || !phone}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100">
            {submitting ? 'Redirecionando para pagamento...' : 'Ir para o pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
