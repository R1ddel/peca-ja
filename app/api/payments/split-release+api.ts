/**
 * Reparte o pedido no gateway depois da confirmação do cliente e do entregador.
 * POST { orderId, order, token? }
 */
import type { Order } from '@/types';
import { releaseGatewaySplit } from '@/services/gatewaySplitRelease';
import { loadPlatformState } from '@/services/platformStore';

type Body = {
  orderId?: string;
  order?: Order;
  token?: string;
};

function bearer(request: Request, body: Body): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization');
  if (h?.toLowerCase().startsWith('bearer ')) return h.slice(7).trim() || null;
  return body.token?.trim() || null;
}

function syncSecretOk(token: string | null): boolean {
  if (!token) return false;
  const secrets = [process.env.PLATFORM_LEDGER_SECRET?.trim(), process.env.FLEET_SYNC_SECRET?.trim()].filter(
    Boolean
  ) as string[];
  return secrets.some((s) => s === token);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const token = bearer(request, body);
    if (!token) {
      return Response.json({ ok: false, code: 'AUTH', message: 'Sessão obrigatória.' }, { status: 401 });
    }
    if (!syncSecretOk(token)) {
      const state = await loadPlatformState();
      const session = state.sessions.find((s) => s.token === token);
      if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
          { status: 401 }
        );
      }
    }
    const order = body.order;
    const orderId = String(body.orderId || order?.id || '').trim();
    if (!order || !orderId) {
      return Response.json({ ok: false, code: 'INVALID', message: 'Pedido obrigatório.' }, { status: 400 });
    }
    const result = await releaseGatewaySplit({ ...order, id: orderId });
    return Response.json({ ok: result.ok, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha no repasse.';
    return Response.json({ ok: false, code: 'SPLIT', message }, { status: 500 });
  }
}
