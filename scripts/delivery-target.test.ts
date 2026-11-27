/**
 * Cascata do destino: GPS do celular → ponto salvo no pedido → endereço.
 * Roda com: npx tsx scripts/delivery-target.test.ts
 */
import assert from 'node:assert/strict';
import type { Order } from '@/types';
import {
  LIVE_CUSTOMER_GPS_MAX_AGE_MS,
  deliveryTargetFromOrder,
} from '@/utils/deliveryTarget';
import { graftDeliverySignals, mergeOrdersPreferNewer } from '@/utils/orderMerge';

const now = 1_700_000_000_000;
const saved = {
  address: 'Rua A, 10',
  deliveryLatitude: -13.01,
  deliveryLongitude: -41.37,
  deliveryPinSavedAt: '2026-01-01T00:00:00.000Z',
};

const live = deliveryTargetFromOrder(
  {
    ...saved,
    customerLiveLatitude: -13.02,
    customerLiveLongitude: -41.38,
    customerLiveAt: new Date(now - 10_000).toISOString(),
  },
  now
);
assert.equal(live.source, 'phone_gps');
assert.equal(live.precise, true);
assert.equal(live.point.latitude, -13.02);

const stale = deliveryTargetFromOrder(
  {
    ...saved,
    customerLiveLatitude: -13.02,
    customerLiveLongitude: -41.38,
    customerLiveAt: new Date(now - LIVE_CUSTOMER_GPS_MAX_AGE_MS - 1).toISOString(),
  },
  now
);
assert.equal(stale.source, 'order_pin');
assert.equal(stale.point.latitude, -13.01);

const badLive = deliveryTargetFromOrder(
  {
    ...saved,
    customerLiveLatitude: 999,
    customerLiveLongitude: 0,
    customerLiveAt: new Date(now).toISOString(),
  },
  now
);
assert.equal(badLive.source, 'order_pin');

const addressOnly = deliveryTargetFromOrder(
  { address: 'Rua das Flores, 120 — Mucugê' },
  now
);
assert.equal(addressOnly.source, 'address');
assert.equal(addressOnly.precise, false);
assert.equal(Number.isFinite(addressOnly.point.latitude), true);

const older = {
  id: 'PJ1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'preparando',
  customerLiveLatitude: -13.2,
  customerLiveLongitude: -41.2,
  customerLiveAt: '2026-01-02T00:00:00.000Z',
  deliveryLatitude: -13.01,
  deliveryLongitude: -41.37,
  deliveryPinSavedAt: '2026-01-01T00:00:00.000Z',
} as Order;

const newer = {
  id: 'PJ1',
  updatedAt: '2026-01-03T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'saiu_entrega',
} as Order;

const kept = mergeOrdersPreferNewer([newer], [older])[0];
assert.equal(kept.status, 'saiu_entrega');
assert.equal(kept.customerLiveLatitude, -13.2);
assert.equal(kept.deliveryLatitude, -13.01);
assert.equal(kept.deliveryPinSavedAt, '2026-01-01T00:00:00.000Z');

const moved = graftDeliverySignals(
  {
    ...newer,
    deliveryLatitude: -10,
    deliveryLongitude: -40,
  } as Order,
  older
);
assert.equal(moved.deliveryLatitude, -13.01);
assert.equal(moved.customerLiveLatitude, -13.2);

console.log('delivery-target: ok');
