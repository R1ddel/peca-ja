/**
 * HTTP handler compartilhado: Expo API route + servidor standalone.
 */
import { handlePlatformAction } from '@/services/platformEngine';
import type { PlatformAction } from '@/services/platformTypes';

export async function handlePlatformRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const result = await handlePlatformAction({ action: 'health' });
      return Response.json(result);
    }

    if (request.method !== 'POST') {
      return Response.json(
        { ok: false, code: 'METHOD', message: 'Use GET (health) ou POST (ações).' },
        { status: 405 }
      );
    }

    const body = (await request.json()) as PlatformAction;
    if (!body || typeof body !== 'object' || !('action' in body)) {
      return Response.json(
        { ok: false, code: 'VALIDATION', message: 'Body JSON com "action" é obrigatório.' },
        { status: 400 }
      );
    }

    const result = await handlePlatformAction(body);
    const status = result.ok ? 200 : result.code === 'AUTH' ? 401 : 400;
    return Response.json(result, { status });
  } catch (err: any) {
    console.error('[platform]', err?.message || err);
    return Response.json(
      {
        ok: false,
        code: 'SERVER',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Erro interno da plataforma.'
            : err?.message || 'Erro interno da plataforma.',
      },
      { status: 500 }
    );
  }
}
