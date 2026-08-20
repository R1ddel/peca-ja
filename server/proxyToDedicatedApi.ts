/**
 * Se a API dedicada (8787) estiver ativa, o Metro NÃO abre Postgres —
 * só repassa o request. Evita estourar o pool do Supabase.
 */
export async function proxyToDedicatedApi(request: Request): Promise<Response | null> {
  const use =
    process.env.EXPO_PUBLIC_USE_FLEET_SERVER === '1' ||
    process.env.EXPO_PUBLIC_USE_FLEET_SERVER === 'true';
  if (!use) return null;

  const base = (
    process.env.EXPO_PUBLIC_FLEET_URL?.trim() ||
    `http://127.0.0.1:${process.env.EXPO_PUBLIC_FLEET_PORT?.trim() || '8787'}`
  ).replace(/\/$/, '');

  try {
    const incoming = new URL(request.url);
    const target = `${base}${incoming.pathname}${incoming.search}`;
    const headers = new Headers();
    const ct = request.headers.get('content-type');
    if (ct) headers.set('Content-Type', ct);
    const auth = request.headers.get('authorization');
    if (auth) headers.set('Authorization', auth);
    const accept = request.headers.get('accept');
    if (accept) headers.set('Accept', accept);

    const method = (request.method || 'GET').toUpperCase();
    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = await request.text();
    }

    const res = await fetch(target, init);
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (err: any) {
    return Response.json(
      {
        ok: false,
        code: 'PROXY',
        message: err?.message || `API dedicada inacessível (${base}). Rode npm run api:server.`,
      },
      { status: 502 }
    );
  }
}
