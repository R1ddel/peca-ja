/**
 * Dual-write F6: tickets / applications / audit_logs (REL_HQ).
 */
import type {
  AuditLogEntry,
  PartnerApplicationRecord,
  SupportTicket,
} from '@/services/platformTypes';
import { dualWriteSafe, getRelSql } from '@/services/relDualWrite';

export async function upsertTicketRel(ticket: SupportTicket): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO tickets (
      id, user_id, email, subject, body, status, priority, category,
      assignee_user_id, order_id, created_at, updated_at
    ) VALUES (
      ${ticket.id},
      ${ticket.userId ?? null},
      ${ticket.email || ''},
      ${ticket.subject || ''},
      ${ticket.body || ''},
      ${ticket.status || 'open'},
      ${ticket.priority ?? null},
      ${ticket.category ?? null},
      ${ticket.assigneeUserId ?? null},
      ${ticket.orderId ?? null},
      ${ticket.createdAt},
      ${ticket.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      category = EXCLUDED.category,
      assignee_user_id = EXCLUDED.assignee_user_id,
      body = EXCLUDED.body,
      updated_at = EXCLUDED.updated_at
  `;
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  await db.begin(async (tx) => {
    await tx`DELETE FROM ticket_messages WHERE ticket_id = ${ticket.id}`;
    for (const m of messages) {
      await tx`
        INSERT INTO ticket_messages (ticket_id, at, from_role, text)
        VALUES (${ticket.id}, ${m.at}, ${m.from}, ${m.text || ''})
      `;
    }
  });
}

export async function upsertApplicationRel(app: PartnerApplicationRecord): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO applications (
      id, role, status, pipeline_stage, city, name, email, phone, business_name,
      document, notes, owner_user_id, assignee_user_id, follow_up_at, tags, timeline, raw,
      created_at, updated_at
    ) VALUES (
      ${app.id},
      ${app.role},
      ${app.status},
      ${app.pipelineStage ?? null},
      ${app.city ?? null},
      ${app.name || ''},
      ${app.email || ''},
      ${app.phone || ''},
      ${app.businessName ?? null},
      ${app.document ?? null},
      ${app.notes ?? null},
      ${app.ownerUserId ?? null},
      ${app.assigneeUserId ?? null},
      ${app.followUpAt ?? null},
      ${app.tags ? db.json(app.tags as never) : null},
      ${app.timeline ? db.json(app.timeline as never) : null},
      ${app.raw ? db.json(app.raw as never) : null},
      ${app.createdAt},
      ${app.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      pipeline_stage = EXCLUDED.pipeline_stage,
      city = EXCLUDED.city,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      business_name = EXCLUDED.business_name,
      document = EXCLUDED.document,
      notes = EXCLUDED.notes,
      owner_user_id = EXCLUDED.owner_user_id,
      assignee_user_id = EXCLUDED.assignee_user_id,
      follow_up_at = EXCLUDED.follow_up_at,
      tags = EXCLUDED.tags,
      timeline = EXCLUDED.timeline,
      raw = EXCLUDED.raw,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function insertAuditLogRel(entry: AuditLogEntry): Promise<void> {
  const db = await getRelSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO audit_logs (
      id, actor_id, actor_email, action, entity_type, entity_id,
      before, after, reason, ip, result, created_at
    ) VALUES (
      ${entry.id},
      ${entry.actorId ?? null},
      ${entry.actorEmail ?? null},
      ${entry.action},
      ${entry.entityType ?? null},
      ${entry.entityId ?? null},
      ${entry.before != null ? db.json(entry.before as never) : null},
      ${entry.after != null ? db.json(entry.after as never) : null},
      ${entry.reason ?? null},
      ${entry.ip ?? null},
      ${entry.result ?? null},
      ${entry.createdAt}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function dualWriteTicketSafe(ticket: SupportTicket): Promise<void> {
  await dualWriteSafe('hq', 'ticket', async () => {
    await upsertTicketRel(ticket);
  });
}

export async function dualWriteApplicationSafe(app: PartnerApplicationRecord): Promise<void> {
  await dualWriteSafe('hq', 'application', async () => {
    await upsertApplicationRel(app);
  });
}

export async function dualWriteAuditSafe(entry: AuditLogEntry): Promise<void> {
  await dualWriteSafe('hq', 'audit', async () => {
    await insertAuditLogRel(entry);
  });
}
