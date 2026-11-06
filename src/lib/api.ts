import type {
  AttendanceRecord,
  AuthUser,
  Coupon,
  Customer,
  DiningTable,
  Employee,
  Expense,
  InventoryItem,
  LogEntry,
  Order,
  PaymentEntry,
  PayrollRecord,
  Product,
  Purchase,
  Reservation,
  RestaurantSettings,
  StockMovement,
  Supplier
} from '../types';

export interface AppData {
  settings: RestaurantSettings;
  categories: string[];
  products: Product[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  customers: Customer[];
  tables: DiningTable[];
  reservations: Reservation[];
  suppliers: Supplier[];
  purchases: Purchase[];
  orders: Order[];
  expenses: Expense[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  payroll: PayrollRecord[];
  coupons: Coupon[];
  payments: PaymentEntry[];
  logs: LogEntry[];
  users: AuthUser[];
}

const TOKEN_KEY = 'musafir-token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage may be unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = (payload as { error?: string }).error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export const api = {
  bootstrap: () => request<Partial<AppData>>('/api/bootstrap'),
  sync: (data: Partial<AppData>) => request<{ status: string }>('/api/sync', { method: 'POST', body: JSON.stringify(data) }),
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
  createUser: (payload: { email: string; displayName: string; role: string; password: string }) =>
    request<{ user: AuthUser }>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  health: () => request<{ status: string; engine: string }>('/api/health')
};

export const qrUrl = (table: string, baseUrl: string, branch: string) =>
  `/api/menu/qr?table=${encodeURIComponent(table)}&baseUrl=${encodeURIComponent(baseUrl)}&branch=${encodeURIComponent(branch)}`;
