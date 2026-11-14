/**
 * Router HTTP de pagamentos — mesmo contrato das rotas Expo `app/api/payments/*`.
 * Usado pelo server standalone (Railway) para Pix/cartão/saque/webhook/consulta.
 */
import { POST as postPix } from '@/app/api/payments/pix+api';
import { GET as getPayment } from '@/app/api/payments/[id]+api';
import { POST as postWithdraw } from '@/app/api/payments/withdraw+api';
import { POST as postWebhook } from '@/app/api/payments/webhook+api';
import { POST as postCardCharge } from '@/app/api/payments/card/charge+api';
import { POST as postCardSave } from '@/app/api/payments/card/save+api';
import { POST as postRefund } from '@/app/api/payments/refund+api';
import { POST as postOrderCredit } from '@/app/api/payments/order-credit+api';
import { POST as postSplitRelease } from '@/app/api/payments/split-release+api';
import { POST as postPayoutProfile } from '@/app/api/payments/payout-profile+api';
import { POST as postPlanStatus } from '@/app/api/payments/plan-status+api';

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/** Normaliza pathname sem barra final. */
function norm(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

/**
 * Despacha `/api/payments...` para os handlers Expo.
 * Retorna null se o path não for de pagamentos.
 */
export async function handlePaymentsRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = norm(url.pathname);
  const method = (request.method || 'GET').toUpperCase();

  if (!path.startsWith('/api/payments')) return null;

  if (path === '/api/payments' || path === '/api/payments/') {
    return json({ ok: false, message: 'Not found.' }, 404);
  }

  if (path === '/api/payments/pix' && method === 'POST') {
    return postPix(request);
  }

  if (path === '/api/payments/withdraw' && method === 'POST') {
    return postWithdraw(request);
  }

  if (path === '/api/payments/order-credit' && method === 'POST') {
    return postOrderCredit(request);
  }

  if (path === '/api/payments/split-release' && method === 'POST') {
    return postSplitRelease(request);
  }

  if (path === '/api/payments/payout-profile' && method === 'POST') {
    return postPayoutProfile(request);
  }

  if (path === '/api/payments/refund' && method === 'POST') {
    return postRefund(request);
  }

  if (path === '/api/payments/webhook' && method === 'POST') {
    return postWebhook(request);
  }

  if (path === '/api/payments/plan-status' && method === 'POST') {
    return postPlanStatus(request);
  }

  if (path === '/api/payments/card/charge' && method === 'POST') {
    return postCardCharge(request);
  }

  if (path === '/api/payments/card/save' && method === 'POST') {
    return postCardSave(request);
  }

  // GET /api/payments/:id (não reservado)
  const idMatch = path.match(/^\/api\/payments\/([^/]+)$/);
  if (idMatch && method === 'GET') {
    const id = decodeURIComponent(idMatch[1]);
    const reserved = new Set([
      'pix',
      'withdraw',
      'refund',
      'order-credit',
      'split-release',
      'payout-profile',
      'webhook',
      'plan-status',
      'card',
    ]);
    if (!reserved.has(id.toLowerCase())) {
      return getPayment(request, { id });
    }
  }

  return json({ ok: false, message: 'Not found.' }, 404);
}
