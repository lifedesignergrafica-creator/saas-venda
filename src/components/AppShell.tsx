'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CreditCard, LayoutDashboard, LogOut, Package, ShoppingBag, ShoppingCart, Store, Users } from 'lucide-react';
import { SyncIndicator } from './SyncIndicator';
import { useAuthStore } from '@/lib/store';
import { signOutGoogle } from '@/lib/google-auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { href: '/pos', label: 'PDV', icon: ShoppingCart, roles: ['ADMIN', 'ATTENDANT'] },
  { href: '/dashboard/orders', label: 'Pedidos Online', icon: ShoppingBag, roles: ['ADMIN'] },
  { href: '/dashboard/inventory', label: 'Estoque', icon: Package, roles: ['ADMIN'] },
  { href: '/dashboard/users', label: 'Usuários', icon: Users, roles: ['ADMIN'] },
  { href: '/dashboard/assinatura', label: 'Assinatura', icon: CreditCard, roles: ['ADMIN'] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    signOutGoogle();
    logout();
    router.push('/login');
  }

  const items = NAV.filter((n) => currentUser && n.roles.includes(currentUser.role));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Store size={20} />
            SaaS Venda
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <span className="hidden text-sm text-slate-500 sm:inline">
              {currentUser?.name}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
