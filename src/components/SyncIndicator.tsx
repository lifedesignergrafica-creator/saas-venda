'use client';

import { CheckCircle2, CloudOff, Loader2, XCircle } from 'lucide-react';
import { useSyncStore } from '@/lib/store';

const CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  synced: {
    label: 'Sincronizado',
    icon: <CheckCircle2 size={16} />,
    color: 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20',
  },
  syncing: {
    label: 'Sincronizando...',
    icon: <Loader2 size={16} className="animate-spin" />,
    color: 'text-sky-300 bg-sky-500/10 border border-sky-500/20',
  },
  error: {
    label: 'Erro de Conexão (Modo Offline)',
    icon: <XCircle size={16} />,
    color: 'text-red-300 bg-red-500/10 border border-red-500/20',
  },
  offline: {
    label: 'Modo Offline',
    icon: <CloudOff size={16} />,
    color: 'text-slate-400 bg-white/5 border border-white/10',
  },
};

export function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const cfg = CONFIG[status] ?? CONFIG.offline;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </div>
  );
}
