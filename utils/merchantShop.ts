/**
 * Loja operacional do comerciante (AsyncStorage).
 * businessId = partner_<applicationId> — entra no catálogo do cliente.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Business, MenuItem } from '@/types';
import { BusinessCategory, categoryConfig } from '@/constants/theme';
import { MerchantPlan } from '@/constants/plans';
import {
  isMerchantSubscriptionActive,
  listPartnerApplications,
  MerchantApplication,
} from '@/utils/partners';
import { setPartnerBusinessesCache } from '@/data/businesses';
import { WeeklyHours, formatWeeklyHoursSummary } from '@/utils/weeklyHours';
import { formatDistanceKm, haversineKm } from '@/utils/geo';
import { getActiveDemoLocation } from '@/utils/demoLocation';
import type { ShopPaymentMethod } from '@/utils/paymentMethods';
import type { ShopDeliveryMode } from '@/utils/shopDelivery';

const KEY = '@pecaja_merchant_shops_v1';

export type MerchantShop = {
  applicationId: string;
  businessId: string;
  name: string;
  description: string;
  category: BusinessCategory;
  address: string;
  image: string;
  coverImage: string;
  isOpen: boolean;
  hours: string;
  /** Grade por dia (opcional; hours continua sendo o resumo). */
  weeklyHours?: WeeklyHours;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  tags: string[];
  plan: MerchantPlan;
  menu: MenuItem[];
  createdAt: string;
  updatedAt: string;
  /** Coordenadas reais do comércio (obrigatório para aparecer como "próximo"). */
  latitude?: number;
  longitude?: number;
  /** Usuário da plataforma dono desta loja (preenchido no upsert cloud). */
  ownerUserId?: string;
  city?: string;
  state?: string;
  /** Raio de atendimento em km (padrão 8). */
  serviceRadiusKm?: number;
  /** Fim da mensalidade paga. Sem data vigente a loja fica fora do catálogo. */
  planPaidUntil?: string;
  /** Suspensa pelo HQ — some da descoberta do cliente. */
  suspended?: boolean;
  suspendedAt?: string;
  suspendedReason?: string;
  /** Pagamentos que o cliente pode usar nesta loja. */
  acceptedPayments?: ShopPaymentMethod[];
  /** store = entregador próprio. app = motoboy da Peça Já. */
  deliveryBy?: ShopDeliveryMode;
  /**
   * Marketplace MP: collector/user id do lojista.
   * Preencher após OAuth seller (split 1:1).
   */
  mpCollectorId?: string;
  /**
   * Access token OAuth do seller (servidor). Com MP_MARKETPLACE_SPLIT=1
   * a cobrança usa este token + application_fee da plataforma.
   */
  mpSellerAccessToken?: string;
};

const DEFAULT_LOGO =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&h=300&q=80';
const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&h=400&q=80';
function normalizeCategory(raw: string): BusinessCategory {
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (key in categoryConfig) return key as BusinessCategory;
  if (key.includes('rest')) return 'restaurante';
  if (key.includes('merc')) return 'mercado';
  if (key.includes('farm')) return 'farmacia';
  if (key.includes('distrib')) return 'distribuidora';
  if (key.includes('padar')) return 'padaria';
  if (key.includes('bebid')) return 'bebidas';
  if (key.includes('conven')) return 'conveniencia';
  return 'restaurante';
}

export function partnerBusinessId(applicationId: string): string {
  return `partner_${applicationId}`;
}

async function loadAll(): Promise<MerchantShop[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(list: MerchantShop[], syncShops?: MerchantShop[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  setPartnerBusinessesCache(
    filterActiveShopsForCatalog(await stampShopBilling(list)).map(shopToBusiness)
  );
  const toSync = syncShops?.length ? syncShops : [];
  if (toSync.length === 0) return;
  try {
    const { platformUpsertShop } = await import('@/services/platformClient');
    await Promise.all(toSync.map((shop) => platformUpsertShop(shop)));
  } catch {
    /* API offline */
  }
}

/** Sobe lojas locais para a plataforma (ownerUserId) após login cloud. */
export async function syncLocalShopsToPlatform(): Promise<number> {
  const list = await loadAll();
  if (list.length === 0) return 0;
  try {
    const { platformUpsertShop } = await import('@/services/platformClient');
    let ok = 0;
    for (const shop of list) {
      const res = await platformUpsertShop(shop);
      if (res?.ok) ok += 1;
    }
    return ok;
  } catch {
    return 0;
  }
}

export function shopToBusiness(shop: MerchantShop): Business {
  return {
    id: shop.businessId,
    name: shop.name,
    description: shop.description,
    category: shop.category,
    image: shop.image,
    coverImage: shop.coverImage,
    rating: 5,
    reviewCount: 0,
    deliveryTime: shop.deliveryTime,
    deliveryFee: shop.deliveryFee,
    minOrder: shop.minOrder,
    distance: shop.latitude != null && shop.longitude != null ? '—' : 'Na cidade',
    latitude: shop.latitude,
    longitude: shop.longitude,
    city: shop.city,
    state: shop.state,
    serviceRadiusKm: shop.serviceRadiusKm ?? 8,
    isOpen: shop.suspended ? false : shop.isOpen,
    hours: shop.hours,
    tags: shop.tags.length ? shop.tags : [categoryConfig[shop.category].label],
    // Pausados não aparecem para o cliente
    menu: shop.menu.filter((m) => m.available !== false),
    sellsDrinks: shop.category === 'restaurante' || shop.category === 'bebidas',
    plan: shop.plan,
    acceptedPayments: shop.acceptedPayments,
    deliveryBy: shop.deliveryBy,
  };
}

/** Mensalidade vigente: 30 dias a partir do pagamento. */
export function shopSubscriptionActive(shop: MerchantShop): boolean {
  if (!shop.planPaidUntil) return false;
  const until = new Date(shop.planPaidUntil).getTime();
  return !Number.isNaN(until) && until > Date.now();
}

/** Copia a vigência do cadastro para a loja antes de mostrar ao cliente. */
export async function stampShopBilling(shops: MerchantShop[]): Promise<MerchantShop[]> {
  try {
    const apps = await listPartnerApplications();
    const byApp = new Map(
      apps.filter((a) => a.role === 'merchant').map((a) => [a.id, a as MerchantApplication])
    );
    return shops.map((shop) => {
      const app = byApp.get(shop.applicationId);
      if (!app) return shop;
      return {
        ...shop,
        plan: app.plan || shop.plan,
        planPaidUntil: app.planPaidUntil,
        isOpen: isMerchantSubscriptionActive(app) ? shop.isOpen : false,
      };
    });
  } catch {
    return shops;
  }
}

/** Loja suspensa ou com a mensalidade vencida fica fora do catálogo. */
export function filterActiveShopsForCatalog(shops: MerchantShop[]): MerchantShop[] {
  return shops.filter((s) => !s.suspended && shopSubscriptionActive(s));
}

/**
 * Aplica distância/raio a partir do GPS do cliente.
 * Sem coordenadas do comércio → fora do filtro de proximidade (não inventa).
 */
export function applyProximityToBusinesses(
  list: Business[],
  userLat?: number | null,
  userLng?: number | null
): Business[] {
  if (
    typeof userLat !== 'number' ||
    typeof userLng !== 'number' ||
    !Number.isFinite(userLat) ||
    !Number.isFinite(userLng)
  ) {
    return list;
  }
  const user = { latitude: userLat, longitude: userLng };
  const demo = getActiveDemoLocation();

  return list
    .map((b) => {
      if (typeof b.latitude !== 'number' || typeof b.longitude !== 'number') {
        // Seeds de demo: mantém distância textual do pack
        if (demo) return b;
        return { ...b, distanceKm: undefined };
      }
      const km = haversineKm(user, {
        latitude: b.latitude,
        longitude: b.longitude,
      });
      return {
        ...b,
        distanceKm: km,
        distance: formatDistanceKm(km),
      };
    })
    .filter((b) => {
      if (demo) return true;
      if (typeof b.latitude !== 'number' || typeof b.longitude !== 'number') {
        // Sem geo real: não aparece como "próximo" em produção
        return false;
      }
      const radius = b.serviceRadiusKm ?? 8;
      return (b.distanceKm ?? 999) <= radius;
    })
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

/** Atualiza cache em memória (home do cliente). */
export async function hydratePartnerShops(): Promise<MerchantShop[]> {
  let list = await loadAll();
  try {
    const { platformListShops, asPlatformShops } = await import('@/services/platformClient');
    const remote = await platformListShops();
    if (remote?.ok) {
      const remoteShops = asPlatformShops(remote);
      if (remoteShops.length) {
        const byId = new Map(list.map((s) => [s.businessId, s]));
        for (const shop of remoteShops) {
          const prev = byId.get(shop.businessId);
          if (!prev || +new Date(shop.updatedAt) >= +new Date(prev.updatedAt)) {
            byId.set(shop.businessId, shop);
          }
        }
        list = Array.from(byId.values());
        await AsyncStorage.setItem(KEY, JSON.stringify(list));
      }
    }
  } catch {
    /* offline */
  }
  setPartnerBusinessesCache(
    filterActiveShopsForCatalog(await stampShopBilling(list)).map(shopToBusiness)
  );
  return list;
}

export async function getAllMerchantShops(): Promise<MerchantShop[]> {
  return loadAll();
}

export async function getShopByApplicationId(
  applicationId: string
): Promise<MerchantShop | null> {
  const list = await loadAll();
  return list.find((s) => s.applicationId === applicationId) ?? null;
}

export async function getShopByBusinessId(businessId: string): Promise<MerchantShop | null> {
  const list = await loadAll();
  return list.find((s) => s.businessId === businessId) ?? null;
}

function starterMenu(_shopName: string): MenuItem[] {
  return [];
}

/** Garante loja operacional quando o painel é liberado. */
export async function ensureShopFromApplication(
  app: MerchantApplication
): Promise<MerchantShop> {
  const list = await loadAll();
  const existing = list.find((s) => s.applicationId === app.id);
  if (existing) {
    const synced: MerchantShop = {
      ...existing,
      name: app.businessName || existing.name,
      category: normalizeCategory(app.category || existing.category),
      address: app.address || existing.address,
      plan: app.plan || existing.plan,
      planPaidUntil: app.planPaidUntil,
      isOpen: isMerchantSubscriptionActive(app) ? existing.isOpen : false,
      weeklyHours: existing.weeklyHours ?? app.weeklyHours,
      hours: existing.weeklyHours
        ? existing.hours
        : app.weeklyHours
          ? formatWeeklyHoursSummary(app.weeklyHours)
          : existing.hours,
      acceptedPayments: existing.acceptedPayments ?? app.acceptedPayments,
      deliveryBy: existing.deliveryBy ?? app.deliveryBy,
      city: existing.city || app.city,
      updatedAt: new Date().toISOString(),
    };
    const next = list.map((s) => (s.applicationId === app.id ? synced : s));
    await saveAll(next, [synced]);
    return synced;
  }

  const now = new Date().toISOString();
  let latitude: number | undefined;
  let longitude: number | undefined;
  let city: string | undefined;
  try {
    const { getUserPlaceDetails } = await import('@/services/permissions');
    const place = await getUserPlaceDetails();
    if (place) {
      latitude = place.latitude;
      longitude = place.longitude;
      city = place.city;
    }
  } catch {
    /* sem GPS */
  }

  const shop: MerchantShop = {
    applicationId: app.id,
    businessId: partnerBusinessId(app.id),
    name: app.businessName,
    description: `${app.businessName} no Peça Já — peça e receba na sua cidade.`,
    category: normalizeCategory(app.category || 'restaurante'),
    address: app.address || '',
    image: DEFAULT_LOGO,
    coverImage: DEFAULT_COVER,
      isOpen: isMerchantSubscriptionActive(app),
      planPaidUntil: app.planPaidUntil,
    hours: app.weeklyHours ? formatWeeklyHoursSummary(app.weeklyHours) : '08:00–22:00',
    weeklyHours: app.weeklyHours,
    deliveryTime: '30-50 min',
    deliveryFee: 5,
    minOrder: 0,
    tags: [],
    plan: app.plan || 'essencial',
    menu: starterMenu(app.businessName),
    createdAt: now,
    updatedAt: now,
    latitude,
    longitude,
    city: app.city || city,
    serviceRadiusKm: 8,
    acceptedPayments: app.acceptedPayments,
    deliveryBy: app.deliveryBy,
  };

  await saveAll([shop, ...list], [shop]);
  return shop;
}

export async function patchShop(
  applicationId: string,
  patch: Partial<
    Pick<
      MerchantShop,
      | 'name'
      | 'description'
      | 'category'
      | 'address'
      | 'image'
      | 'coverImage'
      | 'isOpen'
      | 'hours'
      | 'weeklyHours'
      | 'deliveryTime'
      | 'deliveryFee'
      | 'minOrder'
      | 'tags'
      | 'plan'
      | 'planPaidUntil'
      | 'menu'
      | 'latitude'
      | 'longitude'
      | 'city'
      | 'state'
      | 'serviceRadiusKm'
      | 'acceptedPayments'
      | 'deliveryBy'
    >
  >
): Promise<MerchantShop | null> {
  const list = await loadAll();
  const idx = list.findIndex((s) => s.applicationId === applicationId);
  if (idx < 0) return null;
  const updated: MerchantShop = {
    ...list[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  // `undefined`/`null` em lat/lng remove o pin (JSON não persiste undefined sozinho).
  if ('latitude' in patch && (patch.latitude == null || !Number.isFinite(patch.latitude))) {
    delete updated.latitude;
  }
  if ('longitude' in patch && (patch.longitude == null || !Number.isFinite(patch.longitude))) {
    delete updated.longitude;
  }
  list[idx] = updated;
  await saveAll(list, [updated]);
  return updated;
}

export async function upsertMenuItem(
  applicationId: string,
  item: MenuItem
): Promise<MerchantShop | null> {
  const shop = await getShopByApplicationId(applicationId);
  if (!shop) return null;
  const exists = shop.menu.some((m) => m.id === item.id);
  const menu = exists
    ? shop.menu.map((m) => (m.id === item.id ? item : m))
    : [...shop.menu, item];
  return patchShop(applicationId, { menu });
}

export async function removeMenuItem(
  applicationId: string,
  itemId: string
): Promise<MerchantShop | null> {
  const shop = await getShopByApplicationId(applicationId);
  if (!shop) return null;
  return patchShop(applicationId, {
    menu: shop.menu.filter((m) => m.id !== itemId),
  });
}

export function newMenuItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
