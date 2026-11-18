/**
 * Dual-write F4: drivers / driver_sessions / fleet_reports (REL_FLEET).
 */
import type { FleetState } from '@/services/fleetTypes';
import { dualWriteSafe, getRelSql } from '@/services/relDualWrite';

export async function upsertFleetStateRel(state: FleetState): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');

  const drivers = state.drivers && typeof state.drivers === 'object' ? state.drivers : {};
  for (const [fleetId, d] of Object.entries(drivers)) {
    if (!d) continue;
    await db`
      INSERT INTO drivers (
        fleet_id, application_id, name, phone, city, online, last_seen_at, last_offer_at,
        latitude, longitude, heading, blocked, blocked_reason, blocked_at, updated_at
      ) VALUES (
        ${fleetId},
        ${d.applicationId ?? null},
        ${d.name || ''},
        ${d.phone || ''},
        ${d.city ?? null},
        ${!!d.online},
        ${d.lastSeenAt ?? null},
        ${d.lastOfferAt ?? null},
        ${d.latitude ?? null},
        ${d.longitude ?? null},
        ${d.heading ?? null},
        ${!!d.blocked},
        ${d.blockedReason ?? null},
        ${d.blockedAt ?? null},
        ${new Date().toISOString()}
      )
      ON CONFLICT (fleet_id) DO UPDATE SET
        application_id = EXCLUDED.application_id,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        city = EXCLUDED.city,
        online = EXCLUDED.online,
        last_seen_at = EXCLUDED.last_seen_at,
        last_offer_at = EXCLUDED.last_offer_at,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        heading = EXCLUDED.heading,
        blocked = EXCLUDED.blocked,
        blocked_reason = EXCLUDED.blocked_reason,
        blocked_at = EXCLUDED.blocked_at,
        updated_at = EXCLUDED.updated_at
    `;
    if (d.sessionToken) {
      await db`
        INSERT INTO driver_sessions (fleet_id, session_token, updated_at)
        VALUES (${fleetId}, ${d.sessionToken}, ${new Date().toISOString()})
        ON CONFLICT (fleet_id) DO UPDATE SET
          session_token = EXCLUDED.session_token,
          updated_at = EXCLUDED.updated_at
      `;
    } else {
      await db`DELETE FROM driver_sessions WHERE fleet_id = ${fleetId}`;
    }
  }

  const reports = Array.isArray(state.reports) ? state.reports : [];
  for (const report of reports.slice(0, 500)) {
    const id = String((report as { id?: string }).id || '');
    if (!id) continue;
    await db`
      INSERT INTO fleet_reports (id, payload, created_at)
      VALUES (
        ${id},
        ${db.json(report as never)},
        ${new Date().toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
    `;
  }
}

export async function dualWriteFleetSafe(state: FleetState): Promise<void> {
  await dualWriteSafe('fleet', 'save_fleet_state', async () => {
    await upsertFleetStateRel(state);
  });
}
