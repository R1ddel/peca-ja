import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AiInsight,
  CashEntry,
  MacroItem,
  ObrasDocument,
  ObrasEmployee,
  ObrasExpense,
  ObrasProject,
  ObrasSession,
  ObrasStore,
  ObrasSupplier,
  ObrasUser,
  WorkTask,
} from '@/types/obras';
import { buildDemoStore } from '@/utils/obrasDemo';

const STORE_KEY = '@obras/store/v1';
const SESSION_KEY = '@obras/session/v1';

let cache: ObrasStore | null = null;

async function readStore(): Promise<ObrasStore> {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(STORE_KEY);
  if (raw) {
    cache = JSON.parse(raw) as ObrasStore;
    return cache;
  }
  cache = buildDemoStore();
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(cache));
  return cache;
}

async function writeStore(store: ObrasStore): Promise<void> {
  cache = store;
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export async function resetObrasDemo(): Promise<void> {
  cache = buildDemoStore();
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(cache));
}

// ── Session ──

export async function getObrasSession(): Promise<ObrasSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as ObrasSession) : null;
}

export async function setObrasSession(session: ObrasSession | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loginObras(email: string, password: string): Promise<{ ok: true; user: ObrasUser } | { ok: false; error: string }> {
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === '1';
  const trimmed = email.trim().toLowerCase();
  if (!demoMode && trimmed.endsWith('@obras.app')) {
    return { ok: false, error: 'E-mail ou senha incorretos.' };
  }
  const store = await readStore();
  const user = store.users.find(
    (u) => u.email.toLowerCase() === trimmed && u.password === password
  );
  if (!user) return { ok: false, error: 'E-mail ou senha incorretos.' };
  await setObrasSession({
    userId: user.id,
    activeProjectId: user.projectIds[0] ?? null,
    loggedAt: new Date().toISOString(),
  });
  return { ok: true, user };
}

export async function logoutObras(): Promise<void> {
  await setObrasSession(null);
}

export async function getCurrentObrasUser(): Promise<ObrasUser | null> {
  const session = await getObrasSession();
  if (!session) return null;
  const store = await readStore();
  return store.users.find((u) => u.id === session.userId) ?? null;
}

export async function setActiveProject(projectId: string): Promise<void> {
  const session = await getObrasSession();
  if (!session) return;
  await setObrasSession({ ...session, activeProjectId: projectId });
}

export async function getActiveProject(): Promise<ObrasProject | null> {
  const session = await getObrasSession();
  if (!session?.activeProjectId) return null;
  const store = await readStore();
  return store.projects.find((p) => p.id === session.activeProjectId) ?? null;
}

// ── Queries ──

export async function listUserProjects(user: ObrasUser): Promise<ObrasProject[]> {
  const store = await readStore();
  return store.projects.filter((p) => user.projectIds.includes(p.id));
}

export async function getProjectById(id: string): Promise<ObrasProject | null> {
  const store = await readStore();
  return store.projects.find((p) => p.id === id) ?? null;
}

export async function listMacroItems(projectId: string): Promise<MacroItem[]> {
  const store = await readStore();
  return store.macroItems.filter((m) => m.projectId === projectId);
}

export async function listExpenses(projectId: string): Promise<ObrasExpense[]> {
  const store = await readStore();
  return store.expenses.filter((e) => e.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
}

export async function listSuppliers(projectId: string): Promise<ObrasSupplier[]> {
  const store = await readStore();
  return store.suppliers.filter((s) => s.projectId === projectId);
}

export async function listEmployees(projectId: string): Promise<ObrasEmployee[]> {
  const store = await readStore();
  return store.employees.filter((e) => e.projectId === projectId);
}

export async function listTasks(projectId: string, filter?: { assignedTo?: string; dueDate?: string }): Promise<WorkTask[]> {
  const store = await readStore();
  let tasks = store.tasks.filter((t) => t.projectId === projectId);
  if (filter?.assignedTo) tasks = tasks.filter((t) => t.assignedTo === filter.assignedTo);
  if (filter?.dueDate) tasks = tasks.filter((t) => t.dueDate === filter.dueDate);
  return tasks.sort((a, b) => a.status.localeCompare(b.status));
}

export async function listDocuments(projectId: string): Promise<ObrasDocument[]> {
  const store = await readStore();
  return store.documents.filter((d) => d.projectId === projectId);
}

export async function listCashEntries(projectId: string): Promise<CashEntry[]> {
  const store = await readStore();
  return store.cashEntries.filter((c) => c.projectId === projectId);
}

export async function listInsights(projectId: string): Promise<AiInsight[]> {
  const store = await readStore();
  return store.insights.filter((i) => i.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Mutations ──

export async function updateTaskStatus(taskId: string, status: WorkTask['status']): Promise<void> {
  const store = await readStore();
  const idx = store.tasks.findIndex((t) => t.id === taskId);
  if (idx >= 0) {
    store.tasks[idx] = { ...store.tasks[idx], status };
    await writeStore(store);
  }
}

export async function assignTask(taskId: string, employeeId: string, assignedBy: string): Promise<void> {
  const store = await readStore();
  const idx = store.tasks.findIndex((t) => t.id === taskId);
  if (idx >= 0) {
    store.tasks[idx] = { ...store.tasks[idx], assignedTo: employeeId, assignedBy };
    await writeStore(store);
  }
}

export async function addDocument(doc: ObrasDocument): Promise<void> {
  const store = await readStore();
  store.documents.unshift(doc);
  await writeStore(store);
}

export async function addInsight(insight: AiInsight): Promise<void> {
  const store = await readStore();
  store.insights.unshift(insight);
  await writeStore(store);
}

export async function getFinanceSummary(projectId: string) {
  const expenses = await listExpenses(projectId);
  const cash = await listCashEntries(projectId);
  const project = await getProjectById(projectId);

  const totalIn = cash.filter((c) => c.type === 'in').reduce((s, c) => s + c.amount, 0);
  const totalOut = cash.filter((c) => c.type === 'out').reduce((s, c) => s + c.amount, 0);
  const balance = totalIn - totalOut;

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  return {
    budget: project?.budget ?? 0,
    spent: project?.spent ?? 0,
    totalIn,
    totalOut,
    balance,
    byCategory,
    remaining: (project?.budget ?? 0) - (project?.spent ?? 0),
  };
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function obrasHomeForRole(role: ObrasUser['role']): string {
  switch (role) {
    case 'admin':
      return '/obras/admin';
    case 'foreman':
      return '/obras/foreman';
    case 'worker':
      return '/obras/worker';
  }
}
