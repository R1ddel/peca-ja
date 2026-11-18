/**
 * Dual-write F2: shops / menu_items / cities.
 * Ativo só com PERSISTENCE_MODE=hybrid + REL_SHOPS=1.
 */
import type { MerchantShop } from '@/utils/merchantShop';
import type { PlatformCity } from '@/services/platformTypes';
import { dualWriteSafe, getRelSql } from '@/services/relDualWrite';

export async function upsertShopRel(shop: MerchantShop): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO shops (
      business_id, application_id, owner_user_id, name, description, category, address,
      image, cover_image, is_open, hours, weekly_hours, delivery_time, delivery_fee, min_order,
      tags, plan, latitude, longitude, city, state, service_radius_km, plan_paid_until,
      suspended, suspended_at, suspended_reason, accepted_payments, delivery_by,
      mp_collector_id, mp_seller_access_token, created_at, updated_at
    ) VALUES (
      ${shop.businessId},
      ${shop.applicationId},
      ${shop.ownerUserId ?? null},
      ${shop.name || ''},
      ${shop.description || ''},
      ${shop.category || ''},
      ${shop.address || ''},
      ${shop.image ?? null},
      ${shop.coverImage ?? null},
      ${shop.isOpen !== false},
      ${shop.hours ?? null},
      ${shop.weeklyHours ? db.json(shop.weeklyHours as never) : null},
      ${shop.deliveryTime ?? null},
      ${Number(shop.deliveryFee) || 0},
      ${Number(shop.minOrder) || 0},
      ${db.json((shop.tags || []) as never)},
      ${shop.plan ?? null},
      ${shop.latitude ?? null},
      ${shop.longitude ?? null},
      ${shop.city ?? null},
      ${shop.state ?? null},
      ${shop.serviceRadiusKm ?? null},
      ${shop.planPaidUntil ?? null},
      ${!!shop.suspended},
      ${shop.suspendedAt ?? null},
      ${shop.suspendedReason ?? null},
      ${shop.acceptedPayments ? db.json(shop.acceptedPayments as never) : null},
      ${shop.deliveryBy ?? null},
      ${shop.mpCollectorId ?? null},
      ${shop.mpSellerAccessToken ?? null},
      ${shop.createdAt},
      ${shop.updatedAt || new Date().toISOString()}
    )
    ON CONFLICT (business_id) DO UPDATE SET
      application_id = EXCLUDED.application_id,
      owner_user_id = EXCLUDED.owner_user_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      address = EXCLUDED.address,
      image = EXCLUDED.image,
      cover_image = EXCLUDED.cover_image,
      is_open = EXCLUDED.is_open,
      hours = EXCLUDED.hours,
      weekly_hours = EXCLUDED.weekly_hours,
      delivery_time = EXCLUDED.delivery_time,
      delivery_fee = EXCLUDED.delivery_fee,
      min_order = EXCLUDED.min_order,
      tags = EXCLUDED.tags,
      plan = EXCLUDED.plan,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      service_radius_km = EXCLUDED.service_radius_km,
      plan_paid_until = EXCLUDED.plan_paid_until,
      suspended = EXCLUDED.suspended,
      suspended_at = EXCLUDED.suspended_at,
      suspended_reason = EXCLUDED.suspended_reason,
      accepted_payments = EXCLUDED.accepted_payments,
      delivery_by = EXCLUDED.delivery_by,
      mp_collector_id = EXCLUDED.mp_collector_id,
      mp_seller_access_token = EXCLUDED.mp_seller_access_token,
      updated_at = EXCLUDED.updated_at
  `;

  const menu = Array.isArray(shop.menu) ? shop.menu : [];
  await db.begin(async (tx) => {
    await tx`DELETE FROM menu_items WHERE shop_id = ${shop.businessId}`;
    for (const item of menu) {
      await tx`
        INSERT INTO menu_items (
          id, shop_id, name, description, details, price, image, images, category,
          popular, promo, addon_groups, available, convenience
        ) VALUES (
          ${item.id},
          ${shop.businessId},
          ${item.name || ''},
          ${item.description || ''},
          ${item.details ?? null},
          ${Number(item.price) || 0},
          ${item.image ?? null},
          ${item.images ? tx.json(item.images as never) : null},
          ${item.category || ''},
          ${item.popular ?? null},
          ${item.promo ?? null},
          ${item.addonGroups ? tx.json(item.addonGroups as never) : null},
          ${item.available !== false},
          ${item.convenience ?? null}
        )
      `;
    }
  });
}

export async function upsertCityRel(city: PlatformCity): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO cities (
      id, name, state, status, latitude, longitude, service_radius_km, created_at, updated_at
    ) VALUES (
      ${city.id},
      ${city.name},
      ${city.state || ''},
      ${city.status || 'active'},
      ${city.latitude ?? null},
      ${city.longitude ?? null},
      ${city.serviceRadiusKm ?? null},
      ${city.createdAt},
      ${city.updatedAt || new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      state = EXCLUDED.state,
      status = EXCLUDED.status,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      service_radius_km = EXCLUDED.service_radius_km,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function dualWriteShopSafe(shop: MerchantShop): Promise<void> {
  await dualWriteSafe('shops', 'upsert_shop', async () => {
    await upsertShopRel(shop);
  });
}

export async function dualWriteCitySafe(city: PlatformCity): Promise<void> {
  await dualWriteSafe('shops', 'upsert_city', async () => {
    await upsertCityRel(city);
  });
}
