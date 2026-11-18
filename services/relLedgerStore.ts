/**
 * Dual-write F5: ledger / payout_profiles / plan_payments (REL_LEDGER).
 */
import type { LedgerEntry, PayoutProfile, PlanPaymentRecord } from '@/services/platformTypes';
import { dualWriteSafe, getRelSql } from '@/services/relDualWrite';

export async function insertLedgerEntryRel(entry: LedgerEntry): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO ledger_entries (
      id, owner_type, owner_id, order_id, kind, amount, note, actor_user_id, created_at
    ) VALUES (
      ${entry.id},
      ${entry.ownerType},
      ${entry.ownerId},
      ${entry.orderId ?? null},
      ${entry.kind},
      ${Number(entry.amount) || 0},
      ${entry.note || ''},
      ${entry.actorUserId ?? null},
      ${entry.createdAt}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function upsertPayoutProfileRel(profile: PayoutProfile): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO payout_profiles (
      owner_type, owner_id, pix_key, pix_key_type, holder_name, document, updated_at
    ) VALUES (
      ${profile.ownerType},
      ${profile.ownerId},
      ${profile.pixKey},
      ${profile.pixKeyType},
      ${profile.holderName || ''},
      ${profile.document || ''},
      ${profile.updatedAt}
    )
    ON CONFLICT (owner_type, owner_id) DO UPDATE SET
      pix_key = EXCLUDED.pix_key,
      pix_key_type = EXCLUDED.pix_key_type,
      holder_name = EXCLUDED.holder_name,
      document = EXCLUDED.document,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function upsertPlanPaymentRel(row: PlanPaymentRecord): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO plan_payments (
      id, application_id, plan, amount, method, status, external_reference,
      owner_user_id, business_name, created_at, paid_at
    ) VALUES (
      ${row.id},
      ${row.applicationId},
      ${row.plan},
      ${Number(row.amount) || 0},
      ${row.method},
      ${row.status},
      ${row.externalReference ?? null},
      ${row.ownerUserId ?? null},
      ${row.businessName ?? null},
      ${row.createdAt},
      ${row.paidAt ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      paid_at = EXCLUDED.paid_at,
      amount = EXCLUDED.amount,
      method = EXCLUDED.method,
      external_reference = EXCLUDED.external_reference
  `;
}

export async function dualWriteLedgerSafe(entry: LedgerEntry): Promise<void> {
  await dualWriteSafe('ledger', 'ledger_post', async () => {
    await insertLedgerEntryRel(entry);
  });
}

export async function dualWritePayoutSafe(profile: PayoutProfile): Promise<void> {
  await dualWriteSafe('ledger', 'payout_profile', async () => {
    await upsertPayoutProfileRel(profile);
  });
}

export async function dualWritePlanPaymentSafe(row: PlanPaymentRecord): Promise<void> {
  await dualWriteSafe('ledger', 'plan_payment', async () => {
    await upsertPlanPaymentRel(row);
  });
}
