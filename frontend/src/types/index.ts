export interface User {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'manager';
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  budget: number;
  start_date?: string;
  end_date?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  milestone_count?: number;
  completed_milestones?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  due_date: string;
  amount?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  project_id?: number;
  project_name?: string;
  payment_method_id?: number;
  payment_method_name?: string;
  reference_number?: string;
  receipt_path?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface TransactionCategory {
  id: number;
  name: string;
  color: string;
  icon?: string;
  type: 'income' | 'expense';
  user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectCategory {
  id: number;
  name: string;
  color: string;
  description?: string;
  user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  type: 'bank' | 'cash' | 'e_wallet' | 'credit_card' | 'debit_card' | 'other';
  account_number?: string;
  account_name?: string;
  bank_name?: string;
  description?: string;
  is_active: boolean;
  user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardOverview {
  period: string;
  financial_summary: {
    total_income: number;
    total_expense: number;
    net_amount: number;
    income_count: number;
    expense_count: number;
  };
  project_summary: Array<{
    status: string;
    project_count: number;
    total_budget: number;
  }>;
  recent_transactions: Transaction[];
  active_projects: Project[];
  expense_by_category: Array<{
    name: string;
    color: string;
    total_amount: number;
  }>;
  monthly_trend: Array<{
    month: string;
    type: string;
    total_amount: number;
  }>;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  name: string;
  password: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  category_id?: number;
  budget: number;
  start_date?: string;
  end_date?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  status?: string;
}

export interface CreateTransactionRequest {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  category_id?: number;
  project_id?: number;
  payment_method_id?: number;
  reference_number?: string;
  notes?: string;
  items?: TransactionItem[];
}