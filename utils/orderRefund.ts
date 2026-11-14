import type { Order } from '@/types';

/** Situação do estorno vista pelo cliente após cancelar. */
export type OrderRefundStatus =
  | 'not_applicable'
  | 'skipped'
  | 'processing'
  | 'confirmed'
  | 'failed';

const MOCK_PREFIXES = ['mock_', 'local_', 'sim_'];

function isMockPaymentId(paymentId?: string | null): boolean {
  const id = String(paymentId || '').trim();
  return !id || MOCK_PREFIXES.some((p) => id.startsWith(p));
}

function looksLikeCashOrOffline(order: Order): boolean {
  const method = String(order.paymentMethod || '').toLowerCase();
  const provider = String(order.paymentProvider || '').toLowerCase();
  if (provider === 'offline' || provider === 'mock') return true;
  return (
    method.includes('dinheiro') ||
    method.includes('cash') ||
    method.includes('entrega') ||
    method.includes('offline')
  );
}

/** Precisa chamar o gateway (Mercado Pago) antes de cancelar. */
export function orderNeedsGatewayRefund(order: Order): boolean {
  if (!order.paymentConfirmed) return false;
  if (!order.paymentId || isMockPaymentId(order.paymentId)) return false;
  if (looksLikeCashOrOffline(order)) return false;
  const provider = String(order.paymentProvider || '').toLowerCase();
  return (
    provider === 'mercadopago' ||
    provider === 'card' ||
    provider === '' // cobrança real sem label
  );
}

export function mapGatewayRefundStatus(status?: string | null): OrderRefundStatus {
  const s = String(status || '').toLowerCase();
  if (!s || s === 'unknown') return 'processing';
  if (['approved', 'accredited', 'refunded'].includes(s)) return 'confirmed';
  if (['pending', 'in_process', 'in_mediation'].includes(s)) return 'processing';
  if (['rejected', 'cancelled', 'canceled', 'failed'].includes(s)) return 'failed';
  return 'processing';
}

/** Status quando cancela sem passar pelo gateway. */
export function refundStatusWithoutGateway(order: Order): OrderRefundStatus {
  if (!order.paymentConfirmed) return 'not_applicable';
  if (isMockPaymentId(order.paymentId) || looksLikeCashOrOffline(order)) return 'skipped';
  return 'not_applicable';
}

export function customerCancelAlertMessage(status: OrderRefundStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Pedido cancelado. O estorno foi confirmado e o valor volta para você.';
    case 'processing':
      return 'Pedido cancelado. Estorno em andamento — acompanhe o status neste pedido. Se não cair em alguns minutos, abra um chamado no suporte.';
    case 'skipped':
      return 'Pedido cancelado. Este pagamento era de teste/local — não houve cobrança no banco.';
    case 'not_applicable':
      return 'Pedido cancelado. Como não houve cobrança online (ou o pagamento era na entrega), não há estorno.';
    case 'failed':
      return 'O estorno falhou. O pedido não foi cancelado. Tente de novo ou fale com o suporte.';
    default:
      return 'Pedido cancelado.';
  }
}

export function customerRefundBanner(order: Order): {
  title: string;
  text: string;
  tone: 'ok' | 'wait' | 'warn' | 'muted';
} | null {
  if (order.status !== 'cancelado') return null;
  const status = order.refundStatus;
  if (!status) {
    if (order.paymentConfirmed && order.paymentId && !isMockPaymentId(order.paymentId) && !looksLikeCashOrOffline(order)) {
      return {
        title: 'Estorno',
        text: 'Se você pagou online, o valor deve voltar. Em dúvida, abra um chamado no suporte.',
        tone: 'wait',
      };
    }
    return {
      title: 'Sem estorno online',
      text: 'Este cancelamento não gerou estorno no cartão/Pix (nada cobrado online ou pagamento na entrega).',
      tone: 'muted',
    };
  }
  switch (status) {
    case 'confirmed':
      return {
        title: 'Estorno confirmado',
        text: 'O valor já foi devolvido pelo Mercado Pago. Pode levar alguns minutos para aparecer na sua conta.',
        tone: 'ok',
      };
    case 'processing':
      return {
        title: 'Estorno em andamento',
        text: 'O cancelamento foi aceito e o estorno está sendo processado. Acompanhe aqui; se demorar, fale com o suporte.',
        tone: 'wait',
      };
    case 'skipped':
      return {
        title: 'Sem cobrança no banco',
        text: 'Pagamento de teste ou local — não houve estorno no gateway.',
        tone: 'muted',
      };
    case 'not_applicable':
      return {
        title: 'Sem estorno',
        text: 'Não houve cobrança online neste pedido (ou o pagamento era na entrega).',
        tone: 'muted',
      };
    case 'failed':
      return {
        title: 'Estorno falhou',
        text: order.refundMessage || 'Abra um chamado no suporte com o número deste pedido.',
        tone: 'warn',
      };
    default:
      return null;
  }
}

/** Texto curto no chat da loja/entregador (não fala “valor volta” em dinheiro). */
export function cancelChatNotice(order: Order, reason: string): string {
  const base = `Pedido cancelado. Motivo: ${reason}.`;
  const status = order.refundStatus;
  if (status === 'confirmed') {
    return `${base} Estorno do pagamento online confirmado.`;
  }
  if (status === 'processing') {
    return `${base} Estorno do pagamento online em andamento.`;
  }
  if (status === 'skipped') {
    return `${base} Pagamento de teste/local — sem estorno no banco.`;
  }
  if (status === 'not_applicable' || !order.paymentConfirmed) {
    if (looksLikeCashOrOffline(order) && order.paymentConfirmed) {
      return `${base} Pagamento era na entrega — não há estorno.`;
    }
    return `${base} Nada cobrado online.`;
  }
  return base;
}
