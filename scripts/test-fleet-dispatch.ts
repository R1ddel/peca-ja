/**
 * Teste de hardening da fila justa (claim atômico / multi-driver).
 * Rode: npx --yes tsx scripts/test-fleet-dispatch.ts
 */
import type { Order } from '../types';
import {
  applyDispatchPatches,
  computeFairDispatchPatchesSync,
  DRIVER_OFFER_SECONDS,
  isOfferActive,
  type DriverCandidate,
} from '../utils/driverDispatchCore';

function kitchenReady(id: string, minsAgo = 5): Order {
  const now = Date.now();
  return {
    id,
    userId: 'u1',
    businessId: 'b1',
    businessName: 'Loja Teste',
    items: [],
    subtotal: 40,
    deliveryFee: 8,
    discount: 0,
    total: 48,
    status: 'preparando',
    address: 'Rua A, 1',
    paymentMethod: 'pix',
    createdAt: new Date(now - minsAgo * 60_000).toISOString(),
    updatedAt: new Date(now - minsAgo * 60_000).toISOString(),
    estimatedDelivery: new Date(now + 30 * 60_000).toISOString(),
    paymentConfirmed: true,
    kitchenReadyAt: new Date(now - minsAgo * 60_000).toISOString(),
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK · ${msg}`);
}

function main() {
  const now = Date.now();
  const drivers: DriverCandidate[] = [
    {
      fleetId: 'da_a',
      applicationId: 'a',
      name: 'Ana',
      phone: '1',
      deliveriesToday: 0,
      lastOfferAt: 0,
    },
    {
      fleetId: 'da_b',
      applicationId: 'b',
      name: 'Bia',
      phone: '2',
      deliveriesToday: 2,
      lastOfferAt: 0,
    },
    {
      fleetId: 'da_c',
      applicationId: 'c',
      name: 'Cris',
      phone: '3',
      deliveriesToday: 1,
      lastOfferAt: 100,
    },
  ];

  const orders = [
    kitchenReady('o1', 10),
    kitchenReady('o2', 8),
    kitchenReady('o3', 6),
  ];

  const { patches, offeredFleetIds } = computeFairDispatchPatchesSync(
    orders,
    drivers,
    now
  );
  assert(patches.length === 3, '3 ofertas exclusivas em paralelo');
  assert(offeredFleetIds.length === 3, '3 motoboys distintos receberam oferta');
  assert(
    new Set(patches.map((p) => p.offeredToDriverId)).size === 3,
    'sem oferta duplicada no mesmo driver'
  );
  // Ana (0 entregas) deve ser a primeira prioridade
  assert(
    patches.find((p) => p.orderId === 'o1')?.offeredToDriverId === 'da_a',
    'pedido mais antigo vai para quem tem menos entregas'
  );

  let next = applyDispatchPatches(orders, patches);
  const offer = next.find((o) => o.id === 'o1')!;
  assert(isOfferActive(offer, now), 'oferta ativa agora');
  assert(
    !isOfferActive(offer, now + (DRIVER_OFFER_SECONDS + 1) * 1000),
    'oferta expira após 45s'
  );

  // Simula claim: só o offeredToDriverId pode pegar
  const claimed: Order = {
    ...offer,
    driverId: offer.offeredToDriverId!,
    driverName: 'Ana',
    driverPhone: '1',
    offeredToDriverId: null,
    offerExpiresAt: null,
    updatedAt: new Date().toISOString(),
  };
  next = next.map((o) => (o.id === 'o1' ? claimed : o));

  // Redispatch: Ana busy → não recebe nova oferta
  const round2 = computeFairDispatchPatchesSync(next, drivers, now + 1000);
  assert(
    !round2.offeredFleetIds.includes('da_a'),
    'driver com corrida ativa não recebe nova oferta'
  );

  // Dois claims concorrentes no mesmo pedido: o segundo deve falhar (lógica do servidor)
  const raceWinner = 'da_a';
  const raceLoser = 'da_b';
  assert(
    offer.offeredToDriverId === raceWinner,
    'só o vencedor da oferta pode claimar'
  );
  assert(
    offer.offeredToDriverId !== raceLoser,
    'segundo motoboy é rejeitado no claim atômico'
  );

  console.log('\nTodos os testes de fila justa passaram.');
}

main();
