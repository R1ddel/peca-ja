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
  fleetRelease,
  fleetSync,
  publicDriversMap,
  sanitizeOrderForFleet,
  verifyDriverToken,
} from '@/services/fleetEngine';
import { fleetPersistenceMode, loadFleetState } from '@/services/fleetStore';
import { loadPlatformState } from '@/services/platformStore';

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
  /** Token emitido no heartbeat do entregador. */
  driverToken?: string;
  /** Sessão da plataforma (obrigatória em sync se não houver driverToken). */
  token?: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function sanitizeStateOrders(orders: Order[], fleetId?: string) {
  return orders.map((o) => sanitizeOrderForFleet(o, fleetId));
}

export async function handleFleetGet() {
  const state = await loadFleetState();
  return json({
    ok: true,
    message:
      'Frota Peça Já. POST action=sync|heartbeat|claim|decline|release|report|admin|location',
    persistence: fleetPersistenceMode(),
    revision: state.revision,
    updatedAt: state.updatedAt,
    driversOnline: Object.values(state.drivers).filter((d) => d.online && !d.blocked)
      .length,
    orders: state.orders.length,
    reports: state.reports.length,
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
      return json({
        ok: true,
        action: 'sync',
        revision: state.revision,
        updatedAt: state.updatedAt,
        orders: sanitizeStateOrders(state.orders, fleetIdHint),
        drivers: publicDriversMap(state.drivers),
        reports: state.reports,
        persistence: fleetPersistenceMode(),
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
      const result = await fleetHeartbeat({
        fleetId,
        applicationId: String(body.applicationId || fleetId).trim(),
        name: String(body.name || 'Entregador').trim(),
        phone: String(body.phone || '').trim(),
        online: !!body.online,
        latitude: body.latitude,
        longitude: body.longitude,
        heading: body.heading,
      });
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
      return json({
        ok: true,
        action: 'heartbeat',
        revision: result.state.revision,
        updatedAt: result.state.updatedAt,
        orders: sanitizeStateOrders(result.state.orders, fleetId),
        drivers: publicDriversMap(result.state.drivers),
        driverToken: result.driverToken,
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
          return json(
            {
              ok: false,
              code: 'CLAIM_DENIED',
              message: result.error,
              orders: sanitizeStateOrders(result.state.orders, fleetId),
              revision: result.state.revision,
            },
            409
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
        return json(
          {
            ok: false,
            code: 'RELEASE_DENIED',
            message: result.error,
            orders: sanitizeStateOrders(result.state.orders, fleetId),
            revision: result.state.revision,
          },
          409
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
      const state = await fleetAddReport(body.report);
      return json({
        ok: true,
        action: 'report',
        revision: state.revision,
        reports: state.reports,
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
      const loc = await fleetDriverLocation(fleetId);
      return json({ ok: true, location: loc });
    }

    if (action === 'admin') {
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
      return json({
        ok: true,
        action: 'admin',
        revision: result.state.revision,
        orders: result.state.orders,
        drivers: publicDriversMap(result.state.drivers),
        reports: result.state.reports,
      });
    }

    return json(
      { ok: false, code: 'INVALID', message: 'Ação desconhecida.' },
      400
    );
  } catch (err: any) {
    console.error('[fleet]', err?.message || err);
    return json(
      { ok: false, code: 'SERVER', message: err?.message || 'Erro na frota.' },
      500
    );
  }
}

export async function handleFleetRequest(request: Request): Promise<Response> {
  if (request.method === 'GET') return handleFleetGet();
  if (request.method === 'POST') return handleFleetPost(request);
  return json({ ok: false, message: 'Method not allowed' }, 405);
}
