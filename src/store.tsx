import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  categories as demoCategories,
  demoAttendance,
  demoAuditLogs,
  demoCoupons,
  demoCustomers,
  demoEmployees,
  demoExpenses,
  demoInventory,
  demoOrders,
  demoPayments,
  demoPayroll,
  demoProducts,
  demoPurchases,
  demoReservations,
  demoSettings,
  demoStockMovements,
  demoSuppliers,
  demoTables
} from './data/demoData';
import { api, tokenStore, type AppData } from './lib/api';
import { uid } from './lib/format';
import type { AuthUser } from './types';

const OFFLINE_KEY = 'musafir-offline-state-v2';

export const fallbackData: AppData = {
  settings: demoSettings,
  categories: demoCategories as string[],
  products: demoProducts,
  inventory: demoInventory,
  stockMovements: demoStockMovements,
  customers: demoCustomers,
  tables: demoTables,
  reservations: demoReservations,
  suppliers: demoSuppliers,
  purchases: demoPurchases,
  orders: demoOrders,
  expenses: demoExpenses,
  employees: demoEmployees,
  attendance: demoAttendance,
  payroll: demoPayroll,
  coupons: demoCoupons,
  payments: demoPayments,
  logs: demoAuditLogs,
  users: []
};

function readOffline(): AppData {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) return fallbackData;
    return { ...fallbackData, ...(JSON.parse(raw) as Partial<AppData>) };
  } catch {
    return fallbackData;
  }
}

type Patch = Partial<AppData> | ((prev: AppData) => Partial<AppData>);
type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface StoreValue {
  data: AppData;
  ready: boolean;
  sync: SyncState;
  message: string | null;
  user: AuthUser | null;
  authBusy: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  enterOffline: () => void;
  commit: (patch: Patch, log?: { title: string; detail: string; actor?: string }) => void;
  notify: (text: string) => void;
  toast: string;
  dismissToast: () => void;
  reload: () => Promise<void>;
  money: (amount: number) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(fallbackData);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [toast, setToast] = useState('');

  const dataRef = useRef(data);
  dataRef.current = data;
  const dirty = useRef(0);
  const online = useRef(true);

  const notify = useCallback((text: string) => setToast(text), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    try {
      const payload = await api.bootstrap();
      const merged: AppData = { ...fallbackData, ...payload };
      setData(merged);
      online.current = true;
      setSync('idle');
      setMessage(null);
      try {
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(merged));
      } catch {
        /* ignore quota errors */
      }
    } catch {
      online.current = false;
      setData(readOffline());
      setSync('offline');
      setMessage('API server unreachable — running in local offline mode. Changes will sync when the API is back.');
    } finally {
      setReady(true);
    }
  }, []);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    api
      .me()
      .then(result => setUser(result.user))
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      });
  }, []);

  const commit = useCallback((patch: Patch, log?: { title: string; detail: string; actor?: string }) => {
    setData(prev => {
      const partial = typeof patch === 'function' ? patch(prev) : patch;
      const next: AppData = { ...prev, ...partial };
      if (log) {
        next.logs = [
          {
            id: uid('log'),
            title: log.title,
            detail: log.detail,
            actor: log.actor || 'Admin',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...next.logs
        ].slice(0, 250);
      }
      try {
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    dirty.current += 1;
  }, []);

  useEffect(() => {
    if (dirty.current === 0) return;
    const timer = window.setTimeout(async () => {
      if (!online.current || !tokenStore.get()) return;
      setSync('saving');
      const stamp = dirty.current;
      try {
        const snapshot = dataRef.current;
        await api.sync({
          settings: snapshot.settings,
          categories: snapshot.categories,
          products: snapshot.products,
          inventory: snapshot.inventory,
          stockMovements: snapshot.stockMovements,
          customers: snapshot.customers,
          tables: snapshot.tables,
          reservations: snapshot.reservations,
          suppliers: snapshot.suppliers,
          purchases: snapshot.purchases,
          orders: snapshot.orders,
          expenses: snapshot.expenses,
          employees: snapshot.employees,
          attendance: snapshot.attendance,
          payroll: snapshot.payroll,
          coupons: snapshot.coupons,
          payments: snapshot.payments,
          logs: snapshot.logs
        });
        if (dirty.current === stamp) dirty.current = 0;
        setSync('saved');
        setMessage(null);
        window.setTimeout(() => setSync(current => (current === 'saved' ? 'idle' : current)), 2200);
      } catch {
        setSync('error');
        setMessage('Could not save to the database. Your changes are kept locally and will retry.');
        online.current = false;
        window.setTimeout(() => {
          online.current = true;
        }, 15000);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data]);

  const login = useCallback(
    async (email: string, password: string) => {
      setAuthBusy(true);
      try {
        const result = await api.login(email, password);
        tokenStore.set(result.token);
        setUser(result.user);
        notify(`Welcome back, ${result.user.displayName}`);
        await load();
      } finally {
        setAuthBusy(false);
      }
    },
    [load, notify]
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    notify('Signed out of the session.');
  }, [notify]);

  const enterOffline = useCallback(() => {
    setUser({ id: 'guest', email: 'guest@local', displayName: 'Offline Guest', role: 'owner' });
    notify('Offline preview mode enabled.');
  }, [notify]);

  const money = useCallback((amount: number) => {
    const currency = dataRef.current.settings.currency || '৳';
    return `${currency}${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString('en-US')}`;
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      ready,
      sync,
      message,
      user,
      authBusy,
      login,
      logout,
      enterOffline,
      commit,
      notify,
      toast,
      dismissToast: () => setToast(''),
      reload,
      money
    }),
    [data, ready, sync, message, user, authBusy, login, logout, enterOffline, commit, notify, toast, reload, money]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside StoreProvider');
  return context;
}

export function useApp(): AppData {
  return useStore().data;
}
