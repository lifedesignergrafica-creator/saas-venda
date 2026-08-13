'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { Role } from '@/lib/types';

export function AuthGuard({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    if (!allow.includes(currentUser.role)) {
      router.replace(currentUser.role === 'ADMIN' ? '/dashboard' : '/pos');
    }
  }, [currentUser, allow, router]);

  if (!currentUser || !allow.includes(currentUser.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  return <>{children}</>;
}
