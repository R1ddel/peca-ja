import { BusinessCategory } from '@/constants/theme';

/**
 * Seção do cardápio a partir do que o produto é, não do texto solto que a loja digitou.
 * "Carne moída" de um mercado entra em Açougue mesmo se a categoria salva for "Carne" ou "Destaques".
 */

const GENERIC = new Set(['destaques', 'destaque', 'geral', 'outros', 'todos', '']);

const SECTIONS: Record<BusinessCategory, string[]> = {
  mercado: [
    'Açougue',
    'Hortifruti',
    'Mercearia',
    'Laticínios',
    'Frios',
    'Padaria',
    'Bebidas',
    'Biscoitos',
    'Doces',
    'Limpeza',
    'Higiene',
    'Congelados',
  ],
  farmacia: [
    'Medicamentos',
    'Vitaminas',
    'Dermocosméticos',
    'Higiene',
    'Primeiros socorros',
    'Equipamentos',
    'Cuidados',
    'Testes',
    'Kits',
  ],
  restaurante: [
    'Combos',
    'Entradas',
    'Pratos',
    'Massas',
    'Pizzas',
    'Burgers',
    'Acompanhamentos',
    'Saladas',
    'Sopas',
    'Sobremesas',
    'Bebidas',
  ],
  padaria: ['Pães', 'Salgados', 'Doces', 'Lanches', 'Bebidas', 'Kits'],
  bebidas: [
    'Cervejas',
    'Vinhos',
    'Destilados',
    'Drinks',
    'Refrigerantes',
    'Sucos',
    'Águas',
    'Energéticos',
    'Cafés',
    'Chás',
    'Isotônicos',
    'Funcionais',
    'Smoothies',
    'Alternativos',
    'Kits',
  ],
  distribuidora: [
    'Cervejas',
    'Refrigerantes',
    'Águas',
    'Energéticos',
    'Sucos',
    'Vinhos',
    'Destilados',
    'Isotônicos',
    'Chás',
    'Cafés',
    'Mixers',
    'Extras',
    'Kits',
  ],
  conveniencia: [
    'Lanches',
    'Snacks',
    'Doces',
    'Bebidas',
    'Mercearia',
    'Laticínios',
    'Frios',
    'Higiene',
    'Limpeza',
    'Casa',
    'Utilidades',
    'Congelados',
    'Kits',
  ],
};

type Rule = { section: string; words: string[] };

const RULES: Record<BusinessCategory, Rule[]> = {
  mercado: [
    {
      section: 'Bebidas',
      words: [
        'refrigerante', 'cerveja', 'suco', 'energetico', 'agua mineral', 'agua com gas',
        'agua de coco', 'isotonico', 'cha gelado', 'refri',
      ],
    },
    {
      section: 'Limpeza',
      words: [
        'agua sanitaria', 'detergente', 'sabao', 'desinfetante', 'esponja', 'amaciante',
        'alvejante', 'multiuso', 'limpa',
      ],
    },
    {
      section: 'Açougue',
      words: [
        'carne', 'picanha', 'alcatra', 'patinho', 'acem', 'maminha', 'cupim', 'costela',
        'file', 'contrafile', 'linguica', 'salsicha', 'bacon', 'frango', 'coxa',
        'sobrecoxa', 'tulipa', 'bovino', 'suino', 'porco', 'cordeiro', 'peixe', 'tilapia',
        'salmao', 'camarao', 'figado', 'moida', 'acougue',
      ],
    },
    {
      section: 'Hortifruti',
      words: [
        'banana', 'maca', 'tomate', 'alface', 'cebola', 'batata', 'cenoura', 'limao',
        'laranja', 'abacaxi', 'mamao', 'manga', 'uva', 'melancia', 'morango', 'couve',
        'brocolis', 'pimentao', 'alho', 'fruta', 'verdura', 'legume', 'hortalica', 'ovo',
      ],
    },
    {
      section: 'Frios',
      words: ['presunto', 'mortadela', 'salame', 'peito de peru', 'apresuntado', 'frios'],
    },
    {
      section: 'Laticínios',
      words: ['leite condensado', 'leite em po', 'leite', 'queijo', 'iogurte', 'manteiga', 'requeijao', 'cream cheese'],
    },
    {
      section: 'Padaria',
      words: ['pao', 'bisnaga', 'torrada'],
    },
    {
      section: 'Higiene',
      words: ['papel higienico', 'sabonete', 'shampoo', 'condicionador', 'pasta de dente', 'creme dental', 'escova de dente', 'desodorante'],
    },
    {
      section: 'Biscoitos',
      words: ['biscoito', 'bolacha', 'cookie'],
    },
    {
      section: 'Doces',
      words: ['chocolate', 'bala', 'bombom', 'doce'],
    },
    {
      section: 'Congelados',
      words: ['sorvete', 'picole', 'lasanha congelada', 'nugget', 'congelado'],
    },
    {
      section: 'Mercearia',
      words: [
        'arroz', 'feijao', 'acucar', 'cafe', 'macarrao', 'oleo', 'farinha', 'sal ',
        'molho de tomate', 'extrato de tomate', 'milho', 'ervilha', 'atum', 'sardinha',
      ],
    },
  ],
  farmacia: [
    { section: 'Testes', words: ['teste de gravidez', 'teste de covid', 'teste'] },
    { section: 'Kits', words: ['kit primeiros', 'kit'] },
    { section: 'Equipamentos', words: ['termometro', 'inalador', 'nebulizador', 'aparelho de pressao', 'medidor'] },
    { section: 'Primeiros socorros', words: ['curativo', 'gaze', 'soro fisiologico', 'atadura', 'esparadrapo'] },
    { section: 'Vitaminas', words: ['vitamina', 'omega', 'complexo b', 'suplemento'] },
    { section: 'Dermocosméticos', words: ['protetor solar', 'hidratante', 'serum', 'protetor labial', 'dermocosmetico'] },
    { section: 'Cuidados', words: ['fralda', 'lenco umedecido', 'repelente'] },
    { section: 'Higiene', words: ['alcool gel', 'mascara', 'algodao', 'sabonete', 'creme dental', 'escova'] },
    {
      section: 'Medicamentos',
      words: ['dipirona', 'paracetamol', 'ibuprofeno', 'omeprazol', 'loratadina', 'colirio', 'xarope', 'pastilha', 'remedio', 'comprimido', 'mg'],
    },
  ],
  restaurante: [
    { section: 'Combos', words: ['combo', 'kit'] },
    { section: 'Bebidas', words: ['suco', 'refrigerante', 'cerveja', 'agua', 'milkshake', 'cafe', 'cha', 'drink', 'refri'] },
    { section: 'Sobremesas', words: ['acai', 'pudim', 'brownie', 'mousse', 'sorvete', 'sobremesa', 'petit'] },
    { section: 'Pizzas', words: ['pizza'] },
    { section: 'Burgers', words: ['burger', 'hamburguer', 'hamburger', 'smash', 'x-bacon', 'x-tudo', 'x-salada'] },
    { section: 'Massas', words: ['espaguete', 'nhoque', 'lasanha', 'macarrao', 'yakissoba', 'risoto', 'massa'] },
    { section: 'Saladas', words: ['salada'] },
    { section: 'Sopas', words: ['sopa', 'caldo'] },
    { section: 'Entradas', words: ['pastel', 'coxinha', 'bruschetta', 'entrada', 'porcao de'] },
    { section: 'Acompanhamentos', words: ['batata frita', 'onion', 'acompanhamento'] },
    { section: 'Pratos', words: ['pf', 'feijoada', 'bife', 'parmegiana', 'strogonoff', 'file', 'frango', 'carne', 'prato'] },
  ],
  padaria: [
    { section: 'Kits', words: ['kit'] },
    { section: 'Bebidas', words: ['cafe', 'cappuccino', 'chocolate quente', 'suco'] },
    { section: 'Lanches', words: ['sanduiche', 'misto', 'torrada', 'lanche'] },
    { section: 'Salgados', words: ['pao de queijo', 'croissant', 'coxinha', 'empada', 'esfiha', 'quiche', 'torta salgada', 'salgado'] },
    { section: 'Doces', words: ['bolo', 'sonho', 'brigadeiro', 'torta', 'cookie', 'churros', 'rosca', 'cuque', 'doce'] },
    { section: 'Pães', words: ['pao', 'baguete', 'focaccia', 'broa', 'sirio'] },
  ],
  bebidas: [
    { section: 'Kits', words: ['kit'] },
    { section: 'Cervejas', words: ['cerveja', 'chop'] },
    { section: 'Vinhos', words: ['vinho', 'espumante'] },
    { section: 'Destilados', words: ['whisky', 'vodka', 'gin', 'licor'] },
    { section: 'Drinks', words: ['drink', 'mojito', 'tonica'] },
    { section: 'Refrigerantes', words: ['refrigerante', 'refri'] },
    { section: 'Sucos', words: ['suco'] },
    { section: 'Energéticos', words: ['energetico'] },
    { section: 'Cafés', words: ['cafe', 'latte', 'cold brew'] },
    { section: 'Chás', words: ['cha'] },
    { section: 'Smoothies', words: ['smoothie'] },
    { section: 'Isotônicos', words: ['isotonico'] },
    { section: 'Funcionais', words: ['kombucha', 'kefir', 'shot'] },
    { section: 'Alternativos', words: ['leite vegetal'] },
    { section: 'Águas', words: ['agua'] },
  ],
  distribuidora: [
    { section: 'Kits', words: ['kit', 'caixa mista'] },
    { section: 'Cervejas', words: ['cerveja'] },
    { section: 'Refrigerantes', words: ['refrigerante'] },
    { section: 'Energéticos', words: ['energetico'] },
    { section: 'Sucos', words: ['suco'] },
    { section: 'Vinhos', words: ['vinho', 'espumante'] },
    { section: 'Destilados', words: ['whisky', 'vodka', 'gin', 'licor'] },
    { section: 'Isotônicos', words: ['isotonico'] },
    { section: 'Chás', words: ['cha'] },
    { section: 'Cafés', words: ['cafe'] },
    { section: 'Mixers', words: ['mixer', 'xarope', 'tonica'] },
    { section: 'Extras', words: ['gelo', 'copo', 'carvao'] },
    { section: 'Águas', words: ['agua'] },
  ],
  conveniencia: [
    { section: 'Kits', words: ['kit'] },
    { section: 'Bebidas', words: ['agua', 'refrigerante', 'energetico', 'cafe', 'suco', 'cerveja'] },
    { section: 'Lanches', words: ['sanduiche', 'wrap', 'lanche'] },
    { section: 'Snacks', words: ['salgadinho', 'snack', 'chips'] },
    { section: 'Doces', words: ['chocolate', 'bala', 'doce'] },
    { section: 'Laticínios', words: ['iogurte', 'yogurte', 'leite', 'queijo'] },
    { section: 'Frios', words: ['presunto', 'mortadela'] },
    { section: 'Higiene', words: ['sabonete', 'pasta de dente', 'escova'] },
    { section: 'Limpeza', words: ['desinfetante', 'esponja', 'detergente'] },
    { section: 'Casa', words: ['guardanapo', 'saco de lixo', 'papel toalha'] },
    { section: 'Utilidades', words: ['pilha', 'isqueiro', 'carregador', 'fone', 'garrafa', 'guarda-chuva'] },
    { section: 'Congelados', words: ['sorvete', 'picole'] },
    { section: 'Mercearia', words: ['macarrao', 'miojo'] },
  ],
};

export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function menuSectionsFor(shopCategory?: string | null): string[] {
  if (shopCategory && shopCategory in SECTIONS) {
    return SECTIONS[shopCategory as BusinessCategory];
  }
  return SECTIONS.mercado;
}

function hasWord(hay: string, word: string): boolean {
  const folded = foldText(word).trim();
  if (!folded) return false;
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(folded, from);
    if (at < 0) return false;
    const beforeOk = at === 0 || !/[a-z0-9]/.test(hay[at - 1]);
    const after = hay[at + folded.length];
    const afterOk = after == null || !/[a-z0-9]/.test(after) || folded.endsWith(' ');
    if (beforeOk && afterOk) return true;
    from = at + 1;
  }
  return false;
}

export function classifyMenuSection(
  shopCategory: string | null | undefined,
  item: { name?: string; description?: string; details?: string; category?: string }
): string {
  const sections = menuSectionsFor(shopCategory);
  const typed = (item.category || '').trim();
  const foldedTyped = foldText(typed);
  const already = sections.find((section) => foldText(section) === foldedTyped);
  if (already) return already;

  const shop = (shopCategory && shopCategory in RULES ? shopCategory : 'mercado') as BusinessCategory;
  const hay = foldText(
    `${item.name || ''} ${item.description || ''} ${item.details || ''} ${
      GENERIC.has(foldedTyped) ? '' : typed
    }`
  );

  let best: { section: string; len: number } | null = null;
  for (const rule of RULES[shop]) {
    if (!sections.includes(rule.section)) continue;
    for (const word of rule.words) {
      if (!hasWord(hay, word)) continue;
      const len = foldText(word).trim().length;
      if (!best || len > best.len) best = { section: rule.section, len };
    }
  }
  if (best) return best.section;
  if (typed && !GENERIC.has(foldedTyped)) return typed;
  return 'Outros';
}
