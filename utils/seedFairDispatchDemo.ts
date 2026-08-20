/**
 * Gera 3 pedidos prontos na cozinha para testar a fila justa.
 */
import { Order, CartItem, MenuItem } from '@/types';
import { generateOrderVerificationCodes } from '@/utils/orderCodes';
import { makeLineId } from '@/utils/cartLine';
import {
  resolveBusinessCoords,
  resolveDeliveryCoords,
} from '@/utils/orderGeo';
import { getSimulatedCityLabel } from '@/utils/demoLocation';

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
  price: number,
  quantity: number
): CartItem {
  const id = `demo_${name.replace(/\s/g, '_').toLowerCase()}`;
  const item = menuItem(id, name, price);
  return {
    lineId: makeLineId(id, []),
    item,
    quantity,
    businessId,
    businessName,
    selectedAddons: [],
  };
}

export function buildFairDispatchDemoOrders(): Order[] {
  const now = Date.now();
  const city = getSimulatedCityLabel();
  const demos = [
    {
      suffix: 'A',
      businessId: 'demo_fair_pizza',
      businessName: 'Pizzaria do Centro',
      address: `Rua das Flores, 120 — ${city}`,
      items: [line('demo_fair_pizza', 'Pizzaria do Centro', 'Pizza Calabresa G', 42, 1)],
      deliveryFee: 8,
      readyAgoSec: 120,
    },
    {
      suffix: 'B',
      businessId: 'demo_fair_burger',
      businessName: 'Burger Chapada',
      address: `Av. Coronel Durval, 45 — ${city}`,
      items: [
        line('demo_fair_burger', 'Burger Chapada', 'X-Tudo', 28, 2),
        line('demo_fair_burger', 'Burger Chapada', 'Refrigerante Lata', 6, 2),
      ],
      deliveryFee: 6,
      readyAgoSec: 60,
    },
    {
      suffix: 'C',
      businessId: 'demo_fair_acai',
      businessName: 'Açaí da Praça',
      address: `Praça Coronel Douca, 10 — ${city}`,
      items: [line('demo_fair_acai', 'Açaí da Praça', 'Açaí 500ml', 18, 1)],
      deliveryFee: 5,
      readyAgoSec: 10,
    },
  ];

  return demos.map((d, i) => {
    const created = new Date(now - (i + 3) * 60_000).toISOString();
    const readyAt = new Date(now - d.readyAgoSec * 1000).toISOString();
    const { pickupCode, deliveryCode } = generateOrderVerificationCodes();
    const subtotal = d.items.reduce((s, it) => s + it.item.price * it.quantity, 0);
    const id = `PJFAIR${d.suffix}${String(now).slice(-6)}`;
    const delivery = resolveDeliveryCoords(d.address);
    const shop = resolveBusinessCoords(d.businessId, d.businessName);
    return {
      id,
      userId: 'demo_customer',
      businessId: d.businessId,
      businessName: d.businessName,
      businessImage: '',
      items: d.items,
      subtotal,
      deliveryFee: d.deliveryFee,
      total: subtotal + d.deliveryFee + 2,
      status: 'preparando' as const,
      address: d.address,
      deliveryLatitude: delivery.latitude,
      deliveryLongitude: delivery.longitude,
      businessLatitude: shop.latitude,
      businessLongitude: shop.longitude,
      paymentMethod: 'pix',
      createdAt: created,
      updatedAt: readyAt,
      estimatedDelivery: '25-40 min',
      platformFee: 2,
      establishmentAmount: subtotal,
      driverAmount: d.deliveryFee,
      paymentConfirmed: true,
      paymentProvider: 'mock',
      pickupCode,
      deliveryCode,
      kitchenReadyAt: readyAt,
      preparedLineIds: d.items.map((it) => it.lineId),
      shopOrderNumber: 100 + i,
      offeredToDriverId: null,
      offerExpiresAt: null,
      offerDeclinedBy: [],
    } satisfies Order;
  });
}
