/**
 * API Expo da frota — mesmo contrato do server standalone.
 * Com USE_FLEET_SERVER=1, só faz proxy (não abre Postgres no Metro).
 */
import { handleFleetGet, handleFleetPost } from '@/server/fleetHttp';
import { proxyToDedicatedApi } from '@/server/proxyToDedicatedApi';

export async function GET(request: Request) {
  const proxied = await proxyToDedicatedApi(request);
  if (proxied) return proxied;
  return handleFleetGet();
}

export async function POST(request: Request) {
  const proxied = await proxyToDedicatedApi(request);
  if (proxied) return proxied;
  return handleFleetPost(request);
}
