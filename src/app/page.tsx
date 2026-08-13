'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser) {
      router.replace('/login');
    } else {
      router.replace(currentUser.role === 'ADMIN' ? '/dashboard' : '/pos');
    }
  }, [currentUser, router]);

  return null;
}
