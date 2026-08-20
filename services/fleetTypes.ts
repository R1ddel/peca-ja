/**
 * Tipos da frota compartilhada (seguros para cliente e servidor).
 */
import type { ConductReport, Order } from '@/types';

export type FleetDriverPresence = {
  fleetId: string;
  applicationId: string;
  name: string;
  phone: string;
  online: boolean;
  lastSeenAt: string;
  lastOfferAt?: number;
  latitude?: number;
  longitude?: number;
  heading?: number;
  blocked?: boolean;
  blockedReason?: string;
  blockedAt?: string;
  /** Token de sessão do entregador (não expor a outros clients). */
  sessionToken?: string;
};

export type FleetState = {
  revision: number;
  updatedAt: string;
  orders: Order[];
  drivers: Record<string, FleetDriverPresence>;
  reports: ConductReport[];
};
