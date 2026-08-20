import {
  loadCloudSync,
  saveCloudSync,
  tokensMatch,
} from '@/services/cloudSyncStore';

type Body = {
  action?: 'push' | 'pull' | 'status';
  applicationId?: string;
  token?: string;
  payload?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const applicationId = String(body.applicationId || '').trim();
    const token = String(body.token || '').trim();
    const action = body.action || 'status';

    if (!applicationId) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'applicationId obrigatório.' },
        { status: 400 }
      );
    }

    if (action === 'status') {
      const existing = await loadCloudSync(applicationId);
      return Response.json({
        ok: true,
        exists: !!existing,
        updatedAt: existing?.updatedAt ?? null,
      });
    }

    if (!token || token.length < 8) {
      return Response.json(
        { ok: false, code: 'TOKEN', message: 'Token de sync inválido.' },
        { status: 400 }
      );
    }

    if (action === 'push') {
      if (!body.payload || typeof body.payload !== 'object') {
        return Response.json(
          { ok: false, code: 'INVALID', message: 'Payload ausente.' },
          { status: 400 }
        );
      }
      const existing = await loadCloudSync(applicationId);
      if (existing && !tokensMatch(existing.token, token)) {
        // Migração: aceita token estável pj_<applicationId> no lugar do token antigo
        const stable = `pj_${applicationId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
        if (!(token === stable || existing.token === stable)) {
          return Response.json(
            {
              ok: false,
              code: 'FORBIDDEN',
              message: 'Token não confere com o backup na nuvem desta loja.',
            },
            { status: 403 }
          );
        }
      }
      const saved = await saveCloudSync(applicationId, token, body.payload);
      return Response.json({
        ok: true,
        action: 'push',
        updatedAt: saved.updatedAt,
      });
    }

    if (action === 'pull') {
      const existing = await loadCloudSync(applicationId);
      if (!existing) {
        return Response.json(
          { ok: false, code: 'NOT_FOUND', message: 'Nenhum backup na nuvem ainda.' },
          { status: 404 }
        );
      }
      if (!tokensMatch(existing.token, token)) {
        const stable = `pj_${applicationId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
        if (!(token === stable || existing.token === stable)) {
          return Response.json(
            {
              ok: false,
              code: 'FORBIDDEN',
              message: 'Token não confere. Use o mesmo applicationId da loja neste aparelho.',
            },
            { status: 403 }
          );
        }
      }
      return Response.json({
        ok: true,
        action: 'pull',
        updatedAt: existing.updatedAt,
        payload: existing.payload,
      });
    }

    return Response.json(
      { ok: false, code: 'INVALID', message: 'Ação desconhecida.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[merchant/cloud-sync]', err?.message || err);
    return Response.json(
      { ok: false, code: 'SERVER', message: err?.message || 'Erro no sync.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const applicationId = url.searchParams.get('applicationId') || '';
  if (!applicationId) {
    return Response.json({
      ok: true,
      message: 'Cloud sync Peça Já. POST action=push|pull|status.',
    });
  }
  const existing = await loadCloudSync(applicationId);
  return Response.json({
    ok: true,
    exists: !!existing,
    updatedAt: existing?.updatedAt ?? null,
  });
}
