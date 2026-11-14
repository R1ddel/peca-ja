import {
  AiInsight,
  CashEntry,
  MacroItem,
  ObrasDocument,
  ObrasEmployee,
  ObrasExpense,
  ObrasProject,
  ObrasStore,
  ObrasSupplier,
  ObrasUser,
  WorkTask,
} from '@/types/obras';

const PROJECT_1 = 'proj-residencial-solar';
const PROJECT_2 = 'proj-comercial-centro';

export const DEMO_USERS: ObrasUser[] = [
  {
    id: 'usr-admin',
    name: 'Carlos Engenheiro',
    email: 'engenheiro@obras.app',
    password: '123456',
    role: 'admin',
    projectIds: [PROJECT_1, PROJECT_2],
    phone: '(73) 99999-0001',
  },
  {
    id: 'usr-foreman',
    name: 'João Encarregado',
    email: 'encarregado@obras.app',
    password: '123456',
    role: 'foreman',
    projectIds: [PROJECT_1],
    phone: '(73) 99999-0002',
  },
  {
    id: 'usr-worker-1',
    name: 'Pedro Pedreiro',
    email: 'pedro@obras.app',
    password: '123456',
    role: 'worker',
    projectIds: [PROJECT_1],
    phone: '(73) 99999-0003',
  },
  {
    id: 'usr-worker-2',
    name: 'Maria Pintora',
    email: 'maria@obras.app',
    password: '123456',
    role: 'worker',
    projectIds: [PROJECT_1],
    phone: '(73) 99999-0004',
  },
];

export const DEMO_PROJECTS: ObrasProject[] = [
  {
    id: PROJECT_1,
    name: 'Residencial Solar — Bloco A',
    address: 'Rua das Palmeiras, 120 — Mucugê',
    status: 'active',
    startDate: '2026-01-15',
    endDate: '2026-09-30',
    budget: 850000,
    spent: 312400,
    progress: 38,
    description: 'Edificação residencial de 8 apartamentos — estrutura em concreto armado.',
  },
  {
    id: PROJECT_2,
    name: 'Comercial Centro — Reforma',
    address: 'Av. Principal, 45 — Vale do Capão',
    status: 'planning',
    startDate: '2026-03-01',
    endDate: '2026-07-15',
    budget: 220000,
    spent: 18500,
    progress: 12,
    description: 'Reforma de loja comercial — fachada, elétrica e acabamento.',
  },
];

export const DEMO_MACRO: MacroItem[] = [
  {
    id: 'macro-1',
    projectId: PROJECT_1,
    title: 'Fundação e infraestrutura',
    description: 'Escavação, sapatas, vigas baldrame e impermeabilização.',
    progress: 100,
    period: 'month',
    startDate: '2026-01-15',
    endDate: '2026-02-28',
  },
  {
    id: 'macro-2',
    projectId: PROJECT_1,
    title: 'Estrutura — 1º ao 3º pavimento',
    description: 'Formas, armação e concretagem das lajes.',
    progress: 65,
    period: 'quarter',
    startDate: '2026-03-01',
    endDate: '2026-06-30',
  },
  {
    id: 'macro-3',
    projectId: PROJECT_1,
    title: 'Instalações elétricas e hidráulicas',
    description: 'Eletrodutos, tubulações e caixas de passagem.',
    progress: 25,
    period: 'quarter',
    startDate: '2026-04-01',
    endDate: '2026-07-31',
  },
  {
    id: 'macro-4',
    projectId: PROJECT_1,
    title: 'Acabamentos gerais',
    description: 'Revestimentos, pintura, esquadrias e limpeza final.',
    progress: 0,
    period: 'year',
    startDate: '2026-08-01',
    endDate: '2026-09-30',
  },
];

export const DEMO_SUPPLIERS: ObrasSupplier[] = [
  { id: 'sup-1', projectId: PROJECT_1, name: 'Concremix Ltda', category: 'Concreto', phone: '(73) 3333-1111', totalPaid: 89400 },
  { id: 'sup-2', projectId: PROJECT_1, name: 'Ferro & Aço BA', category: 'Aço', phone: '(73) 3333-2222', totalPaid: 67200 },
  { id: 'sup-3', projectId: PROJECT_1, name: 'Hidráulica Total', category: 'Hidráulica', phone: '(73) 3333-3333', totalPaid: 12800 },
  { id: 'sup-4', projectId: PROJECT_1, name: 'Tintas Premium', category: 'Tintas', phone: '(73) 3333-4444', totalPaid: 4200 },
];

export const DEMO_EMPLOYEES: ObrasEmployee[] = [
  { id: 'emp-1', projectId: PROJECT_1, name: 'Pedro Pedreiro', role: 'Pedreiro', dailyRate: 180, phone: '(73) 99999-0003', active: true },
  { id: 'emp-2', projectId: PROJECT_1, name: 'Maria Pintora', role: 'Pintora', dailyRate: 160, phone: '(73) 99999-0004', active: true },
  { id: 'emp-3', projectId: PROJECT_1, name: 'Lucas Servente', role: 'Servente', dailyRate: 120, phone: '(73) 99999-0005', active: true },
  { id: 'emp-4', projectId: PROJECT_1, name: 'Ana Eletricista', role: 'Eletricista', dailyRate: 200, phone: '(73) 99999-0006', active: true },
];

const today = new Date().toISOString().slice(0, 10);

export const DEMO_TASKS: WorkTask[] = [
  {
    id: 'task-1',
    projectId: PROJECT_1,
    title: 'Rebocar paredes — Apt 101',
    description: 'Aplicar massa corrida e preparar para pintura.',
    area: 'Apartamento 101',
    icon: 'construct-outline',
    assignedTo: 'emp-1',
    assignedBy: 'usr-foreman',
    status: 'in_progress',
    priority: 'high',
    dueDate: today,
    createdAt: '2026-08-28T08:00:00',
  },
  {
    id: 'task-2',
    projectId: PROJECT_1,
    title: 'Pintar banheiro — Apt 101',
    description: 'Duas demãos de tinta acrílica branca.',
    area: 'Banheiro Apt 101',
    icon: 'color-palette-outline',
    assignedTo: 'emp-2',
    assignedBy: 'usr-foreman',
    status: 'pending',
    priority: 'medium',
    dueDate: today,
    createdAt: '2026-08-28T08:00:00',
  },
  {
    id: 'task-3',
    projectId: PROJECT_1,
    title: 'Passar cabos elétricos — 2º pav',
    description: 'Instalar eletrodutos e passar fiação dos apartamentos 201 e 202.',
    area: '2º Pavimento',
    icon: 'flash-outline',
    assignedTo: 'emp-4',
    assignedBy: 'usr-admin',
    status: 'pending',
    priority: 'high',
    dueDate: today,
    createdAt: '2026-08-29T07:30:00',
  },
  {
    id: 'task-4',
    projectId: PROJECT_1,
    title: 'Limpar área de serviço',
    description: 'Retirar entulho e organizar materiais.',
    area: 'Área comum',
    icon: 'trash-outline',
    assignedTo: 'emp-3',
    assignedBy: 'usr-foreman',
    status: 'done',
    priority: 'low',
    dueDate: today,
    createdAt: '2026-08-29T06:00:00',
  },
  {
    id: 'task-5',
    projectId: PROJECT_1,
    title: 'Conferir ferragens — laje 3º pav',
    description: 'Verificar espaçamento e amarração antes da concretagem.',
    area: '3º Pavimento',
    icon: 'grid-outline',
    assignedTo: 'emp-1',
    assignedBy: 'usr-admin',
    status: 'pending',
    priority: 'high',
    dueDate: '2026-09-02',
    createdAt: '2026-08-29T09:00:00',
  },
];

export const DEMO_EXPENSES: ObrasExpense[] = [
  { id: 'exp-1', projectId: PROJECT_1, category: 'supplier', supplierId: 'sup-1', amount: 28400, description: 'Concreto usinado — laje 2º pav', date: '2026-08-25', invoiceRef: 'NF-4521' },
  { id: 'exp-2', projectId: PROJECT_1, category: 'supplier', supplierId: 'sup-2', amount: 15600, description: 'Vergalhão CA-50 — 3º pav', date: '2026-08-22', invoiceRef: 'NF-8892' },
  { id: 'exp-3', projectId: PROJECT_1, category: 'labor', employeeId: 'emp-1', amount: 5400, description: 'Diárias pedreiro — semana 34', date: '2026-08-23' },
  { id: 'exp-4', projectId: PROJECT_1, category: 'material', amount: 3200, description: 'Cimento, areia e brita', date: '2026-08-20', invoiceRef: 'NF-1102' },
  { id: 'exp-5', projectId: PROJECT_1, category: 'equipment', amount: 1800, description: 'Aluguel betoneira — 5 dias', date: '2026-08-18' },
  { id: 'exp-6', projectId: PROJECT_1, category: 'supplier', supplierId: 'sup-3', amount: 4200, description: 'Tubos PVC e conexões', date: '2026-08-15', invoiceRef: 'NF-3301' },
];

export const DEMO_CASH: CashEntry[] = [
  { id: 'cash-1', projectId: PROJECT_1, type: 'in', amount: 150000, description: 'Liberação 2ª medição — proprietário', date: '2026-08-01' },
  { id: 'cash-2', projectId: PROJECT_1, type: 'out', amount: 28400, description: 'Pagamento Concremix', date: '2026-08-25' },
  { id: 'cash-3', projectId: PROJECT_1, type: 'out', amount: 15600, description: 'Pagamento Ferro & Aço', date: '2026-08-22' },
  { id: 'cash-4', projectId: PROJECT_1, type: 'out', amount: 5400, description: 'Folha pedreiro', date: '2026-08-23' },
  { id: 'cash-5', projectId: PROJECT_1, type: 'in', amount: 50000, description: 'Adiantamento proprietário', date: '2026-08-10' },
];

export const DEMO_DOCS: ObrasDocument[] = [
  { id: 'doc-1', projectId: PROJECT_1, name: 'Cronograma físico-financeiro.xlsx', type: 'spreadsheet', uploadedAt: '2026-07-15T10:00:00' },
  { id: 'doc-2', projectId: PROJECT_1, name: 'NF Concremix 4521.pdf', type: 'invoice', uploadedAt: '2026-08-25T14:30:00' },
  { id: 'doc-3', projectId: PROJECT_1, name: 'Planta baixa — Bloco A.dwg', type: 'plan', uploadedAt: '2026-01-10T09:00:00' },
];

export const DEMO_INSIGHTS: AiInsight[] = [
  {
    id: 'ai-1',
    projectId: PROJECT_1,
    agent: 'Analista de Custos',
    title: 'Gasto com concreto 12% acima da média',
    body: 'Os últimos 30 dias mostram aumento de 12% no custo de concreto usinado. Sugestão: negociar contrato trimestral com Concremix ou cotar fornecedor alternativo.',
    severity: 'warning',
    createdAt: '2026-08-29T08:00:00',
  },
  {
    id: 'ai-2',
    projectId: PROJECT_1,
    agent: 'Planejador',
    title: 'Instalações elétricas atrasadas',
    body: 'O macro-item "Instalações elétricas" está com 25% de progresso vs. 40% esperado. Antecipe equipe elétrica na próxima semana para evitar gargalo no acabamento.',
    severity: 'critical',
    createdAt: '2026-08-29T08:05:00',
  },
  {
    id: 'ai-3',
    projectId: PROJECT_1,
    agent: 'Assistente Financeiro',
    title: 'Saldo positivo — margem saudável',
    body: 'Entradas superam saídas em R$ 50.600 neste mês. Reserva recomendada: manter 15% do orçamento restante para imprevistos.',
    severity: 'info',
    createdAt: '2026-08-29T08:10:00',
  },
];

export function buildDemoStore(): ObrasStore {
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === '1';
  return {
    users: demoMode ? DEMO_USERS : [],
    projects: DEMO_PROJECTS,
    macroItems: DEMO_MACRO,
    expenses: DEMO_EXPENSES,
    suppliers: DEMO_SUPPLIERS,
    employees: DEMO_EMPLOYEES,
    tasks: DEMO_TASKS,
    documents: DEMO_DOCS,
    cashEntries: DEMO_CASH,
    insights: DEMO_INSIGHTS,
  };
}
