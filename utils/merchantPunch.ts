/**
 * Bater ponto — entrada e saída, turnos abertos e relatório local.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StaffMember,
  StaffRole,
  StaffSession,
  listActiveByRole,
  getStaffSession,
  setStaffSession,
  writeRoleGate,
  clearRoleGate,
  normalizePin,
  isValidPin,
  createTimedStaffSession,
  clearSoftUnlock,
} from '@/utils/merchantTeam';
import { logMerchantAudit } from '@/utils/merchantAudit';

export type PunchRole = Exclude<StaffRole, 'owner'>;

export type PunchKind = 'in' | 'out';

export type StaffPunch = {
  id: string;
  businessId: string;
  memberId: string;
  memberName: string;
  role: PunchRole;
  punchedAt: string;
  /** Entradas antigas sem kind contam como 'in'. */
  kind?: PunchKind;
};

export type PunchReportRow = {
  memberId: string;
  memberName: string;
  role: PunchRole;
  entries: number;
  exits: number;
  open: boolean;
  lastAt: string | null;
  minutesWorkedApprox: number;
};

const KEY = '@pecaja_merchant_punches_v1';

function isStubMember(m: StaffMember): boolean {
  return m.id.startsWith('staff_stub_') || m.email.toLowerCase().endsWith('@painel.local');
}

export function punchKindOf(p: StaffPunch): PunchKind {
  return p.kind === 'out' ? 'out' : 'in';
}

/** Funcionários reais cadastrados na função (sem stub automático). */
export async function listPunchableStaff(
  businessId: string,
  role: PunchRole
): Promise<StaffMember[]> {
  const list = await listActiveByRole(businessId, role);
  return list.filter((m) => !isStubMember(m));
}

async function loadAll(): Promise<StaffPunch[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StaffPunch[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(list: StaffPunch[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 1200)));
}

export async function recordPunch(input: {
  businessId: string;
  memberId: string;
  memberName: string;
  role: PunchRole;
  kind: PunchKind;
}): Promise<StaffPunch> {
  const punch: StaffPunch = {
    id: `punch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    businessId: input.businessId,
    memberId: input.memberId,
    memberName: input.memberName.trim() || 'Funcionário',
    role: input.role,
    punchedAt: new Date().toISOString(),
    kind: input.kind,
  };
  const all = await loadAll();
  await saveAll([punch, ...all]);
  return punch;
}

export async function listPunches(
  businessId: string,
  opts?: { limit?: number; sinceMs?: number; memberId?: string }
): Promise<StaffPunch[]> {
  const limit = opts?.limit ?? 60;
  const since = opts?.sinceMs ?? 0;
  const all = await loadAll();
  return all
    .filter((p) => p.businessId === businessId)
    .filter((p) => !opts?.memberId || p.memberId === opts.memberId)
    .filter((p) => !since || +new Date(p.punchedAt) >= since)
    .sort((a, b) => +new Date(b.punchedAt) - +new Date(a.punchedAt))
    .slice(0, limit);
}

export async function listTodayPunches(businessId: string): Promise<StaffPunch[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return listPunches(businessId, { limit: 120, sinceMs: start.getTime() });
}

/** Último ponto do membro; se for 'in', o turno ainda está aberto. */
export async function getOpenPunch(
  businessId: string,
  memberId: string
): Promise<StaffPunch | null> {
  const list = await listPunches(businessId, { memberId, limit: 20 });
  const last = list[0];
  if (!last) return null;
  return punchKindOf(last) === 'in' ? last : null;
}

/**
 * Valida o PIN pessoal do membro. Sem fallback universal.
 */
function verifyMemberPin(member: StaffMember, pinRaw: string): string | null {
  const pin = normalizePin(pinRaw);
  if (!isValidPin(pin)) return 'PIN inválido.';
  if (!member.pin || normalizePin(member.pin) !== pin) {
    return 'PIN inválido.';
  }
  return null;
}

/**
 * Valida PIN pessoal, bate ponto de entrada e abre sessão com validade.
 */
export async function punchInAndEnter(
  member: StaffMember,
  pin: string
): Promise<{ ok: true; session: StaffSession; punch: StaffPunch } | { ok: false; error: string }> {
  if (member.role === 'owner') {
    return { ok: false, error: 'O dono não bate ponto nesta função.' };
  }
  if (!member.active) {
    return { ok: false, error: 'Este funcionário está inativo.' };
  }
  if (isStubMember(member)) {
    return { ok: false, error: 'Cadastre o funcionário na Equipe antes de bater ponto.' };
  }
  const pinErr = verifyMemberPin(member, pin);
  if (pinErr) return { ok: false, error: pinErr };

  const open = await getOpenPunch(member.businessId, member.id);
  if (open) {
    // Fecha turno anterior automaticamente (esquecimento de saída).
    await recordPunch({
      businessId: member.businessId,
      memberId: member.id,
      memberName: member.name,
      role: member.role as PunchRole,
      kind: 'out',
    });
  }

  const role = member.role as PunchRole;
  const punch = await recordPunch({
    businessId: member.businessId,
    memberId: member.id,
    memberName: member.name,
    role,
    kind: 'in',
  });

  const session = await createTimedStaffSession({
    businessId: member.businessId,
    memberId: member.id,
    role,
    name: member.name,
    punchId: punch.id,
    email: member.email,
  });
  await writeRoleGate(session);
  await logMerchantAudit({
    businessId: member.businessId,
    actorId: member.id,
    actorName: member.name,
    actorRole: role,
    action: 'punch_in',
    detail: `Entrou em ${role}`,
  });
  return { ok: true, session, punch };
}

/**
 * Bate ponto de saída + encerra sessão (Trocar / sair da função).
 */
export async function punchOutAndLogout(): Promise<{
  ok: true;
  punch: StaffPunch | null;
} | { ok: false; error: string }> {
  const sess = await getStaffSession();
  if (!sess) {
    await setStaffSession(null);
    await clearRoleGate();
    await clearSoftUnlock();
    return { ok: true, punch: null };
  }
  if (sess.role === 'owner') {
    await setStaffSession(null);
    await clearRoleGate();
    await clearSoftUnlock();
    return { ok: true, punch: null };
  }

  const role = sess.role as PunchRole;
  let punch: StaffPunch | null = null;
  const open = await getOpenPunch(sess.businessId, sess.memberId);
  if (open) {
    punch = await recordPunch({
      businessId: sess.businessId,
      memberId: sess.memberId,
      memberName: sess.name,
      role,
      kind: 'out',
    });
    await logMerchantAudit({
      businessId: sess.businessId,
      actorId: sess.memberId,
      actorName: sess.name,
      actorRole: role,
      action: 'punch_out',
      detail: 'Saiu da função',
    });
  }

  await setStaffSession(null);
  await clearRoleGate();
  await clearSoftUnlock();
  return { ok: true, punch };
}

/** Relatório agregado (útil dono/gerente). */
export async function buildPunchReport(
  businessId: string,
  sinceMs: number
): Promise<PunchReportRow[]> {
  const punches = await listPunches(businessId, { limit: 500, sinceMs });
  const map = new Map<string, PunchReportRow & { stack: number[] }>();

  // Processar do mais antigo ao mais novo para minutos.
  const chronological = [...punches].sort(
    (a, b) => +new Date(a.punchedAt) - +new Date(b.punchedAt)
  );

  for (const p of chronological) {
    let row = map.get(p.memberId);
    if (!row) {
      row = {
        memberId: p.memberId,
        memberName: p.memberName,
        role: p.role,
        entries: 0,
        exits: 0,
        open: false,
        lastAt: null,
        minutesWorkedApprox: 0,
        stack: [],
      };
      map.set(p.memberId, row);
    }
    row.lastAt = p.punchedAt;
    row.memberName = p.memberName;
    row.role = p.role;
    if (punchKindOf(p) === 'in') {
      row.entries += 1;
      row.open = true;
      row.stack.push(+new Date(p.punchedAt));
    } else {
      row.exits += 1;
      row.open = false;
      const start = row.stack.pop();
      if (start) {
        row.minutesWorkedApprox += Math.max(
          0,
          Math.floor((+new Date(p.punchedAt) - start) / 60000)
        );
      }
    }
  }

  // Turno ainda aberto: conta até agora.
  const now = Date.now();
  for (const row of map.values()) {
    while (row.stack.length) {
      const start = row.stack.pop()!;
      row.minutesWorkedApprox += Math.max(0, Math.floor((now - start) / 60000));
    }
  }

  return [...map.values()]
    .map(({ stack: _s, ...rest }) => rest)
    .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
}
