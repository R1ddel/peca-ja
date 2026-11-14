/**
 * Equipe da loja (AsyncStorage) — papéis, login e convites locais.
 * Expo Go: sem backend; cadastro/login no aparelho.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StaffRole = 'owner' | 'manager' | 'kitchen' | 'cashier';

export type StaffMember = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Senha do painel do funcionário (MVP local). */
  password?: string;
  /** PIN de 4 dígitos — obrigatório para abrir o painel da função. */
  pin?: string;
  active: boolean;
  createdAt: string;
};

export type StaffInvite = {
  code: string;
  businessId: string;
  role: Exclude<StaffRole, 'owner'>;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export type StaffSession = {
  businessId: string;
  memberId: string;
  role: StaffRole;
  name: string;
  /** ISO — início da sessão atual. */
  startedAt?: string;
  /** ISO — depois disso precisa entrar de novo. */
  expiresAt?: string;
  /** ID do ponto de entrada aberto (se houver). */
  punchId?: string;
  /** E-mail do operador (dono = e-mail da compra). */
  email?: string;
};

/** Compara e-mails de forma estável (trim + lower). */
export function emailsMatch(a?: string | null, b?: string | null): boolean {
  const left = (a || '').trim().toLowerCase();
  const right = (b || '').trim().toLowerCase();
  return !!left && !!right && left === right;
}

/**
 * Só o e-mail cadastrado na compra/candidatura da loja é o dono.
 */
export function isApplicationOwnerEmail(
  userEmail?: string | null,
  applicationEmail?: string | null
): boolean {
  return emailsMatch(userEmail, applicationEmail);
}

const MEMBERS_KEY = '@pecaja_merchant_staff_v1';
const INVITES_KEY = '@pecaja_merchant_invites_v1';
const SESSION_KEY = '@pecaja_merchant_staff_session';
export const ROLE_GATE_KEY = '@pecaja_merchant_role_gate_v1';
/** Última função usada neste aparelho (por loja) — acelera a reentrada. */
const LAST_ROLE_KEY = '@pecaja_merchant_last_role_v1';
/** Soft unlock: reabre o painel sem PIN por algumas horas. */
const SOFT_UNLOCK_KEY = '@pecaja_merchant_soft_unlock_v1';
const SOFT_UNLOCK_MS = 8 * 60 * 60 * 1000; // 8h

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Dono',
  manager: 'Gerente',
  kitchen: 'Cozinha',
  cashier: 'Caixa',
};

export type StaffPermission =
  | 'orders'
  | 'kitchen'
  | 'pickup'
  | 'chat'
  | 'menu'
  | 'promos'
  | 'wallet'
  | 'withdraw'
  | 'settings'
  | 'team'
  | 'stores'
  | 'insights'
  | 'print'
  | 'sync';

const ROLE_PERMS: Record<StaffRole, StaffPermission[]> = {
  owner: [
    'orders',
    'kitchen',
    'pickup',
    'chat',
    'menu',
    'promos',
    'wallet',
    'withdraw',
    'settings',
    'team',
    'stores',
    'insights',
    'print',
    'sync',
  ],
  manager: [
    'orders',
    'kitchen',
    'pickup',
    'chat',
    'menu',
    'promos',
    'wallet',
    'withdraw',
    'settings',
    'team',
    'insights',
    'print',
    'sync',
  ],
  kitchen: ['orders', 'kitchen', 'pickup', 'chat', 'print'],
  cashier: ['orders', 'pickup', 'chat', 'print'],
};

export function staffCan(role: StaffRole, perm: StaffPermission): boolean {
  return ROLE_PERMS[role].includes(perm);
}

/** Painel isolado por função — ninguém abre o de outro papel. */
export function staffHomePath(role?: StaffRole): string {
  if (role === 'manager') return '/merchant/staff/manager';
  if (role === 'kitchen') return '/merchant/staff/kitchen';
  if (role === 'cashier') return '/merchant/staff/cashier';
  return '/merchant/staff/owner';
}

export function roleDescription(role: StaffRole): string {
  if (role === 'owner') return 'Acesso total: lojas, planos, saques e equipe.';
  if (role === 'manager') {
    return 'Operação completa: pedidos, cardápio, saldo/saque e equipe.';
  }
  if (role === 'kitchen') {
    return 'Fila da cozinha, preparo, cupom e chat do pedido.';
  }
  return 'Retirada por código, pedidos prontos e chat.';
}

export function roleAccent(role: StaffRole): string {
  if (role === 'owner') return '#0F766E';
  if (role === 'manager') return '#0369A1';
  if (role === 'kitchen') return '#C2410C';
  return '#5B21B6';
}

export function normalizePin(pin: string): string {
  return pin.replace(/\D/g, '').slice(0, 4);
}

function newStaffPin(): string {
  let pin = '';
  do {
    pin = String(1000 + Math.floor(Math.random() * 9000));
  } while (pin === '1234' || pin === '0000');
  return pin;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(normalizePin(pin));
}

export async function writeRoleGate(session: StaffSession): Promise<void> {
  await AsyncStorage.setItem(
    ROLE_GATE_KEY,
    `${session.businessId}:${session.memberId}:${session.role}`
  );
  await saveLastOperatorRole(session.businessId, session.role);
  await writeSoftUnlock(session);
}

export async function clearRoleGate(): Promise<void> {
  await AsyncStorage.removeItem(ROLE_GATE_KEY);
}

export async function saveLastOperatorRole(
  businessId: string,
  role: StaffRole
): Promise<void> {
  await AsyncStorage.setItem(LAST_ROLE_KEY, `${businessId}:${role}`);
}

export async function getLastOperatorRole(
  businessId: string
): Promise<StaffRole | null> {
  const raw = await AsyncStorage.getItem(LAST_ROLE_KEY);
  if (!raw) return null;
  const [id, role] = raw.split(':');
  if (id !== businessId) return null;
  if (role === 'owner' || role === 'manager' || role === 'kitchen' || role === 'cashier') {
    return role;
  }
  return null;
}

async function writeSoftUnlock(session: StaffSession): Promise<void> {
  await AsyncStorage.setItem(
    SOFT_UNLOCK_KEY,
    JSON.stringify({
      businessId: session.businessId,
      memberId: session.memberId,
      role: session.role,
      name: session.name,
      until: Date.now() + SOFT_UNLOCK_MS,
    })
  );
}

export async function clearSoftUnlock(): Promise<void> {
  await AsyncStorage.removeItem(SOFT_UNLOCK_KEY);
}

/** Sessão recente ainda válida — reabre o painel sem pedir PIN de novo. */
export async function trySoftUnlock(
  businessId: string
): Promise<StaffSession | null> {
  const raw = await AsyncStorage.getItem(SOFT_UNLOCK_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      businessId: string;
      memberId: string;
      role: StaffRole;
      name: string;
      until: number;
    };
    if (data.businessId !== businessId) return null;
    if (!data.until || Date.now() > data.until) {
      await clearSoftUnlock();
      return null;
    }
    const session: StaffSession = {
      businessId: data.businessId,
      memberId: data.memberId,
      role: data.role,
      name: data.name,
    };
    await setStaffSession(session);
    await AsyncStorage.setItem(
      ROLE_GATE_KEY,
      `${session.businessId}:${session.memberId}:${session.role}`
    );
    return session;
  } catch {
    return null;
  }
}

export async function isRoleGateValid(
  businessId: string,
  session: StaffSession | null
): Promise<boolean> {
  if (!session || session.businessId !== businessId) return false;
  const raw = await AsyncStorage.getItem(ROLE_GATE_KEY);
  return raw === `${businessId}:${session.memberId}:${session.role}`;
}

/** Membros ativos da função (para o gate). */
export async function listActiveByRole(
  businessId: string,
  role: StaffRole
): Promise<StaffMember[]> {
  const list = await listStaff(businessId);
  return list.filter((m) => m.active && m.role === role);
}

/**
 * Abre o painel da função com o PIN pessoal do operador (sem PIN universal).
 */
export async function authenticateOperatorByPin(opts: {
  businessId: string;
  role: StaffRole;
  pin: string;
  ownerName?: string;
  ownerEmail?: string;
}): Promise<
  | { ok: true; session: StaffSession; member: StaffMember }
  | { ok: false; error: string }
> {
  const pin = normalizePin(opts.pin);
  if (!isValidPin(pin)) {
    return { ok: false, error: 'PIN inválido.' };
  }

  if (opts.role === 'owner') {
    return {
      ok: false,
      error:
        'O painel do dono só abre com o e-mail da compra. Use o card Dono no sistema avançado.',
    };
  }

  const candidates = await listActiveByRole(opts.businessId, opts.role);
  if (!candidates.length) {
    return { ok: false, error: 'Nenhum operador cadastrado nesta função. Peça acesso ao dono.' };
  }

  const found = candidates.find((m) => m.pin && normalizePin(m.pin) === pin);
  if (!found) {
    return { ok: false, error: 'PIN inválido.' };
  }

  const session: StaffSession = {
    businessId: opts.businessId,
    memberId: found.id,
    role: found.role,
    name: found.name,
  };
  await setStaffSession(session);
  await writeRoleGate(session);
  return { ok: true, session, member: found };
}

/** Stub local para abrir painel de uma função ainda sem funcionário cadastrado. */
async function ensureRoleStub(
  businessId: string,
  role: Exclude<StaffRole, 'owner'>
): Promise<StaffMember> {
  const list = await loadMembers();
  const existing = list.find((m) => m.businessId === businessId && m.role === role && m.active);
  if (existing) return existing;

  const member: StaffMember = {
    id: `staff_stub_${role}_${businessId}`.slice(0, 48),
    businessId,
    name: `Operador ${STAFF_ROLE_LABEL[role]}`,
    email: `${role}.${businessId.replace(/\W/g, '')}@painel.local`.toLowerCase(),
    role,
    password: newStaffPin(),
    pin: newStaffPin(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  await saveMembers([member, ...list]);
  return member;
}

/** Define PIN sem checar conflito — usado só para migrar para o PIN fixo. */
async function setMemberPinAllowFixed(
  businessId: string,
  memberId: string,
  pin: string
): Promise<void> {
  const normalized = normalizePin(pin);
  const list = await loadMembers();
  await saveMembers(
    list.map((m) =>
      m.id === memberId && m.businessId === businessId ? { ...m, pin: normalized } : m
    )
  );
}

/** Define ou troca o PIN de um membro (dono/gerente ou o próprio dono no 1º acesso). */
export async function setMemberPin(
  businessId: string,
  memberId: string,
  pin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizePin(pin);
  if (!isValidPin(normalized)) {
    return { ok: false, error: 'PIN deve ter 4 dígitos.' };
  }
  const list = await loadMembers();
  const target = list.find((m) => m.id === memberId && m.businessId === businessId);
  if (!target || !target.active) {
    return { ok: false, error: 'Membro não encontrado.' };
  }
  await saveMembers(
    list.map((m) => (m.id === memberId ? { ...m, pin: normalized } : m))
  );
  return { ok: true };
}

/**
 * Primeiro acesso do dono: garante membro owner e abre com PIN.
 * Exige actorEmail = e-mail da compra.
 */
export async function setupOwnerPinAndEnter(opts: {
  businessId: string;
  ownerName: string;
  ownerEmail: string;
  actorEmail?: string | null;
  pin: string;
}): Promise<
  | { ok: true; session: StaffSession }
  | { ok: false; error: string }
> {
  const res = await ownerEnterWithPin({
    businessId: opts.businessId,
    ownerName: opts.ownerName,
    ownerEmail: opts.ownerEmail,
    actorEmail: opts.actorEmail ?? opts.ownerEmail,
    pin: opts.pin,
  });
  if (!res.ok) return res;
  return { ok: true, session: res.session };
}

/** Isolamento duro: rota do painel de outro papel → redireciona. */
export function staffPanelRoleFromPath(pathname?: string | null): StaffRole | null {
  const path = pathname || '';
  if (path.includes('/staff/owner')) return 'owner';
  if (path.includes('/staff/manager')) return 'manager';
  if (path.includes('/staff/kitchen')) return 'kitchen';
  if (path.includes('/staff/cashier')) return 'cashier';
  return null;
}

/** Permissão de rota compartilhada (/menu, /wallet…). */
export function staffCanAccessPath(role: StaffRole, pathname?: string | null): boolean {
  const path = pathname || '';
  if (
    path.includes('/staff/login') ||
    path.includes('/staff/register') ||
    path.includes('/staff/request-access') ||
    path.includes('/staff/forgot') ||
    path.includes('/team/join') ||
    path.includes('/advanced')
  ) {
    return true;
  }
  // Gate de entrada / hub
  if (path === '/merchant' || path.endsWith('/merchant')) return true;

  const panelRole = staffPanelRoleFromPath(path);
  if (panelRole) {
    // Dono (e-mail da compra) pode inspecionar qualquer painel.
    // Funcionário só o da função designada.
    if (role === 'owner') return true;
    return panelRole === role;
  }

  if (path.includes('/punches') || path.includes('/audit')) {
    return role === 'owner' || role === 'manager';
  }
  if (path.includes('/wallet/withdraw')) return staffCan(role, 'withdraw');
  if (path.includes('/wallet')) return staffCan(role, 'wallet');
  if (path.includes('/menu')) return staffCan(role, 'menu');
  if (path.includes('/promos')) return staffCan(role, 'promos');
  if (path.includes('/settings')) return staffCan(role, 'settings');
  if (path.includes('/team')) return staffCan(role, 'team');
  if (path.includes('/stores')) return staffCan(role, 'stores');
  if (path.includes('/insights')) return staffCan(role, 'insights');
  if (path.includes('/sync')) return staffCan(role, 'sync');
  if (path.includes('/pickup')) return staffCan(role, 'pickup');
  if (path.includes('/chat')) return staffCan(role, 'chat');
  if (path.includes('/orders') || path.includes('/order')) return staffCan(role, 'orders');
  return staffCan(role, 'orders');
}

/** @deprecated use authenticateOperatorByPin — mantido só por compat. */
export async function pickOperatorRole(opts: {
  businessId: string;
  role: StaffRole;
  displayName: string;
}): Promise<StaffSession> {
  const members = await listStaff(opts.businessId);
  const match = members.find((m) => m.active && m.role === opts.role && m.pin);
  if (!match) {
    throw new Error('PIN obrigatório: cadastre o operador da função em Equipe.');
  }
  const session: StaffSession = {
    businessId: opts.businessId,
    memberId: match.id,
    role: match.role,
    name: match.name,
  };
  await setStaffSession(session);
  await writeRoleGate(session);
  return session;
}

async function loadMembers(): Promise<StaffMember[]> {
  try {
    const raw = await AsyncStorage.getItem(MEMBERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMembers(list: StaffMember[]) {
  await AsyncStorage.setItem(MEMBERS_KEY, JSON.stringify(list));
}

async function loadInvites(): Promise<StaffInvite[]> {
  try {
    const raw = await AsyncStorage.getItem(INVITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveInvites(list: StaffInvite[]) {
  await AsyncStorage.setItem(INVITES_KEY, JSON.stringify(list));
}

/** Garante o dono na equipe — só pelo e-mail da compra (sem fallback). */
export async function ensureOwnerMember(opts: {
  businessId: string;
  name: string;
  email: string;
}): Promise<StaffMember> {
  const list = await loadMembers();
  const email = opts.email.trim().toLowerCase();
  if (!email) {
    throw new Error('E-mail do dono é obrigatório.');
  }

  const existing = list.find(
    (m) =>
      m.businessId === opts.businessId &&
      m.role === 'owner' &&
      m.email.trim().toLowerCase() === email
  );

  if (existing) {
    if (!existing.pin || !isValidPin(existing.pin)) {
      const next = {
        ...existing,
        active: true,
      };
      await saveMembers(list.map((m) => (m.id === existing.id ? next : m)));
      return next;
    }
    if (!existing.active) {
      const next = { ...existing, active: true };
      await saveMembers(list.map((m) => (m.id === existing.id ? next : m)));
      return next;
    }
    return existing;
  }

  // Desativa outros "owners" órfãos desta loja (migração).
  const cleaned = list.map((m) =>
    m.businessId === opts.businessId && m.role === 'owner' && m.email.trim().toLowerCase() !== email
      ? { ...m, active: false }
      : m
  );

  const owner: StaffMember = {
    id: `staff_${Date.now()}_owner`,
    businessId: opts.businessId,
    name: opts.name.trim() || 'Dono',
    email,
    role: 'owner',
    pin: '',
    password: '',
    active: true,
    createdAt: new Date().toISOString(),
  };
  await saveMembers([owner, ...cleaned]);
  return owner;
}

/** Entra no painel do dono com PIN — exige e-mail da compra. */
export async function ownerEnterWithPin(opts: {
  businessId: string;
  ownerName: string;
  ownerEmail: string;
  /** E-mail logado no app (deve ser o da compra). */
  actorEmail?: string | null;
  pin: string;
}): Promise<{ ok: true; session: StaffSession; member: StaffMember } | { ok: false; error: string }> {
  if (!isApplicationOwnerEmail(opts.actorEmail, opts.ownerEmail)) {
    return {
      ok: false,
      error:
        'Só o e-mail cadastrado na compra da loja pode abrir o painel do dono. Funcionários usam o cadastro da equipe e o painel da função.',
    };
  }

  let owner = await ensureOwnerMember({
    businessId: opts.businessId,
    name: opts.ownerName,
    email: opts.ownerEmail,
  });
  const pin = normalizePin(opts.pin);
  if (owner.pin && isValidPin(owner.pin)) {
    if (!isValidPin(pin) || owner.pin !== pin) {
      return { ok: false, error: 'PIN inválido.' };
    }
  }

  const session = await createTimedStaffSession({
    businessId: opts.businessId,
    memberId: owner.id,
    role: 'owner',
    name: owner.name,
    email: owner.email,
  });
  await writeRoleGate(session);
  try {
    const { logMerchantAudit } = await import('@/utils/merchantAudit');
    await logMerchantAudit({
      businessId: opts.businessId,
      actorId: owner.id,
      actorName: owner.name,
      actorRole: 'owner',
      action: 'owner_enter',
      detail: 'Entrou no painel do dono',
    });
  } catch {
    /* ignore */
  }
  return { ok: true, session, member: owner };
}

export async function listStaff(businessId: string): Promise<StaffMember[]> {
  const list = await loadMembers();
  return list
    .filter((m) => m.businessId === businessId)
    .sort((a, b) => {
      const rank = (r: StaffRole) =>
        r === 'owner' ? 0 : r === 'manager' ? 1 : r === 'kitchen' ? 2 : 3;
      return rank(a.role) - rank(b.role) || a.name.localeCompare(b.name);
    });
}

export async function createStaffInvite(opts: {
  businessId: string;
  role: Exclude<StaffRole, 'owner'>;
}): Promise<StaffInvite> {
  const code = `EQ${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = Date.now();
  const invite: StaffInvite = {
    code,
    businessId: opts.businessId,
    role: opts.role,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 7 * 24 * 3600_000).toISOString(),
  };
  const list = await loadInvites();
  await saveInvites([invite, ...list.filter((i) => !i.usedAt).slice(0, 40)]);
  return invite;
}

export async function listOpenInvites(businessId: string): Promise<StaffInvite[]> {
  const now = Date.now();
  const list = await loadInvites();
  return list.filter(
    (i) =>
      i.businessId === businessId &&
      !i.usedAt &&
      +new Date(i.expiresAt) > now
  );
}

export async function redeemStaffInvite(opts: {
  code: string;
  name: string;
  email: string;
  password: string;
  pin?: string;
}): Promise<{ ok: true; member: StaffMember } | { ok: false; error: string }> {
  const code = opts.code.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Informe o código do convite.' };
  const invites = await loadInvites();
  const invite = invites.find((i) => i.code === code && !i.usedAt);
  if (!invite) return { ok: false, error: 'Convite inválido ou já usado.' };
  if (+new Date(invite.expiresAt) < Date.now()) {
    return { ok: false, error: 'Convite expirado. Peça um novo ao dono.' };
  }
  const name = opts.name.trim();
  const email = opts.email.trim().toLowerCase();
  const password = opts.password.trim();
  const pin = normalizePin(opts.pin || '') || newStaffPin();
  if (!name || !email) return { ok: false, error: 'Nome e e-mail são obrigatórios.' };
  if (password.length < 4) {
    return { ok: false, error: 'Senha com no mínimo 4 caracteres.' };
  }

  const members = await loadMembers();
  if (
    members.some(
      (m) =>
        m.businessId === invite.businessId &&
        m.email === email &&
        m.active
    )
  ) {
    return { ok: false, error: 'Este e-mail já está na equipe desta loja.' };
  }

  const member: StaffMember = {
    id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    businessId: invite.businessId,
    name,
    email,
    role: invite.role,
    password,
    pin,
    active: true,
    createdAt: new Date().toISOString(),
  };

  await saveMembers([member, ...members]);
  await saveInvites(
    invites.map((i) =>
      i.code === code ? { ...i, usedAt: new Date().toISOString() } : i
    )
  );
  const session = {
    businessId: member.businessId,
    memberId: member.id,
    role: member.role,
    name: member.name,
  };
  await setStaffSession(session);
  await writeRoleGate(session);
  return { ok: true, member };
}

/** Dono/gerente cadastra funcionário com PIN pessoal único. */
export async function createStaffAccount(opts: {
  businessId: string;
  name: string;
  email: string;
  password: string;
  role: Exclude<StaffRole, 'owner'>;
  pin?: string;
}): Promise<{ ok: true; member: StaffMember } | { ok: false; error: string }> {
  const name = opts.name.trim();
  const email = opts.email.trim().toLowerCase();
  const password = opts.password.trim();
  if (!name || !email) return { ok: false, error: 'Nome e e-mail são obrigatórios.' };
  if (password.length < 4) {
    return { ok: false, error: 'Senha com no mínimo 4 caracteres.' };
  }

  let pin = opts.pin ? normalizePin(opts.pin) : '';
  if (pin && !isValidPin(pin)) {
    return { ok: false, error: 'PIN deve ter 4 dígitos.' };
  }
  if (!pin) pin = await generateUniqueStaffPin(opts.businessId);

  const members = await loadMembers();
  if (
    members.some(
      (m) => m.businessId === opts.businessId && m.email === email && m.active
    )
  ) {
    return { ok: false, error: 'Este e-mail já está na equipe desta loja.' };
  }

  const member: StaffMember = {
    id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    businessId: opts.businessId,
    name,
    email,
    role: opts.role,
    password,
    pin,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await saveMembers([member, ...members]);

  try {
    const { logMerchantAudit } = await import('@/utils/merchantAudit');
    await logMerchantAudit({
      businessId: opts.businessId,
      actorName: 'Dono/Gerente',
      actorRole: 'owner',
      action: 'create_staff',
      detail: `Cadastrou ${name} como ${STAFF_ROLE_LABEL[opts.role]} (PIN ${pin})`,
    });
  } catch {
    /* audit opcional */
  }

  return { ok: true, member };
}

/** Login do funcionário por e-mail + senha (ou PIN da loja). */
export async function loginStaff(opts: {
  email: string;
  password: string;
  businessId?: string;
}): Promise<{ ok: true; member: StaffMember } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase();
  const secret = opts.password.trim();
  if (!email || !secret) {
    return { ok: false, error: 'Informe e-mail e senha (ou PIN).' };
  }

  const members = await loadMembers();
  const candidates = members.filter(
    (m) =>
      m.active &&
      m.email === email &&
      (!opts.businessId || m.businessId === opts.businessId)
  );

  if (!candidates.length) {
    return {
      ok: false,
      error: 'Conta não encontrada. Peça ao dono para cadastrar você em Equipe, ou envie um pedido de acesso.',
    };
  }

  const byPassword = candidates.find((m) => m.password && m.password === secret);
  const byPin = candidates.find((m) => m.pin && m.pin === secret);
  const found = byPassword || byPin;
  if (!found) {
    return { ok: false, error: 'Senha ou PIN incorreto.' };
  }

  await setStaffSession({
    businessId: found.businessId,
    memberId: found.id,
    role: found.role,
    name: found.name,
  });
  await writeRoleGate({
    businessId: found.businessId,
    memberId: found.id,
    role: found.role,
    name: found.name,
  });
  return { ok: true, member: found };
}

export async function logoutStaff(): Promise<void> {
  await setStaffSession(null);
  await clearRoleGate();
  await clearSoftUnlock();
}

export async function findStaffByEmail(email: string): Promise<StaffMember[]> {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  const members = await loadMembers();
  return members.filter(
    (m) => m.active && m.email.trim().toLowerCase() === needle && m.role !== 'owner'
  );
}

export async function deactivateStaffMember(
  businessId: string,
  memberId: string
): Promise<void> {
  const list = await loadMembers();
  const target = list.find((m) => m.id === memberId && m.businessId === businessId);
  if (!target || target.role === 'owner') return;
  await saveMembers(
    list.map((m) =>
      m.id === memberId ? { ...m, active: false } : m
    )
  );
}

export async function reactivateStaffMember(
  businessId: string,
  memberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const list = await loadMembers();
  const target = list.find((m) => m.id === memberId && m.businessId === businessId);
  if (!target) return { ok: false, error: 'Membro não encontrado.' };
  if (target.role === 'owner') return { ok: false, error: 'Dono já está ativo.' };
  await saveMembers(
    list.map((m) => (m.id === memberId ? { ...m, active: true } : m))
  );
  return { ok: true };
}

export async function updateStaffRole(
  businessId: string,
  memberId: string,
  role: Exclude<StaffRole, 'owner'>
): Promise<void> {
  const list = await loadMembers();
  await saveMembers(
    list.map((m) =>
      m.id === memberId && m.businessId === businessId && m.role !== 'owner'
        ? { ...m, role }
        : m
    )
  );
}

export async function setStaffSession(session: StaffSession | null) {
  if (!session) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function getStaffSession(): Promise<StaffSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
}

export function isStaffSessionExpired(session: StaffSession | null | undefined): boolean {
  if (!session?.expiresAt) return false;
  return Date.now() > +new Date(session.expiresAt);
}

/** Sessão ativa e ainda dentro do prazo; se expirou, limpa. */
export async function getValidStaffSession(): Promise<StaffSession | null> {
  const sess = await getStaffSession();
  if (!sess) return null;
  if (isStaffSessionExpired(sess)) {
    await setStaffSession(null);
    await clearRoleGate();
    await clearSoftUnlock();
    return null;
  }
  return sess;
}

/** Cria sessão com validade (modo simples/avançado define as horas). */
export async function createTimedStaffSession(input: {
  businessId: string;
  memberId: string;
  role: StaffRole;
  name: string;
  punchId?: string;
  email?: string;
}): Promise<StaffSession> {
  const { getSessionHours } = await import('@/utils/merchantOpsMode');
  const hours = await getSessionHours();
  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
  const session: StaffSession = {
    businessId: input.businessId,
    memberId: input.memberId,
    role: input.role,
    name: input.name,
    startedAt,
    expiresAt,
    punchId: input.punchId,
    email: input.email?.trim().toLowerCase(),
  };
  await setStaffSession(session);
  return session;
}

/** Gera um PIN de 4 dígitos (pode repetir entre funcionários). */
export async function generateUniqueStaffPin(_businessId?: string): Promise<string> {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Sessão ativa da loja — NÃO promove automaticamente a dono.
 * Equipe/dono precisam ter entrado pelo gate correto.
 */
export async function resolveStaffSession(opts: {
  businessId: string;
  ownerName: string;
  ownerEmail: string;
}): Promise<StaffSession | null> {
  await ensureOwnerMember({
    businessId: opts.businessId,
    name: opts.ownerName,
    email: opts.ownerEmail,
  });
  const current = await getValidStaffSession();
  if (!current || current.businessId !== opts.businessId) return null;

  const members = await listStaff(opts.businessId);
  const still = members.find((m) => m.id === current.memberId && m.active);
  if (!still) return null;

  return {
    businessId: opts.businessId,
    memberId: still.id,
    role: still.role,
    name: still.name,
    startedAt: current.startedAt,
    expiresAt: current.expiresAt,
    punchId: current.punchId,
    email: still.email || current.email,
  };
}

export async function switchStaffByPin(
  businessId: string,
  pin: string
): Promise<StaffSession | null> {
  const members = await listStaff(businessId);
  const found = members.find(
    (m) => m.active && m.pin && m.pin === normalizePin(pin)
  );
  if (!found) return null;
  const session: StaffSession = {
    businessId,
    memberId: found.id,
    role: found.role,
    name: found.name,
  };
  await setStaffSession(session);
  await writeRoleGate(session);
  return session;
}

// ─── Pedidos de acesso (aprovação do dono) ───────────────────────────────────

export type StaffAccessRequestStatus = 'pending' | 'approved' | 'rejected';

export type StaffAccessRequest = {
  id: string;
  businessId: string;
  shopName: string;
  name: string;
  email: string;
  password: string;
  pin: string;
  role: Exclude<StaffRole, 'owner'>;
  status: StaffAccessRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

const ACCESS_REQUESTS_KEY = '@pecaja_merchant_access_requests_v1';

async function loadAccessRequests(): Promise<StaffAccessRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCESS_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAccessRequests(list: StaffAccessRequest[]) {
  await AsyncStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(list));
}

/** Funcionário pede acesso — o dono libera pelo e-mail em Equipe. */
export async function requestStaffAccess(opts: {
  businessId: string;
  shopName: string;
  name: string;
  email: string;
  password: string;
  pin?: string;
  role: Exclude<StaffRole, 'owner'>;
}): Promise<{ ok: true; request: StaffAccessRequest } | { ok: false; error: string }> {
  const name = opts.name.trim();
  const email = opts.email.trim().toLowerCase();
  const password = opts.password.trim();
  const pin = normalizePin(opts.pin || '') || newStaffPin();
  if (!name || !email) return { ok: false, error: 'Nome e e-mail são obrigatórios.' };
  if (password.length < 4) return { ok: false, error: 'Senha com no mínimo 4 caracteres.' };
  if (!email.includes('@')) return { ok: false, error: 'Informe um e-mail válido.' };

  const members = await listStaff(opts.businessId);
  if (members.some((m) => m.active && m.email === email)) {
    return { ok: false, error: 'Este e-mail já faz parte da equipe desta loja.' };
  }

  const list = await loadAccessRequests();
  if (
    list.some(
      (r) =>
        r.status === 'pending' &&
        r.businessId === opts.businessId &&
        r.email === email
    )
  ) {
    return { ok: false, error: 'Já existe um pedido pendente com este e-mail nesta loja.' };
  }

  const request: StaffAccessRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    businessId: opts.businessId,
    shopName: opts.shopName.trim() || 'Loja',
    name,
    email,
    password,
    pin,
    role: opts.role,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await saveAccessRequests([request, ...list].slice(0, 200));
  return { ok: true, request };
}

export async function listPendingAccessRequests(
  businessId: string
): Promise<StaffAccessRequest[]> {
  const list = await loadAccessRequests();
  return list
    .filter((r) => r.businessId === businessId && r.status === 'pending')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function countPendingAccessRequests(businessId: string): Promise<number> {
  const list = await listPendingAccessRequests(businessId);
  return list.length;
}

/** Dono/gerente aprova → libera o e-mail do funcionário no painel do cargo. */
export async function approveAccessRequest(
  requestId: string,
  reviewerName: string
): Promise<{ ok: true; member: StaffMember } | { ok: false; error: string }> {
  const list = await loadAccessRequests();
  const req = list.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') {
    return { ok: false, error: 'Pedido não encontrado ou já analisado.' };
  }

  const created = await createStaffAccount({
    businessId: req.businessId,
    name: req.name,
    email: req.email,
    password: req.password,
    role: req.role,
    pin: req.pin || newStaffPin(),
  });
  if (!created.ok) return created;

  await saveAccessRequests(
    list.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'approved' as const,
            reviewedAt: new Date().toISOString(),
            reviewedBy: reviewerName,
          }
        : r
    )
  );
  try {
    const { logMerchantAudit } = await import('@/utils/merchantAudit');
    await logMerchantAudit({
      businessId: req.businessId,
      actorName: reviewerName,
      actorRole: 'owner',
      action: 'approve_access',
      detail: `Aceitou ${created.member.name} como ${STAFF_ROLE_LABEL[created.member.role]}`,
    });
  } catch {
    /* ignore */
  }
  return { ok: true, member: created.member };
}

export async function rejectAccessRequest(
  requestId: string,
  reviewerName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const list = await loadAccessRequests();
  const req = list.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') {
    return { ok: false, error: 'Pedido não encontrado ou já analisado.' };
  }
  await saveAccessRequests(
    list.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'rejected' as const,
            reviewedAt: new Date().toISOString(),
            reviewedBy: reviewerName,
          }
        : r
    )
  );
  return { ok: true };
}

// ─── Recuperação de e-mail / senha (MVP local) ───────────────────────────────

/** Recupera e-mails da equipe pelo nome (e opcionalmente loja). */
export async function recoverStaffEmails(opts: {
  name: string;
  businessId?: string;
}): Promise<
  | {
      ok: true;
      matches: { name: string; email: string; shopHint: string; role: StaffRole }[];
    }
  | { ok: false; error: string }
> {
  const name = opts.name.trim().toLowerCase();
  if (name.length < 2) {
    return { ok: false, error: 'Digite pelo menos 2 letras do seu nome.' };
  }
  const members = await loadMembers();
  const matches = members
    .filter(
      (m) =>
        m.active &&
        m.role !== 'owner' &&
        !m.email.includes('@painel.local') &&
        m.name.toLowerCase().includes(name) &&
        (!opts.businessId || m.businessId === opts.businessId)
    )
    .map((m) => ({
      name: m.name,
      email: m.email,
      shopHint: m.businessId,
      role: m.role,
    }));
  if (!matches.length) {
    return { ok: false, error: 'Nenhum e-mail encontrado com esse nome.' };
  }
  return { ok: true, matches };
}

/** Redefine senha com o e-mail + PIN fixo do painel (confirmação). */
export async function resetStaffPassword(opts: {
  email: string;
  newPassword: string;
  confirmPin: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase();
  const password = opts.newPassword.trim();
  const pin = normalizePin(opts.confirmPin);
  if (!email) return { ok: false, error: 'Informe o e-mail.' };
  if (password.length < 4) {
    return { ok: false, error: 'Nova senha com no mínimo 4 caracteres.' };
  }
  const members = await loadMembers();
  const targets = members.filter((m) => m.active && m.email === email);
  if (!targets.length) {
    return { ok: false, error: 'E-mail não encontrado na equipe.' };
  }
  const match = targets.find((m) => m.pin && normalizePin(m.pin) === pin);
  if (!match) {
    return { ok: false, error: 'PIN inválido.' };
  }

  await saveMembers(
    members.map((m) =>
      m.id === match.id ? { ...m, password } : m
    )
  );
  return { ok: true };
}
