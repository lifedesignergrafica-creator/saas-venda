'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Rocket, Store } from 'lucide-react';

interface PlanOption {
  slug: string;
  name: string;
  priceLabel: string;
  maxProducts: string;
  maxOrders: string;
}

// Espelha os planos cadastrados em supabase/schema.sql (tabela `plans`).
// Se os preços/limites mudarem no banco, atualize aqui também — esta lista é
// só para exibição amigável no formulário de cadastro.
const PLANS: PlanOption[] = [
  { slug: 'basico', name: 'Básico', priceLabel: 'R$ 49,90/mês', maxProducts: 'até 50 produtos', maxOrders: 'até 100 pedidos/mês' },
  { slug: 'pro', name: 'Pro', priceLabel: 'R$ 99,90/mês', maxProducts: 'até 300 produtos', maxOrders: 'até 1.000 pedidos/mês' },
  { slug: 'ilimitado', name: 'Ilimitado', priceLabel: 'R$ 199,90/mês', maxProducts: 'produtos ilimitados', maxOrders: 'pedidos ilimitados' },
];

export default function SignupPage() {
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [planSlug, setPlanSlug] = useState('basico');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStoreNameChange(value: string) {
    setStoreName(value);
    // Sugere automaticamente um slug a partir do nome da loja, mas o campo
    // continua editável (o lojista pode ajustar antes de enviar).
    setSlug(
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          slug,
          ownerEmail,
          notificationEmail: notificationEmail || ownerEmail,
          planSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Redireciona para o Mercado Pago autorizar a cobrança recorrente do
      // plano escolhido. Enquanto isso não é feito, a loja fica em
      // "trialing" (14 dias de teste) e já pode ser configurada normalmente.
      if (data.subscriptionCheckoutUrl) {
        window.location.href = data.subscriptionCheckoutUrl;
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao criar sua loja.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Store size={24} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Criar minha loja</h1>
          <p className="text-sm text-slate-500">
            14 dias grátis para configurar tudo. Depois, a cobrança é feita direto pelo Mercado Pago.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nome da loja</label>
            <input
              required
              value={storeName}
              onChange={(e) => handleStoreNameChange(e.target.value)}
              placeholder="Ex: Doces da Ana"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Endereço da sua loja online
            </label>
            <div className="flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:border-slate-400">
              <span className="text-slate-400">sualoja.com/loja/</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 outline-none text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Seu e-mail (login com Google)</label>
            <input
              required
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              E-mail para receber avisos de novo pedido (opcional)
            </label>
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="Deixe em branco para usar o mesmo acima"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Escolha um plano</label>
            <div className="space-y-2">
              {PLANS.map((plan) => (
                <label
                  key={plan.slug}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
                    planSlug === plan.slug
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="plan"
                      value={plan.slug}
                      checked={planSlug === plan.slug}
                      onChange={() => setPlanSlug(plan.slug)}
                      className="accent-slate-900"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-500">
                        {plan.maxProducts} · {plan.maxOrders}
                      </p>
                    </div>
                  </div>
                  <span className="font-medium text-slate-900">{plan.priceLabel}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
            {loading ? 'Criando sua loja...' : 'Começar teste grátis de 14 dias'}
          </button>

          <p className="flex items-start gap-1.5 text-xs text-slate-400">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            Você só será cobrado após autorizar o pagamento recorrente no Mercado Pago. Pode cancelar quando quiser.
          </p>
        </form>
      </div>
    </main>
  );
}
