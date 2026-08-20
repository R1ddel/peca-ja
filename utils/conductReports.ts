/**
 * Denúncias graves de conduta do entregador → fila local + e-mail ao suporte.
 */
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConductReport, ConductReportCategory } from '@/types';
import { SUPPORT_EMAIL } from '@/data/supportBot';
import { fleetReportRemote } from '@/services/fleetClient';

const KEY = '@pecaja_conduct_reports_v1';

export const CONDUCT_CATEGORIES: {
  id: ConductReportCategory;
  label: string;
  hint: string;
}[] = [
  {
    id: 'racismo',
    label: 'Racismo / discriminação',
    hint: 'Ofensas por raça, cor, origem ou religião',
  },
  {
    id: 'bullying',
    label: 'Bullying / humilhação',
    hint: 'Xingamentos, humilhação ou intimidação',
  },
  {
    id: 'assedio',
    label: 'Assédio',
    hint: 'Assédio moral ou sexual',
  },
  {
    id: 'violencia',
    label: 'Agressão / violência',
    hint: 'Agressão física ou tentativa',
  },
  {
    id: 'ameaca',
    label: 'Ameaça',
    hint: 'Ameaça de violência ou prejuízo',
  },
  {
    id: 'furto',
    label: 'Furto / dano',
    hint: 'Sumiço de itens ou dano proposital',
  },
  {
    id: 'outro',
    label: 'Outro delito',
    hint: 'Outra conduta ilegal ou grave',
  },
];

export function conductCategoryLabel(id: ConductReportCategory): string {
  return CONDUCT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

async function loadAll(): Promise<ConductReport[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(list: ConductReport[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function listConductReports(): Promise<ConductReport[]> {
  const list = await loadAll();
  return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export type SubmitConductInput = {
  orderId: string;
  businessId: string;
  businessName: string;
  driverId?: string;
  driverName?: string;
  reporterUserId: string;
  reporterName: string;
  reporterEmail?: string;
  category: ConductReportCategory;
  description: string;
  evidenceUris: string[];
  policeAware?: boolean;
};

/**
 * Salva a denúncia e abre o e-mail do suporte com o relato (provas anexadas pelo usuário no app de e-mail se necessário).
 */
export async function submitConductReportToSupport(
  input: SubmitConductInput
): Promise<{ ok: true; report: ConductReport } | { ok: false; error: string }> {
  const description = input.description.trim();
  if (description.length < 20) {
    return {
      ok: false,
      error: 'Descreva o ocorrido com pelo menos 20 caracteres.',
    };
  }
  if (!input.category) {
    return { ok: false, error: 'Escolha o tipo de denúncia.' };
  }

  const report: ConductReport = {
    id: `cr-${Date.now()}`,
    orderId: input.orderId,
    businessId: input.businessId,
    businessName: input.businessName,
    driverId: input.driverId,
    driverName: input.driverName,
    reporterUserId: input.reporterUserId,
    reporterName: input.reporterName,
    reporterEmail: input.reporterEmail,
    category: input.category,
    description,
    evidenceUris: input.evidenceUris.slice(0, 5),
    createdAt: new Date().toISOString(),
    status: 'enviado_suporte',
    policeAware: !!input.policeAware,
  };

  const list = await loadAll();
  list.unshift(report);
  await saveAll(list);

  // Espelha na frota compartilhada (painel de suporte)
  void fleetReportRemote(report);

  const cat = conductCategoryLabel(report.category);
  const subject = encodeURIComponent(
    `[DENÚNCIA GRAVE] Pedido ${report.orderId} · ${cat}`
  );
  const body = encodeURIComponent(
    [
      'DENÚNCIA DE CONDUTA — PEÇA JÁ',
      '',
      `Protocolo: ${report.id}`,
      `Data: ${new Date(report.createdAt).toLocaleString('pt-BR')}`,
      `Categoria: ${cat}`,
      `Pedido: ${report.orderId}`,
      `Comércio: ${report.businessName} (${report.businessId})`,
      `Entregador: ${report.driverName || 'não identificado'} (${report.driverId || '—'})`,
      `Cliente: ${report.reporterName} <${report.reporterEmail || 'sem e-mail'}>`,
      `Polícia ciente/acionada: ${report.policeAware ? 'sim' : 'não informado'}`,
      `Provas anexadas no app: ${report.evidenceUris.length} foto(s)`,
      '',
      'RELATO:',
      report.description,
      '',
      '---',
      'Pedido: análise urgente pela equipe Peça Já.',
      'Em crimes, orientar o cliente a registrar Boletim de Ocorrência.',
      Platform.OS === 'ios' || Platform.OS === 'android'
        ? 'As fotos ficam no aparelho do cliente; peça reenvio por e-mail se necessário.'
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  try {
    const can = await Linking.canOpenURL(mailto);
    if (can) await Linking.openURL(mailto);
    else await Linking.openURL(mailto);
  } catch {
    // Denúncia já está salva localmente para a fila do suporte
  }

  return { ok: true, report };
}
