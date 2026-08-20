import { handlePlatformRequest } from '@/server/platformHttp';
import { proxyToDedicatedApi } from '@/server/proxyToDedicatedApi';

export async function GET(request: Request) {
  const proxied = await proxyToDedicatedApi(request);
  if (proxied) return proxied;
  return handlePlatformRequest(request);
}

export async function POST(request: Request) {
  const proxied = await proxyToDedicatedApi(request);
  if (proxied) return proxied;
  return handlePlatformRequest(request);
}
