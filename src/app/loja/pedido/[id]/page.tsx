'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

/**
 * Página de retorno do Mercado Pago (back_urls). A confirmação real do
 * pagamento acontece no webhook (/api/webhooks/mercadopago) — esta tela é
 * só o feedback visual imediato para o cliente.
 */
export default function OrderReturnPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const [shortId, setShortId] = useState('');

  useEffect(() => {
    if (id) setShortId(id.slice(0, 8));
  }, [id]);

  const config = {
    success: {
      icon: <CheckCircle2 className="text-emerald-400" size={48} />,
      title: 'Pagamento confirmado!',
      text: 'Você vai receber um e-mail com a confirmação e as atualizações do seu pedido.',
    },
    pending: {
      icon: <Clock className="text-amber-400" size={48} />,
      title: 'Pagamento em análise',
      text: 'Assim que for aprovado, você recebe a confirmação por e-mail.',
    },
    failure: {
      icon: <XCircle className="text-red-400" size={48} />,
      title: 'Pagamento não concluído',
      text: 'Algo deu errado. Você pode tentar novamente pelo link da loja.',
    },
  } as const;

  const c = config[(status as keyof typeof config) ?? 'pending'] ?? config.pending;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">{c.icon}</div>
        <h1 className="text-lg font-bold">{c.title}</h1>
        <p className="text-sm text-slate-400 mt-2">{c.text}</p>
        {shortId && <p className="text-xs text-slate-600 mt-4">Pedido #{shortId}</p>}
      </div>
    </div>
  );
}
