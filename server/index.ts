/**
 * Servidor HTTP Peça Já — frota + plataforma + pagamentos.
 * Deploy: Railway / Render / Fly — DATABASE_URL + PORT + MP_ACCESS_TOKEN.
 *
 * Local: npm run fleet:server
 * App: EXPO_PUBLIC_API_URL=http://SEU_IP:8787  + EXPO_PUBLIC_USE_FLEET_SERVER=1
 */
import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fleetPersistenceMode } from '@/services/fleetStore';
import { platformPersistenceMode } from '@/services/platformStore';
import { handleFleetRequest } from '@/server/fleetHttp';
import { handlePlatformRequest } from '@/server/platformHttp';
import { handlePaymentsRequest } from '@/server/paymentsHttp';
import { PRIVACY_POLICY_HTML } from '@/server/privacyPolicy';
import { APOIADORES_HTML, BENEFICIOS_HTML } from '@/server/apoiadoresPage';

function publicPdfPath(fileName: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'server', 'public', fileName),
    path.join(process.cwd(), 'docs', fileName),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function sendPdf(res: http.ServerResponse, fileName: string, downloadName: string) {
  const pdfPath = publicPdfPath(fileName);
  if (!pdfPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: `PDF ${downloadName} não encontrado.` }));
    return;
  }
  const buf = fs.readFileSync(pdfPath);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': buf.length,
    'Content-Disposition': `inline; filename="${downloadName}"`,
    'Cache-Control': 'public, max-age=300',
  });
  res.end(buf);
}

const PORT = Number(process.env.PORT || process.env.FLEET_PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

function assertProductionPersistence() {
  if (!IS_PROD) return;
  if (platformPersistenceMode() !== 'postgres' || fleetPersistenceMode() !== 'postgres') {
    console.error(
      '[pecaja-api] FATAL: em production é obrigatório DATABASE_URL (Postgres). Fallback .data/ é proibido.'
    );
    process.exit(1);
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function toFetchRequest(req: http.IncomingMessage, url: URL, raw: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };
  const auth = req.headers.authorization || req.headers.Authorization;
  if (typeof auth === 'string' && auth.trim()) {
    headers.Authorization = auth;
  }
  return new Request(`http://local${url.pathname}${url.search}`, {
    method: req.method || 'GET',
    headers,
    body:
      req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
        ? raw || undefined
        : undefined,
  });
}

assertProductionPersistence();

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health' || url.pathname === '/') {
      const fleet = fleetPersistenceMode();
      const platform = platformPersistenceMode();
      if (IS_PROD && (fleet !== 'postgres' || platform !== 'postgres')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            code: 'NO_POSTGRES',
            message: 'Production exige Postgres (DATABASE_URL).',
            fleet,
            platform,
          })
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'pecaja-api',
          fleet,
          platform,
          payments: true,
          mpConfigured: !!process.env.MP_ACCESS_TOKEN?.trim(),
          time: new Date().toISOString(),
        })
      );
      return;
    }

    if (url.pathname === '/privacy' || url.pathname === '/privacy/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(PRIVACY_POLICY_HTML);
      return;
    }

    if (url.pathname === '/apoiadores' || url.pathname === '/apoiadores/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(APOIADORES_HTML);
      return;
    }

    if (url.pathname === '/apoiadores.pdf') {
      sendPdf(res, 'PECA_JA_Apoiadores.pdf', 'PECA_JA_Apoiadores.pdf');
      return;
    }

    if (url.pathname === '/beneficios' || url.pathname === '/beneficios/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(BENEFICIOS_HTML);
      return;
    }

    if (url.pathname === '/beneficios.pdf') {
      sendPdf(res, 'PECA_JA_Beneficios_Comerciante.pdf', 'PECA_JA_Beneficios_Comerciante.pdf');
      return;
    }

    const raw =
      req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
        ? await readBody(req)
        : '';

    const fetchReq = toFetchRequest(req, url, raw);

    if (url.pathname === '/api/fleet' || url.pathname === '/api/fleet/') {
      const response = await handleFleetRequest(fetchReq);
      const body = await response.text();
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      });
      res.end(body);
      return;
    }

    if (url.pathname === '/api/platform' || url.pathname === '/api/platform/') {
      const response = await handlePlatformRequest(fetchReq);
      const body = await response.text();
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      });
      res.end(body);
      return;
    }

    if (url.pathname.startsWith('/api/payments')) {
      const response = await handlePaymentsRequest(fetchReq);
      if (response) {
        const body = await response.text();
        res.writeHead(response.status, {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        });
        res.end(body);
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        message: 'Not found. Use /api/fleet, /api/platform ou /api/payments/*',
      })
    );
  } catch (err: any) {
    console.error('[pecaja-api]', err?.message || err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        code: 'SERVER',
        message: err?.message || 'Erro no servidor.',
      })
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[pecaja-api] http://${HOST}:${PORT} · fleet=${fleetPersistenceMode()} · platform=${platformPersistenceMode()} · payments=on`
  );
  if (platformPersistenceMode() === 'filesystem') {
    console.warn(
      '[pecaja-api] Sem DATABASE_URL — plataforma em .data/platform (ok pra LAN; use Postgres em produção).'
    );
  }
});
