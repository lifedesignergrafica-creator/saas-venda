'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, DollarSign, Package, ShoppingBag, Download } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/db';
import { useSync } from '@/lib/use-sync';

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="glass card-hover rounded-xl p-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        <Icon size={16} />
      </div>
      <p className="mt-3 text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function DashboardContent() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const sales = useLiveQuery(() => db.sales.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const { exportBackup } = useSync();

  const today = new Date().toDateString();
  const todaySales = sales.filter((s) => new Date(s.createdAt).toDateString() === today);
  const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const lowStock = products.filter((p) => p.stockQuantity <= p.minStockAlert);

  const recent = useMemo(() => sales.slice(0, 8), [sales]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">Dashboard</h1>
        <button
          onClick={exportBackup}
          className="glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
        >
          <Download size={14} /> Exportar Backup (.json)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Vendas Hoje"
          value={`R$ ${todayTotal.toFixed(2)}`}
          color="bg-emerald-500/15 text-emerald-300"
        />
        <StatCard
          icon={ShoppingBag}
          label="Nº de Vendas Hoje"
          value={String(todaySales.length)}
          color="bg-sky-500/15 text-sky-300"
        />
        <StatCard
          icon={Package}
          label="Produtos Cadastrados"
          value={String(products.length)}
          color="bg-violet-500/15 text-violet-300"
        />
        <StatCard
          icon={AlertTriangle}
          label="Estoque Baixo"
          value={String(lowStock.length)}
          color="bg-red-500/15 text-red-300"
        />
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-300">
            <AlertTriangle size={15} /> Produtos com estoque baixo
          </p>
          <ul className="space-y-1 text-sm text-red-200/90">
            {lowStock.map((p) => (
              <li key={p.id}>
                {p.name} — {p.stockQuantity} un. (mínimo {p.minStockAlert})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass rounded-xl">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Vendas Recentes</h2>
        </div>
        <div className="divide-y divide-white/5">
          {recent.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma venda ainda.</p>
          )}
          {recent.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {sale.items.length} item(ns) — {sale.paymentMethod}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(sale.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-100">
                R$ {sale.totalAmount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard allow={['ADMIN']}>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </AuthGuard>
  );
}
