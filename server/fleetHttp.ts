/**
 * Handler HTTP compartilhado: Expo Router (`app/api/fleet+api.ts`) e server standalone.
 */
import type { ConductReport, Order } from '@/types';
import {
  fleetAddReport,
  fleetAdmin,
  fleetClaim,
  fleetDecline,
  fleetDriverLocation,
  fleetHeartbeat,
  fleetIssueDriverSession,
  fleetRelease,
  fleetSync,
  publicDriversMap,
  sanitizeOrderForFleet,
  verifyDriverToken,
} from '@/services/fleetEngine';
import { fleetPersistenceMode, loadFleetState } from '@/services/fleetStore';
import { loadPlatformState } from '@/services/platformStore';
import type { FleetDriverPresence } from '@/services/fleetTypes';

type Body = {
  action?: string;
  orders?: Order[];
  runDispatch?: boolean;
  orderId?: string;
  fleetId?: string;
  applicationId?: string;
  name?: string;
  phone?: string;
  online?: boolean;
  latitude?: number;
  longitude?: number;
  heading?: number;
  photoUrl?: string;
  bio?: string;
  vehicle?: string;
  report?: ConductReport;
  pin?: string;
  reason?: string;
  reportId?: string;
  status?: ConductReport['status'];
  adminAction?: 'list' | 'block' | 'unblock' | 'set_report_status';
  hqMode?: 'real' | 'projection';
  /** Token emitido no heartbeat do entregador. */
  driverToken?: string;
  /** Sessão da plataforma (obrigatória em sync se não houver driverToken). */
  token?: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function sanitizeStateOrders(orders: Order[], fleetId?: string) {
  return orders
    .filter((o) => !String(o.id || '').startsWith('proj2y_'))
    .map((o) => sanitizeOrderForFleet(o, fleetId));
}

function selfDriverMap(
  drivers: Record<string, FleetDriverPresence>,
  fleetId: string
): Record<string, FleetDriverPresence> {
  const d = drivers[fleetId];
  if (!d) return {};
  const { sessionToken: _t, ...rest } = d;
  return { [fleetId]: rest };
}

async function platformSessionUserId(token?: string): Promise<string | null> {
  const tok = String(token || '').trim();
  if (!tok) return null;
  const state = await loadPlatformState();
  const session = state.sessions.find((s) => s.token === tok);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  return session.userId;
}

async function userMayDriveFleet(userId: string, fleetId: string): Promise<boolean> {
  const state = await loadPlatformState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) return false;
  const email = user.email.trim().toLowerCase();
  const apps = (state.applications || []).filter(
    (a) => a.role === 'driver' && a.status === 'approved'
  );
  return apps.some((a) => {
    const own =
      a.ownerUserId === userId || a.email.trim().toLowerCase() === email;
    if (!own) return false;
    const localId = String((a.raw as { localApplicationId?: string } | undefined)?.localApplicationId || '');
    const ids = [a.id, `da_${a.id}`, localId, localId ? `da_${localId}` : ''].filter(Boolean);
    return ids.includes(fleetId);
  });
}

export async function handleFleetGet() {
  if (process.env.NODE_ENV === 'production') {
    return json({ ok: true });
  }
  return json({
    ok: true,
    message: 'Frota Peça Já.',
    persistence: fleetPersistenceMode(),
  });
}

export async function handleFleetPost(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const action = String(body.action || '').trim();
    const fleetIdHint = String(body.fleetId || '').trim() || undefined;
    const driverToken = String(body.driverToken || '').trim() || undefined;

    if (action === 'sync') {
      const platformToken = String(body.token || '').trim();
      const syncSecret = (process.env.FLEET_SYNC_SECRET || '').trim();
      const authHeader =
        request.headers.get('authorization') || request.headers.get('Authorization') || '';
      const bearer =
        authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

      let authorized = false;
      if (syncSecret && (platformToken === syncSecret || bearer === syncSecret)) {
        authorized = true;
      }
      if (!authorized && driverToken && fleetIdHint) {
        const fleetState = await loadFleetState();
        if (verifyDriverToken(fleetState, fleetIdHint, driverToken)) {
          authorized = true;
        }
      }
      if (!authorized && (platformToken || bearer)) {
        const tok = platformToken || bearer;
        const state = await loadPlatformState();
        const session = state.sessions.find((s) => s.token === tok);
        if (session && new Date(session.expiresAt).getTime() >= Date.now()) {
          authorized = true;
        }
      }
      if (!authorized) {
        return json(
          {
            ok: false,
            code: 'AUTH',
            message:
              'Sync da frota exige sessão (token) ou FLEET_SYNC_SECRET. Faça login no app.',
          },
          401
        );
      }

      const state = await fleetSync({
        orders: Array.isArray(body.orders) ? body.orders : [],
        runDispatch: body.runDispatch !== false,
      });
      // Roster completo só no HQ (action=admin). Sync devolve no máximo o próprio motorista.
      const driversOut = fleetIdHint
        ? selfDriverMap(state.drivers, fleetIdHint)
        : {};
      return json({
        ok: true,
        action: 'sync',
        revision: state.revision,
        updatedAt: state.updatedAt,
        orders: sanitizeStateOrders(state.orders, fleetIdHint),
        drivers: driversOut,
        persistence: fleetPersistenceMode(),
      });
    }

    if (action === 'driver_auth') {
      const fleetId = String(body.fleetId || '').trim();
      if (!fleetId) {
        return json({ ok: false, code: 'INVALID', message: 'fleetId obrigatório.' }, 400);
      }
      const platformTok = String(body.token || '').trim();
      const authHeader =
        request.headers.get('authorization') || request.headers.get('Authorization') || '';
      const bearer =
        authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
      const userId = await platformSessionUserId(platformTok || bearer);
      if (!userId) {
        return json(
          { ok: false, code: 'AUTH', message: 'Login de entregador obrigatório.' },
          401
        );
      }
      const allowed = await userMayDriveFleet(userId, fleetId);
      if (!allowed) {
        return json(
          { ok: false, code: 'AUTH', message: 'Cadastro de entregador não aprovado para esta frota.' },
          403
        );
      }
      const issued = await fleetIssueDriverSession({
        fleetId,
        applicationId: String(body.applicationId || fleetId).trim(),
        name: String(body.name || '').trim() || undefined,
        phone: String(body.phone || '').trim() || undefined,
        city: typeof (body as { city?: string }).city === 'string' ? String((body as { city?: string }).city).trim() : undefined,
      });
      if (issued.blocked) {
        return json({ ok: false, code: 'BLOCKED', message: issued.reason || 'Conta bloqueada.' }, 403);
      }
      const self = selfDriverMap(issued.state.drivers, fleetId)[fleetId];
      return json({
        ok: true,
        action: 'driver_auth',
        driverToken: issued.driverToken,
        driver: self || null,
        revision: issued.state.revision,
      });
    }

    if (action === 'heartbeat') {
      const fleetId = String(body.fleetId || '').trim();
      if (!fleetId) {
        return json(
          { ok: false, code: 'INVALID', message: 'fleetId obrigatório.' },
          400
        );
      }
      const state0 = await loadFleetState();
      if (!verifyDriverToken(state0, fleetId, driverToken)) {
        return json(
          {
            ok: false,
            code: 'AUTH',
            message: 'Heartbeat exige token de entregador.',
          },
          403
        );
      }

      const result = await fleetHeartbeat({
        fleetId,
        applicationId: String(body.applicationId || fleetId).trim(),
        online: !!body.online,
        latitude: body.latitude,
        longitude: body.longitude,
        heading: body.heading,
      });
      if (result.missing) {
        return json(
          { ok: false, code: 'AUTH', message: 'Sessão de entregador inválida. Entre de novo.' },
          403
        );
      }
      if (result.blocked) {
        return json(
          {
            ok: false,
            code: 'BLOCKED',
            message: result.reason || 'Conta bloqueada.',
          },
          403
        );
      }
      const self = selfDriverMap(result.state.drivers, fleetId)[fleetId];
      return json({
        ok: true,
        action: 'heartbeat',
        revision: result.state.revision,
        updatedAt: result.state.updatedAt,
        orders: sanitizeStateOrders(result.state.orders, fleetId),
        driver: self || null,
      });
    }

    if (action === 'claim' || action === 'decline' || action === 'release') {
      const orderId = String(body.orderId || '').trim();
      const fleetId = String(body.fleetId || '').trim();
      if (!orderId || !fleetId) {
        return json(
          { ok: false, code: 'INVALID', message: 'orderId e fleetId obrigatórios.' },
          400
        );
      }
      const state0 = await loadFleetState();
      if (!verifyDriverToken(state0, fleetId, driverToken)) {
        return json(
          {
            ok: false,
            code: 'AUTH',
            message: 'Token do entregador inválido. Fique online de novo no painel.',
          },
          401
        );
      }

      if (action === 'claim') {
        const result = await fleetClaim({
          orderId,
          fleetId,
          name: String(body.name || 'Entregador').trim(),
          phone: String(body.phone || '').trim(),
          photoUrl: body.photoUrl ? String(body.photoUrl).trim() : undefined,
          bio: body.bio ? String(body.bio).trim() : undefined,
          vehicle: body.vehicle ? String(body.vehicle).trim() : undefined,
        });
        if (!result.ok) {
          const notFound = /não encontrado/i.test(result.error);
          return json(
            {
              ok: false,
              code: notFound ? 'NOT_FOUND' : 'CLAIM_DENIED',
              message: result.error,
              orders: sanitizeStateOrders(result.state.orders, fleetId),
              revision: result.state.revision,
            },
            notFound ? 404 : 409
          );
        }
        return json({
          ok: true,
          action: 'claim',
          order: result.order,
          orders: sanitizeStateOrders(result.state.orders, fleetId),
          revision: result.state.revision,
        });
      }

      if (action === 'decline') {
        const result = await fleetDecline({ orderId, fleetId });
        if (!result.ok) {
          return json(
            {
              ok: false,
              code: 'DECLINE_DENIED',
              message: result.error,
              orders: sanitizeStateOrders(result.state.orders, fleetId),
              revision: result.state.revision,
            },
            409
          );
        }
        return json({
          ok: true,
          action: 'decline',
          order: result.order,
          orders: sanitizeStateOrders(result.state.orders, fleetId),
          revision: result.state.revision,
        });
      }

      const result = await fleetRelease({ orderId, fleetId });
      if (!result.ok) {
        const notFound = /não encontrado/i.test(result.error);
        return json(
          {
            ok: false,
            code: notFound ? 'NOT_FOUND' : 'RELEASE_DENIED',
            message: result.error,
            orders: sanitizeStateOrders(result.state.orders, fleetId),
            revision: result.state.revision,
          },
          notFound ? 404 : 409
        );
      }
      return json({
        ok: true,
        action: 'release',
        order: result.order,
        orders: sanitizeStateOrders(result.state.orders, fleetId),
        revision: result.state.revision,
      });
    }

    if (action === 'report' && body.report) {
      const reportFleet =
        String(body.fleetId || '').trim() ||
        String((body.report as { reporterId?: string })?.reporterId || '').trim();
      const state0 = await loadFleetState();
      const platformTok = String(body.token || '').trim();
      const okDriver = reportFleet
        ? verifyDriverToken(state0, reportFleet, driverToken)
        : false;
      const okPlatform = !!(await platformSessionUserId(platformTok));
      if (!okDriver && !okPlatform) {
        return json(
          { ok: false, code: 'AUTH', message: 'Sessão obrigatória para denúncia.' },
          401
        );
      }
      const state = await fleetAddReport(body.report);
      return json({
        ok: true,
        action: 'report',
        revision: state.revision,
      });
    }

    if (action === 'location') {
      const fleetId = String(body.fleetId || '').trim();
      if (!fleetId) {
        return json(
          { ok: false, code: 'INVALID', message: 'fleetId obrigatório.' },
          400
        );
      }
      const state0 = await loadFleetState();
      const okDriver = verifyDriverToken(state0, fleetId, driverToken);
      if (!okDriver) {
        return json(
          { ok: false, code: 'AUTH', message: 'Token de entregador obrigatório.' },
          403
        );
      }
      const loc = await fleetDriverLocation(fleetId);
      return json({ ok: true, location: loc });
    }

    if (action === 'admin') {
      const showProjection = body.hqMode !== 'real';
      if (showProjection) {
        const { loadPlatformState } = await import('@/services/platformStore');
        const { ensureProjectionSeeded } = await import('@/services/hqProjectionSeed');
        await ensureProjectionSeeded(await loadPlatformState());
      }
      const result = await fleetAdmin({
        pin: String(body.pin || ''),
        token: String(body.token || ''),
        action: body.adminAction || 'list',
        fleetId: body.fleetId,
        reason: body.reason,
        reportId: body.reportId,
        status: body.status,
      });
      if (!result.ok) {
        return json(
          { ok: false, code: 'FORBIDDEN', message: result.error },
          403
        );
      }
      const proj = (id: string) => id.startsWith('proj2y_');
      const realOnly = body.hqMode === 'real';
      const drivers = publicDriversMap(result.state.drivers);
      const driversOut: typeof drivers = {};
      for (const [id, driver] of Object.entries(drivers)) {
        if (realOnly && proj(id)) continue;
        driversOut[id] = driver;
      }
      return json({
        ok: true,
        action: 'admin',
        revision: result.state.revision,
        orders: (result.state.orders || []).filter((o) => (realOnly ? !proj(String(o.id || '')) : true)),
        drivers: driversOut,
        reports: (result.state.reports || []).filter((r) =>
          realOnly ? !proj(String(r.id || '')) : true
        ),
      });
    }

    return json(
      { ok: false, code: 'INVALID', message: 'Ação desconhecida.' },
      400
    );
  } catch (err: any) {
    console.error('[fleet]', err?.message || err);
    return json(
      {
        ok: false,
        code: 'SERVER',
        message: process.env.NODE_ENV === 'production' ? 'Erro na frota.' : err?.message || 'Erro na frota.',
      },
      500
    );
  }
}

export async function handleFleetRequest(request: Request): Promise<Response> {
  if (request.method === 'GET') return handleFleetGet();
  if (request.method === 'POST') return handleFleetPost(request);
  return json({ ok: false, message: 'Method not allowed' }, 405);
}
