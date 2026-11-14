/**
 * Grava a chave Pix da loja ou do entregador para o repasse do gateway.
 * POST { ownerType, ownerId, pixKey, pixKeyType, holderName, document, token? }
 */
import { loadPlatformState, mutatePlatformState } from '@/services/platformStore';
import type { PayoutProfile } from '@/services/platformTypes';

type Body = {
  ownerType?: 'merchant' | 'driver';
  ownerId?: string;
  pixKey?: string;
  pixKeyType?: PayoutProfile['pixKeyType'];
  holderName?: string;
  document?: string;
  token?: string;
};

function bearer(request: Request, body: Body): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization');
  if (h?.toLowerCase().startsWith('bearer ')) return h.slice(7).trim() || null;
  return body.token?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const token = bearer(request, body);
    if (!token) {
      return Response.json({ ok: false, code: 'AUTH', message: 'Sessão obrigatória.' }, { status: 401 });
    }
    const state = await loadPlatformState();
    const session = state.sessions.find((s) => s.token === token);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return Response.json(
        { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
        { status: 401 }
      );
    }

    const ownerType = body.ownerType;
    const ownerId = String(body.ownerId || '').trim();
    const pixKey = String(body.pixKey || '').trim();
    const pixKeyType = body.pixKeyType;
    const holderName = String(body.holderName || '').trim();
    const document = String(body.document || '').replace(/\D/g, '');
    if (ownerType !== 'merchant' && ownerType !== 'driver') {
      return Response.json({ ok: false, code: 'INVALID', message: 'ownerType inválido.' }, { status: 400 });
    }
    if (!ownerId || !pixKey || !pixKeyType || holderName.length < 2) {
      return Response.json({ ok: false, code: 'INVALID', message: 'Chave Pix incompleta.' }, { status: 400 });
    }
    if (document.length !== 11 && document.length !== 14) {
      return Response.json(
        { ok: false, code: 'DOCUMENT', message: 'Informe CPF ou CNPJ do titular.' },
        { status: 400 }
      );
    }

    const profile: PayoutProfile = {
      ownerType,
      ownerId,
      pixKey,
      pixKeyType,
      holderName,
      document,
      updatedAt: new Date().toISOString(),
    };
    await mutatePlatformState((current) => {
      const prev = current.payoutProfiles || [];
      const next = [
        profile,
        ...prev.filter((p) => !(p.ownerType === ownerType && p.ownerId === ownerId)),
      ];
      return { state: { ...current, payoutProfiles: next }, result: true };
    });
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao gravar a chave Pix.';
    return Response.json({ ok: false, code: 'PROFILE', message }, { status: 500 });
  }
}
