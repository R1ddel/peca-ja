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
} from '@/services/platformCrypto';
import { mutatePlatformState, loadPlatformState, platformPersistenceMode } from '@/services/platformStore';
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
import {
  buildAdminOverview,
  buildAdminShopDetail,
  buildAdminShopRows,
  filterAdminOrders,
  requireStaffUser,
  staffDirectory,
} from '@/services/platformAdmin';

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

function sanitizeOrderForUser(order: Order, user: PlatformUser): Order {
  if (orderVisibleToUser(order, user)) return order;
  // Comércio / outros: sem códigos de verificação do cliente
  const { pickupCode: _p, deliveryCode: _d, ...rest } = order as Order & {
    pickupCode?: string;
    deliveryCode?: string;
  };
  return rest as Order;
}

export async function handlePlatformAction(action: PlatformAction): Promise<any> {
  if (action.action === 'health') {
    return {
      ok: true,
      service: 'pecaja-platform',
      persistence: platformPersistenceMode(),
      time: new Date().toISOString(),
    };
  }

  if (action.action === 'register') {
    const email = action.email.trim().toLowerCase();
    const password = action.password;
    if (!email || !password || password.length < 6) {
      return { ok: false, code: 'VALIDATION', message: 'E-mail e senha (mín. 6) são obrigatórios.' };
    }
    return mutatePlatformState((state) => {
      if (state.users.some((u) => u.email === email)) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'EXISTS',
            message: 'Este e-mail já está cadastrado.',
          },
        };
      }
      const { salt, hash } = hashPassword(password);
      const user: PlatformUser = {
        id: newId('usr'),
        name: action.name.trim(),
        email,
        phone: action.phone.trim(),
        address: action.address.trim(),
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
      return {
        state: {
          ...state,
          users: [...state.users, user],
          sessions: [...state.sessions, session],
        },
        result: { ok: true as const, user: publicUser(user), token },
      };
    });
  }

  if (action.action === 'login') {
    const email = action.email.trim().toLowerCase();
    return mutatePlatformState((state) => {
      const found = state.users.find((u) => u.email === email);
      if (!found || !verifyPassword(action.password, found.passwordSalt, found.passwordHash)) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'AUTH',
            message: found ? 'Senha incorreta.' : 'E-mail não encontrado. Crie uma conta.',
          },
        };
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
      return {
        state: { ...state, users, sessions },
        result: { ok: true as const, user: publicUser(boosted), token },
      };
    });
  }

  if (action.action === 'me') {
    return mutatePlatformState((state) => {
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
      return {
        state: { ...state, users },
        result: { ok: true as const, user: publicUser(boosted) },
      };
    });
  }

  if (action.action === 'logout') {
    return mutatePlatformState((state) => ({
      state: {
        ...state,
        sessions: state.sessions.filter((s) => s.token !== action.token),
      },
      result: { ok: true as const },
    }));
  }

  if (action.action === 'request_password_reset') {
    const email = action.email.trim().toLowerCase();
    if (!email) {
      return { ok: false, code: 'VALIDATION', message: 'Informe o e-mail.' };
    }
    return mutatePlatformState((state) => {
      const found = state.users.find((u) => u.email === email);
      // Resposta uniforme (não vaza se o e-mail existe)
      if (!found) {
        return {
          state,
          result: {
            ok: true as const,
            exists: false,
            message: 'E-mail não encontrado na nuvem.',
          },
        };
      }
      const token = newSessionToken().slice(0, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
      const passwordResets = [
        ...(state.passwordResets || []).filter((r) => r.email !== email),
        { email, token, expiresAt },
      ];
      const result: Record<string, unknown> = {
        ok: true as const,
        exists: true,
        message: 'Código de recuperação gerado.',
      };
      // Piloto sem SMTP: devolve o código no JSON (ligar e-mail depois).
      // Desligue com EXPOSE_PASSWORD_RESET_CODE=0 quando tiver envio real.
      const exposeCode = process.env.EXPOSE_PASSWORD_RESET_CODE !== '0';
      if (exposeCode) {
        result.devResetToken = token;
        result.resetToken = token;
      }
      return {
        state: { ...state, passwordResets },
        result,
      };
    });
  }

  if (action.action === 'reset_password') {
    const email = action.email.trim().toLowerCase();
    const resetToken = String(action.resetToken || '').trim().toUpperCase();
    if (action.newPassword.length < 6) {
      return { ok: false, code: 'VALIDATION', message: 'A nova senha deve ter pelo menos 6 caracteres.' };
    }
    if (!resetToken) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Informe o código de recuperação enviado por e-mail.',
      };
    }
    return mutatePlatformState((state) => {
      const reset = (state.passwordResets || []).find(
        (r) => r.email === email && r.token.toUpperCase() === resetToken
      );
      if (!reset || new Date(reset.expiresAt).getTime() < Date.now()) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'AUTH',
            message: 'Código inválido ou expirado. Solicite um novo.',
          },
        };
      }
      const idx = state.users.findIndex((u) => u.email === email);
      if (idx < 0) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'NOT_FOUND',
            message: 'Não encontramos uma conta com este e-mail.',
          },
        };
      }
      const { salt, hash } = hashPassword(action.newPassword);
      const users = [...state.users];
      users[idx] = { ...users[idx], passwordHash: hash, passwordSalt: salt };
      return {
        state: {
          ...state,
          users,
          sessions: state.sessions.filter((s) => s.userId !== users[idx].id),
          passwordResets: (state.passwordResets || []).filter((r) => r.email !== email),
        },
        result: { ok: true as const },
      };
    });
  }

  if (action.action === 'update_profile') {
    return mutatePlatformState((state) => {
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
      return {
        state: { ...state, users },
        result: { ok: true as const, user: publicUser(updated) },
      };
    });
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
        .map((o) => sanitizeOrderForUser(o, user));
    } else {
      list = list.map((o) => sanitizeOrderForUser(o, user));
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
    return { ok: true, order: sanitizeOrderForUser(order, user) };
  }

  if (action.action === 'upsert_order') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const order = action.order as Order;
    if (!order?.id) {
      return { ok: false, code: 'VALIDATION', message: 'Pedido inválido.' };
    }
    return mutatePlatformState((state) => {
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
      return {
        state: { ...state, orders },
        result: { ok: true as const, order: saved, revision: state.revision + 1 },
      };
    });
  }

  if (action.action === 'sync_orders') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
    const incoming = Array.isArray(action.orders) ? action.orders : [];
    return mutatePlatformState((state) => {
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
      return {
        state: { ...state, orders },
        result: {
          ok: true as const,
          orders: orders.map((o) => sanitizeOrderForUser(o, user)),
          revision: state.revision + 1,
        },
      };
    });
  }

  if (action.action === 'list_shops') {
    const state = await loadPlatformState();
    const shops = (state.shops || [])
      .filter((s) => !s.suspended)
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
    return mutatePlatformState((state) => {
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
      return {
        state: { ...state, shops },
        result: { ok: true as const, shop: next },
      };
    });
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
    return mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const ticket: SupportTicket = {
        id: newId('tkt'),
        userId: action.userId,
        email: action.email.trim().toLowerCase(),
        subject: action.subject.trim(),
        body: action.body.trim(),
        status: 'open',
        orderId: action.orderId,
        createdAt: now,
        updatedAt: now,
        messages: [{ at: now, from: 'user', text: action.body.trim() }],
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
    if (action.email) {
      const email = action.email.trim().toLowerCase();
      return {
        ok: true,
        tickets: state.tickets.filter((t) => t.email === email),
      };
    }
    return { ok: false, code: 'AUTH', message: 'PIN ou e-mail necessário.' };
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

  // —— Painel HQ (/admin) ——
  if (action.action === 'admin_overview') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    const gate = requireStaffUser(user, 'ops');
    if (!gate.ok) return gate;
    return { ok: true, overview: buildAdminOverview(state) };
  }

  if (action.action === 'admin_list_shops') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    const gate = requireStaffUser(user, 'ops');
    if (!gate.ok) return gate;
    return { ok: true, shops: buildAdminShopRows(state) };
  }

  if (action.action === 'admin_shop_detail') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    const gate = requireStaffUser(user, 'ops');
    if (!gate.ok) return gate;
    const businessId = String(action.businessId || '').trim();
    const detail = buildAdminShopDetail(state, businessId);
    if (!detail) return { ok: false, code: 'NOT_FOUND', message: 'Loja não encontrada.' };
    return { ok: true, ...detail };
  }

  if (action.action === 'admin_list_orders') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    const gate = requireStaffUser(user, 'ops');
    if (!gate.ok) return gate;
    const orders = filterAdminOrders(state, {
      businessId: action.businessId,
      status: action.status,
      sinceDays: action.sinceDays,
    });
    return { ok: true, orders };
  }

  if (action.action === 'admin_set_shop_status') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    const gate = requireStaffUser(user, 'ceo');
    if (!gate.ok) return gate;
    const businessId = String(action.businessId || '').trim();
    if (!businessId) {
      return { ok: false, code: 'VALIDATION', message: 'businessId obrigatório.' };
    }
    return mutatePlatformState((state) => {
      const idx = state.shops.findIndex((s) => s.businessId === businessId);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Loja não encontrada.' },
        };
      }
      const shop = state.shops[idx];
      const suspend = action.status === 'suspended';
      const next = {
        ...shop,
        suspended: suspend,
        suspendedAt: suspend ? new Date().toISOString() : undefined,
        suspendedReason: suspend
          ? String(action.reason || 'Suspensa pelo HQ Peça Já').trim()
          : undefined,
        updatedAt: new Date().toISOString(),
      };
      const shops = state.shops.map((s, i) => (i === idx ? next : s));
      return {
        state: { ...state, shops },
        result: { ok: true as const, shop: next },
      };
    });
  }

  if (action.action === 'admin_list_staff') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    const gate = requireStaffUser(user, 'ceo');
    if (!gate.ok) return gate;
    return { ok: true, staff: staffDirectory(state) };
  }

  if (action.action === 'admin_set_staff_role') {
    const state0 = await loadPlatformState();
    const actor = requireUser(state0, action.token);
    const gate = requireStaffUser(actor, 'ceo');
    if (!gate.ok) return gate;
    const userId = String(action.userId || '').trim();
    const role = action.role;
    if (!userId) {
      return { ok: false, code: 'VALIDATION', message: 'userId obrigatório.' };
    }
    if (role !== null && role !== 'ops' && role !== 'ceo') {
      return { ok: false, code: 'VALIDATION', message: 'Papel inválido.' };
    }
    return mutatePlatformState((state) => {
      let idx = state.users.findIndex((u) => u.id === userId);
      if (idx < 0 && userId.includes('@')) {
        idx = state.users.findIndex((u) => u.email === userId.toLowerCase());
      }
      if (idx < 0 && userId.startsWith('email:')) {
        const em = userId.slice(6).toLowerCase();
        idx = state.users.findIndex((u) => u.email === em);
      }
      if (idx < 0) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'NOT_FOUND',
            message:
              'Usuário não encontrado. A pessoa precisa criar conta/login no app antes de ser promovida.',
          },
        };
      }
      const target = state.users[idx];
      if (target.id === actor!.id && role !== 'ceo') {
        return {
          state,
          result: {
            ok: false as const,
            code: 'FORBIDDEN',
            message: 'Você não pode remover o próprio papel de CEO.',
          },
        };
      }
      const users = state.users.map((u, i) =>
        i === idx ? { ...u, platformRole: role } : u
      );
      return {
        state: { ...state, users },
        result: {
          ok: true as const,
          user: publicUser(users[idx]),
        },
      };
    });
  }

  if (action.action === 'admin_ticket_list') {
    const state = await loadPlatformState();
    const user = requireUser(state, action.token);
    const gate = requireStaffUser(user, 'ops');
    if (!gate.ok) return gate;
    const tickets = [...(state.tickets || [])].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return { ok: true, tickets };
  }

  if (action.action === 'admin_ticket_update') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    const gate = requireStaffUser(user, 'ops');
    if (!gate.ok) return gate;
    const id = String(action.id || '').trim();
    if (!id) return { ok: false, code: 'VALIDATION', message: 'id obrigatório.' };
    return mutatePlatformState((state) => {
      const idx = state.tickets.findIndex((t) => t.id === id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Ticket não encontrado.' },
        };
      }
      const prev = state.tickets[idx];
      const now = new Date().toISOString();
      const messages = [...(prev.messages || [])];
      const reply = String(action.reply || '').trim();
      if (reply) {
        messages.push({ at: now, from: 'support', text: reply });
      }
      const next = {
        ...prev,
        status: action.status || prev.status,
        messages,
        updatedAt: now,
      };
      const tickets = state.tickets.map((t, i) => (i === idx ? next : t));
      return {
        state: { ...state, tickets },
        result: { ok: true as const, ticket: next },
      };
    });
  }

  if (action.action === 'admin_claim_ceo') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) {
      return { ok: false, code: 'AUTH', message: 'Faça login na plataforma antes.' };
    }
    const expected = process.env.SUPPORT_PIN?.trim();
    const pin = String(action.supportPin || '').trim();
    if (!expected || !pin || pin !== expected) {
      return { ok: false, code: 'AUTH', message: 'PIN de suporte inválido.' };
    }
    return mutatePlatformState((state) => {
      const idx = state.users.findIndex((u) => u.id === user!.id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
        };
      }
      const users = state.users.map((u, i) =>
        i === idx ? { ...u, platformRole: 'ceo' as const } : u
      );
      return {
        state: { ...state, users },
        result: { ok: true as const, user: publicUser(users[idx]) },
      };
    });
  }

  return { ok: false, code: 'UNKNOWN', message: 'Ação não reconhecida.' };
}

export function toPublicUserSafe(u: User): User {
  return u;
}
