/**
 * Assistente de suporte Peça Já (FAQ local).
 * Dúvidas genéricas → bot. Casos específicos → ticket / e-mail.
 */

import { SUPPORT_REPLY_HOURS, SUPPORT_SLA_LINE } from '@/utils/supportSla';

export type SupportTopicId =
  | 'pedido'
  | 'pagamento'
  | 'entrega'
  | 'conta'
  | 'clube'
  | 'cancelar'
  | 'denuncia'
  | 'outro';

export type FaqEntry = {
  id: string;
  topic: SupportTopicId;
  /** Rótulo no chip de atalho */
  label: string;
  /** Palavras/frases que ativam esta resposta */
  keywords: string[];
  answer: string;
};

export const QUICK_TOPICS: { id: SupportTopicId; label: string; icon: string }[] = [
  { id: 'pedido', label: 'Meu pedido', icon: 'receipt-outline' },
  { id: 'pagamento', label: 'Pagamento', icon: 'card-outline' },
  { id: 'entrega', label: 'Entrega', icon: 'bicycle-outline' },
  { id: 'denuncia', label: 'Denúncia', icon: 'warning-outline' },
  { id: 'clube', label: 'Clube / pts', icon: 'gift-outline' },
  { id: 'cancelar', label: 'Cancelar', icon: 'close-circle-outline' },
  { id: 'conta', label: 'Minha conta', icon: 'person-outline' },
];

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'denuncia_conduta',
    topic: 'denuncia',
    label: 'Denunciar entregador',
    keywords: [
      'denuncia',
      'denúncia',
      'racismo',
      'bullying',
      'assedio',
      'assédio',
      'violencia',
      'violência',
      'crime',
      'prova',
      'provas',
    ],
    answer:
      'Para denunciar delito (racismo, bullying, assédio, violência etc.):\n\n1. Abra o pedido entregue → “Denunciar conduta do entregador”.\n2. Escolha o tipo, descreva o fato e anexe fotos/provas.\n3. O relato vai direto ao suporte (suporte@pecaja.com.br) com protocolo.\n\nEm crime, registre também Boletim de Ocorrência na polícia — o app encaminha à equipe Peça Já, mas não substitui a autoridade.',
  },
  {
    id: 'track',
    topic: 'pedido',
    label: 'Acompanhar pedido',
    keywords: [
      'acompanhar',
      'status',
      'onde esta',
      'onde está',
      'rastrear',
      'pedido',
      'demorando',
    ],
    answer:
      'Para acompanhar, abra a aba Pedidos. Lá você vê o status em tempo real (recebido → preparo → saiu para entrega → entregue).\n\nSe o pedido estiver parado há muito tempo, envie um e-mail para o suporte com o número do pedido.',
  },
  {
    id: 'pix',
    topic: 'pagamento',
    label: 'Como pagar com Pix',
    keywords: ['pix', 'qr', 'qr code', 'pagar', 'pagamento', 'cobrança', 'cobranca'],
    answer:
      'No checkout, escolha Pix (QR / copia e cola) ou Cartão cadastrado no app. Não há pagamento em dinheiro.\n\nCartões ficam em Perfil → Meus cartões. O CVV não é salvo.',
  },
  {
    id: 'split',
    topic: 'pagamento',
    label: 'Taxa Peça Já',
    keywords: ['taxa', 'taxa peça', '1,99', '1.99', '2 reais', 'split', 'comissao', 'comissão'],
    answer:
      'A taxa Peça Já é R$ 2,00 por item: sobe no preço que o cliente paga e NÃO sai do bolso do comércio. Ex.: pizza R$ 38 da loja → cliente paga R$ 40; a loja recebe R$ 38 no caixa.',
  },
  {
    id: 'frete',
    topic: 'entrega',
    label: 'Taxa de entrega',
    keywords: ['frete', 'entrega', 'taxa de entrega', 'demora', 'tempo de entrega'],
    answer:
      'A taxa de entrega aparece no carrinho e no checkout: R$ 5,00 dentro da cidade (até ~7 km). Fora da cidade fica R$ 15,00 até 13 km; se for mais longe, o GPS calcula a partir disso.\n\nMembros do clube podem resgatar frete grátis (válido em pedidos a partir de R$ 25).',
  },
  {
    id: 'endereco',
    topic: 'entrega',
    label: 'Alterar endereço',
    keywords: ['endereço', 'endereco', 'trocar endereco', 'mudar endereco', 'local'],
    answer:
      'Você pode editar o endereço no checkout antes de confirmar, ou salvar um endereço padrão em Perfil → Endereços.\n\nDepois que o pedido sai para entrega, mudanças precisam de contato por e-mail com o suporte.',
  },
  {
    id: 'clube',
    topic: 'clube',
    label: 'Pontos e recompensas',
    keywords: [
      'ponto',
      'pontos',
      'clube',
      'fidelidade',
      'recompensa',
      'frete gratis',
      'frete grátis',
      'desconto',
    ],
    answer:
      'Pedidos entregues geram pontos no Clube Peça Já (veja no Perfil). Você pode resgatar frete grátis, desconto e outras vantagens.\n\nBenefícios ativos aparecem no carrinho e são usados no próximo pedido elegível.',
  },
  {
    id: 'cotw',
    topic: 'clube',
    label: 'Cliente da Semana',
    keywords: ['cliente da semana', 'coroa', 'podio', 'pódio', 'semana'],
    answer:
      'O Cliente da Semana é um destaque experimental da Comunidade. O benefício real do app continua sendo o clube de pontos no Perfil.',
  },
  {
    id: 'cancel',
    topic: 'cancelar',
    label: 'Cancelar pedido',
    keywords: ['cancelar', 'cancelamento', 'desistir', 'reembolso', 'estornar', 'estorno'],
    answer:
      'Pedidos ainda em “recebido” ou “confirmado” costumam poder ser cancelados na tela do pedido. Depois que a loja libera a retirada, o cancelamento depende da loja.\n\nPara reembolso, escreva para o suporte com o número do pedido.',
  },
  {
    id: 'conta',
    topic: 'conta',
    label: 'Foto, bio e capa',
    keywords: ['foto', 'perfil', 'bio', 'capa', 'senha', 'conta', 'login', 'sair'],
    answer:
      'Em Perfil você altera nome, telefone, endereço, bio, foto e capa. Para sair, use “Sair da conta” no final da tela.\n\nEsqueceu a senha? Na tela de login toque em “Esqueci a senha”, informe o e-mail da conta e defina uma nova.\n\nOutros problemas de login: escreva para o e-mail de suporte.',
  },
  {
    id: 'minimo',
    topic: 'pedido',
    label: 'Pedido mínimo',
    keywords: ['mínimo', 'minimo', 'pedido minimo', 'pedido mínimo', 'faltam'],
    answer:
      'No Peça Já não há pedido mínimo: você pode pedir só o que quiser. O valor do frete continua aparecendo no carrinho e no checkout.',
  },
];

const EMAIL_HINTS = [
  'humano',
  'atendente',
  'pessoa',
  'falar com',
  'suporte humano',
  'reclamação',
  'reclamacao',
  'advogado',
  'procon',
  'bug',
  'erro no app',
  'não funciona',
  'nao funciona',
  'cobraram errado',
  'cobraram a mais',
  'item faltando',
  'faltou',
  'estragado',
  'ruim',
  'comida fria',
  'acidente',
  'entregador',
  'motorista',
  'email',
  'e-mail',
];

export type BotReply = {
  text: string;
  matchedFaqId?: string;
  /** Se true, UI deve oferecer abrir e-mail. */
  suggestEmail: boolean;
  quickReplies?: string[];
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function scoreEntry(message: string, entry: FaqEntry): number {
  const n = normalize(message);
  let score = 0;
  for (const kw of entry.keywords) {
    const k = normalize(kw);
    if (!k) continue;
    if (n.includes(k)) score += k.length >= 6 ? 3 : 2;
  }
  return score;
}

export function wantsEmailSupport(message: string): boolean {
  const n = normalize(message);
  return EMAIL_HINTS.some((h) => n.includes(normalize(h)));
}

/** @deprecated use wantsEmailSupport */
export function wantsHuman(message: string): boolean {
  return wantsEmailSupport(message);
}

export function replyAsBot(message: string): BotReply {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      text: 'Pode digitar sua dúvida ou escolher um atalho abaixo.',
      suggestEmail: false,
      quickReplies: QUICK_TOPICS.map((t) => t.label),
    };
  }

  if (wantsEmailSupport(trimmed)) {
    return {
      text:
        'Para casos específicos (reembolso, item faltando, cobrança), o melhor canal é o e-mail do suporte. Toque em “Enviar e-mail” e descreva o problema com o número do pedido, se tiver.',
      suggestEmail: true,
      quickReplies: ['Enviar e-mail', 'Voltar aos atalhos'],
    };
  }

  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of FAQ_ENTRIES) {
    const s = scoreEntry(trimmed, entry);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }

  if (best && bestScore >= 2) {
    const related = FAQ_ENTRIES.filter((e) => e.topic === best!.topic && e.id !== best!.id)
      .slice(0, 2)
      .map((e) => e.label);

    return {
      text: best.answer,
      matchedFaqId: best.id,
      suggestEmail: best.topic === 'cancelar',
      quickReplies: [...related, 'Enviar e-mail', 'Outra dúvida'].slice(0, 4),
    };
  }

  return {
    text:
      'Não tenho certeza sobre isso. Posso ajudar com pedidos, Pix, entrega, clube de pontos e conta.\n\nSe for algo específico do seu pedido, envie um e-mail para o suporte.',
    suggestEmail: true,
    quickReplies: [
      'Enviar e-mail',
      'Acompanhar pedido',
      'Como pagar com Pix',
      'Pontos e recompensas',
    ],
  };
}

export function replyForTopic(topicId: SupportTopicId): BotReply {
  const first = FAQ_ENTRIES.find((e) => e.topic === topicId);
  if (!first) {
    return replyAsBot('ajuda');
  }
  const siblings = FAQ_ENTRIES.filter((e) => e.topic === topicId).map((e) => e.label);
  return {
    text: `${first.answer}\n\nQuer ver outro assunto desta área?`,
    matchedFaqId: first.id,
    suggestEmail: topicId === 'cancelar',
    quickReplies: [...siblings.slice(0, 3), 'Enviar e-mail'],
  };
}

export const BOT_GREETING =
  `Olá! Sou o assistente de dúvidas rápidas sobre pedido, pagamento e entrega.\n\n${SUPPORT_SLA_LINE}\n\nToque em Ticket para falar com a equipe. A resposta aparece em Seus chamados.`;

export const SUPPORT_EMAIL = 'suporte@pecaja.com.br';

/** Mantidos para não quebrar imports antigos. */
export const HUMAN_QUEUE_MESSAGE =
  `Para uma pessoa, abra um Ticket. Resposta em até ${SUPPORT_REPLY_HOURS}h em Seus chamados. Ou envie e-mail.`;

export const HUMAN_AUTO_REPLY =
  `Recebemos sua mensagem. Em chamados pelo app, a equipe responde em até ${SUPPORT_REPLY_HOURS}h em Seus chamados. Urgências: suporte@pecaja.com.br.`;