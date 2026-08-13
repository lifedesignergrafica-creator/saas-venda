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
  const initials = (currentUser?.name ?? '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="dot-grid pointer-events-none fixed inset-0 opacity-40" />
      <div className="relative flex">
        {/* Sidebar */}
        <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 md:flex">
          <div className="flex items-center gap-2 px-5 py-5 font-extrabold">
            <div className="grad-btn flex h-9 w-9 items-center justify-center rounded-xl">
              <Store className="h-5 w-5 text-white" />
            </div>
            SaaS Venda
          </div>
          <nav className="flex-1 space-y-1 px-3 py-2">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'grad-btn text-white shadow-lg shadow-violet-900/30'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <div className="glass flex items-center gap-2.5 rounded-xl px-3 py-2.5">
              <div className="grad-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400">
                  {currentUser?.role === 'ADMIN' ? 'Administrador' : 'Atendente'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="glass sticky top-0 z-10 border-b border-white/10">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2 font-extrabold md:hidden">
                <div className="grad-btn flex h-8 w-8 items-center justify-center rounded-lg">
                  <Store className="h-4 w-4 text-white" />
                </div>
                SaaS Venda
              </div>
              <div className="flex items-center gap-3">
                <SyncIndicator />
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
                  title="Sair"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
            <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/10 px-4 py-2 md:hidden">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                      active ? 'grad-btn text-white' : 'text-slate-300'
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
