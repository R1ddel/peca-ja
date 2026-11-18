/**
 * Motor da plataforma: auth, pedidos, lojas, ledger, suporte.
 */
import type { Order, User } from '@/types';
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  newId,
  sessionExpiresAt,
  hashResetToken,
  tokensMatch,
  dummyPasswordCheck,
  newNumericCode,
} from '@/services/platformCrypto';
import { sendPasswordResetEmail } from '@/services/resetMail';
import {
  mutatePlatformState,
  loadPlatformState,
  pingPlatformDb,
  platformPersistenceMode,
} from '@/services/platformStore';
import type {
  AuthPublicUser,
  PlatformAction,
  PlatformResult,
  PlatformSession,
  PlatformState,
  PlatformUser,
  SupportTicket,
} from '@/services/platformTypes';
import { mergeOrderFields, mergeOrdersPreferNewer } from '@/utils/orderMerge';
import { hasOpenOrderCredit } from '@/services/orderLedgerServer';
import { applyCeoBootstrap } from '@/services/platformRoles';
import { handleAdminPlatformAction } from '@/services/platformAdminHandlers';
import {
  dualWriteAuthSafe,
  upsertUserRel,
  upsertSessionRel,
  deleteSessionRel,
  replaceSessionsForUserRel,
  deleteSessionsForUserRel,
  upsertPasswordResetRel,
} from '@/services/relAuthStore';
import { dualWriteShopSafe } from '@/services/relCatalogStore';
import { dualWriteOrderSafe, dualWriteOrdersSafe } from '@/services/relOrdersStore';

function publicUser(u: PlatformUser): AuthPublicUser {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = u;
  return rest;
}

function findSession(state: PlatformState, token: string): PlatformSession | null {
  const s = state.sessions.find((x) => x.token === token);
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) return null;
  return s;
}

function requireUser(state: PlatformState, token?: string): PlatformUser | null {
  if (!token) return null;
  const session = findSession(state, token);
  if (!session) return null;
  return state.users.find((u) => u.id === session.userId) || null;
}

function supportPinOk(pin?: string): boolean {
  const expected = process.env.SUPPORT_PIN?.trim();
  if (!expected) return false;
  return !!pin && pin === expected;
}

function orderVisibleToUser(order: Order, user: PlatformUser): boolean {
  if (order.userId === user.id) return true;
  return false;
}

function userOwnsBusiness(state: PlatformState, user: PlatformUser, businessId: string): boolean {
  return state.shops.some(
    (s) => s.businessId === businessId && s.ownerUserId === user.id
  );
}

function ownedBusinessIds(state: PlatformState, user: PlatformUser): Set<string> {
  return new Set(
    state.shops
      .filter((s) => s.ownerUserId === user.id)
      .map((s) => s.businessId)
  );
}

function sanitizeOrderForUser(
  order: Order,
  user: PlatformUser,
  shops: Set<string>
): Order {
  if (orderVisibleToUser(order, user)) return order;
  if (shops.has(order.businessId)) {
    // A loja precisa do código para conferir o que o motoboy mostrar. Não recebe o código do cliente.
    const { deliveryCode: _d, ...rest } = order;
    return rest;
  }
  const { pickupCode: _p, deliveryCode: _delivery, ...rest } = order as Order & {
    pickupCode?: string;
    deliveryCode?: string;
  };
  return rest as Order;
}

export async function handlePlatformAction(action: PlatformAction): Promise<any> {
  if (action.action === 'health') {
    const persistence = platformPersistenceMode();
    if (persistence === 'postgres') {
      try {
        await pingPlatformDb();
      } catch {
        return { ok: false, code: 'DB' };
      }
    } else if (process.env.NODE_ENV === 'production') {
      return { ok: false, code: 'DB' };
    }
    return { ok: true };
  }

  if (action.action === 'register') {
    const email = String(action.email || '').trim().toLowerCase();
    const password = String(action.password || '');
    const name = String(action.name || '').trim();
    const phone = String(action.phone || '').trim();
    const address = String(action.address || '').trim();
    if (!email || !password || password.length < 6) {
      return { ok: false, code: 'INVALID', message: 'E-mail e senha (mín. 6) são obrigatórios.' };
    }
    let mirroredUser: PlatformUser | null = null;
    let mirroredSession: PlatformSession | null = null;
    const out = await mutatePlatformState((state) => {
      if (state.users.some((u) => u.email === email)) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'AUTH',
            message: 'Não foi possível concluir o cadastro. Tente entrar ou recuperar a senha.',
          },
        };
      }
      const { salt, hash } = hashPassword(password);
      const user: PlatformUser = {
        id: newId('usr'),
        name,
        email,
        phone,
        address,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
      };
      const token = newSessionToken();
      const session: PlatformSession = {
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: sessionExpiresAt(30),
      };
      mirroredUser = user;
      mirroredSession = session;
      return {
        state: {
          ...state,
          users: [...state.users, user],
          sessions: [...state.sessions, session],
        },
        result: { ok: true as const, user: publicUser(user), token },
      };
    });
    if (out?.ok && mirroredUser && mirroredSession) {
      const u = mirroredUser;
      const s = mirroredSession;
      await dualWriteAuthSafe('register', async () => {
        await upsertUserRel(u);
        await upsertSessionRel(s);
      });
    }
    return out;
  }

  if (action.action === 'login') {
    const email = String(action.email || '').trim().toLowerCase();
    const password = String(action.password || '');
    let mirroredUser: PlatformUser | null = null;
    let mirroredSession: PlatformSession | null = null;
    const out = await mutatePlatformState((state) => {
      const found = state.users.find((u) => u.email === email);
      const AUTH_FAIL = {
        ok: false as const,
        code: 'AUTH' as const,
        message: 'E-mail ou senha inválidos.',
      };
      if (!found) {
        dummyPasswordCheck(password);
        return { state, result: AUTH_FAIL };
      }
      if (!verifyPassword(password, found.passwordSalt, found.passwordHash)) {
        return { state, result: AUTH_FAIL };
      }
      const boosted = applyCeoBootstrap(found);
      const users =
        boosted.platformRole !== found.platformRole
          ? state.users.map((u) => (u.id === found.id ? boosted : u))
          : state.users;
      const token = newSessionToken();
      const session: PlatformSession = {
        token,
        userId: found.id,
        createdAt: new Date().toISOString(),
        expiresAt: sessionExpiresAt(30),
      };
      const sessions = [
        ...state.sessions.filter((s) => s.userId !== found.id),
        session,
      ];
      mirroredUser = boosted;
      mirroredSession = session;
      return {
        state: { ...state, users, sessions },
        result: { ok: true as const, user: publicUser(boosted), token },
      };
    });
    if (out?.ok && mirroredUser && mirroredSession) {
      const u = mirroredUser;
      const s = mirroredSession;
      await dualWriteAuthSafe('login', async () => {
        await upsertUserRel(u);
        await replaceSessionsForUserRel(u.id, s);
      });
    }
    return out;
  }

  if (action.action === 'me') {
    let mirroredUser: PlatformUser | null = null;
    const out = await mutatePlatformState((state) => {
      const user = requireUser(state, action.token);
      if (!user) {
        return {
          state,
          result: { ok: false as const, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
        };
      }
      const boosted = applyCeoBootstrap(user);
      const users =
        boosted.platformRole !== user.platformRole
          ? state.users.map((u) => (u.id === user.id ? boosted : u))
          : state.users;
      mirroredUser = boosted;
      return {
        state: { ...state, users },
        result: { ok: true as const, user: publicUser(boosted) },
      };
    });
    if (out?.ok && mirroredUser) {
      const u = mirroredUser;
      await dualWriteAuthSafe('me', async () => {
        await upsertUserRel(u);
      });
    }
    return out;
  }

  if (action.action === 'logout') {
    const out = await mutatePlatformState((state) => ({
      state: {
        ...state,
        sessions: state.sessions.filter((s) => s.token !== action.token),
      },
      result: { ok: true as const },
    }));
    if (out?.ok && action.token) {
      await dualWriteAuthSafe('logout', async () => {
        await deleteSessionRel(action.token);
      });
    }
    return out;
  }

  if (action.action === 'request_password_reset') {
    const RESET_GENERIC = {
      ok: true as const,
      message: 'Se a conta existir, enviaremos as instruções.',
    };
    const email = String(action.email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      return RESET_GENERIC;
    }
    const token = newNumericCode(8);
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    let shouldSend = false;
    await mutatePlatformState((state) => {
      const found = state.users.find((u) => u.email === email);
      if (!found) {
        dummyPasswordCheck(token);
        return { state, result: RESET_GENERIC };
      }
      shouldSend = true;
      const passwordResets = [
        ...(state.passwordResets || []).filter((r) => r.email !== email),
        { email, tokenHash, expiresAt, attempts: 0 },
      ];
      return {
        state: { ...state, passwordResets },
        result: RESET_GENERIC,
      };
    });
    if (shouldSend) {
      await dualWriteAuthSafe('request_password_reset', async () => {
        await upsertPasswordResetRel({ email, tokenHash, expiresAt, attempts: 0 });
      });
      try {
        await sendPasswordResetEmail(email, token);
      } catch (err) {
        console.error('[reset] envio falhou', (err as { message?: string })?.message);
      }
    }
    return RESET_GENERIC;
  }

  if (action.action === 'reset_password') {
    const email = String(action.email || '').trim().toLowerCase();
    const resetToken = String(action.resetToken || '').trim();
    const newPassword = String(action.newPassword || '');
    const AUTH_FAIL = {
      ok: false as const,
      code: 'INVALID' as const,
      message: 'Código inválido ou expirado. Solicite um novo.',
    };
    if (newPassword.length < 6) {
      return { ok: false, code: 'INVALID', message: 'A nova senha deve ter pelo menos 6 caracteres.' };
    }
    if (!resetToken) {
      return AUTH_FAIL;
    }
    const tokenHash = hashResetToken(resetToken);
    let mirroredUser: PlatformUser | null = null;
    let mirroredReset: {
      email: string;
      tokenHash: string;
      expiresAt: string;
      usedAt?: string;
      attempts?: number;
    } | null = null;
    let attemptsOnly: {
      email: string;
      tokenHash: string;
      expiresAt: string;
      usedAt?: string;
      attempts?: number;
    } | null = null;
    const out = await mutatePlatformState((state) => {
      const list = state.passwordResets || [];
      const idxReset = list.findIndex((r) => r.email === email && r.tokenHash);
      const reset = list[idxReset];
      if (
        !reset ||
        !reset.tokenHash ||
        reset.usedAt ||
        new Date(reset.expiresAt).getTime() < Date.now() ||
        (reset.attempts || 0) >= 5 ||
        !tokensMatch(reset.tokenHash, tokenHash)
      ) {
        dummyPasswordCheck(resetToken);
        if (reset && idxReset >= 0) {
          const next = [...list];
          const bumped = { ...reset, attempts: (reset.attempts || 0) + 1 };
          next[idxReset] = bumped;
          attemptsOnly = {
            email: bumped.email,
            tokenHash: bumped.tokenHash!,
            expiresAt: bumped.expiresAt,
            usedAt: bumped.usedAt,
            attempts: bumped.attempts,
          };
          return { state: { ...state, passwordResets: next }, result: AUTH_FAIL };
        }
        return { state, result: AUTH_FAIL };
      }
      const idx = state.users.findIndex((u) => u.email === email);
      if (idx < 0) {
        return { state, result: AUTH_FAIL };
      }
      const { salt, hash } = hashPassword(newPassword);
      const users = [...state.users];
      users[idx] = { ...users[idx], passwordHash: hash, passwordSalt: salt };
      const used = { ...reset, usedAt: new Date().toISOString(), attempts: (reset.attempts || 0) + 1 };
      mirroredUser = users[idx];
      mirroredReset = {
        email: used.email,
        tokenHash: used.tokenHash!,
        expiresAt: used.expiresAt,
        usedAt: used.usedAt,
        attempts: used.attempts,
      };
      return {
        state: {
          ...state,
          users,
          sessions: state.sessions.filter((s) => s.userId !== users[idx].id),
          passwordResets: list.map((r, i) => (i === idxReset ? used : r)),
        },
        result: { ok: true as const },
      };
    });
    if (out?.ok && mirroredUser && mirroredReset) {
      const u = mirroredUser;
      const r = mirroredReset;
      await dualWriteAuthSafe('reset_password', async () => {
        await upsertUserRel(u);
        await upsertPasswordResetRel(r);
        await deleteSessionsForUserRel(u.id);
      });
    } else if (attemptsOnly) {
      const r = attemptsOnly;
      await dualWriteAuthSafe('reset_password_attempts', async () => {
        await upsertPasswordResetRel(r);
      });
    }
    return out;
  }

  if (action.action === 'update_profile') {
    let mirroredUser: PlatformUser | null = null;
    const out = await mutatePlatformState((state) => {
      const user = requireUser(state, action.token);
      if (!user) {
        return {
          state,
          result: { ok: false as const, code: 'AUTH', message: 'Sessão inválida.' },
        };
      }
      const patch = { ...action.patch };
      delete (patch as any).id;
      delete (patch as any).email;
      delete (patch as any).createdAt;
      delete (patch as any).passwordHash;
      delete (patch as any).passwordSalt;
      // Papel HQ só via PLATFORM_CEO_EMAILS / admin_set_staff_role
      delete (patch as any).platformRole;
      const users = state.users.map((u) =>
        u.id === user.id ? { ...u, ...patch } : u
      );
      const updated = users.find((u) => u.id === user.id)!;
      mirroredUser = updated;
      return {
        state: { ...state, users },
        result: { ok: true as const, user: publicUser(updated) },
      };
    });
    if (out?.ok && mirroredUser) {
      const u = mirroredUser;
      await dualWriteAuthSafe('update_profile', async () => {
        await upsertUserRel(u);
      });
    }
    return out;
  }

  if (action.action === 'list_orders') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    let list = state.orders.filter((o) => orderVisibleToUser(o, user));
    if (action.userId && action.userId !== user.id) {
      return { ok: false, code: 'AUTH', message: 'Sem permissão para listar estes pedidos.' };
    }
    if (action.businessId) {
      if (!userOwnsBusiness(state, user, action.businessId)) {
        return {
          ok: false,
          code: 'AUTH',
          message: 'Sem permissão para listar pedidos desta loja.',
        };
      }
      list = state.orders
        .filter((o) => o.businessId === action.businessId)
        .map((o) => sanitizeOrderForUser(o, user, ownedBusinessIds(state, user)));
    } else {
      list = list.map((o) => sanitizeOrderForUser(o, user, ownedBusinessIds(state, user)));
    }
    return { ok: true, orders: list, revision: state.revision };
  }

  if (action.action === 'get_order') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const order = state.orders.find((o) => o.id === action.id);
    if (!order) return { ok: false, code: 'NOT_FOUND', message: 'Pedido não encontrado.' };
    const allowed =
      orderVisibleToUser(order, user) ||
      userOwnsBusiness(state, user, order.businessId);
    if (!allowed) {
      return { ok: false, code: 'AUTH', message: 'Sem permissão para este pedido.' };
    }
    return { ok: true, order: sanitizeOrderForUser(order, user, ownedBusinessIds(state, user)) };
  }

  if (action.action === 'upsert_order') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const order = action.order as Order;
    if (!order?.id) {
      return { ok: false, code: 'VALIDATION', message: 'Pedido inválido.' };
    }
    let mirrored: Order | null = null;
    const out = await mutatePlatformState((state) => {
      const existing = state.orders.find((o) => o.id === order.id);
      if (existing && !orderVisibleToUser(existing, user) && existing.userId !== user.id) {
        // Permite atualização de status por quem já tem o pedido (comércio/entregador via mesmo token de conta)
        if (existing.userId && existing.userId !== user.id && order.userId !== user.id) {
          // Ainda permite merge se o caller é o mesmo userId do pedido
        }
      }
      if (!existing && order.userId && order.userId !== user.id) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'AUTH',
            message: 'Não é possível criar pedido para outro usuário.',
          },
        };
      }
      if (!existing && order.businessId) {
        const shop = (state.shops || []).find((s) => s.businessId === order.businessId);
        if (shop?.suspended) {
          return {
            state,
            result: {
              ok: false as const,
              code: 'FORBIDDEN',
              message: 'Esta loja está temporariamente indisponível.',
            },
          };
        }
      }
      const idx = state.orders.findIndex((o) => o.id === order.id);
      const stamp = new Date().toISOString();
      const safeOrder =
        existing && !orderVisibleToUser(existing, user)
          ? { ...order, pickupCode: existing.pickupCode, deliveryCode: existing.deliveryCode }
          : order;
      const orders =
        idx >= 0
          ? state.orders.map((o, i) =>
              i === idx
                ? { ...mergeOrderFields(o, safeOrder), updatedAt: stamp }
                : o
            )
          : [...state.orders, { ...safeOrder, userId: user.id, updatedAt: safeOrder.updatedAt || stamp }];
      const saved = orders.find((o) => o.id === order.id)!;
      mirrored = saved;
      return {
        state: { ...state, orders },
        result: { ok: true as const, order: saved, revision: state.revision + 1 },
      };
    });
    if (out?.ok && mirrored) await dualWriteOrderSafe(mirrored);
    return out;
  }

  if (action.action === 'sync_orders') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const incoming = Array.isArray(action.orders) ? action.orders : [];
    let mirroredOrders: Order[] = [];
    const out = await mutatePlatformState((state) => {
      // Local-first: merge com proteção — não deixa zerar total financeiro de pedido alheio
      const safeIncoming = (incoming as Order[]).map((inc) => {
        const prev = state.orders.find((o) => o.id === inc.id);
        if (!prev) return inc;
        if (prev.userId && prev.userId !== user.id && inc.userId !== user.id) {
          return {
            ...inc,
            total: prev.total,
            establishmentAmount: prev.establishmentAmount,
            driverAmount: prev.driverAmount,
            pickupCode: prev.pickupCode,
            deliveryCode: prev.deliveryCode,
            customerPhone: prev.customerPhone,
          };
        }
        return inc;
      });
      const orders = mergeOrdersPreferNewer(state.orders, safeIncoming);
      mirroredOrders = safeIncoming;
      return {
        state: { ...state, orders },
        result: {
          ok: true as const,
          orders: orders.map((o) => sanitizeOrderForUser(o, user, ownedBusinessIds(state, user))),
          revision: state.revision + 1,
        },
      };
    });
    if (out?.ok && mirroredOrders.length) await dualWriteOrdersSafe(mirroredOrders);
    return out;
  }

  if (action.action === 'list_shops') {
    const state = await loadPlatformState();
    const shops = (state.shops || [])
      .filter((s) => !String(s.businessId || '').startsWith('proj2y_'))
      .filter((s) => !s.suspended)
      .filter((s) => !/recheck|\bteste\b/i.test(String(s.name || s.businessId || '')))
      .map((s) => {
        const { mpSellerAccessToken: _t, ...rest } = s;
        return rest;
      });
    return { ok: true, shops, revision: state.revision };
  }

  if (action.action === 'upsert_shop') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const shop = action.shop;
    if (!shop?.businessId || !shop?.applicationId) {
      return { ok: false, code: 'VALIDATION', message: 'Loja inválida.' };
    }
    let mirroredShop: typeof shop | null = null;
    const out = await mutatePlatformState((state) => {
      const idx = state.shops.findIndex((s) => s.businessId === shop.businessId);
      const existing = idx >= 0 ? state.shops[idx] : null;
      if (existing?.ownerUserId && existing.ownerUserId !== user.id) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'AUTH',
            message: 'Esta loja pertence a outra conta.',
          },
        };
      }
      const next = {
        ...shop,
        ownerUserId: existing?.ownerUserId || user.id,
        // Comerciante não pode limpar suspensão do HQ no upsert
        suspended: existing?.suspended ?? shop.suspended,
        suspendedAt: existing?.suspended ? existing.suspendedAt : shop.suspendedAt,
        suspendedReason: existing?.suspended ? existing.suspendedReason : shop.suspendedReason,
        // Credenciais MP marketplace: não apagar se o client não mandou
        mpCollectorId:
          shop.mpCollectorId !== undefined
            ? shop.mpCollectorId
            : existing?.mpCollectorId,
        mpSellerAccessToken:
          shop.mpSellerAccessToken !== undefined
            ? shop.mpSellerAccessToken
            : existing?.mpSellerAccessToken,
        updatedAt: new Date().toISOString(),
      };
      const shops =
        idx >= 0
          ? state.shops.map((s, i) => (i === idx ? next : s))
          : [...state.shops, next];
      mirroredShop = next;
      return {
        state: { ...state, shops },
        result: { ok: true as const, shop: next },
      };
    });
    if (out?.ok && mirroredShop) {
      await dualWriteShopSafe(mirroredShop);
    }
    return out;
  }

  if (action.action === 'ledger_list') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    if (action.ownerType === 'merchant' && !userOwnsBusiness(state, user, action.ownerId)) {
      return { ok: false, code: 'AUTH', message: 'Sem permissão para esta carteira.' };
    }
    if (action.ownerType === 'driver' && action.ownerId !== user.id) {
      return { ok: false, code: 'AUTH', message: 'Sem permissão para esta carteira.' };
    }
    if (action.ownerType === 'platform') {
      return { ok: false, code: 'AUTH', message: 'Carteira da plataforma restrita.' };
    }
    const entries = state.ledger.filter(
      (e) => e.ownerType === action.ownerType && e.ownerId === action.ownerId
    );
    const balance = entries.reduce(
      (sum, e) => sum + (e.kind === 'debit' || e.kind === 'withdraw' ? -e.amount : e.amount),
      0
    );
    return { ok: true, entries, balance };
  }

  if (action.action === 'ledger_post') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const amount = Number(action.entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, code: 'VALIDATION', message: 'Valor inválido.' };
    }
    if (action.entry.ownerType === 'merchant') {
      if (!userOwnsBusiness(state0, user, action.entry.ownerId)) {
        return { ok: false, code: 'AUTH', message: 'Sem permissão para creditar esta loja.' };
      }
    } else if (action.entry.ownerType === 'driver') {
      if (action.entry.ownerId !== user.id) {
        return { ok: false, code: 'AUTH', message: 'Sem permissão para esta carteira de entregador.' };
      }
    } else {
      return { ok: false, code: 'AUTH', message: 'Tipo de carteira não permitido.' };
    }
    if (action.entry.kind === 'credit') {
      if (!action.entry.orderId) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: 'Crédito de carteira exige orderId.',
        };
      }
      if (
        hasOpenOrderCredit(
          state0.ledger,
          action.entry.ownerType,
          action.entry.ownerId,
          action.entry.orderId
        )
      ) {
        return { ok: true, skipped: true, message: 'Crédito já lançado para este pedido.' };
      }
      const order = state0.orders.find((o) => o.id === action.entry.orderId);
      if (!order) {
        return { ok: false, code: 'NOT_FOUND', message: 'Pedido não encontrado para crédito.' };
      }
      if (
        action.entry.ownerType === 'merchant' &&
        order.businessId !== action.entry.ownerId
      ) {
        return { ok: false, code: 'AUTH', message: 'Pedido não pertence a esta loja.' };
      }
      const maxAllowed =
        action.entry.ownerType === 'driver'
          ? Number(order.driverAmount ?? order.deliveryFee ?? 0)
          : action.entry.ownerType === 'merchant'
            ? Number(order.establishmentAmount ?? order.subtotal ?? 0)
            : Number(order.total ?? 0);
      if (amount > maxAllowed + 0.009) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: 'Valor de crédito maior que o permitido pelo pedido.',
        };
      }
    }
    if (action.entry.kind === 'withdraw' || action.entry.kind === 'debit') {
      const entries = state0.ledger.filter(
        (e) =>
          e.ownerType === action.entry.ownerType && e.ownerId === action.entry.ownerId
      );
      const balance = entries.reduce(
        (sum, e) => sum + (e.kind === 'debit' || e.kind === 'withdraw' ? -e.amount : e.amount),
        0
      );
      if (amount > balance + 0.009) {
        return { ok: false, code: 'BALANCE', message: 'Saldo insuficiente.' };
      }
    }
    return mutatePlatformState((state) => {
      const entry = {
        id: action.entry.id || newId('led'),
        createdAt: action.entry.createdAt || new Date().toISOString(),
        ownerType: action.entry.ownerType,
        ownerId: action.entry.ownerId,
        orderId: action.entry.orderId,
        kind: action.entry.kind,
        amount,
        note: action.entry.note,
      };
      return {
        state: { ...state, ledger: [...state.ledger, entry] },
        result: { ok: true as const, entry },
      };
    });
  }

  if (action.action === 'ticket_create') {
    const state0 = await loadPlatformState();
    const account = requireUser(state0, action.token);
    if (!account) {
      return { ok: false, code: 'AUTH', message: 'Faça login para abrir um chamado.' };
    }
    const subject = String(action.subject || '').trim();
    const body = String(action.body || '').trim();
    if (subject.length < 3 || body.length < 3) {
      return { ok: false, code: 'VALIDATION', message: 'Descreva o problema.' };
    }
    return mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const ticket: SupportTicket = {
        id: newId('tkt'),
        userId: account.id,
        email: account.email.trim().toLowerCase(),
        subject,
        body,
        status: 'open',
        orderId: action.orderId,
        createdAt: now,
        updatedAt: now,
        messages: [{ at: now, from: 'user', text: body }],
      };
      return {
        state: { ...state, tickets: [ticket, ...state.tickets] },
        result: { ok: true as const, ticket },
      };
    });
  }

  if (action.action === 'ticket_list') {
    const state = await loadPlatformState();
    if (supportPinOk(action.pin)) {
      return { ok: true, tickets: state.tickets };
    }
    const account = requireUser(state, action.token);
    if (!account) {
      return { ok: false, code: 'AUTH', message: 'Faça login para ver seus chamados.' };
    }
    const email = account.email.trim().toLowerCase();
    return {
      ok: true,
      tickets: state.tickets.filter(
        (t) => t.email === email || t.userId === account.id
      ),
    };
  }

  if (action.action === 'ticket_update') {
    if (!supportPinOk(action.pin)) {
      return { ok: false, code: 'AUTH', message: 'PIN de suporte inválido.' };
    }
    return mutatePlatformState((state) => {
      const idx = state.tickets.findIndex((t) => t.id === action.id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Ticket não encontrado.' },
        };
      }
      const now = new Date().toISOString();
      const prev = state.tickets[idx];
      const messages = [...prev.messages];
      if (action.reply?.trim()) {
        messages.push({ at: now, from: 'support', text: action.reply.trim() });
      }
      const ticket: SupportTicket = {
        ...prev,
        status: action.status || prev.status,
        updatedAt: now,
        messages,
      };
      const tickets = state.tickets.map((t, i) => (i === idx ? ticket : t));
      return {
        state: { ...state, tickets },
        result: { ok: true as const, ticket },
      };
    });
  }

  if (action.action === 'upsert_chat_message') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const threadKey = String(action.threadKey || '').trim();
    const message = action.message;
    if (!threadKey || !message || typeof message !== 'object') {
      return { ok: false, code: 'VALIDATION', message: 'threadKey e message obrigatórios.' };
    }
    const msgId = typeof message.id === 'string' ? message.id : '';
    if (!msgId) {
      return { ok: false, code: 'VALIDATION', message: 'message.id obrigatório.' };
    }
    return mutatePlatformState((state) => {
      const chats = { ...(state.chats || {}) };
      const prev = Array.isArray(chats[threadKey]) ? [...chats[threadKey]] : [];
      if (prev.some((m) => m && typeof m === 'object' && (m as { id?: string }).id === msgId)) {
        return { state, result: { ok: true as const, chats } };
      }
      chats[threadKey] = [...prev, message];
      return {
        state: { ...state, chats },
        result: { ok: true as const, chats: { [threadKey]: chats[threadKey] } },
      };
    });
  }

  if (action.action === 'sync_chats') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const incoming = action.chats && typeof action.chats === 'object' ? action.chats : {};
    return mutatePlatformState((state) => {
      const chats = { ...(state.chats || {}) };
      for (const [key, list] of Object.entries(incoming)) {
        if (!Array.isArray(list)) continue;
        const prev = Array.isArray(chats[key]) ? chats[key] : [];
        const byId = new Map<string, unknown>();
        for (const m of [...prev, ...list]) {
          if (!m || typeof m !== 'object') continue;
          const id = (m as { id?: string }).id;
          if (typeof id === 'string' && id) byId.set(id, m);
        }
        chats[key] = Array.from(byId.values()).sort((a, b) => {
          const ta = +new Date(String((a as { createdAt?: string }).createdAt || 0));
          const tb = +new Date(String((b as { createdAt?: string }).createdAt || 0));
          return ta - tb;
        });
      }
      return {
        state: { ...state, chats },
        result: { ok: true as const, chats },
      };
    });
  }

  if (action.action === 'list_chats') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const all = state.chats || {};
    const orderIds = Array.isArray(action.orderIds)
      ? action.orderIds.map((id) => String(id)).filter(Boolean)
      : null;
    const mine = new Set(
      state.orders.filter((o) => orderVisibleToUser(o, user)).map((o) => o.id)
    );
    const want = orderIds && orderIds.length > 0 ? new Set(orderIds) : mine;
    const filtered: Record<string, unknown[]> = {};
    for (const [key, list] of Object.entries(all)) {
      const orderId = key.split('::')[0];
      if (want.has(orderId)) filtered[key] = list as unknown[];
    }
    return { ok: true, chats: filtered };
  }

  if (action.action === 'sync_driver_application') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const input = action.application;
    if (!input?.id || !input.email?.trim() || !input.name?.trim()) {
      return { ok: false, code: 'VALIDATION', message: 'Cadastro de entregador incompleto.' };
    }
    const emailKey = user.email.trim().toLowerCase();
    if (input.email.trim().toLowerCase() !== emailKey) {
      return { ok: false, code: 'AUTH', message: 'Só dá para enviar o próprio cadastro.' };
    }
    return mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const apps = state.applications || [];
      // 1) id local  2) mesmo e-mail (prioriza aprovado — HQ pode ter aprovado outro id)
      let idx = apps.findIndex((a) => a.id === input.id);
      if (idx < 0) {
        const sameEmail = apps
          .map((a, i) => ({ a, i }))
          .filter(
            ({ a }) =>
              a.role === 'driver' && a.email.trim().toLowerCase() === emailKey
          );
        const preferred =
          sameEmail.find(({ a }) => a.status === 'approved') ||
          sameEmail.find(({ a }) => a.status === 'pending') ||
          sameEmail[0];
        idx = preferred ? preferred.i : -1;
      }
      const prev = idx >= 0 ? apps[idx] : null;
      if (prev && prev.email.trim().toLowerCase() !== emailKey) {
        return {
          state,
          result: { ok: false as const, code: 'AUTH', message: 'Este cadastro é de outra conta.' },
        };
      }
      // Nunca rebaixa approved/rejected do HQ com um sync do celular
      const kept =
        prev?.status === 'approved' || prev?.status === 'rejected'
          ? prev.status
          : prev?.status || 'pending';
      const canonicalId = prev?.id || input.id;
      const next = {
        id: canonicalId,
        role: 'driver' as const,
        status: kept,
        city: input.city?.trim() || prev?.city,
        name: input.name.trim(),
        email: emailKey,
        phone: input.phone?.trim() || prev?.phone || '',
        document: input.document?.replace(/\D/g, '') || prev?.document,
        notes: prev?.notes,
        ownerUserId: user.id,
        assigneeUserId: prev?.assigneeUserId,
        followUpAt: prev?.followUpAt,
        tags: prev?.tags,
        timeline: prev?.timeline || [
          { at: now, text: 'Termo assinado. Aguardando a equipe.', actorId: user.id },
        ],
        createdAt: prev?.createdAt || now,
        updatedAt: now,
        raw: {
          ...(prev?.raw || {}),
          termsStatus: input.termsStatus || 'accepted',
          vehicle: input.vehicle || prev?.raw?.vehicle,
          localApplicationId: input.id,
        },
      };
      const applications =
        idx >= 0
          ? apps.map((a, i) => (i === idx ? next : a))
          : [next, ...apps];
      return {
        state: { ...state, applications },
        result: { ok: true as const, application: next },
      };
    });
  }

  // —— Painel HQ / Command Center (/admin) ——
  {
    const adminResult = await handleAdminPlatformAction(action, {
      requireUser,
      publicUser,
    });
    if (adminResult) return adminResult;
  }

  return { ok: false, code: 'UNKNOWN', message: 'Ação não reconhecida.' };
}

export function toPublicUserSafe(u: User): User {
  return u;
}
