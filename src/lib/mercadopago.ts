import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

function getClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado. Veja .env.local.example.');
  }
  return new MercadoPagoConfig({ accessToken });
}

interface CreatePreferenceArgs {
  orderId: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  payerEmail?: string;
  baseUrl: string; // ex: https://sualoja.com — usado para as URLs de retorno e o webhook
}

/**
 * Cria uma "preferência de pagamento" no Mercado Pago (Checkout Pro).
 * O cliente é redirecionado para a página hospedada pelo Mercado Pago —
 * nunca lidamos com dados de cartão diretamente neste sistema.
 */
export async function createPaymentPreference(args: CreatePreferenceArgs) {
  const client = getClient();
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: args.items.map((i) => ({
        id: i.name,
        title: i.name,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        currency_id: 'BRL',
      })),
      payer: args.payerEmail ? { email: args.payerEmail } : undefined,
      external_reference: args.orderId,
      back_urls: {
        success: `${args.baseUrl}/loja/pedido/${args.orderId}?status=success`,
        pending: `${args.baseUrl}/loja/pedido/${args.orderId}?status=pending`,
        failure: `${args.baseUrl}/loja/pedido/${args.orderId}?status=failure`,
      },
      auto_return: 'approved',
      notification_url: `${args.baseUrl}/api/webhooks/mercadopago`,
    },
  });

  return result; // result.id = preference id, result.init_point = URL de checkout
}

/**
 * Busca os detalhes de um pagamento no Mercado Pago (chamado a partir do
 * webhook, que só manda o ID — nunca confiamos no payload do webhook sozinho).
 */
export async function fetchPayment(paymentId: string) {
  const client = getClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
