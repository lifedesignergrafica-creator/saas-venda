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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
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
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <button
          onClick={exportBackup}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download size={14} /> Exportar Backup (.json)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={DollarSign} label="Vendas Hoje" value={`R$ ${todayTotal.toFixed(2)}`} />
        <StatCard icon={ShoppingBag} label="Nº de Vendas Hoje" value={String(todaySales.length)} />
        <StatCard icon={Package} label="Produtos Cadastrados" value={String(products.length)} />
        <StatCard icon={AlertTriangle} label="Estoque Baixo" value={String(lowStock.length)} />
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
            <AlertTriangle size={15} /> Produtos com estoque baixo
          </p>
          <ul className="space-y-1 text-sm text-red-600">
            {lowStock.map((p) => (
              <li key={p.id}>
                {p.name} — {p.stockQuantity} un. (mínimo {p.minStockAlert})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Vendas Recentes</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {recent.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma venda ainda.</p>
          )}
          {recent.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {sale.items.length} item(ns) — {sale.paymentMethod}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(sale.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
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
