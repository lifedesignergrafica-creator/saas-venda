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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (error || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-red-400 text-sm">
        {error ?? 'Loja não encontrada.'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <Store size={18} /> {store.name}
        </div>
        <button
          onClick={() => setCheckoutOpen(true)}
          disabled={cart.length === 0}
          className="relative flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
        >
          <ShoppingCart size={16} /> {fmt(total)}
          {cart.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {cart.reduce((n, i) => n + i.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {products.map((p) => {
          const inCart = cart.find((i) => i.product.id === p.id)?.quantity ?? 0;
          const out = p.stock_quantity <= 0;
          return (
            <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="aspect-square bg-white/5">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-sm font-bold text-violet-300 mt-0.5">{fmt(p.price)}</p>
                <button
                  onClick={() => addToCart(p)}
                  disabled={out || inCart >= p.stock_quantity}
                  className="mt-2 w-full rounded-lg bg-violet-600 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  {out ? 'Esgotado' : inCart > 0 ? `No carrinho (${inCart})` : 'Adicionar'}
                </button>
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="col-span-full text-center text-slate-500 py-16">
            Nenhum produto disponível no momento.
          </p>
        )}
      </main>

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
    <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm">Finalizar pedido</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="space-y-2 mb-4">
          {cart.map((i) => (
            <div key={i.product.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{i.product.name}</span>
              <button onClick={() => onChangeQty(i.product.id, -1)} className="p-1"><Minus size={13} /></button>
              <span className="w-5 text-center">{i.quantity}</span>
              <button onClick={() => onChangeQty(i.product.id, 1)} className="p-1"><Plus size={13} /></button>
              <span className="w-16 text-right font-semibold">{fmt(i.product.price * i.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="Telefone (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="E-mail (para receber atualizações do pedido)" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setFulfillment('PICKUP')}
              className={`rounded-lg py-2 text-xs font-semibold ${fulfillment === 'PICKUP' ? 'bg-violet-600' : 'bg-white/5'}`}>
              Retirar na loja
            </button>
            <button onClick={() => setFulfillment('DELIVERY')}
              className={`rounded-lg py-2 text-xs font-semibold ${fulfillment === 'DELIVERY' ? 'bg-violet-600' : 'bg-white/5'}`}>
              Receber em casa
            </button>
          </div>

          {fulfillment === 'DELIVERY' && (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Rua" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })}
                className="col-span-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
              <input placeholder="Número" value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
              <input placeholder="Bairro" value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
              <input placeholder="Cidade" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
              <input placeholder="UF" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
              <input placeholder="CEP" value={address.zipCode} onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                className="col-span-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm" />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-slate-400">Total</span>
            <span className="text-lg font-bold">{fmt(total)}</span>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting || !name || !phone}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-bold disabled:opacity-40">
            {submitting ? 'Redirecionando para pagamento...' : 'Ir para o pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
