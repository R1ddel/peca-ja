/**
 * Persistência da frota.
 * - Com FLEET_DATABASE_URL / DATABASE_URL → Postgres (produção)
 * - Sem URL → .data/fleet/state.json (dev / Expo host)
 */
import { promises as fs } from 'fs';
import path from 'path';
import type { Order } from '@/types';
import type { FleetState } from '@/services/fleetTypes';
import {
  isFleetPostgresEnabled,
  loadFleetStatePg,
  saveFleetStatePg,
  withFleetTransactionPg,
  markFleetFilesystemFallback,
} from '@/services/fleetDb';
import { mergeOrdersPreferNewer } from '@/utils/orderMerge';

export type { FleetDriverPresence, FleetState } from '@/services/fleetTypes';

const memory: { state: FleetState | null } = { state: null };
let writeChain: Promise<void> = Promise.resolve();

function dataDir(): string {
  return path.join(process.cwd(), '.data', 'fleet');
}

function stateFile(): string {
  return path.join(dataDir(), 'state.json');
}

function emptyState(): FleetState {
  return {
    revision: 0,
    updatedAt: new Date().toISOString(),
    orders: [],
    drivers: {},
    reports: [],
  };
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function loadFleetStateFs(): Promise<FleetState> {
  if (memory.state) return memory.state;
  try {
    const raw = await fs.readFile(stateFile(), 'utf8');
    const parsed = JSON.parse(raw) as FleetState;
    if (parsed && Array.isArray(parsed.orders)) {
      memory.state = {
        revision: parsed.revision || 0,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        orders: parsed.orders,
        drivers:
          parsed.drivers && typeof parsed.drivers === 'object'
            ? parsed.drivers
            : {},
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      };
      return memory.state;
    }
  } catch {
    /* missing */
  }
  memory.state = emptyState();
  return memory.state;
}

async function persistFs(state: FleetState): Promise<void> {
  memory.state = state;
  try {
    await ensureDir();
    await fs.writeFile(stateFile(), JSON.stringify(state), 'utf8');
  } catch (err) {
    console.warn('[fleet] fs write failed, memory only', err);
  }
}

export async function loadFleetState(): Promise<FleetState> {
  if (isFleetPostgresEnabled()) {
    try {
      return await loadFleetStatePg();
    } catch (err) {
      markFleetFilesystemFallback(err);
      return loadFleetStateFs();
    }
  }
  return loadFleetStateFs();
}

/** Serializa writes (FS) ou SELECT FOR UPDATE (Postgres). */
export function withFleetLock<T>(
  fn: (state: FleetState) => Promise<T> | T
): Promise<T> {
  if (isFleetPostgresEnabled()) {
    return withFleetTransactionPg(async ({ state }) => fn(state)).catch(
      async (err) => {
        markFleetFilesystemFallback(err);
        const state = await loadFleetStateFs();
        return fn(state);
      }
    );
  }

  const run = writeChain.then(async () => {
    const state = await loadFleetStateFs();
    return fn(state);
  });
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function saveFleetState(state: FleetState): Promise<FleetState> {
  let saved: FleetState;
  if (isFleetPostgresEnabled()) {
    try {
      saved = await saveFleetStatePg(state);
      const { dualWriteFleetSafe } = await import('@/services/relFleetStore');
      await dualWriteFleetSafe(saved);
      return saved;
    } catch (err) {
      markFleetFilesystemFallback(err);
    }
  }
  saved = {
    ...state,
    revision: (state.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  await persistFs(saved);
  const { dualWriteFleetSafe } = await import('@/services/relFleetStore');
  await dualWriteFleetSafe(saved);
  return saved;
}

export function mergeOrdersByUpdatedAt(
  current: Order[],
  incoming: Order[]
): Order[] {
  return mergeOrdersPreferNewer(current, incoming);
}

/** Limita histórico antigo para não explodir o payload. */
export function pruneFleetOrders(orders: Order[], keepDays = 14): Order[] {
  const cutoff = Date.now() - keepDays * 86_400_000;
  return orders.filter((o) => {
    if (o.status !== 'entregue' && o.status !== 'cancelado') return true;
    const t = +new Date(o.updatedAt || o.deliveryVerifiedAt || o.createdAt);
    return t >= cutoff;
  });
}

export function fleetPersistenceMode(): 'postgres' | 'filesystem' {
  return isFleetPostgresEnabled() ? 'postgres' : 'filesystem';
}
