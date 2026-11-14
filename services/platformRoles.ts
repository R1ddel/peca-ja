/**
 * RBAC do Peça Já Command Center.
 * ceo/ops mantidos por compatibilidade (ceo = super, ops = operations).
 */
import type { PlatformUser } from '@/services/platformTypes';

export type PlatformRole =
  | 'ceo'
  | 'ops'
  | 'admin'
  | 'finance'
  | 'support'
  | 'commercial'
  | 'marketing'
  | 'operations'
  | 'auditor';

export type PlatformPermission =
  | 'view'
  | 'create'
  | 'edit'
  | 'block'
  | 'export'
  | 'financial'
  | 'audit'
  | 'team'
  | 'config'
  | 'flags'
  | 'marketing_manage'
  | 'crm';

const ALL_PERMS: PlatformPermission[] = [
  'view',
  'create',
  'edit',
  'block',
  'export',
  'financial',
  'audit',
  'team',
  'config',
  'flags',
  'marketing_manage',
  'crm',
];

const ROLE_PERMS: Record<PlatformRole, PlatformPermission[]> = {
  ceo: ALL_PERMS,
  admin: ALL_PERMS.filter((p) => p !== 'team'),
  ops: ['view', 'edit', 'block', 'export', 'crm'],
  operations: ['view', 'edit', 'block', 'export', 'crm'],
  finance: ['view', 'export', 'financial', 'audit'],
  support: ['view', 'edit', 'crm'],
  commercial: ['view', 'create', 'edit', 'crm', 'export'],
  marketing: ['view', 'create', 'edit', 'marketing_manage', 'export'],
  auditor: ['view', 'audit', 'export'],
};

export const STAFF_ROLES: PlatformRole[] = [
  'ceo',
  'ops',
  'admin',
  'finance',
  'support',
  'commercial',
  'marketing',
  'operations',
  'auditor',
];

export function parseCeoEmails(): string[] {
  const raw = process.env.PLATFORM_CEO_EMAILS?.trim() || '';
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isCeoEmail(email: string): boolean {
  const list = parseCeoEmails();
  if (list.length === 0) return false;
  return list.includes(String(email || '').trim().toLowerCase());
}

export function normalizeRole(
  role: PlatformRole | string | null | undefined
): PlatformRole | null {
  if (!role) return null;
  if (role === 'super_admin') return 'ceo';
  if ((STAFF_ROLES as string[]).includes(role)) return role as PlatformRole;
  return null;
}

export function staffRank(role: PlatformRole | null | undefined): number {
  const r = normalizeRole(role);
  if (r === 'ceo') return 100;
  if (r === 'admin') return 90;
  if (r === 'ops' || r === 'operations') return 50;
  if (r === 'finance') return 40;
  if (r === 'commercial') return 35;
  if (r === 'marketing') return 30;
  if (r === 'support') return 25;
  if (r === 'auditor') return 20;
  return 0;
}

/** Compat: min role por rank (ceo > ops). */
export function hasMinRole(
  role: PlatformRole | null | undefined,
  min: PlatformRole
): boolean {
  return staffRank(role) >= staffRank(min);
}

export function rolePermissions(role: PlatformRole | null | undefined): PlatformPermission[] {
  const r = normalizeRole(role);
  if (!r) return [];
  return ROLE_PERMS[r] || [];
}

export function hasPermission(
  role: PlatformRole | null | undefined,
  perm: PlatformPermission
): boolean {
  return rolePermissions(role).includes(perm);
}

export function applyCeoBootstrap(user: PlatformUser): PlatformUser {
  if (!isCeoEmail(user.email)) return user;
  if (user.platformRole === 'ceo') return user;
  return { ...user, platformRole: 'ceo' };
}

export function isStaffRole(role: PlatformRole | null | undefined): boolean {
  return staffRank(role) > 0;
}

export function roleLabel(role: PlatformRole | null | undefined): string {
  switch (normalizeRole(role)) {
    case 'ceo':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'ops':
    case 'operations':
      return 'Operações';
    case 'finance':
      return 'Financeiro';
    case 'support':
      return 'Suporte';
    case 'commercial':
      return 'Comercial';
    case 'marketing':
      return 'Marketing';
    case 'auditor':
      return 'Auditor';
    default:
      return 'Sem papel';
  }
}
