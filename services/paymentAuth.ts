/**
 * Auth obrigatória nas rotas de pagamento.
 */
import { loadPlatformState } from '@/services/platformStore';
import type { PlatformUser } from '@/services/platformTypes';

export function bearerFromRequest(
  request: Request,
  body?: { token?: string }
): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization');
  if (h?.toLowerCase().startsWith('bearer ')) {
    const t = h.slice(7).trim();
    if (t) return t;
  }
  const fromBody = body?.token?.trim();
  return fromBody || null;
}

export async function requirePaymentSession(
  request: Request,
  body?: { token?: string }
): Promise<
  | { ok: true; user: PlatformUser; token: string }
  | { ok: false; response: Response }
> {
  const token = bearerFromRequest(request, body);
  if (!token) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: 'AUTH', message: 'Sessão obrigatória.' },
        { status: 401 }
      ),
    };
  }
  const state = await loadPlatformState();
  const session = state.sessions.find((s) => s.token === token);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
        { status: 401 }
      ),
    };
  }
  const user = state.users.find((u) => u.id === session.userId);
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: 'AUTH', message: 'Usuário da sessão não encontrado.' },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user, token };
}
