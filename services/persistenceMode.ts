/**
 * Modo de persistência na migração JSONB → relacional (F0+).
 * Default: jsonb (comportamento atual). Flags REL_* ligam fatias no hybrid.
 *
 * Env (só nomes — valores no painel/.env, nunca no git):
 *   PERSISTENCE_MODE=jsonb|hybrid|relational
 *   REL_USERS / REL_SHOPS / REL_ORDERS / REL_FLEET / REL_LEDGER / REL_HQ = 0|1
 */

export type PersistenceMode = 'jsonb' | 'hybrid' | 'relational';

export type RelDomain = 'users' | 'shops' | 'orders' | 'fleet' | 'ledger' | 'hq';

function envFlagOn(name: string): boolean {
  const v = (process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function getPersistenceMode(): PersistenceMode {
  const raw = (process.env.PERSISTENCE_MODE || 'jsonb').trim().toLowerCase();
  if (raw === 'hybrid' || raw === 'relational') return raw;
  return 'jsonb';
}

/** Domínio relacional ativo (leitura/escrita conforme a fase). Em `relational`, tudo on. */
export function isRelDomainEnabled(domain: RelDomain): boolean {
  const mode = getPersistenceMode();
  if (mode === 'jsonb') return false;
  if (mode === 'relational') return true;
  const key = `REL_${domain.toUpperCase()}` as const;
  return envFlagOn(key);
}

/** Dual-write: hybrid com domínio ligado, ou transitional até cutover. */
export function shouldDualWrite(domain: RelDomain): boolean {
  return getPersistenceMode() === 'hybrid' && isRelDomainEnabled(domain);
}

export function persistenceModeSummary(): {
  mode: PersistenceMode;
  domains: Record<RelDomain, boolean>;
} {
  const domains: RelDomain[] = ['users', 'shops', 'orders', 'fleet', 'ledger', 'hq'];
  return {
    mode: getPersistenceMode(),
    domains: Object.fromEntries(domains.map((d) => [d, isRelDomainEnabled(d)])) as Record<
      RelDomain,
      boolean
    >,
  };
}
