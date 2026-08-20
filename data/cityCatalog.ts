/**
 * Packs de catálogo por cidade demo.
 * Regra: uma cidade ativa = só comércios daquela cidade (sem misturar Mucugê no Capão).
 */
import { MUCUGE_SHOPS, MucugeShop } from '@/data/mucugeMerchants';
import { VALE_DO_CAPAO_SHOPS } from '@/data/valeDoCapaoMerchants';
import {
  DemoLocationId,
  getActiveDemoLocation,
  getDemoLocationIdSync,
  isDemoCityAllowed,
} from '@/utils/demoLocation';
import { BusinessCategory } from '@/constants/theme';

/** Nomes exclusivos do Vale do Capão (nunca Mucugê). */
const CAPAO_NAMES: Partial<Record<BusinessCategory, string[]>> = {
  restaurante: [
    'Pousada e Restaurante Capão',
    'Pizza do Fogo',
    'Açaí da Cachoeira',
    'Cantina da Trilha',
    'Fogão de Lenha do Vale',
    'Mirante Sabor Capão',
    'Casa da Cachoeira',
    'Restaurante Portal do Vale',
    'Boteco Serra Geral',
    'Tempero da Chapada Capão',
    'Quintal do Capão',
    'Sabor da Trilha',
    'Pé de Serra Grill',
    'Cozinha do Fogo',
    'Vale Gourmet',
  ],
  mercado: [
    'Mercadinho do Vale',
    'Empório Portal do Capão',
    'Hortifruti da Cachoeira',
    'Mercado Serra do Espinhaço',
    'Mini Mercado Trilha',
    'Empório Chapadeiro Capão',
  ],
  farmacia: [
    'Farmácia Capão Vida',
    'Farma Trilha',
    'Drogaria Portal do Vale',
    'Farmácia Serra Geral',
  ],
  padaria: [
    'Padaria Trilha do Sol',
    'Pães do Vale',
    'Padaria Portal Capão',
    'Forno da Cachoeira',
  ],
  bebidas: [
    'Depósito Gelado Capão',
    'Adega do Vale',
    'Distribuidora Portal Capão',
    'Geladas da Trilha',
  ],
  conveniencia: [
    'Conveniência Portal do Capão',
    'Tudo Aqui Capão',
    'Express Vale',
    'Shop da Trilha',
  ],
  distribuidora: [
    'Distribuidora Capão Atacado',
    'Atacado do Vale',
    'Depósito Serra Geral',
  ],
};

function stripOldCity(text: string, city: string): string {
  return (text || '')
    .replace(/Mucugê/gi, city)
    .replace(/Mucuge/gi, city)
    .replace(/Vale do Capão/gi, city);
}

function pickCityName(
  category: BusinessCategory,
  indexInCategory: number,
  cityId: DemoLocationId,
  used: Set<string>
): string {
  const bank =
    (cityId === 'vale-do-capao' ? CAPAO_NAMES[category] : null) ||
    CAPAO_NAMES.restaurante ||
    [];
  let base =
    bank[indexInCategory % Math.max(bank.length, 1)] ||
    `Comércio ${cityId} ${indexInCategory + 1}`;
  if (indexInCategory >= bank.length) {
    base = `${base} ${Math.floor(indexInCategory / bank.length) + 1}`;
  }
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base} ${n}`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

/**
 * Catálogo exclusivo Capão: lojas curadas + menus da Chapada
 * rebatizados com nomes do vale (zero "Mucugê" na vitrine).
 */
function buildCapaoExclusiveCatalog(): MucugeShop[] {
  const city = 'Vale do Capão';
  const used = new Set<string>();
  const curated = VALE_DO_CAPAO_SHOPS.map((shop, index) => {
    used.add(shop.name.toLowerCase());
    return {
      ...shop,
      description: stripOldCity(shop.description, city),
      tags: Array.from(new Set([...(shop.tags || []), 'Capão', 'Chapada'])),
      distanceKm: shop.distanceKm ?? 0.3 + (index % 20) * 0.12,
    };
  });

  const countByCat: Partial<Record<BusinessCategory, number>> = {};
  const extras = MUCUGE_SHOPS.map((shop, index) => {
    const cat = shop.category as BusinessCategory;
    const n = countByCat[cat] ?? 0;
    countByCat[cat] = n + 1;
    const name = pickCityName(cat, n + (CAPAO_NAMES[cat]?.length || 0), 'vale-do-capao', used);
    return {
      ...shop,
      name,
      description: stripOldCity(shop.description || `Delivery em ${city}`, city),
      tags: Array.from(
        new Set(
          [...(shop.tags || []).map((t) => stripOldCity(t, 'Capão')), 'Capão', 'Chapada'].filter(
            Boolean
          )
        )
      ),
      distanceKm: 0.25 + (index % 28) * 0.11,
    };
  });

  return [...curated, ...extras];
}

/** Pack da cidade demo (só __DEV__). Produção: lista vazia — só parceiros reais. */
export function getShopsForActiveCity(): MucugeShop[] {
  if (!isDemoCityAllowed()) return [];
  const id = getDemoLocationIdSync();
  if (id === 'vale-do-capao') return buildCapaoExclusiveCatalog();
  if (id === 'mucuge') return MUCUGE_SHOPS;
  return [];
}

export function getActiveCatalogCityName(): string {
  return getActiveDemoLocation()?.city ?? 'sua cidade';
}

export function listDemoCityIds(): DemoLocationId[] {
  return ['vale-do-capao', 'mucuge'];
}
