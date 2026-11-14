import { AiInsight, ObrasStore } from '@/types/obras';
import { addInsight, getFinanceSummary, listExpenses, listMacroItems, listTasks } from '@/utils/obrasStore';

const AGENTS = [
  { id: 'cost-analyst', name: 'Analista de Custos', emoji: '💰' },
  { id: 'planner', name: 'Planejador', emoji: '📅' },
  { id: 'finance', name: 'Assistente Financeiro', emoji: '📊' },
  { id: 'safety', name: 'Segurança do Trabalho', emoji: '🦺' },
  { id: 'productivity', name: 'Produtividade', emoji: '⚡' },
] as const;

function uid() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Agentes de IA locais — analisam dados da obra e geram insights automáticos.
 * Preparado para integração futura com API de LLM.
 */
export async function runObrasAiAgents(projectId: string): Promise<AiInsight[]> {
  const newInsights: AiInsight[] = [];
  const now = new Date().toISOString();

  const [finance, expenses, macros, tasks] = await Promise.all([
    getFinanceSummary(projectId),
    listExpenses(projectId),
    listMacroItems(projectId),
    listTasks(projectId),
  ]);

  // Agente: Analista de Custos
  const supplierExpenses = expenses.filter((e) => e.category === 'supplier');
  if (supplierExpenses.length >= 2) {
    const avg = supplierExpenses.reduce((s, e) => s + e.amount, 0) / supplierExpenses.length;
    const latest = supplierExpenses[0];
    if (latest.amount > avg * 1.1) {
      newInsights.push({
        id: uid(),
        projectId,
        agent: 'Analista de Custos',
        title: `Último gasto com fornecedor ${Math.round(((latest.amount - avg) / avg) * 100)}% acima da média`,
        body: `"${latest.description}" custou mais que a média recente. Revise cotações ou negocie desconto por volume.`,
        severity: 'warning',
        createdAt: now,
      });
    }
  }

  // Agente: Planejador
  const delayed = macros.filter((m) => {
    const expected = m.period === 'month' ? 80 : m.period === 'quarter' ? 50 : 30;
    return m.progress < expected && m.progress < 100;
  });
  if (delayed.length > 0) {
    const item = delayed[0];
    newInsights.push({
      id: uid(),
      projectId,
      agent: 'Planejador',
      title: `"${item.title}" abaixo do cronograma`,
      body: `Progresso atual: ${item.progress}%. Realoque equipe ou revise prazos para evitar atraso em cascata.`,
      severity: 'critical',
      createdAt: now,
    });
  }

  // Agente: Financeiro
  if (finance.remaining < finance.budget * 0.15) {
    newInsights.push({
      id: uid(),
      projectId,
      agent: 'Assistente Financeiro',
      title: 'Orçamento quase esgotado',
      body: `Restam apenas ${((finance.remaining / finance.budget) * 100).toFixed(0)}% do orçamento. Priorize itens críticos e evite gastos não planejados.`,
      severity: 'critical',
      createdAt: now,
    });
  } else if (finance.balance > 0) {
    newInsights.push({
      id: uid(),
      projectId,
      agent: 'Assistente Financeiro',
      title: 'Fluxo de caixa positivo',
      body: `Saldo atual: entradas superam saídas. Mantenha reserva de ${formatBRL(finance.budget * 0.1)} para imprevistos.`,
      severity: 'info',
      createdAt: now,
    });
  }

  // Agente: Produtividade
  const pendingToday = tasks.filter((t) => t.status === 'pending' && t.dueDate === new Date().toISOString().slice(0, 10));
  const doneToday = tasks.filter((t) => t.status === 'done' && t.dueDate === new Date().toISOString().slice(0, 10));
  if (pendingToday.length > doneToday.length + 2) {
    newInsights.push({
      id: uid(),
      projectId,
      agent: 'Produtividade',
      title: `${pendingToday.length} tarefas pendentes hoje`,
      body: 'A equipe está com backlog acima do normal. Considere redistribuir funções ou estender jornada.',
      severity: 'warning',
      createdAt: now,
    });
  }

  // Agente: Segurança
  const highPriorityPending = tasks.filter((t) => t.priority === 'high' && t.status !== 'done');
  if (highPriorityPending.length >= 3) {
    newInsights.push({
      id: uid(),
      projectId,
      agent: 'Segurança do Trabalho',
      title: 'Muitas tarefas críticas abertas',
      body: 'Priorize EPIs e briefing de segurança antes de iniciar serviços de alto risco (altura, elétrica, concretagem).',
      severity: 'warning',
      createdAt: now,
    });
  }

  for (const insight of newInsights) {
    await addInsight(insight);
  }

  return newInsights;
}

export function listAiAgents() {
  return AGENTS;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export type AgentStatus = {
  id: string;
  name: string;
  emoji: string;
  status: 'idle' | 'running' | 'done';
  lastRun?: string;
};

export function getAgentStatuses(store: ObrasStore, projectId: string): AgentStatus[] {
  const projectInsights = store.insights.filter((i) => i.projectId === projectId);
  return AGENTS.map((a) => {
    const last = projectInsights.find((i) => i.agent === a.name);
    return {
      ...a,
      status: 'idle' as const,
      lastRun: last?.createdAt,
    };
  });
}
