'use client';

import { CheckCircle2, CloudOff, Loader2, XCircle } from 'lucide-react';
import { useSyncStore } from '@/lib/store';

const CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  synced: {
    label: 'Sincronizado',
    icon: <CheckCircle2 size={16} />,
    color: 'text-green-600 bg-green-50',
  },
  syncing: {
    label: 'Sincronizando...',
    icon: <Loader2 size={16} className="animate-spin" />,
    color: 'text-blue-600 bg-blue-50',
  },
  error: {
    label: 'Erro de Conexão (Modo Offline)',
    icon: <XCircle size={16} />,
    color: 'text-red-600 bg-red-50',
  },
  offline: {
    label: 'Modo Offline',
    icon: <CloudOff size={16} />,
    color: 'text-gray-500 bg-gray-100',
  },
};

export function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const cfg = CONFIG[status] ?? CONFIG.offline;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </div>
  );
}
