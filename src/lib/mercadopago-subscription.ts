import { MercadoPagoConfig, PreApproval } from 'mercadopago';

/**
 * Assinaturas recorrentes (Mercado Pago "Preapproval") — cobra o lojista
 * mensalmente pela licença de uso do sistema. Diferente do checkout da loja
 * (que cobra o CLIENTE FINAL pelos produtos), esta é a cobrança de VOCÊ para
 * cada lojista que usa a plataforma.
 *
 * Importante: esta conta do Mercado Pago é a SUA conta central (a que
 * recebe as mensalidades), configurada nas variáveis de ambiente do projeto
 * hospedado por você — diferente de uma eventual conta de MP que o lojista
 * usaria para receber pelos próprios produtos (Checkout Pro, em mercadopago.ts).
 */

function getClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado. Veja .env.local.example.');
  }
  return new MercadoPagoConfig({ accessToken });
}

interface CreateSubscriptionArgs {
  storeId: string;
  payerEmail: string;
  planName: string;
  priceCents: number;
  baseUrl: string;
}

/**
 * Cria uma assinatura recorrente mensal para uma loja. O lojista é
 * redirecionado para a página do Mercado Pago para autorizar a cobrança
 * automática (cartão de crédito). O status inicial é "pending" até a
 * autorização; o webhook de assinatura confirma quando vira "authorized".
 */
export async function createSubscription(args: CreateSubscriptionArgs) {
  const client = getClient();
  const preApproval = new PreApproval(client);

  const result = await preApproval.create({
    body: {
      reason: `Assinatura SaaS Venda — Plano ${args.planName}`,
      external_reference: args.storeId,
      payer_email: args.payerEmail,
      back_url: `${args.baseUrl}/dashboard/assinatura?status=retorno`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: args.priceCents / 100,
        currency_id: 'BRL',
      },
      status: 'pending',
    },
  });

  return result; // result.id = preapproval id, result.init_point = URL de autorização
}

/**
 * Rebusca o status real de uma assinatura direto na API do Mercado Pago —
 * nunca confiamos apenas no payload do webhook.
 */
export async function fetchSubscription(preapprovalId: string) {
  const client = getClient();
  const preApproval = new PreApproval(client);
  return preApproval.get({ id: preapprovalId });
}

/**
 * Cancela a assinatura de uma loja (ex: pedido do lojista, ou inadimplência
 * prolongada).
 */
export async function cancelSubscription(preapprovalId: string) {
  const client = getClient();
  const preApproval = new PreApproval(client);
  return preApproval.update({ id: preapprovalId, body: { status: 'cancelled' } });
}
