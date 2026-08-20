/** Página pública do PDF para apoiadores — GET /apoiadores */

export function publicPdfHtml(opts: {
  title: string;
  subtitle: string;
  pdfHref: string;
  fallbackLabel: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      background: #F5FAF7;
      color: #1A2E24;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #00A86B;
      color: #fff;
      padding: 0.85rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    header strong { font-size: 1.05rem; }
    header span { opacity: 0.92; font-size: 0.9rem; }
    a.btn {
      background: #fff;
      color: #007A4D;
      text-decoration: none;
      font-weight: 700;
      padding: 0.55rem 0.9rem;
      border-radius: 8px;
    }
    iframe, object {
      flex: 1;
      width: 100%;
      min-height: 70vh;
      border: 0;
      background: #e8f8f0;
    }
    .fallback {
      padding: 2rem 1.25rem;
      max-width: 36rem;
      margin: 0 auto;
      line-height: 1.5;
    }
    .fallback a { color: #007A4D; font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <div>
      <strong>Peça Já</strong><br />
      <span>${opts.subtitle}</span>
    </div>
    <a class="btn" href="${opts.pdfHref}" target="_blank" rel="noopener">Abrir / baixar PDF</a>
  </header>
  <object data="${opts.pdfHref}" type="application/pdf">
    <div class="fallback">
      <p>Seu navegador não mostrou o PDF aqui.</p>
      <p><a href="${opts.pdfHref}">${opts.fallbackLabel}</a></p>
    </div>
  </object>
</body>
</html>
`;
}

export const APOIADORES_HTML = publicPdfHtml({
  title: 'Peça Já — Convite a apoiadores',
  subtitle: 'Convite a apoiadores e lojas parceiras · Mucugê',
  pdfHref: '/apoiadores.pdf',
  fallbackLabel: 'Toque aqui para abrir o convite a apoiadores.',
});

export const BENEFICIOS_HTML = publicPdfHtml({
  title: 'Peça Já — Por que assinar',
  subtitle: 'Benefícios e oferta de lançamento · Mucugê',
  pdfHref: '/beneficios.pdf',
  fallbackLabel: 'Toque aqui para abrir os benefícios do comerciante.',
});

