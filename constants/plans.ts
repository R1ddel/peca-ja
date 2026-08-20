export type MerchantPlan = 'essencial' | 'crescimento' | 'destaque';

export type MerchantPlanDef = {
  label: string;
  monthlyPrice: number;
  badge: string;
  tagline: string;
  /** Por que este plano vale a pena (tela de detalhe). */
  pitch: string;
  /** Argumentos de venda curtos. */
  why: string[];
  perks: string[];
  highlight?: string;
  /** Plano imediatamente superior (upsell). */
  upsellTo?: MerchantPlan;
  upsellHook?: string;
};

/** Pacotes de assinatura do comércio no Peça Já (do mais acessível ao Topo). */
export const MERCHANT_PLANS: Record<MerchantPlan, MerchantPlanDef> = {
  essencial: {
    label: 'Já na Rua',
    monthlyPrice: 200,
    badge: 'Já na Rua',
    tagline: 'Sua loja no app, pedindo todo dia na cidade.',
    highlight: 'Ideal pra começar',
    pitch:
      'O Já na Rua coloca sua loja no mapa do Peça Já com tudo que precisa pra vender: cardápio, pedidos e painel. É a porta de entrada — barata, completa e honesta. Perfeito se você quer testar o app na sua cidade sem travar o caixa.',
    why: [
      'Presença real no app da cidade, sem enrolação',
      'Painel completo pra receber e organizar pedidos',
      'Fotos e galeria do produto — o cliente vê o que pede',
      'Custo mensal previsível pra começar com segurança',
    ],
    perks: [
      'Listagem completa no Peça Já da sua cidade',
      'Pedidos ilimitados no painel do comércio',
      'Cardápio com fotos e galeria do produto',
      'Frete urbano Peça Já (regra da cidade)',
      'Notificações de pedido novo',
      'Suporte por e-mail / FAQ',
    ],
    upsellTo: 'crescimento',
    upsellHook:
      'Com o Já em Alta você sobe na busca, ganha cupons da loja e aparece mais na home — a diferença que costuma virar pedido.',
  },
  crescimento: {
    label: 'Já em Alta',
    monthlyPrice: 250,
    badge: 'Já em Alta',
    tagline: 'Mais olhos na vitrine — e mais pedidos na cozinha.',
    highlight: 'Mais pedido',
    pitch:
      'O Já em Alta é o plano do comércio que já sabe que presença importa. Você leva tudo do Já na Rua e ainda ganha selo, cupons e prioridade média no ranking. É o equilíbrio: um pouco a mais no mês, bem mais gente te encontrando.',
    why: [
      'Selo “Em Alta” chama atenção na busca e no cardápio',
      'Cupons da loja pra converter quem está em dúvida',
      'Destaque rotativo na home da cidade',
      'Relatório semanal pra você ver o que está vendendo',
    ],
    perks: [
      'Tudo do Já na Rua',
      'Selo “Em Alta” na busca e no cardápio',
      'Prioridade média no ranking da cidade',
      'Cupons da loja (ex.: frete ou % off)',
      'Destaque rotativo na home local',
      'Relatório simples de pedidos da semana',
      'Suporte prioritário no horário comercial',
    ],
    upsellTo: 'destaque',
    upsellHook:
      'No Já no Topo sua marca vai pra frente de quase todo mundo: sugestões na busca, faixa premium e prioridade máxima nas campanhas da cidade.',
  },
  destaque: {
    label: 'Já no Topo',
    monthlyPrice: 300,
    badge: 'Já no Topo',
    tagline: 'O pacote que coloca sua marca na frente de todo mundo.',
    highlight: 'Máxima vitrine',
    pitch:
      'O Já no Topo é o plano de quem quer ser a primeira escolha. Inclui tudo dos planos anteriores e ainda coloca sua loja nas sugestões da busca, com selo Topo e prioridade máxima. É a vitrine mais forte do Peça Já na sua cidade.',
    why: [
      'Máxima prioridade no ranking e nas campanhas locais',
      'Combos e produtos nas sugestões “pra você”',
      'Faixa Parceiro Topo no card — confiança à primeira vista',
      'Canal direto com a equipe Peça Já',
    ],
    perks: [
      'Tudo do Já em Alta',
      'Selo Topo + posição premium no ranking',
      'Sugestões na busca (“pra você”) com seus combos',
      'Faixa “Parceiro Topo” no card do comércio',
      'Prioridade máxima em campanhas da cidade',
      'Destaque fixo na vitrine da home (quando houver slot)',
      'Galeria reforçada + dica de foto no painel',
      'Canal direto com a equipe Peça Já',
    ],
  },
};

/** Plano mais caro — usado nas sugestões da busca. */
export const TOP_MERCHANT_PLAN: MerchantPlan = 'destaque';

export const MERCHANT_PLAN_ORDER: MerchantPlan[] = ['essencial', 'crescimento', 'destaque'];

export function formatPlanPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function getNextPlan(plan: MerchantPlan): MerchantPlan | null {
  return MERCHANT_PLANS[plan].upsellTo ?? null;
}

export function isMerchantPlanId(value: string | undefined | null): value is MerchantPlan {
  return value === 'essencial' || value === 'crescimento' || value === 'destaque';
}
