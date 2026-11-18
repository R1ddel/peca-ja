/**
 * Dual-write F3: orders / order_items (REL_ORDERS).
 */
import type { Order } from '@/types';
import { dualWriteSafe, getRelSql } from '@/services/relDualWrite';

export async function upsertOrderRel(order: Order): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO orders (
      id, user_id, business_id, business_name, status, city,
      subtotal, delivery_fee, discount, total, payment_method, payment_id,
      payment_provider, payment_confirmed, driver_id, driver_platform_user_id,
      delivery_by, created_at, updated_at, payload
    ) VALUES (
      ${order.id},
      ${order.userId ?? null},
      ${order.businessId ?? null},
      ${order.businessName ?? null},
      ${order.status ?? null},
      ${order.city ?? null},
      ${order.subtotal ?? null},
      ${order.deliveryFee ?? null},
      ${order.discount ?? null},
      ${order.total ?? null},
      ${order.paymentMethod ?? null},
      ${order.paymentId ?? null},
      ${order.paymentProvider ?? null},
      ${order.paymentConfirmed ?? null},
      ${order.driverId ?? null},
      ${order.driverPlatformUserId ?? null},
      ${order.deliveryBy ?? null},
      ${order.createdAt ?? null},
      ${order.updatedAt || new Date().toISOString()},
      ${db.json(order as never)}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      business_id = EXCLUDED.business_id,
      business_name = EXCLUDED.business_name,
      status = EXCLUDED.status,
      city = EXCLUDED.city,
      subtotal = EXCLUDED.subtotal,
      delivery_fee = EXCLUDED.delivery_fee,
      discount = EXCLUDED.discount,
      total = EXCLUDED.total,
      payment_method = EXCLUDED.payment_method,
      payment_id = EXCLUDED.payment_id,
      payment_provider = EXCLUDED.payment_provider,
      payment_confirmed = EXCLUDED.payment_confirmed,
      driver_id = EXCLUDED.driver_id,
      driver_platform_user_id = EXCLUDED.driver_platform_user_id,
      delivery_by = EXCLUDED.delivery_by,
      created_at = COALESCE(EXCLUDED.created_at, orders.created_at),
      updated_at = EXCLUDED.updated_at,
      payload = EXCLUDED.payload
  `;

  const items = Array.isArray(order.items) ? order.items : [];
  await db.begin(async (tx) => {
    await tx`DELETE FROM order_items WHERE order_id = ${order.id}`;
    for (const line of items) {
      const lineId = String(line.lineId || line.item?.id || `${order.id}-${Math.random()}`);
      await tx`
        INSERT INTO order_items (
          line_id, order_id, item_id, name, quantity, unit_price, business_id, note, selected_addons, payload
        ) VALUES (
          ${lineId},
          ${order.id},
          ${line.item?.id ?? null},
          ${line.item?.name ?? null},
          ${Number(line.quantity) || 1},
          ${line.item?.price ?? null},
          ${line.businessId ?? order.businessId ?? null},
          ${line.note ?? null},
          ${line.selectedAddons ? tx.json(line.selectedAddons as never) : null},
          ${tx.json(line as never)}
        )
      `;
    }
  });
}

export async function dualWriteOrderSafe(order: Order): Promise<void> {
  await dualWriteSafe('orders', 'upsert_order', async () => {
    await upsertOrderRel(order);
  });
}

export async function dualWriteOrdersSafe(orders: Order[]): Promise<void> {
  await dualWriteSafe('orders', 'sync_orders', async () => {
    for (const order of orders) {
      await upsertOrderRel(order);
    }
  });
}
