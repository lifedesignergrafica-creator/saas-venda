import { Resend } from 'resend';
import {
  DeliveryAddress,
  FulfillmentType,
  OrderStatus,
} from './store-types';

/**
 * E-mail transacional (Resend) — substitui a notificação por WhatsApp para
 * manter custo zero/baixo. Dispara em dois momentos:
 *  1. Para o CLIENTE: a cada mudança de status do pedido.
 *  2. Para o LOJISTA: assim que um novo pedido é pago.
 */

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurado. Veja .env.local.example.');
  }
  return new Resend(apiKey);
}

function fromAddress() {
  // Em produção, use um domínio verificado no Resend (ex: pedidos@sualoja.com.br).
  // "onboarding@resend.dev" funciona para testes sem domínio próprio configurado.
  return process.env.EMAIL_FROM || 'SaaS Venda <onboarding@resend.dev>';
}

// Nome do cliente, endereço, etc. vêm de um formulário público (qualquer um
// pode digitar o que quiser) e são interpolados dentro de HTML de e-mail —
// sem escapar, alguém poderia injetar tags/links maliciosos que chegam
// tanto na caixa do cliente quanto na do lojista.
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(v: number) {
  return 'R$ ' + Number(v).toFixed(2);
}

interface OrderItemLike {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface CustomerStatusEmailArgs {
  to: string;
  customerName: string;
  storeName: string;
  orderShortId: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  items: OrderItemLike[];
  totalAmount: number;
}

const STATUS_COPY: Record<
  OrderStatus,
  { subject: (orderShortId: string) => string; body: (a: CustomerStatusEmailArgs) => string }
> = {
  RECEIVED: {
    subject: (id) => `Pedido #${id} recebido — pagamento confirmado`,
    body: (a) =>
      `Recebemos seu pagamento e seu pedido já está sendo preparado. ` +
      (a.fulfillmentType === 'PICKUP'
        ? `Assim que estiver pronto, avisamos para você retirar na loja.`
        : `Assim que for enviado, avisamos por aqui.`),
  },
  IN_PRODUCTION: {
    subject: (id) => `Pedido #${id} está em produção`,
    body: () => `Seu pedido entrou em produção/separação. Já avisamos assim que estiver pronto!`,
  },
  SHIPPED: {
    subject: (id) => `Pedido #${id} foi enviado`,
    body: () => `Seu pedido foi enviado e está a caminho. Fique de olho na entrega!`,
  },
  READY_FOR_PICKUP: {
    subject: (id) => `Pedido #${id} pronto para retirada`,
    body: () => `Seu pedido está pronto! Pode vir retirar na loja quando quiser.`,
  },
  DONE: {
    subject: (id) => `Pedido #${id} concluído`,
    body: () => `Seu pedido foi concluído. Obrigado pela compra!`,
  },
};

function itemsListHtml(items: OrderItemLike[]) {
  return items
    .map(
      (i) =>
        `<li>${escapeHtml(i.quantity)}x ${escapeHtml(i.product_name)} — ${fmt(i.unit_price * i.quantity)}</li>`
    )
    .join('');
}

export async function sendCustomerStatusEmail(args: CustomerStatusEmailArgs) {
  const copy = STATUS_COPY[args.status];
  const resend = getResend();

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#4f46e5;">${escapeHtml(args.storeName)}</h2>
      <p>Olá, ${escapeHtml(args.customerName)}!</p>
      <p>${copy.body(args)}</p>
      <p style="font-size:13px;color:#666">Pedido #${escapeHtml(args.orderShortId)}</p>
      <ul style="font-size:14px;">${itemsListHtml(args.items)}</ul>
      <p style="font-weight:bold;">Total: ${fmt(args.totalAmount)}</p>
      <p style="font-size:12px;color:#999;margin-top:24px;">
        Esta é uma mensagem automática do sistema de pedidos de ${escapeHtml(args.storeName)}.
      </p>
    </div>`;

  return resend.emails.send({
    from: fromAddress(),
    to: args.to,
    subject: copy.subject(args.orderShortId),
    html,
  });
}

interface NewOrderNotificationArgs {
  to: string; // e-mail do lojista (notification_email da loja)
  storeName: string;
  orderShortId: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: DeliveryAddress | null;
  items: OrderItemLike[];
  totalAmount: number;
}

export async function sendNewOrderNotificationEmail(args: NewOrderNotificationArgs) {
  const resend = getResend();

  const fulfillmentHtml =
    args.fulfillmentType === 'PICKUP'
      ? '<p><strong>Entrega:</strong> Retirada na loja</p>'
      : `<p><strong>Entrega:</strong> Envio para: ${
          args.deliveryAddress
            ? escapeHtml(
                `${args.deliveryAddress.street}, ${args.deliveryAddress.number} — ${args.deliveryAddress.neighborhood}, ${args.deliveryAddress.city}/${args.deliveryAddress.state} — CEP ${args.deliveryAddress.zipCode}`
              )
            : '(endereço não informado)'
        }</p>`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#16a34a;">Novo pedido pago 🎉</h2>
      <p><strong>Cliente:</strong> ${escapeHtml(args.customerName)}</p>
      <p><strong>Telefone:</strong> ${escapeHtml(args.customerPhone)}</p>
      ${fulfillmentHtml}
      <p style="font-size:13px;color:#666">Pedido #${escapeHtml(args.orderShortId)}</p>
      <ul style="font-size:14px;">${itemsListHtml(args.items)}</ul>
      <p style="font-weight:bold;">Total: ${fmt(args.totalAmount)}</p>
      <p style="font-size:12px;color:#999;margin-top:24px;">
        Acesse o painel em /dashboard/orders para acompanhar e avançar o status deste pedido.
      </p>
    </div>`;

  return resend.emails.send({
    from: fromAddress(),
    to: args.to,
    // Subject não interpreta HTML, mas ainda assim removemos quebras de
    // linha para impedir "header injection" (um nome de cliente com \n
    // tentando forjar cabeçalhos extras de e-mail).
    subject: `Novo pedido de ${args.customerName.replace(/[\r\n]/g, ' ')} — ${args.storeName}`,
    html,
  });
}
