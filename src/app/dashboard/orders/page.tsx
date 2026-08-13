'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, OrderStatus } from '@/lib/store-types';
import { useAuthStore } from '@/lib/store';
import { ArrowRight, Loader2, Mail, MapPin, Package, Phone, Store } from 'lucide-react';

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface OrderWithRelations {
  id: string;
  total_amount: number;
  payment_status: string;
  fulfillment_type: 'PICKUP' | 'DELIVERY';
  status: OrderStatus;
  created_at: string;
  customers: { name: string; phone: string; email: string | null };
  order_items: { product_name: string; quantity: number; unit_price: number }[];
}

function fmt(v: number) {
  return 'R$ ' + Number(v).toFixed(2);
}

// Defina a slug da sua loja no .env.local (NEXT_PUBLIC_STORE_SLUG) — usada
// para saber de qual loja buscar os pedidos online neste painel.
const STORE_SLUG = process.env.NEXT_PUBLIC_STORE_SLUG || '';

function OrdersContent() {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    if (!STORE_SLUG) {
      setError('Configure NEXT_PUBLIC_STORE_SLUG no .env.local para conectar a loja online.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?storeSlug=${STORE_SLUG}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function advanceStatus(order: OrderWithRelations) {
    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
    const next = ORDER_STATUS_FLOW[currentIndex + 1];
    if (!next) return;
    setUpdatingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e: any) {
      alert(e.message ?? 'Erro ao atualizar status.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  }

  const paidOrders = orders.filter((o) => o.payment_status === 'paid');
  const pendingOrders = orders.filter((o) => o.payment_status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Pedidos Online</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Pedidos feitos pelo link da loja. Avance o status para notificar o cliente por e-mail automaticamente.
        </p>
      </div>

      {paidOrders.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Nenhum pedido pago ainda.
        </p>
      )}

      <div className="space-y-3">
        {paidOrders.map((order) => {
          const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
          const next = ORDER_STATUS_FLOW[currentIndex + 1];
          return (
            <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{order.customers.name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1"><Phone size={12} /> {order.customers.phone}</span>
                    {order.customers.email && (
                      <span className="flex items-center gap-1"><Mail size={12} /> {order.customers.email}</span>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-slate-900 text-white text-xs font-semibold px-3 py-1">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                {order.fulfillment_type === 'PICKUP' ? (
                  <><Store size={13} /> Retirada na loja</>
                ) : (
                  <><MapPin size={13} /> Entrega</>
                )}
              </div>

              <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                {order.order_items.map((item, i) => (
                  <p key={i}>{item.quantity}x {item.product_name} — {fmt(item.unit_price * item.quantity)}</p>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{fmt(order.total_amount)}</span>
                {next && (
                  <button
                    onClick={() => advanceStatus(order)}
                    disabled={updatingId === order.id}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {updatingId === order.id ? 'Enviando...' : `Avançar para "${ORDER_STATUS_LABELS[next]}"`}
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingOrders.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <Package size={13} /> Aguardando pagamento ({pendingOrders.length})
          </h2>
          <div className="space-y-2">
            {pendingOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex justify-between">
                <span>{order.customers.name}</span>
                <span>{fmt(order.total_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <AuthGuard allow={['ADMIN']}>
      <AppShell>
        <OrdersContent />
      </AppShell>
    </AuthGuard>
  );
}
