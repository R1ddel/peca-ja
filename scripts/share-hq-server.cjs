/**
 * Servidor leve só pra compartilhar o HQ (projeção Ano 2) na web.
 * Não usa Metro — evita timeout em túnel.
 *
 * Uso: node scripts/share-hq-server.mjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.SHARE_HQ_PORT || 8790);
const API = (process.env.SHARE_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

const Y2 = {
  label: 'Projeção Ano 2 · escala nacional',
  todayOrders: '34.820',
  todayGmv: 'R$ 2.847.620',
  todayFee: 'R$ 341.714',
  inProgress: '1.840',
  monthOrders: '982.400',
  monthGmv: 'R$ 79.420.500',
  shops: '8.420',
  users: '2.840.000',
  cities: '186',
  driversOnline: '12.840',
  platformBalance: 'R$ 18.420.600',
  seriesGmv: [2410, 2529, 2601, 2712, 2981, 3215, 2848],
  seriesLabels: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'],
};

function html() {
  const max = Math.max(...Y2.seriesGmv);
  const bars = Y2.seriesGmv
    .map((v, i) => {
      const h = Math.max(8, Math.round((v / max) * 120));
      return `<div class="bar-col"><div class="bar" style="height:${h}px"></div><span>${Y2.seriesLabels[i]}</span></div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Peça Já · Command Center (Projeção Ano 2)</title>
  <style>
    :root {
      --bg: #f4f7f5;
      --panel: #ffffff;
      --text: #10241c;
      --muted: #5b6b63;
      --line: #d7e3dc;
      --green: #00a86b;
      --greenDim: rgba(0,168,107,.12);
      --blue: #2563eb;
      --amber: #d97706;
      --red: #dc2626;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: radial-gradient(1200px 600px at 10% -10%, #d9f5e8, transparent),
                  radial-gradient(900px 500px at 100% 0%, #e8eefc, transparent),
                  var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .top {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 18px 28px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.8);
      backdrop-filter: blur(8px); position: sticky; top: 0; z-index: 2;
    }
    .brand { font-weight: 800; font-size: 20px; letter-spacing: -0.02em; }
    .brand span { color: var(--green); }
    .pill {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(217,119,6,.14); color: #b45309; font-weight: 700; font-size: 12px;
      padding: 8px 12px; border-radius: 999px;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #d97706; }
    main { max-width: 1100px; margin: 0 auto; padding: 28px 20px 60px; }
    h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.03em; }
    .lead { color: var(--muted); margin: 0 0 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .kpi {
      background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
      padding: 16px; border-top: 3px solid var(--green);
    }
    .kpi.blue { border-top-color: var(--blue); }
    .kpi.amber { border-top-color: var(--amber); }
    .kpi .v { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .kpi .l { color: var(--muted); font-size: 12px; font-weight: 700; margin-top: 6px; text-transform: uppercase; }
    .card {
      margin-top: 18px; background: var(--panel); border: 1px solid var(--line);
      border-radius: 16px; padding: 18px 20px;
    }
    .card h2 { margin: 0 0 14px; font-size: 15px; }
    .bars { display: flex; align-items: flex-end; gap: 10px; height: 140px; }
    .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
    .bar { width: 100%; max-width: 42px; background: linear-gradient(180deg, #1fd87f, var(--green)); border-radius: 8px 8px 4px 4px; }
    .bar-col span { font-size: 11px; color: var(--muted); font-weight: 600; }
    .note { margin-top: 18px; color: var(--muted); font-size: 13px; line-height: 1.5; }
    .row { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
    @media (max-width: 800px) { .row { grid-template-columns: 1fr; } }
    .side li { list-style: none; display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
    .side ul { margin: 0; padding: 0; }
    .side strong { font-weight: 800; }
  </style>
</head>
<body>
  <div class="top">
    <div class="brand">Peça <span>Já</span> · Command Center</div>
    <div class="pill"><span class="dot"></span> AMBIENTE DE PLANEJAMENTO — DADOS PROJETADOS</div>
  </div>
  <main>
    <h1>Como está o Peça Já agora?</h1>
    <p class="lead">Vitrine de planejamento Ano 2 — não é operação real · ${Y2.label}</p>

    <div class="grid">
      <div class="kpi blue"><div class="v">${Y2.todayOrders}</div><div class="l">Pedidos hoje</div></div>
      <div class="kpi"><div class="v">${Y2.todayGmv}</div><div class="l">GMV hoje</div></div>
      <div class="kpi"><div class="v">${Y2.todayFee}</div><div class="l">Receita PJ hoje</div></div>
      <div class="kpi amber"><div class="v">${Y2.inProgress}</div><div class="l">Em andamento</div></div>
      <div class="kpi"><div class="v">${Y2.monthGmv}</div><div class="l">GMV 30 dias</div></div>
      <div class="kpi blue"><div class="v">${Y2.monthOrders}</div><div class="l">Pedidos 30d</div></div>
    </div>

    <div class="row">
      <div class="card">
        <h2>GMV diário (7 dias) · R$ mil</h2>
        <div class="bars">${bars}</div>
      </div>
      <div class="card side">
        <h2>Rede</h2>
        <ul>
          <li><span>Lojas ativas</span><strong>${Y2.shops}</strong></li>
          <li><span>Clientes</span><strong>${Y2.users}</strong></li>
          <li><span>Cidades ativas</span><strong>${Y2.cities}</strong></li>
          <li><span>Entregadores online</span><strong>${Y2.driversOnline}</strong></li>
          <li><span>Saldo plataforma</span><strong>${Y2.platformBalance}</strong></li>
        </ul>
      </div>
    </div>

    <p class="note">
      Esta página é uma vitrine leve da projeção Ano 2 (carrega rápido em qualquer rede).
      O painel completo (/admin no app) exige login HQ e o PC ligado com a API local.
    </p>
  </main>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname.startsWith('/api/')) {
    try {
      const target = `${API}${url.pathname}${url.search}`;
      const headers = { 'content-type': req.headers['content-type'] || 'application/json' };
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(target, {
        method: req.method || 'GET',
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
      res.end(text);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: String(err?.message || err) }));
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[share-hq] http://127.0.0.1:${PORT}`);
  console.log(`[share-hq] API proxy → ${API}`);
});
