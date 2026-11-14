export type ObrasRole = 'admin' | 'foreman' | 'worker';

export type PlanningPeriod = 'week' | 'month' | 'quarter' | 'year';

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed';

export type ExpenseCategory = 'material' | 'labor' | 'equipment' | 'supplier' | 'other';

export type TaskStatus = 'pending' | 'in_progress' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export type DocumentType = 'invoice' | 'spreadsheet' | 'plan' | 'other';

export type AiSeverity = 'info' | 'warning' | 'critical';

export interface ObrasUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: ObrasRole;
  projectIds: string[];
  phone?: string;
}

export interface ObrasProject {
  id: string;
  name: string;
  address: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  budget: number;
  spent: number;
  progress: number;
  description?: string;
}

export interface MacroItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  progress: number;
  period: PlanningPeriod;
  startDate: string;
  endDate: string;
}

export interface ObrasExpense {
  id: string;
  projectId: string;
  category: ExpenseCategory;
  supplierId?: string;
  employeeId?: string;
  amount: number;
  description: string;
  date: string;
  invoiceRef?: string;
}

export interface ObrasSupplier {
  id: string;
  projectId: string;
  name: string;
  category: string;
  phone?: string;
  totalPaid: number;
}

export interface ObrasEmployee {
  id: string;
  projectId: string;
  name: string;
  role: string;
  dailyRate: number;
  phone?: string;
  active: boolean;
}

export interface WorkTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  area: string;
  icon: string;
  assignedTo?: string;
  assignedBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  createdAt: string;
}

export interface ObrasDocument {
  id: string;
  projectId: string;
  name: string;
  type: DocumentType;
  uploadedAt: string;
  note?: string;
}

export interface CashEntry {
  id: string;
  projectId: string;
  type: 'in' | 'out';
  amount: number;
  description: string;
  date: string;
}

export interface AiInsight {
  id: string;
  projectId: string;
  agent: string;
  title: string;
  body: string;
  severity: AiSeverity;
  createdAt: string;
}

export interface ObrasSession {
  userId: string;
  activeProjectId: string | null;
  loggedAt: string;
}

export interface ObrasStore {
  users: ObrasUser[];
  projects: ObrasProject[];
  macroItems: MacroItem[];
  expenses: ObrasExpense[];
  suppliers: ObrasSupplier[];
  employees: ObrasEmployee[];
  tasks: WorkTask[];
  documents: ObrasDocument[];
  cashEntries: CashEntry[];
  insights: AiInsight[];
}
