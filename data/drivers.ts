/**
 * Entregadores cadastrados no Peça Já (contas Mercado Pago conectadas ao Split).
 */
export type Driver = {
  id: string;
  name: string;
  phone: string;
  /**
   * Access Token OAuth do Mercado Pago do entregador.
   * Usado no Split Pix para creditar a taxa de entrega.
   */
  mpAccessToken: string;
  isAvailable: boolean;
};

/** Frota cadastrada — em produção viria do backend após OAuth do MP. */
export const DRIVERS: Driver[] = [
  {
    id: 'driver_1',
    name: 'Carlos Motoboy',
    phone: '(75) 99999-1001',
    mpAccessToken: 'APP_USR-DRIVER-1-MUCUGE-CONNECTED',
    isAvailable: true,
  },
  {
    id: 'driver_2',
    name: 'Ana Delivery',
    phone: '(75) 99999-1002',
    mpAccessToken: 'APP_USR-DRIVER-2-MUCUGE-CONNECTED',
    isAvailable: true,
  },
  {
    id: 'driver_3',
    name: 'Pedro Chapada',
    phone: '(75) 99999-1003',
    mpAccessToken: 'APP_USR-DRIVER-3-MUCUGE-CONNECTED',
    isAvailable: true,
  },
];

export function getDriverById(id: string): Driver | undefined {
  return DRIVERS.find((d) => d.id === id);
}

/** Seleciona o próximo entregador disponível (round-robin simples por id do pedido). */
export function pickAvailableDriver(seed?: string): Driver | undefined {
  const available = DRIVERS.filter((d) => d.isAvailable);
  if (available.length === 0) return undefined;
  if (!seed) return available[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % available.length;
  }
  return available[hash];
}
