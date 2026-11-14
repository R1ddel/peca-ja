/**
 * Cardápio + promoções prontos para pizzaria do comerciante.
 * Itens com id estável — pode rodar de novo sem duplicar.
 */
import { MenuItem } from '@/types';
import { getAddonGroupsForCategory } from '@/data/addons';
import {
  getShopByApplicationId,
  patchShop,
  MerchantShop,
} from '@/utils/merchantShop';
import {
  deletePromo,
  listPromosByApplication,
  upsertPromo,
} from '@/utils/merchantPromos';

const IMG = {
  margherita:
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&h=400&q=80',
  calabresa:
    'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&h=400&q=80',
  quatro:
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&h=400&q=80',
  portuguesa:
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&h=400&q=80',
  frango:
    'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=600&h=400&q=80',
  pepperoni:
    'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&h=400&q=80',
  chocolate:
    'https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?auto=format&fit=crop&w=600&h=400&q=80',
  combo:
    'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?auto=format&fit=crop&w=600&h=400&q=80',
  refri:
    'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&h=400&q=80',
  suco:
    'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=600&h=400&q=80',
  cerveja:
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&h=400&q=80',
  batata:
    'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&h=400&q=80',
  brownie:
    'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&h=400&q=80',
  garlic:
    'https://images.unsplash.com/photo-1615478503562-ec2d8aa0e24e?auto=format&fit=crop&w=600&h=400&q=80',
};

function item(
  partial: Omit<MenuItem, 'images' | 'addonGroups' | 'available'> & {
    images?: string[];
  }
): MenuItem {
  const addons = getAddonGroupsForCategory(partial.category);
  return {
    ...partial,
    images: partial.images ?? [partial.image],
    addonGroups: addons,
    available: true,
  };
}

/** Catálogo completo de pizzaria (pizzas, combos, bebidas, extras). */
export function buildPizzaMerchantMenu(): MenuItem[] {
  return [
    // ——— PIZZAS ———
    item({
      id: 'seed_pizza_mussarela',
      name: 'Pizza Mussarela G',
      description: 'Molho de tomate, mussarela e orégano',
      details: 'Massa artesanal, forno a lenha. Serve 2–3 pessoas.',
      price: 49.9,
      promo: 44.9,
      image: IMG.margherita,
      category: 'Pizzas',
      popular: true,
    }),
    item({
      id: 'seed_pizza_calabresa',
      name: 'Pizza Calabresa G',
      description: 'Calabresa fatiada, cebola e mussarela',
      details: 'Clássico da casa. Peça borda recheada nos adicionais.',
      price: 54.9,
      promo: 49.9,
      image: IMG.calabresa,
      category: 'Pizzas',
      popular: true,
    }),
    item({
      id: 'seed_pizza_margherita',
      name: 'Pizza Margherita G',
      description: 'Mussarela, tomate fresco e manjericão',
      price: 52.9,
      image: IMG.margherita,
      category: 'Pizzas',
      popular: true,
    }),
    item({
      id: 'seed_pizza_portuguesa',
      name: 'Pizza Portuguesa G',
      description: 'Presunto, ovo, cebola, azeitona e ervilha',
      price: 58.9,
      promo: 54.9,
      image: IMG.portuguesa,
      category: 'Pizzas',
    }),
    item({
      id: 'seed_pizza_frango_catupiry',
      name: 'Pizza Frango c/ Catupiry G',
      description: 'Frango desfiado, catupiry e milho',
      price: 59.9,
      image: IMG.frango,
      category: 'Pizzas',
      popular: true,
    }),
    item({
      id: 'seed_pizza_quatro_queijos',
      name: 'Pizza Quatro Queijos G',
      description: 'Mussarela, provolone, parmesão e gorgonzola',
      price: 62.9,
      image: IMG.quatro,
      category: 'Pizzas',
    }),
    item({
      id: 'seed_pizza_pepperoni',
      name: 'Pizza Pepperoni G',
      description: 'Pepperoni importado e mussarela',
      price: 64.9,
      promo: 59.9,
      image: IMG.pepperoni,
      category: 'Pizzas',
    }),
    item({
      id: 'seed_pizza_bacon',
      name: 'Pizza Bacon c/ Cheddar G',
      description: 'Bacon crocante, cheddar e cebola',
      price: 61.9,
      image: IMG.calabresa,
      category: 'Pizzas',
    }),
    item({
      id: 'seed_pizza_vegetariana',
      name: 'Pizza Vegetariana G',
      description: 'Abobrinha, berinjela, pimentão, tomate e mussarela',
      price: 56.9,
      image: IMG.portuguesa,
      category: 'Pizzas',
    }),
    item({
      id: 'seed_pizza_chocolate',
      name: 'Pizza Doce Chocolate G',
      description: 'Chocolate ao leite e granulado',
      details: 'Ideal para sobremesa. Serve 2–3.',
      price: 48.9,
      promo: 42.9,
      image: IMG.chocolate,
      category: 'Pizzas',
    }),

    // ——— COMBOS ———
    item({
      id: 'seed_combo_familia',
      name: 'Combo Família',
      description: '2 pizzas G (Calabresa + Mussarela) + Refri 2L',
      details: 'Economia da casa. Troque os sabores no pedido (observação).',
      price: 129.9,
      promo: 109.9,
      image: IMG.combo,
      category: 'Combos',
      popular: true,
    }),
    item({
      id: 'seed_combo_casal',
      name: 'Combo Casal',
      description: '1 pizza G à escolha + 2 refrigerantes lata',
      price: 69.9,
      promo: 59.9,
      image: IMG.combo,
      category: 'Combos',
      popular: true,
    }),
    item({
      id: 'seed_combo_noite',
      name: 'Combo Noite de Pizza',
      description: '1 pizza G + batata frita + brownie',
      price: 84.9,
      promo: 74.9,
      image: IMG.combo,
      category: 'Combos',
    }),
    item({
      id: 'seed_combo_amigos',
      name: 'Combo Galera',
      description: '3 pizzas G + Refri 2L + porção de batata',
      price: 189.9,
      promo: 169.9,
      image: IMG.combo,
      category: 'Combos',
    }),

    // ——— ENTRADAS / ACOMPANHAMENTOS ———
    item({
      id: 'seed_entrada_garlic',
      name: 'Pão de Alho (6 un.)',
      description: 'Massa da casa com alho e mussarela',
      price: 18.9,
      promo: 15.9,
      image: IMG.garlic,
      category: 'Entradas',
    }),
    item({
      id: 'seed_entrada_batata',
      name: 'Batata Frita G',
      description: 'Porção generosa com sal e orégano',
      price: 22.9,
      image: IMG.batata,
      category: 'Acompanhamentos',
      popular: true,
    }),
    item({
      id: 'seed_entrada_anel',
      name: 'Anéis de Cebola',
      description: 'Crocantes, acompanha molho da casa',
      price: 19.9,
      image: IMG.batata,
      category: 'Acompanhamentos',
    }),

    // ——— BEBIDAS ———
    item({
      id: 'seed_bebida_refri_2l',
      name: 'Refrigerante 2L',
      description: 'Coca-Cola, Guaraná ou Fanta',
      price: 14.9,
      promo: 12.0,
      image: IMG.refri,
      category: 'Bebidas',
      popular: true,
    }),
    item({
      id: 'seed_bebida_lata',
      name: 'Refrigerante Lata 350ml',
      description: 'Gelado',
      price: 6.9,
      image: IMG.refri,
      category: 'Bebidas',
    }),
    item({
      id: 'seed_bebida_suco',
      name: 'Suco Natural 500ml',
      description: 'Laranja, limão ou abacaxi',
      price: 12.9,
      image: IMG.suco,
      category: 'Bebidas',
    }),
    item({
      id: 'seed_bebida_agua',
      name: 'Água Mineral 500ml',
      description: 'Com ou sem gás',
      price: 4.5,
      image: IMG.suco,
      category: 'Bebidas',
    }),
    item({
      id: 'seed_bebida_cerveja',
      name: 'Cerveja Long Neck',
      description: 'Gelada',
      price: 9.9,
      image: IMG.cerveja,
      category: 'Bebidas',
    }),

    // ——— SOBREMESAS ———
    item({
      id: 'seed_sobremesa_brownie',
      name: 'Brownie com Sorvete',
      description: 'Brownie quente e bola de creme',
      price: 18.9,
      promo: 15.9,
      image: IMG.brownie,
      category: 'Sobremesas',
      popular: true,
    }),
    item({
      id: 'seed_sobremesa_petit',
      name: 'Petit Gateau',
      description: 'Chocolate com sorvete de creme',
      price: 22.9,
      image: IMG.brownie,
      category: 'Sobremesas',
    }),
  ];
}

const PROMO_DEFS: Array<{
  key: string;
  title: string;
  type: 'percent' | 'fixed' | 'free_delivery';
  value: number;
  maxDiscount?: number;
  minSubtotal: number;
  code: string | null;
}> = [
  {
    key: 'frete',
    title: 'Frete grátis na pizzaria',
    type: 'free_delivery',
    value: 0,
    minSubtotal: 60,
    code: 'FRETEPIZZA',
  },
  {
    key: 'frete_auto',
    title: 'Frete grátis acima de R$ 80',
    type: 'free_delivery',
    value: 0,
    minSubtotal: 80,
    code: null,
  },
  {
    key: 'pizza10',
    title: '10% off no pedido',
    type: 'percent',
    value: 10,
    maxDiscount: 20,
    minSubtotal: 40,
    code: 'PIZZA10',
  },
  {
    key: 'bemvindo',
    title: 'R$ 12 de boas-vindas',
    type: 'fixed',
    value: 12,
    minSubtotal: 50,
    code: 'BEMVINDOPIZZA',
  },
  {
    key: 'combo15',
    title: '15% off em combos',
    type: 'percent',
    value: 15,
    maxDiscount: 30,
    minSubtotal: 55,
    code: 'COMBO15',
  },
  {
    key: 'noite',
    title: 'R$ 10 off à noite',
    type: 'fixed',
    value: 10,
    minSubtotal: 45,
    code: 'NOITE10',
  },
];

function mergeMenu(existing: MenuItem[], seeded: MenuItem[]): MenuItem[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const s of seeded) {
    byId.set(s.id, s);
  }
  // Remove placeholder genérico se ainda existir
  const merged = Array.from(byId.values()).filter(
    (m) =>
      !(
        m.name === 'Produto destaque' ||
        (m.description || '').includes('Primeiro item do cardápio')
      )
  );
  // Seed items first (stable order), then any custom extras
  const seedIds = new Set(seeded.map((s) => s.id));
  const seeds = seeded.map((s) => byId.get(s.id)!);
  const extras = merged.filter((m) => !seedIds.has(m.id));
  return [...seeds, ...extras];
}

export type SeedPizzaResult = {
  shop: MerchantShop;
  menuCount: number;
  promosCreated: number;
};

/**
 * Injeta cardápio de pizzaria + cupons/promos no bolso da loja.
 */
export async function seedPizzaMerchantCatalog(
  applicationId: string
): Promise<SeedPizzaResult | null> {
  const shop = await getShopByApplicationId(applicationId);
  if (!shop) return null;

  const seededMenu = buildPizzaMerchantMenu();
  const menu = mergeMenu(shop.menu || [], seededMenu);
  const updated = await patchShop(applicationId, {
    menu,
    description:
      shop.description?.includes('no Peça Já') || menu.length > 5
        ? `${shop.name} — pizzas artesanais, combos e promoções. Peça no app e receba quentinha.`
        : shop.description,
    tags: Array.from(
      new Set([...(shop.tags || []), 'Pizza', 'Combos', 'Delivery', 'Promoções'])
    ),
  });

  if (!updated) return null;

  const existingPromos = await listPromosByApplication(applicationId);
  const existingCodes = new Set(
    existingPromos.map((p) => (p.code || `auto:${p.title}`).toUpperCase())
  );

  let promosCreated = 0;
  for (const def of PROMO_DEFS) {
    const key = (def.code || `auto:${def.title}`).toUpperCase();
    if (existingCodes.has(key)) continue;
    if (
      !def.code &&
      existingPromos.some((p) => !p.code && p.title === def.title)
    ) {
      continue;
    }
    await upsertPromo({
      businessId: updated.businessId,
      applicationId,
      title: def.title,
      type: def.type,
      value: def.value,
      maxDiscount: def.maxDiscount,
      minSubtotal: def.minSubtotal,
      code: def.code,
      active: true,
    });
    promosCreated += 1;
  }

  const refreshed = (await getShopByApplicationId(applicationId)) ?? updated;
  return {
    shop: refreshed,
    menuCount: refreshed.menu.length,
    promosCreated,
  };
}

export function shopLooksLikePizzaria(shop: {
  name?: string;
  category?: string;
  tags?: string[];
}): boolean {
  const blob = `${shop.name || ''} ${(shop.tags || []).join(' ')}`.toLowerCase();
  return /pizza|pizzaria/.test(blob);
}

const SEEDED_PROMO_CODES = new Set([
  'FRETEPIZZA',
  'PIZZA10',
  'BEMVINDOPIZZA',
  'COMBO15',
  'NOITE10',
]);

const SEEDED_PROMO_TITLES = new Set(['Frete grátis acima de R$ 80', 'Frete grátis na pizzaria']);

export function isSeededMenuItem(item: MenuItem): boolean {
  return (
    item.id.startsWith('seed_') ||
    item.name === 'Produto destaque' ||
    (item.description || '').includes('Primeiro item do cardápio')
  );
}

/** Tira cardápio e cupons que o app colocou sozinho. O que a loja criou fica. */
export async function removeSeededMerchantContent(
  applicationId: string
): Promise<MerchantShop | null> {
  const shop = await getShopByApplicationId(applicationId);
  if (!shop) return null;

  const menu = (shop.menu || []).filter((item) => !isSeededMenuItem(item));
  let next = shop;
  if (menu.length !== (shop.menu || []).length) {
    const patched = await patchShop(applicationId, { menu });
    if (patched) next = patched;
  }

  const promos = await listPromosByApplication(applicationId);
  for (const promo of promos) {
    const code = (promo.code || '').toUpperCase();
    if (SEEDED_PROMO_CODES.has(code) || (!promo.code && SEEDED_PROMO_TITLES.has(promo.title))) {
      await deletePromo(promo.id);
    }
  }

  return (await getShopByApplicationId(applicationId)) ?? next;
}

/** True se ainda não tem o cardápio seed de pizzaria. */
export function needsPizzaSeed(shop: MerchantShop): boolean {
  const menu = shop.menu || [];
  return !menu.some(
    (m) => m.id.startsWith('seed_pizza_') || m.id.startsWith('seed_combo_')
  );
}
