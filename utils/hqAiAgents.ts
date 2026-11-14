/**
 * Equipe de IA do Command Center (/admin/ai-team).
 * Analisa dados reais do HQ (ops, problemas, financeiro, inteligência)
 * e gera insights locais. Manuais em equipe-ia/agentes/.
 * Preparado para LLM depois — hoje é regra + dados ao vivo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  platformAdminFinanceOverview,
  platformAdminIntelligence,
  platformAdminOpsNow,
  platformAdminProblemsNow,
} from '@/services/platformClient';

const INSIGHTS_KEY = '@pecaja_hq_ai_insights_v1';
const APPROVALS_KEY = '@pecaja_hq_ai_approvals_v1';
const MAX_INSIGHTS = 80;

export type HqAiSeverity = 'info' | 'warning' | 'critical';

export type HqAiInsight = {
  id: string;
  agentId: string;
  agent: string;
  title: string;
  body: string;
  severity: HqAiSeverity;
  createdAt: string;
  href?: string;
};

export type HqAiApproval = {
  id: string;
  agentId: string;
  agent: string;
  urgency: 'alta' | 'media' | 'baixa';
  what: string;
  why: string;
  risk: string;
  recommendation: string;
  status: 'pending' | 'approved' | 'rejected' | 'adjusted';
  createdAt: string;
  decidedAt?: string;
  note?: string;
};

export type HqAiAgentDef = {
  id: string;
  name: string;
  area: string;
  emoji: string;
  manual: string;
  runnable: boolean;
  blurb: string;
};

/** Roster alinhado a equipe-ia/agentes (núcleo + expansão). */
export const HQ_AI_AGENTS: HqAiAgentDef[] = [
  {
    id: 'chefe',
    name: 'Chefe de Gabinete',
    area: 'Gestão',
    emoji: '🗂',
    manual: 'equipe-ia/agentes/01-chefe-de-gabinete.md',
    runnable: true,
    blurb: 'Consolida briefing e fila de decisões.',
  },
  {
    id: 'pm',
    name: 'Product Manager',
    area: 'Produto',
    emoji: '📐',
    manual: 'equipe-ia/agentes/02-product-manager.md',
    runnable: false,
    blurb: 'Prioriza backlog (manual no Cursor).',
  },
  {
    id: 'dev',
    name: 'Dev Full-stack',
    area: 'Tech',
    emoji: '💻',
    manual: 'equipe-ia/agentes/03-dev-fullstack.md',
    runnable: false,
    blurb: 'Código em branch + PR (chat Dev).',
  },
  {
    id: 'qa',
    name: 'QA / Testes',
    area: 'Tech',
    emoji: '🧪',
    manual: 'equipe-ia/agentes/04-qa-testes.md',
    runnable: false,
    blurb: 'Regressão e smoke (chat QA).',
  },
  {
    id: 'devops',
    name: 'DevOps',
    area: 'Tech',
    emoji: '🛡',
    manual: 'equipe-ia/agentes/05-devops-monitoramento.md',
    runnable: true,
    blurb: 'Saúde da operação e alertas.',
  },
  {
    id: 'marketing',
    name: 'Marketing / Conteúdo',
    area: 'Growth',
    emoji: '✦',
    manual: 'equipe-ia/agentes/06-marketing-conteudo.md',
    runnable: true,
    blurb: 'Sinais de crescimento e conteúdo.',
  },
  {
    id: 'trafego',
    name: 'Tráfego Pago',
    area: 'Growth',
    emoji: '📢',
    manual: 'equipe-ia/agentes/07-trafego-pago.md',
    runnable: false,
    blurb: 'Campanhas — aprovação humana obrigatória.',
  },
  {
    id: 'criativo',
    name: 'Criativo',
    area: 'Growth',
    emoji: '🎨',
    manual: 'equipe-ia/agentes/08-criativo.md',
    runnable: false,
    blurb: 'Artes e panfletos (chat marketing).',
  },
  {
    id: 'aso',
    name: 'ASO / Lojas',
    area: 'Growth',
    emoji: '🏪',
    manual: 'equipe-ia/agentes/09-aso-lojas.md',
    runnable: false,
    blurb: 'Play Store / App Store.',
  },
  {
    id: 'sdr',
    name: 'Prospecção / SDR',
    area: 'Comercial',
    emoji: '🎯',
    manual: 'equipe-ia/agentes/10-prospeccao-sdr.md',
    runnable: true,
    blurb: 'Lojas e frota no funil do HQ.',
  },
  {
    id: 'vendas',
    name: 'Vendas / CRM',
    area: 'Comercial',
    emoji: '🤝',
    manual: 'equipe-ia/agentes/11-vendas-crm.md',
    runnable: false,
    blurb: 'Pipeline comercial.',
  },
  {
    id: 'suporte',
    name: 'Suporte / CS',
    area: 'Operação',
    emoji: '✉',
    manual: 'equipe-ia/agentes/12-suporte-customer-success.md',
    runnable: true,
    blurb: 'Problemas e SLA ao vivo.',
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    area: 'Ops',
    emoji: '₿',
    manual: 'equipe-ia/agentes/13-financeiro.md',
    runnable: true,
    blurb: 'Caixa e visão financeira do HQ.',
  },
  {
    id: 'juridico',
    name: 'Jurídico / Compliance',
    area: 'Ops',
    emoji: '⚖',
    manual: 'equipe-ia/agentes/14-juridico-compliance.md',
    runnable: false,
    blurb: 'Só rascunho — validação humana.',
  },
  {
    id: 'dados',
    name: 'Analista de Dados',
    area: 'Análises',
    emoji: '📊',
    manual: 'equipe-ia/agentes/15-analista-de-dados.md',
    runnable: true,
    blurb: 'Números e tendências do HQ.',
  },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listHqAiAgents() {
  return HQ_AI_AGENTS;
}

export async function listHqAiInsights(): Promise<HqAiInsight[]> {
  try {
    const raw = await AsyncStorage.getItem(INSIGHTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HqAiInsight[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveInsights(list: HqAiInsight[]) {
  await AsyncStorage.setItem(INSIGHTS_KEY, JSON.stringify(list.slice(0, MAX_INSIGHTS)));
}

export async function clearHqAiInsights() {
  await AsyncStorage.removeItem(INSIGHTS_KEY);
}

export async function listHqAiApprovals(): Promise<HqAiApproval[]> {
  try {
    const raw = await AsyncStorage.getItem(APPROVALS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HqAiApproval[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveApprovals(list: HqAiApproval[]) {
  await AsyncStorage.setItem(APPROVALS_KEY, JSON.stringify(list.slice(0, 60)));
}

export async function decideHqAiApproval(
  id: string,
  status: 'approved' | 'rejected' | 'adjusted',
  note?: string
) {
  const list = await listHqAiApprovals();
  const next = list.map((a) =>
    a.id === id
      ? { ...a, status, note, decidedAt: new Date().toISOString() }
      : a
  );
  await saveApprovals(next);
  return next;
}

function pushInsight(
  bag: HqAiInsight[],
  agent: HqAiAgentDef,
  title: string,
  body: string,
  severity: HqAiSeverity,
  href?: string
) {
  bag.push({
    id: uid('ins'),
    agentId: agent.id,
    agent: agent.name,
    title,
    body,
    severity,
    createdAt: new Date().toISOString(),
    href,
  });
}

/**
 * Roda os agentes “runnable” com snapshot do HQ.
 * Retorna insights novos + briefing do Chefe.
 */
export async function runHqAiAgents(opts: {
  token: string;
  hqMode?: 'real' | 'projection';
}): Promise<{ insights: HqAiInsight[]; approvals: HqAiApproval[]; briefing: string }> {
  const hqMode = opts.hqMode || 'real';
  const token = opts.token;
  const now = new Date().toISOString();
  const fresh: HqAiInsight[] = [];
  const approvals: HqAiApproval[] = [];

  const byId = Object.fromEntries(HQ_AI_AGENTS.map((a) => [a.id, a]));

  const [opsRes, problemsRes, financeRes, intelRes] = await Promise.all([
    platformAdminOpsNow(token, hqMode).catch(() => null),
    platformAdminProblemsNow(token, { hqMode }).catch(() => null),
    platformAdminFinanceOverview(token, 7, hqMode).catch(() => null),
    platformAdminIntelligence(token, { hqMode, sinceDays: 7 }).catch(() => null),
  ]);

  const ops = (opsRes as any)?.ok ? (opsRes as any).ops : null;
  const problems = (problemsRes as any)?.ok ? (problemsRes as any) : null;
  const finance = (financeRes as any)?.ok ? (financeRes as any) : null;
  const intel = (intelRes as any)?.ok ? (intelRes as any).intelligence : null;

  // —— DevOps / operação ——
  const devops = byId.devops;
  const delayedCount = Number(ops?.delayedCount || ops?.delayed?.length || 0);
  const newOrders = Number(ops?.newOrders?.length || 0);
  const preparing = Number(ops?.preparing?.length || 0);
  if (devops) {
    if (delayedCount > 0) {
      pushInsight(
        fresh,
        devops,
        `${delayedCount} pedido(s) atrasado(s)`,
        'Há atraso na operação ao vivo. Abra Operação / Central de Problemas e redistribua moto ou fale com a loja.',
        delayedCount >= 3 ? 'critical' : 'warning',
        '/admin/ops'
      );
    } else if (ops) {
      pushInsight(
        fresh,
        devops,
        'Operação estável neste snapshot',
        `Novos: ${newOrders} · Em preparo: ${preparing} · Atrasados: 0. Continue o poll da Operação.`,
        'info',
        '/admin/ops'
      );
    } else {
      pushInsight(
        fresh,
        devops,
        'Sem dados de operação',
        'Não foi possível ler admin_ops_now. Confira API / sessão cloud.',
        'warning',
        '/admin/health'
      );
    }
  }

  // —— Suporte / problemas ——
  const suporte = byId.suporte;
  const problemList: any[] = problems?.problems || [];
  const problemSummary = problems?.summary || {};
  if (suporte) {
    if (problemList.length > 0) {
      const sev =
        problemList.some((p) => String(p.severity || '').includes('critical') || p.sla === 'breach')
          ? 'critical'
          : 'warning';
      pushInsight(
        fresh,
        suporte,
        `${problemList.length} problema(s) na Central`,
        `Resumo: ${JSON.stringify(problemSummary).slice(0, 160)}. Atue nos SLA estourados primeiro.`,
        sev,
        '/admin/problems'
      );
    } else if (problems) {
      pushInsight(
        fresh,
        suporte,
        'Nenhum problema aberto neste filtro',
        'Central limpa no snapshot. Bom momento para revisar tickets e avaliações.',
        'info',
        '/admin/problems'
      );
    }
  }

  // —— Financeiro ——
  const finAgent = byId.financeiro;
  if (finAgent && finance) {
    const gmv = finance.gmv ?? finance.overview?.gmv ?? finance.totals?.gmv;
    const orders = finance.orders ?? finance.overview?.orders ?? finance.totals?.orders;
    pushInsight(
      fresh,
      finAgent,
      'Visão financeira (7 dias)',
      gmv != null || orders != null
        ? `Pedidos/GMV no recorte disponível: pedidos=${orders ?? '—'} · gmv=${gmv ?? '—'}. Confira detalhe em Financeiro.`
        : 'Snapshot financeiro recebido. Abra Financeiro para números completos.',
      'info',
      '/admin/finance'
    );
  } else if (finAgent) {
    pushInsight(
      fresh,
      finAgent,
      'Financeiro indisponível neste run',
      'Sem leitura de admin_finance_overview. Verifique permissão financial e API.',
      'warning',
      '/admin/finance'
    );
  }

  // —— Dados / inteligência ——
  const dados = byId.dados;
  if (dados && intel) {
    const insights: any[] = intel.insights || [];
    const anomalies: any[] = intel.anomalies || [];
    if (anomalies.length > 0) {
      const a = anomalies[0];
      pushInsight(
        fresh,
        dados,
        `Anomalia: ${a.title || a.label || 'sinal fora do padrão'}`,
        String(a.body || a.message || a.detail || 'Veja Inteligência no HQ.'),
        'warning',
        '/admin/intelligence'
      );
    } else if (insights.length > 0) {
      const i = insights[0];
      pushInsight(
        fresh,
        dados,
        String(i.title || 'Insight de crescimento'),
        String(i.body || i.message || 'Detalhe na tela Inteligência.'),
        'info',
        '/admin/intelligence'
      );
    } else {
      pushInsight(
        fresh,
        dados,
        'Inteligência sem alerta novo',
        'Sem anomalias no recorte de 7 dias. Continue medindo pedidos concluídos (não só download).',
        'info',
        '/admin/intelligence'
      );
    }
  }

  // —— Marketing (growth soft) ——
  const mkt = byId.marketing;
  if (mkt) {
    const growth = intel?.current || intel?.meta || {};
    pushInsight(
      fresh,
      mkt,
      'Lembrete de lançamento / conteúdo',
      'Alinhe criativos e blogueiras com lojas realmente abertas. Roteiro: marketing/roteiro-dias.html. Não ligue tráfego forte sem oferta (loja + moto).',
      'info',
      '/admin/marketing'
    );
    if (growth && Object.keys(growth).length === 0) {
      /* noop */
    }
  }

  // —— SDR / cadastros ——
  const sdr = byId.sdr;
  if (sdr) {
    pushInsight(
      fresh,
      sdr,
      'Funil comercial no HQ',
      'Revise Cadastros (CRM): lojas e motoboys pendentes. Meta de lançamento = loja pronta (cardápio+foto+horário), não só lead.',
      'info',
      '/admin/crm'
    );
  }

  // —— Chefe de Gabinete: briefing + aprovação se crítico ——
  const chefe = byId.chefe;
  const criticals = fresh.filter((i) => i.severity === 'critical');
  const warnings = fresh.filter((i) => i.severity === 'warning');
  let briefing =
    `Briefing HQ · ${new Date().toLocaleString('pt-BR')}\n` +
    `1) Resultados deste run: ${fresh.length} insight(s).\n` +
    `2) Alertas: ${criticals.length} crítico(s), ${warnings.length} aviso(s).\n` +
    `3) Operação: atrasados=${delayedCount}, novos=${newOrders}, preparo=${preparing}, problemas=${problemList.length}.\n` +
    `4) Plano: tratar críticos → problemas → confirmar plantão loja/moto → só então growth.\n`;

  if (chefe) {
    pushInsight(
      fresh,
      chefe,
      'Briefing da Manhã (auto)',
      briefing,
      criticals.length ? 'critical' : warnings.length ? 'warning' : 'info',
      '/admin/ai-team'
    );

    if (criticals.length > 0) {
      approvals.push({
        id: uid('apr'),
        agentId: chefe.id,
        agent: chefe.name,
        urgency: 'alta',
        what: 'Pausar tráfego pago / anúncios até estabilizar operação',
        why: `${criticals.length} alerta(s) crítico(s) no HQ (atraso ou problema).`,
        risk: 'Pedido ruim na rua queima blogueira e campanha.',
        recommendation: 'APROVAR pausa de anúncio até delayed/problemas zerarem no plantão.',
        status: 'pending',
        createdAt: now,
      });
    }
  }

  const prev = await listHqAiInsights();
  const merged = [...fresh, ...prev].slice(0, MAX_INSIGHTS);
  await saveInsights(merged);

  if (approvals.length) {
    const prevA = await listHqAiApprovals();
    await saveApprovals([...approvals, ...prevA]);
  }

  const allApprovals = await listHqAiApprovals();
  return { insights: fresh, approvals: allApprovals.filter((a) => a.status === 'pending'), briefing };
}
