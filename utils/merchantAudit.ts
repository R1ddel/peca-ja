/**
 * Auditoria local do painel (AsyncStorage) — quem fez o quê.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffRole } from '@/utils/merchantTeam';

export type AuditAction =
  | 'punch_in'
  | 'punch_out'
  | 'login'
  | 'approve_access'
  | 'reject_access'
  | 'create_staff'
  | 'switch_store'
  | 'session_expired'
  | 'denied_route'
  | 'owner_enter';

export type MerchantAuditEntry = {
  id: string;
  businessId: string;
  actorId?: string;
  actorName: string;
  actorRole?: StaffRole | 'system';
  action: AuditAction;
  detail: string;
  createdAt: string;
};

const KEY = '@pecaja_merchant_audit_v1';

async function loadAll(): Promise<MerchantAuditEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MerchantAuditEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(list: MerchantAuditEntry[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 600)));
}

export async function logMerchantAudit(input: {
  businessId: string;
  actorId?: string;
  actorName: string;
  actorRole?: StaffRole | 'system';
  action: AuditAction;
  detail: string;
}): Promise<MerchantAuditEntry> {
  const entry: MerchantAuditEntry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    businessId: input.businessId,
    actorId: input.actorId,
    actorName: input.actorName.trim() || 'Sistema',
    actorRole: input.actorRole ?? 'system',
    action: input.action,
    detail: input.detail,
    createdAt: new Date().toISOString(),
  };
  const all = await loadAll();
  await saveAll([entry, ...all]);
  return entry;
}

export async function listMerchantAudit(
  businessId: string,
  limit = 80
): Promise<MerchantAuditEntry[]> {
  const all = await loadAll();
  return all
    .filter((e) => e.businessId === businessId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, limit);
}

export function auditActionLabel(action: AuditAction): string {
  switch (action) {
    case 'punch_in':
      return 'Entrada';
    case 'punch_out':
      return 'Saída';
    case 'login':
      return 'Login';
    case 'approve_access':
      return 'Aceitou membro';
    case 'reject_access':
      return 'Recusou membro';
    case 'create_staff':
      return 'Cadastrou equipe';
    case 'switch_store':
      return 'Trocou loja';
    case 'session_expired':
      return 'Sessão expirou';
    case 'denied_route':
      return 'Acesso negado';
    case 'owner_enter':
      return 'Dono entrou';
    default:
      return action;
  }
}
