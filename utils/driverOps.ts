/**
 * Operação do entregador: online, identidade, filtros de corridas.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '@/types';
import { DriverApplication } from '@/utils/partners';

const ONLINE_KEY = '@pecaja_driver_online_v1';

/** ID estável no pedido — distinto da frota mock `driver_1`. */
export function driverFleetId(app: DriverApplication | { id: string }): string {
  return `da_${app.id}`;
}

/** Snapshot de perfil público para gravar no pedido no aceite. */
export function driverPublicProfile(app: {
  photoUrl?: string;
  bio?: string;
  notes?: string;
  vehicleType?: string;
  vehicle?: string;
}) {
  return {
    photoUrl: app.photoUrl?.trim() || undefined,
    bio: (app.bio || app.notes || '').trim() || undefined,
    vehicle: (app.vehicleType || app.vehicle || '').trim() || undefined,
  };
}

export function isMockFleetDriverId(driverId?: string | null): boolean {
  if (!driverId) return false;
  return /^driver_\d+$/i.test(driverId) || driverId.startsWith('driver_');
}

export function isAssignedToDriver(order: Order, fleetId: string): boolean {
  return !!order.driverId && order.driverId === fleetId;
}

/** Pedido livre para a fila do motoboy: cozinha já marcou pronto e ninguém aceitou. */
export function isJobAvailable(order: Order): boolean {
  if (order.deliveryBy === 'store') return false;
  if (!isKitchenReadyForPickup(order)) return false;
  if (!order.driverId || isMockFleetDriverId(order.driverId)) return true;
  return false;
}

/** Corridas prontas na cozinha (prioridade no board). */
export function isKitchenReadyForPickup(order: Order): boolean {
  return (
    order.status === 'preparando' &&
    !!order.kitchenReadyAt &&
    !order.pickupVerifiedAt
  );
}

export function listAvailableJobs(orders: Order[]): Order[] {
  return orders.filter(isJobAvailable).sort((a, b) => {
    return (
      +new Date(a.kitchenReadyAt || a.createdAt) - +new Date(b.kitchenReadyAt || b.createdAt)
    );
  });
}

export function listDriverActive(orders: Order[], fleetId: string): Order[] {
  return orders
    .filter(
      (o) =>
        isAssignedToDriver(o, fleetId) &&
        o.status !== 'cancelado' &&
        o.status !== 'entregue' &&
        o.status !== 'pendente'
    )
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function listDriverHistory(orders: Order[], fleetId: string): Order[] {
  return orders
    .filter(
      (o) =>
        isAssignedToDriver(o, fleetId) &&
        (o.status === 'entregue' || o.status === 'cancelado')
    )
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getDriverOnline(fleetId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ONLINE_KEY);
    if (!raw) return true;
    const map = JSON.parse(raw) as Record<string, boolean>;
    if (typeof map[fleetId] === 'boolean') return map[fleetId];
    return true;
  } catch {
    return true;
  }
}

export async function setDriverOnline(fleetId: string, online: boolean): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ONLINE_KEY);
    const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    map[fleetId] = online;
    await AsyncStorage.setItem(ONLINE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function driverEarningsOf(order: Order): number {
  const n = order.driverAmount ?? order.deliveryFee ?? 0;
  return Math.round(Math.max(0, n) * 100) / 100;
}

export function statusLabelPt(status: string): string {
  const map: Record<string, string> = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    preparando: 'Preparando',
    saiu_entrega: 'Em rota',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return map[status] || status;
}
