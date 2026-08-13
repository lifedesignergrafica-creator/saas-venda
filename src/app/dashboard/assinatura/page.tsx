'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { useAuthStore } from '@/lib/store';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STORE_SLUG = process.env.NEXT_PUBLIC_STORE_SLUG || '';

interface StoreStatus {
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended';
  trial_ends_at: string | null;
  plans: { name: string; price_cents: number; max_products: number | null; max_orders_per_month: number | null } | null;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  trialing: { label: 'Em teste gratuito', tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  active: { label: 'Assinatura ativa', tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  past_due: { label: 'Pagamento pendente', tone: 'text-orange-600 bg-orange-50 border-orange-200' },
  canceled: { label: 'Assinatura cancelada', tone: 'text-red-600 bg-red-50 border-red-200' },
  suspended: { label: 'Suspensa', tone: 'text-red-600 bg-red-50 border-red-200' },
};

function fmtPrice(cents: number) {
  return 'R$ ' + (cents / 100).toFixed(2) + '/mês';
}

function AssinaturaContent() {
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [usage, setUsage] = useState<{ products: number; ordersThisMonth: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!STORE_SLUG) {
        setError('Configure NEXT_PUBLIC_STORE_SLUG no .env.local para ver os dados da assinatura.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/store/status?storeSlug=${STORE_SLUG}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStatus(data.store);
        setUsage(data.usage);
      } catch (e: any) {
        setError(e.message ?? 'Erro ao carregar assinatura.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
  if (!status) return null;

  const badge = STATUS_LABEL[status.subscription_status];
  const isOk = status.subscription_status === 'active' || status.subscription_status === 'trialing';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Assinatura</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Plano contratado da sua loja online e uso atual em relação aos limites.
        </p>
      </div>

      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${badge.tone}`}>
        {isOk ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        {badge.label}
        {status.subscription_status === 'trialing' && status.trial_ends_at && (
          <span className="font-normal">
            — teste até {new Date(status.trial_ends_at).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      {status.plans && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">{status.plans.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{fmtPrice(status.plans.price_cents)}</p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Produtos ativos</p>
              <p className="text-sm font-medium text-slate-900">
                {usage?.products ?? 0} / {status.plans.max_products ?? '∞'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Pedidos este mês</p>
              <p className="text-sm font-medium text-slate-900">
                {usage?.ordersThisMonth ?? 0} / {status.plans.max_orders_per_month ?? '∞'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isOk && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Sua loja online está com o acesso limitado. Regularize o pagamento para voltar a receber pedidos
          normalmente.
        </p>
      )}
    </div>
  );
}

export default function AssinaturaPage() {
  return (
    <AuthGuard allow={['ADMIN']}>
      <AppShell>
        <AssinaturaContent />
      </AppShell>
    </AuthGuard>
  );
}
