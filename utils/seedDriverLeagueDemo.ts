/**
 * Contas demo + entregas da semana para popular a Liga dos motoboys.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, CartItem, MenuItem } from '@/types';
import { generateOrderVerificationCodes } from '@/utils/orderCodes';
import { makeLineId } from '@/utils/cartLine';
import { DRIVER_TERMS_VERSION } from '@/constants/driverTerms';
import type { DriverApplication, PartnerApplication } from '@/utils/partners';
import { driverFleetId } from '@/utils/driverOps';
import {
  resolveBusinessCoords,
  resolveDeliveryCoords,
} from '@/utils/orderGeo';
import { getWeekBounds } from '@/utils/driverLeague';
import { getSimulatedCityLabel } from '@/utils/demoLocation';

const APPS_KEY = '@pecaja_partner_applications';
export const LEAGUE_ORDER_PREFIX = 'PJLEAGUE';

export type LeagueDemoAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  password: string;
  /** Quantas entregas na semana (para o ranking). */
  weekDeliveries: number;
  /** Frete médio por entrega. */
  avgFee: number;
  /** Quantas dessas são “rápidas” (≤55 min). */
  fastCount: number;
};

/** Contas rivais fixas — login possível no painel. */
export const LEAGUE_DEMO_ACCOUNTS: LeagueDemoAccount[] = [
  {
    id: 'driver_league_rafa',
    name: 'Rafael Souza',
    email: 'rafa.liga@pecaja.demo',
    phone: '(75) 98888-1001',
    vehicle: 'moto',
    password: 'liga123',
    weekDeliveries: 9,
    avgFee: 8.5,
    fastCount: 6,
  },
  {
    id: 'driver_league_bia',
    name: 'Beatriz Lima',
    email: 'bia.liga@pecaja.demo',
    phone: '(75) 98888-1002',
    vehicle: 'moto',
    password: 'liga123',
    weekDeliveries: 6,
    avgFee: 7,
    fastCount: 3,
  },
  {
    id: 'driver_league_kai',
    name: 'Kaique Santos',
    email: 'kai.liga@pecaja.demo',
    phone: '(75) 98888-1003',
    vehicle: 'bike',
    password: 'liga123',
    weekDeliveries: 4,
    avgFee: 6,
    fastCount: 1,
  },
  {
    id: 'driver_league_nanda',
    name: 'Fernanda Rocha',
    email: 'nanda.liga@pecaja.demo',
    phone: '(75) 98888-1004',
    vehicle: 'moto',
    password: 'liga123',
    weekDeliveries: 7,
    avgFee: 9,
    fastCount: 5,
  },
];

function menuItem(id: string, name: string, price: number): MenuItem {
  return {
    id,
    name,
    description: name,
    price,
    image: '',
    category: 'geral',
  };
}

function line(
  businessId: string,
  businessName: string,
  name: string,
  price: number
): CartItem {
  const id = `league_${name.replace(/\s/g, '_').toLowerCase()}`;
  return {
    lineId: makeLineId(id, []),
    item: menuItem(id, name, price),
    quantity: 1,
    businessId,
    businessName,
    selectedAddons: [],
  };
}

function buildDriverApp(acc: LeagueDemoAccount, nowIso: string): DriverApplication {
  return {
    id: acc.id,
    role: 'driver',
    status: 'approved',
    createdAt: nowIso,
    updatedAt: nowIso,
    name: acc.name,
    email: acc.email,
    phone: acc.phone,
    vehicle: acc.vehicle,
    document: '000.000.000-00',
    password: acc.password,
    city: getSimulatedCityLabel(),
    cnhNumber: '12345678900',
    cnhCategory: 'A',
    vehicleType: acc.vehicle === 'bike' ? 'Bicicleta' : 'Moto',
    plate: acc.vehicle === 'bike' ? undefined : 'ABC1D23',
    termsStatus: 'accepted',
    termsVersion: DRIVER_TERMS_VERSION,
    termsAcceptedAt: nowIso,
    termsSignatureMethod: 'aceite_eletronico',
    termsSignerName: acc.name,
    termsSignerDocument: '000.000.000-00',
  };
}

function leagueShops() {
  const city = getSimulatedCityLabel();
  return [
    { id: 'demo_fair_pizza', name: 'Pizzaria do Centro', item: 'Pizza Calabresa', price: 42, addr: `Rua das Flores, 120 — ${city}` },
    { id: 'demo_fair_burger', name: 'Burger Chapada', item: 'X-Tudo', price: 28, addr: `Av. Coronel Durval, 45 — ${city}` },
    { id: 'demo_fair_acai', name: 'Açaí da Praça', item: 'Açaí 500ml', price: 18, addr: `Praça Coronel Douca, 10 — ${city}` },
  ];
}

function buildWeekOrdersForAccount(acc: LeagueDemoAccount, weekStart: Date): Order[] {
  const fleetId = driverFleetId({ id: acc.id });
  const out: Order[] = [];
  const SHOPS = leagueShops();

  for (let i = 0; i < acc.weekDeliveries; i++) {
    const shop = SHOPS[i % SHOPS.length];
    const dayOffset = i % 5; // espalha na semana
    const hour = 11 + (i % 8);
    const deliveredAt = new Date(weekStart);
    deliveredAt.setDate(deliveredAt.getDate() + dayOffset);
    deliveredAt.setHours(hour, 15 + i, 0, 0);

    const isFast = i < acc.fastCount;
    const readyAt = new Date(deliveredAt);
    readyAt.setMinutes(readyAt.getMinutes() - (isFast ? 35 : 80));

    const createdAt = new Date(readyAt);
    createdAt.setMinutes(createdAt.getMinutes() - 25);

    const fee = acc.avgFee + (i % 3);
    const items = [line(shop.id, shop.name, shop.item, shop.price)];
    const subtotal = shop.price;
    const { pickupCode, deliveryCode } = generateOrderVerificationCodes();
    const delivery = resolveDeliveryCoords(shop.addr);
    const biz = resolveBusinessCoords(shop.id, shop.name);

    out.push({
      id: `${LEAGUE_ORDER_PREFIX}_${acc.id.slice(-4)}_${i}`,
      userId: 'demo_customer_league',
      businessId: shop.id,
      businessName: shop.name,
      businessImage: '',
      items,
      subtotal,
      deliveryFee: fee,
      total: subtotal + fee + 2,
      status: 'entregue',
      address: shop.addr,
      deliveryLatitude: delivery.latitude,
      deliveryLongitude: delivery.longitude,
      businessLatitude: biz.latitude,
      businessLongitude: biz.longitude,
      paymentMethod: 'pix',
      createdAt: createdAt.toISOString(),
      updatedAt: deliveredAt.toISOString(),
      estimatedDelivery: '25-40 min',
      platformFee: 2,
      establishmentAmount: subtotal,
      driverAmount: fee,
      paymentConfirmed: true,
      paymentProvider: 'mock',
      driverId: fleetId,
      driverName: acc.name,
      driverPhone: acc.phone,
      pickupCode,
      deliveryCode,
      kitchenReadyAt: readyAt.toISOString(),
      pickupVerifiedAt: new Date(+readyAt + 5 * 60_000).toISOString(),
      deliveryVerifiedAt: deliveredAt.toISOString(),
      preparedLineIds: items.map((it) => it.lineId),
      shopOrderNumber: 200 + i,
    });
  }

  return out;
}

/** Grava/atualiza as 4 contas rivais aprovadas. */
export async function upsertLeagueDemoDrivers(): Promise<LeagueDemoAccount[]> {
  const nowIso = new Date().toISOString();
  let list: PartnerApplication[] = [];
  try {
    const raw = await AsyncStorage.getItem(APPS_KEY);
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }

  const ids = new Set(LEAGUE_DEMO_ACCOUNTS.map((a) => a.id));
  const kept = list.filter((a) => !ids.has(a.id));
  const demos = LEAGUE_DEMO_ACCOUNTS.map((a) => buildDriverApp(a, nowIso));
  await AsyncStorage.setItem(APPS_KEY, JSON.stringify([...demos, ...kept]));
  return LEAGUE_DEMO_ACCOUNTS;
}

/** Pedidos entregues da semana (substitui lotes PJLEAGUE anteriores). */
export function buildLeagueDemoOrders(): Order[] {
  const { start } = getWeekBounds();
  return LEAGUE_DEMO_ACCOUNTS.flatMap((acc) =>
    buildWeekOrdersForAccount(acc, start)
  );
}

export type LeagueSeedResult = {
  accounts: LeagueDemoAccount[];
  orders: Order[];
};

export async function seedDriverLeagueDemo(): Promise<LeagueSeedResult> {
  const accounts = await upsertLeagueDemoDrivers();
  const orders = buildLeagueDemoOrders();
  return { accounts, orders };
}
