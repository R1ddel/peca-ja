/**
 * Gera entidades da projeção Ano 2 para preencher todas as telas do HQ.
 * IDs com prefixo proj2y_ — idempotente (remove e recria).
 */
import type { Order } from '@/types';
import type {
  AuditLogEntry,
  FeatureFlag,
  LedgerEntry,
  PartnerApplicationRecord,
  PlatformCampaign,
  PlatformCity,
  PlatformCoupon,
  PlatformIncident,
  PlatformReview,
  PlatformState,
  PlatformUser,
  SupportTicket,
  SystemLogEntry,
} from '@/services/platformTypes';
import type { MerchantShop } from '@/utils/merchantShop';
import type { FleetDriverPresence, FleetState } from '@/services/fleetTypes';
import { hashPassword } from '@/services/platformCrypto';
import {
  HQ_PROJ_FLAG,
  HQ_PROJ_PREFIX,
  HQ_YEAR2,
  stripProjectionEntities,
  stripProjectionShops,
  stripProjectionUsers,
} from '@/services/hqProjection';

const CITIES_SEED: Array<{ name: string; state: string; lat: number; lng: number }> = [
  { name: 'São Paulo', state: 'SP', lat: -23.55, lng: -46.63 },
  { name: 'Rio de Janeiro', state: 'RJ', lat: -22.91, lng: -43.17 },
  { name: 'Belo Horizonte', state: 'MG', lat: -19.92, lng: -43.94 },
  { name: 'Salvador', state: 'BA', lat: -12.97, lng: -38.5 },
  { name: 'Brasília', state: 'DF', lat: -15.78, lng: -47.93 },
  { name: 'Fortaleza', state: 'CE', lat: -3.73, lng: -38.52 },
  { name: 'Curitiba', state: 'PR', lat: -25.43, lng: -49.27 },
  { name: 'Recife', state: 'PE', lat: -8.05, lng: -34.88 },
  { name: 'Porto Alegre', state: 'RS', lat: -30.03, lng: -51.23 },
  { name: 'Manaus', state: 'AM', lat: -3.12, lng: -60.02 },
  { name: 'Belém', state: 'PA', lat: -1.46, lng: -48.5 },
  { name: 'Goiânia', state: 'GO', lat: -16.68, lng: -49.25 },
  { name: 'Guarulhos', state: 'SP', lat: -23.45, lng: -46.53 },
  { name: 'Campinas', state: 'SP', lat: -22.91, lng: -47.06 },
  { name: 'São Luís', state: 'MA', lat: -2.53, lng: -44.3 },
  { name: 'Maceió', state: 'AL', lat: -9.67, lng: -35.74 },
  { name: 'Natal', state: 'RN', lat: -5.79, lng: -35.21 },
  { name: 'Teresina', state: 'PI', lat: -5.09, lng: -42.8 },
  { name: 'Campo Grande', state: 'MS', lat: -20.44, lng: -54.65 },
  { name: 'João Pessoa', state: 'PB', lat: -7.12, lng: -34.86 },
  { name: 'Florianópolis', state: 'SC', lat: -27.59, lng: -48.55 },
  { name: 'Vitória', state: 'ES', lat: -20.32, lng: -40.34 },
  { name: 'Cuiabá', state: 'MT', lat: -15.6, lng: -56.1 },
  { name: 'Aracaju', state: 'SE', lat: -10.91, lng: -37.07 },
  { name: 'Londrina', state: 'PR', lat: -23.3, lng: -51.16 },
  { name: 'Santos', state: 'SP', lat: -23.96, lng: -46.33 },
  { name: 'Ribeirão Preto', state: 'SP', lat: -21.18, lng: -47.81 },
  { name: 'Uberlândia', state: 'MG', lat: -18.92, lng: -48.28 },
  { name: 'Sorocaba', state: 'SP', lat: -23.5, lng: -47.46 },
  { name: 'Juiz de Fora', state: 'MG', lat: -21.76, lng: -43.35 },
  { name: 'Mucugê', state: 'BA', lat: -13.0, lng: -41.37 },
  { name: 'Lençóis', state: 'BA', lat: -12.56, lng: -41.39 },
  { name: 'Palmeiras', state: 'BA', lat: -12.53, lng: -41.58 },
  { name: 'Seabra', state: 'BA', lat: -12.42, lng: -41.77 },
  { name: 'Feira de Santana', state: 'BA', lat: -12.27, lng: -38.97 },
  { name: 'Ilhéus', state: 'BA', lat: -14.79, lng: -39.05 },
  { name: 'Porto Seguro', state: 'BA', lat: -16.44, lng: -39.06 },
  { name: 'Niterói', state: 'RJ', lat: -22.88, lng: -43.1 },
  { name: 'Osasco', state: 'SP', lat: -23.53, lng: -46.79 },
  { name: 'Santo André', state: 'SP', lat: -23.66, lng: -46.53 },
];

const SHOP_NAMES = [
  'Burger Prime',
  'Açaí do Vale',
  'Pizza Napoli',
  'Sushi House',
  'Mercado Bom Preço',
  'Farmácia Saúde+',
  'Distribuidora Gelada',
  'Padaria Central',
  'Churrasco Gaúcho',
  'Temakeria Sol',
  'Café & Cia',
  'Marmitaria Fit',
  'Doces da Vovó',
  'Hamburgueria 47',
  'Pastelaria Cruzeiro',
];

const CATEGORIES = ['restaurante', 'mercado', 'farmacia', 'distribuidora', 'conveniencia'] as const;

function pid(kind: string, n: number | string) {
  return `${HQ_PROJ_PREFIX}${kind}_${n}`;
}

function isoDaysAgo(days: number, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function money(seed: number, min: number, max: number) {
  const v = min + ((seed * 37) % Math.floor(max - min));
  return Math.round(v * 100) / 100;
}

export type HqProjectionSeedResult = {
  cities: number;
  shops: number;
  customers: number;
  orders: number;
  ledger: number;
  tickets: number;
  applications: number;
  reviews: number;
  drivers: number;
};

export function buildProjectionPayload(now = new Date()): {
  cities: PlatformCity[];
  shops: MerchantShop[];
  users: PlatformUser[];
  orders: Order[];
  ledger: LedgerEntry[];
  tickets: SupportTicket[];
  applications: PartnerApplicationRecord[];
  reviews: PlatformReview[];
  coupons: PlatformCoupon[];
  campaigns: PlatformCampaign[];
  featureFlags: FeatureFlag[];
  systemLogs: SystemLogEntry[];
  incidents: PlatformIncident[];
  auditLogs: AuditLogEntry[];
  drivers: Record<string, FleetDriverPresence>;
} {
  const nowIso = now.toISOString();
  const pwd = hashPassword('proj2y-demo-locked');

  const cities: PlatformCity[] = CITIES_SEED.map((c, i) => {
    const status: PlatformCity['status'] =
      i < 32 ? 'active' : i < 38 ? 'implanting' : i < 40 ? 'inactive' : 'active';
    return {
      id: pid('city', i),
      name: c.name,
      state: c.state,
      status,
      latitude: c.lat,
      longitude: c.lng,
      serviceRadiusKm: 12,
      createdAt: isoDaysAgo(400 - i),
      updatedAt: nowIso,
    };
  });

  // Expand to feel national in cities list (aliases / metros)
  for (let i = CITIES_SEED.length; i < 80; i++) {
    const base = CITIES_SEED[i % CITIES_SEED.length];
    cities.push({
      id: pid('city', i),
      name: `${base.name} · Zona ${String.fromCharCode(65 + (i % 8))}`,
      state: base.state,
      status: i % 11 === 0 ? 'implanting' : 'active',
      latitude: base.lat + (i % 7) * 0.02,
      longitude: base.lng + (i % 5) * 0.02,
      serviceRadiusKm: 10,
      createdAt: isoDaysAgo(200 - (i % 180)),
      updatedAt: nowIso,
    });
  }

  const shops: MerchantShop[] = [];
  for (let i = 0; i < 420; i++) {
    const city = cities[i % cities.length];
    const cat = pick(CATEGORIES, i);
    const name = `${pick(SHOP_NAMES, i)} ${city.name.split(' ')[0]}`;
    const bid = pid('shop', i);
    shops.push({
      applicationId: pid('appshop', i),
      businessId: bid,
      name,
      description: `Unidade Peça Já · ${city.name}`,
      category: cat as any,
      address: `Av. Central, ${100 + (i % 800)} — ${city.name}/${city.state}`,
      image:
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&h=300&q=80',
      coverImage:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&h=400&q=80',
      isOpen: i % 17 !== 0,
      hours: '10:00–23:00',
      deliveryTime: '25-40 min',
      deliveryFee: 4.9 + (i % 5),
      minOrder: 15,
      tags: ['projeção', city.name],
      plan: pick(['essencial', 'crescimento', 'destaque'] as const, i),
      menu: [
        {
          id: pid('item', `${i}_1`),
          name: 'Combo destaque',
          description: 'Mais pedido da casa',
          price: money(i, 28, 68),
          image:
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300&q=80',
          category: 'Destaques',
          available: true,
        },
        {
          id: pid('item', `${i}_2`),
          name: 'Prato do dia',
          description: 'Rotativo',
          price: money(i + 3, 22, 55),
          image:
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300&q=80',
          category: 'Pratos',
          available: true,
        },
        {
          id: pid('item', `${i}_3`),
          name: 'Bebida 350ml',
          description: 'Gelada',
          price: money(i + 7, 5, 12),
          image:
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300&q=80',
          category: 'Bebidas',
          available: i % 9 !== 0,
        },
      ],
      createdAt: isoDaysAgo(300 - (i % 280)),
      updatedAt: nowIso,
      latitude: (city.latitude || 0) + ((i % 20) - 10) * 0.01,
      longitude: (city.longitude || 0) + ((i % 16) - 8) * 0.01,
      city: city.name,
      state: city.state,
      serviceRadiusKm: 8,
      suspended: i % 43 === 0,
      suspendedAt: i % 43 === 0 ? isoDaysAgo(12) : undefined,
      suspendedReason: i % 43 === 0 ? 'Inadimplência — projeção' : undefined,
    });
  }

  const users: PlatformUser[] = [];
  for (let i = 0; i < 520; i++) {
    const city = cities[i % cities.length];
    users.push({
      id: pid('user', i),
      name: `Cliente ${i + 1}`,
      email: `cliente${i}@proj2y.pecaja.local`,
      phone: `7799${String(1000000 + i).slice(0, 7)}`,
      address: `Rua das Flores, ${i + 10} — ${city.name}`,
      createdAt: isoDaysAgo(Math.min(700, 10 + (i % 680))),
      passwordHash: pwd.hash,
      passwordSalt: pwd.salt,
      blocked: i % 97 === 0,
      blockedReason: i % 97 === 0 ? 'Fraude suspeita (projeção)' : undefined,
      blockedAt: i % 97 === 0 ? isoDaysAgo(20) : undefined,
      platformRole: 'customer' as any,
    } as PlatformUser);
  }

  const orders: Order[] = [];
  // Active / live ops (~180)
  const liveStatuses = ['pendente', 'confirmado', 'preparando', 'pronto', 'saiu_entrega'] as const;
  for (let i = 0; i < 180; i++) {
    const shop = shops[i % shops.length];
    const user = users[i % users.length];
    const status = liveStatuses[i % liveStatuses.length];
    const subtotal = money(i + 11, 35, 120);
    const deliveryFee = shop.deliveryFee;
    const platformFee = Math.round(subtotal * 0.12 * 100) / 100;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;
    const ageMin = 20 + (i % 140);
    const created = new Date(Date.now() - ageMin * 60_000).toISOString();
    const needsDriver = status === 'confirmado' || status === 'preparando';
    orders.push({
      id: pid('ord', `live_${i}`),
      userId: user.id,
      businessId: shop.businessId,
      businessName: shop.name,
      businessImage: shop.image,
      items: [
        {
          id: shop.menu[0].id,
          name: shop.menu[0].name,
          price: shop.menu[0].price,
          quantity: 1,
          image: shop.menu[0].image,
        } as any,
      ],
      subtotal,
      deliveryFee,
      total,
      status: status as any,
      address: user.address,
      deliveryLatitude: shop.latitude,
      deliveryLongitude: shop.longitude,
      businessLatitude: shop.latitude,
      businessLongitude: shop.longitude,
      paymentMethod: i % 3 === 0 ? 'pix' : 'card',
      createdAt: created,
      updatedAt: nowIso,
      estimatedDelivery: new Date(Date.now() + 25 * 60_000).toISOString(),
      platformFee,
      establishmentAmount: Math.round((subtotal - platformFee) * 100) / 100,
      driverAmount: deliveryFee,
      paymentConfirmed: status !== 'pendente' || i % 5 !== 0,
      paymentProvider: 'mock',
      customerName: user.name,
      customerPhone: user.phone,
      driverId: needsDriver && i % 4 !== 0 ? null : pid('drv', i % 350),
      driverName: needsDriver && i % 4 !== 0 ? null : `Motoboy ${i % 350}`,
      city: shop.city,
    } as Order & { city?: string });
  }

  // History dense last 30d + thinner back (~900)
  for (let i = 0; i < 900; i++) {
    const shop = shops[i % shops.length];
    const user = users[i % users.length];
    const day = i < 400 ? i % 14 : 14 + (i % 70);
    const status = i % 19 === 0 ? 'cancelado' : 'entregue';
    const subtotal = money(i + 99, 28, 145);
    const deliveryFee = shop.deliveryFee;
    const platformFee = Math.round(subtotal * 0.12 * 100) / 100;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;
    const createdAt = isoDaysAgo(day, 10 + (i % 12), i % 60);
    orders.push({
      id: pid('ord', `hist_${i}`),
      userId: user.id,
      businessId: shop.businessId,
      businessName: shop.name,
      businessImage: shop.image,
      items: [
        {
          id: shop.menu[0].id,
          name: shop.menu[0].name,
          price: shop.menu[0].price,
          quantity: 1 + (i % 3),
          image: shop.menu[0].image,
        } as any,
      ],
      subtotal,
      deliveryFee,
      total,
      status: status as any,
      address: user.address,
      paymentMethod: i % 2 === 0 ? 'pix' : 'card',
      createdAt,
      updatedAt: createdAt,
      estimatedDelivery: createdAt,
      platformFee,
      establishmentAmount: Math.round((subtotal - platformFee) * 100) / 100,
      driverAmount: deliveryFee,
      paymentConfirmed: status !== 'cancelado',
      paymentProvider: 'mock',
      customerName: user.name,
      customerPhone: user.phone,
      driverId: pid('drv', i % 350),
      driverName: `Motoboy ${i % 350}`,
      city: shop.city,
    } as Order & { city?: string });
  }

  const ledger: LedgerEntry[] = [];
  // Platform balance base via credits
  ledger.push({
    id: pid('led', 'plat_open'),
    ownerType: 'platform',
    ownerId: 'pecaja',
    kind: 'credit',
    amount: HQ_YEAR2.finance.platformBalance,
    note: 'Saldo consolidado · projeção Ano 2',
    createdAt: isoDaysAgo(60),
  });
  for (let i = 0; i < 220; i++) {
    const shop = shops[i % shops.length];
    const amt = money(i + 5, 80, 900);
    ledger.push({
      id: pid('led', `m_${i}`),
      ownerType: 'merchant',
      ownerId: shop.businessId,
      orderId: pid('ord', `hist_${i}`),
      kind: i % 11 === 0 ? 'withdraw' : 'credit',
      amount: amt,
      note: i % 11 === 0 ? 'Saque PIX loja' : 'Repasse pedido',
      createdAt: isoDaysAgo(i % 40, 14, i % 50),
    });
  }
  for (let i = 0; i < 80; i++) {
    ledger.push({
      id: pid('led', `d_${i}`),
      ownerType: 'driver',
      ownerId: pid('drv', i),
      kind: i % 7 === 0 ? 'withdraw' : 'credit',
      amount: money(i + 2, 12, 45),
      note: i % 7 === 0 ? 'Saque entregador' : 'Frete',
      createdAt: isoDaysAgo(i % 20),
    });
  }
  for (let i = 0; i < 30; i++) {
    ledger.push({
      id: pid('led', `ref_${i}`),
      ownerType: 'platform',
      ownerId: 'pecaja',
      kind: 'debit',
      amount: money(i + 8, 20, 180),
      note: 'Estorno / reembolso',
      createdAt: isoDaysAgo(i % 25),
    });
  }

  const tickets: SupportTicket[] = [];
  for (let i = 0; i < 90; i++) {
    const user = users[i % users.length];
    const status = pick(['open', 'in_progress', 'resolved', 'closed'] as const, i);
    tickets.push({
      id: pid('tkt', i),
      userId: user.id,
      email: user.email,
      subject: pick(
        ['Pedido atrasado', 'Item faltando', 'Cobrança duplicada', 'App travando', 'Entregador rude'],
        i
      ),
      body: 'Ticket gerado na projeção Ano 2 do Command Center.',
      status,
      priority: pick(['low', 'normal', 'high', 'critical'] as const, i),
      category: 'ops',
      orderId: pid('ord', `hist_${i}`),
      createdAt: isoDaysAgo(i % 18),
      updatedAt: nowIso,
      messages: [
        { at: isoDaysAgo(i % 18), from: 'user', text: 'Preciso de ajuda com meu pedido.' },
        {
          at: isoDaysAgo(Math.max(0, (i % 18) - 1)),
          from: 'support',
          text: 'Estamos verificando com a loja.',
        },
      ],
    });
  }

  const applications: PartnerApplicationRecord[] = [];
  for (let i = 0; i < 120; i++) {
    const city = cities[i % cities.length];
    const role = i % 2 === 0 ? 'merchant' : 'driver';
    const status = pick(
      ['pending', 'lead', 'contact', 'interested', 'meeting', 'proposal', 'approved', 'active'] as const,
      i
    );
    applications.push({
      id: pid('crm', i),
      role,
      status: status as any,
      pipelineStage: status,
      city: city.name,
      name: role === 'merchant' ? `Lead Loja ${i}` : `Candidato Motoboy ${i}`,
      email: `${role}${i}@proj2y.pecaja.local`,
      phone: `7198${String(2000000 + i).slice(0, 7)}`,
      businessName: role === 'merchant' ? `${pick(SHOP_NAMES, i)} ${city.name}` : undefined,
      notes: 'Pipeline CRM · projeção Ano 2',
      createdAt: isoDaysAgo(i % 60),
      updatedAt: nowIso,
      timeline: [{ at: isoDaysAgo(i % 60), text: 'Lead capturado (projeção)' }],
      tags: ['proj2y', city.state],
    });
  }

  const reviews: PlatformReview[] = [];
  for (let i = 0; i < 160; i++) {
    reviews.push({
      id: pid('rev', i),
      targetType: i % 3 === 0 ? 'driver' : 'business',
      targetId: i % 3 === 0 ? pid('drv', i % 350) : shops[i % shops.length].businessId,
      userId: users[i % users.length].id,
      rating: 3 + (i % 3),
      comment: pick(
        ['Rápido e quente!', 'Bom demais', 'Demorou um pouco', 'Perfeito', 'Voltarei a pedir'],
        i
      ),
      hidden: i % 41 === 0,
      createdAt: isoDaysAgo(i % 45),
    });
  }

  const coupons: PlatformCoupon[] = [];
  for (let i = 0; i < 24; i++) {
    coupons.push({
      id: pid('cpn', i),
      code: `PJ2Y${10 + i}`,
      type: i % 2 === 0 ? 'percent' : 'fixed',
      value: i % 2 === 0 ? 10 + (i % 5) * 5 : 5 + (i % 8),
      active: i % 7 !== 0,
      maxUses: 50000,
      usedCount: 1200 + i * 340,
      cityId: cities[i % cities.length].id,
      startsAt: isoDaysAgo(30),
      endsAt: isoDaysAgo(-60),
      createdAt: isoDaysAgo(40),
      updatedAt: nowIso,
      note: 'Campanha nacional Ano 2',
    });
  }

  const campaigns: PlatformCampaign[] = [];
  for (let i = 0; i < 18; i++) {
    campaigns.push({
      id: pid('cmp', i),
      name: pick(
        ['Free delivery domingo', 'Cupom BA', 'Retenção 30d', 'Push horário almoço', 'Reativação'],
        i
      ),
      channel: pick(['push', 'email', 'in_app'] as const, i),
      segment: pick(['all', 'churn_risk', 'vip', 'new_users'] as const, i),
      status: pick(['sent', 'scheduled', 'draft'] as const, i),
      body: 'Campanha da projeção nacional Peça Já.',
      cityId: i % 4 === 0 ? cities[i % cities.length].id : undefined,
      scheduledAt: isoDaysAgo(-3),
      sentAt: i % 3 === 0 ? isoDaysAgo(2) : undefined,
      createdAt: isoDaysAgo(15),
      updatedAt: nowIso,
    });
  }

  const featureFlags: FeatureFlag[] = [
    {
      key: HQ_PROJ_FLAG,
      enabled: true,
      scope: 'global',
      note: HQ_YEAR2.label,
      updatedAt: nowIso,
      updatedBy: 'seed',
    },
    {
      key: 'marketplace_split_v2',
      enabled: true,
      scope: 'percent',
      percent: 65,
      note: 'Rollout split MP',
      updatedAt: nowIso,
    },
    {
      key: 'driver_league',
      enabled: true,
      scope: 'global',
      note: 'Liga dos motoboys',
      updatedAt: nowIso,
    },
    {
      key: 'dynamic_fee',
      enabled: true,
      scope: 'city',
      cityId: cities[0].id,
      note: 'Taxa dinâmica SP',
      updatedAt: nowIso,
    },
  ];

  const systemLogs: SystemLogEntry[] = [];
  for (let i = 0; i < 40; i++) {
    systemLogs.push({
      id: pid('log', i),
      level: pick(['info', 'warning', 'error', 'info', 'info'] as const, i),
      service: pick(['payments', 'fleet', 'platform', 'webhook'] as const, i),
      message: pick(
        [
          'Webhook MP processado',
          'Retry dispatch frota',
          'Latência gateway elevada',
          'Snapshot state OK',
          'Rate limit edge',
        ],
        i
      ),
      createdAt: isoDaysAgo(0, 8 + (i % 10), i % 60),
    });
  }

  const incidents: PlatformIncident[] = [
    {
      id: pid('inc', 1),
      title: 'Latência checkout PIX (região SE)',
      severity: 'medium',
      service: 'payments',
      status: 'investigating',
      impact: '~2% dos checkouts com delay >8s',
      cause: 'Pico de tráfego + fila webhook',
      ownerUserId: undefined,
      startedAt: isoDaysAgo(0, 7),
      updatedAt: nowIso,
    },
    {
      id: pid('inc', 2),
      title: 'GPS frota degradado em Manaus',
      severity: 'low',
      service: 'fleet',
      status: 'mitigated',
      impact: 'ETA impreciso em 4% das corridas',
      startedAt: isoDaysAgo(1),
      updatedAt: nowIso,
    },
    {
      id: pid('inc', 3),
      title: 'Spike de cancelamentos pós-pagamento',
      severity: 'high',
      service: 'platform',
      status: 'open',
      impact: 'Monitoramento ativo no Ops',
      startedAt: isoDaysAgo(0, 9),
      updatedAt: nowIso,
    },
  ];

  const auditLogs: AuditLogEntry[] = [];
  for (let i = 0; i < 50; i++) {
    auditLogs.push({
      id: pid('aud', i),
      actorId: 'seed',
      actorEmail: 'hq@pecaja.app',
      action: pick(
        ['shop.suspend', 'ticket.assign', 'flag.update', 'ledger.adjust', 'user.block'],
        i
      ),
      entityType: pick(['shop', 'ticket', 'flag', 'ledger', 'user'] as const, i),
      entityId: pid('ent', i),
      result: 'success',
      reason: 'Ação HQ · projeção',
      createdAt: isoDaysAgo(i % 12, 11, i % 50),
    });
  }

  const drivers: Record<string, FleetDriverPresence> = {};
  for (let i = 0; i < 350; i++) {
    const city = cities[i % cities.length];
    const id = pid('drv', i);
    drivers[id] = {
      fleetId: id,
      applicationId: pid('drvapp', i),
      name: `Motoboy ${i + 1}`,
      phone: `7197${String(3000000 + i).slice(0, 7)}`,
      online: i % 5 !== 0,
      lastSeenAt: nowIso,
      latitude: (city.latitude || 0) + ((i % 30) - 15) * 0.008,
      longitude: (city.longitude || 0) + ((i % 24) - 12) * 0.008,
      heading: (i * 17) % 360,
      blocked: i % 61 === 0,
      blockedReason: i % 61 === 0 ? 'Score baixo' : undefined,
    };
  }

  return {
    cities,
    shops,
    users,
    orders,
    ledger,
    tickets,
    applications,
    reviews,
    coupons,
    campaigns,
    featureFlags,
    systemLogs,
    incidents,
    auditLogs,
    drivers,
  };
}

export function mergeProjectionIntoPlatform(state: PlatformState): {
  state: PlatformState;
  stats: HqProjectionSeedResult;
} {
  const payload = buildProjectionPayload();

  const keepFlags = (state.featureFlags || []).filter((f) => f.key !== HQ_PROJ_FLAG);
  const next: PlatformState = {
    ...state,
    revision: (state.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
    users: [...stripProjectionUsers(state.users), ...payload.users],
    // preserve sessions / passwordResets untouched
    orders: [...stripProjectionEntities(state.orders as any), ...payload.orders] as Order[],
    shops: [...stripProjectionShops(state.shops), ...payload.shops],
    ledger: [...stripProjectionEntities(state.ledger), ...payload.ledger],
    tickets: [...stripProjectionEntities(state.tickets), ...payload.tickets],
    applications: [...stripProjectionEntities(state.applications), ...payload.applications],
    cities: [...stripProjectionEntities(state.cities), ...payload.cities],
    coupons: [...stripProjectionEntities(state.coupons), ...payload.coupons],
    campaigns: [...stripProjectionEntities(state.campaigns), ...payload.campaigns],
    reviews: [...stripProjectionEntities(state.reviews), ...payload.reviews],
    systemLogs: [...stripProjectionEntities(state.systemLogs), ...payload.systemLogs],
    incidents: [...stripProjectionEntities(state.incidents), ...payload.incidents],
    auditLogs: [...stripProjectionEntities(state.auditLogs), ...payload.auditLogs],
    featureFlags: [...keepFlags, ...payload.featureFlags],
  };

  return {
    state: next,
    stats: {
      cities: payload.cities.length,
      shops: payload.shops.length,
      customers: payload.users.length,
      orders: payload.orders.length,
      ledger: payload.ledger.length,
      tickets: payload.tickets.length,
      applications: payload.applications.length,
      reviews: payload.reviews.length,
      drivers: Object.keys(payload.drivers).length,
    },
  };
}

let projectionSeedTask: Promise<void> | null = null;

/** Grava o cenário Ano 2 uma vez, para o HQ abrir como se a rede já estivesse rodando. */
export async function ensureProjectionSeeded(state: PlatformState): Promise<PlatformState> {
  const hasRows = (state.orders || []).some((o) => String(o.id || '').startsWith(HQ_PROJ_PREFIX));
  if (hasRows) return state;
  if (!projectionSeedTask) {
    projectionSeedTask = (async () => {
      const { loadPlatformState, savePlatformState, withPlatformLock } = await import(
        '@/services/platformStore'
      );
      const { loadFleetState, saveFleetState } = await import('@/services/fleetStore');
      await withPlatformLock(async () => {
        const fresh = await loadPlatformState();
        if (!(fresh.orders || []).some((o) => String(o.id || '').startsWith(HQ_PROJ_PREFIX))) {
          const { state: next } = mergeProjectionIntoPlatform(fresh);
          await savePlatformState(next);
        }
      });
      const fleet = await loadFleetState();
      await saveFleetState(mergeProjectionIntoFleet(fleet));
    })().finally(() => {
      projectionSeedTask = null;
    });
  }
  await projectionSeedTask;
  const { loadPlatformState } = await import('@/services/platformStore');
  return loadPlatformState();
}

export function mergeProjectionIntoFleet(fleet: FleetState): FleetState {
  const payload = buildProjectionPayload();
  const drivers = { ...fleet.drivers };
  for (const key of Object.keys(drivers)) {
    if (key.startsWith(HQ_PROJ_PREFIX)) delete drivers[key];
  }
  Object.assign(drivers, payload.drivers);
  const orders = (fleet.orders || []).filter((o) => !String(o.id || '').startsWith(HQ_PROJ_PREFIX));
  return {
    ...fleet,
    revision: (fleet.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
    drivers,
    orders,
  };
}
