import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Bike,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CloudOff,
  CreditCard,
  Grid2X2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Table2,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { useStore } from '../store';

export interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  hint?: string;
}

export const moduleGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Live branch overview' },
      { id: 'pos', label: 'POS / Billing', icon: ShoppingCart, hint: 'Take orders and collect payment' },
      { id: 'orders', label: 'Orders', icon: ClipboardList, hint: 'Order lifecycle and receipts' },
      { id: 'kitchen', label: 'Kitchen Display', icon: ChefHat, hint: 'Ticket board for the kitchen' },
      { id: 'tables', label: 'Tables Management', icon: Table2, hint: 'Floor plan and seating' },
      { id: 'reservations', label: 'Reservations', icon: CalendarDays, hint: 'Advance table bookings' }
    ]
  },
  {
    title: 'Restaurant',
    items: [
      { id: 'customers', label: 'Customers', icon: Users, hint: 'Guest profiles and loyalty' },
      { id: 'menu', label: 'Menu Management', icon: BookOpen, hint: 'Products, prices and visibility' },
      { id: 'categories', label: 'Categories', icon: Grid2X2, hint: 'Menu sections and ordering' },
      { id: 'inventory', label: 'Inventory', icon: Boxes, hint: 'Stock levels and movements' },
      { id: 'recipes', label: 'Recipes & Ingredients', icon: Package, hint: 'Bill of materials per item' },
      { id: 'suppliers', label: 'Suppliers', icon: BriefcaseBusiness, hint: 'Vendors and payables' },
      { id: 'purchases', label: 'Purchase Management', icon: ShoppingBag, hint: 'Goods received notes' },
      { id: 'delivery', label: 'Delivery Management', icon: Bike, hint: 'Rider assignment and status' }
    ]
  },
  {
    title: 'Finance & team',
    items: [
      { id: 'expenses', label: 'Expenses', icon: Wallet, hint: 'Operating cost ledger' },
      { id: 'employees', label: 'Employee Management', icon: Users, hint: 'Staff directory and shifts' },
      { id: 'attendance', label: 'Attendance', icon: CalendarDays, hint: 'Daily check-in register' },
      { id: 'payroll', label: 'Salary & Payroll', icon: CircleDollarSign, hint: 'Monthly salary runs' },
      { id: 'accounting', label: 'Accounting', icon: BarChart3, hint: 'Cash, payments and ledger' },
      { id: 'reports', label: 'Sales Reports', icon: BarChart3, hint: 'Revenue analytics' },
      { id: 'profit', label: 'Profit & Loss', icon: Activity, hint: 'Margin and cost breakdown' },
      { id: 'dues', label: 'Customer Due', icon: CreditCard, hint: 'Receivables collection' },
      { id: 'discounts', label: 'Discounts & Coupons', icon: Sparkles, hint: 'Promo codes' }
    ]
  },
  {
    title: 'Channels & setup',
    items: [
      { id: 'qr', label: 'QR Menu', icon: Grid2X2, hint: 'Table QR codes and public menu' },
      { id: 'settings', label: 'Settings', icon: Settings, hint: 'Branch profile and tax' },
      { id: 'roles', label: 'User Roles & Permissions', icon: ShieldCheck, hint: 'Role matrix and staff accounts' }
    ]
  }
];

export const allModules = moduleGroups.flatMap(group => group.items);

export default function Shell({
  view,
  onNavigate,
  children
}: {
  view: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
}) {
  const { data, user, logout, sync, message, toast, dismissToast, money } = useStore();
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const lowStock = data.inventory.filter(item => item.stock <= item.reorderLevel);
  const activeLabel = allModules.find(item => item.id === view)?.label ?? 'Dashboard';
  const held = data.orders.filter(order => order.number === 'HOLD');
  const openOrders = data.orders.filter(order => !['Completed', 'Cancelled'].includes(order.status) && order.number !== 'HOLD');

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return { modules: [], products: [] };
    return {
      modules: allModules.filter(item => item.label.toLowerCase().includes(term) || item.id.includes(term)).slice(0, 5),
      products: data.products.filter(item => item.name.toLowerCase().includes(term)).slice(0, 4)
    };
  }, [query, data.products]);

  const go = (id: string) => {
    onNavigate(id);
    setMobileNav(false);
    setProfileOpen(false);
    setAlertsOpen(false);
    setQuery('');
  };

  const syncLabel =
    sync === 'saving' ? 'Saving…' : sync === 'saved' ? 'Saved to database' : sync === 'error' ? 'Save failed' : sync === 'offline' ? 'Offline mode' : 'Database connected';

  return (
    <div className="min-h-screen bg-[#0b0e11] text-slate-100">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-white/[.06] bg-[#0f1216] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            mobileNav ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-[68px] shrink-0 items-center gap-3 border-b border-white/[.06] px-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#f0ca69] to-[#b37a18] font-serif text-xl font-black text-[#201707]">
              M
            </div>
            <div className="min-w-0">
              <div className="truncate font-serif text-[17px] font-bold tracking-wide text-white">{data.settings.restaurantName || 'Musafir'}</div>
              <div className="text-[9px] uppercase tracking-[.24em] text-[#cba84c]">{data.settings.branchCode} · POS</div>
            </div>
            <button onClick={() => setMobileNav(false)} className="ml-auto text-slate-500 lg:hidden" aria-label="Close menu">
              <X size={18} />
            </button>
          </div>

          <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-white/[.06] bg-white/[.025] p-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e7b943] text-[12px] font-bold text-[#211908]">
              {(user?.displayName || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">{user?.displayName || 'Admin'}</div>
              <div className="truncate text-[10px] capitalize text-slate-500">{user?.role || 'owner'} access</div>
            </div>
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          </div>

          <nav className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
            {moduleGroups.map(group => (
              <div key={group.title}>
                <div className="mb-1.5 px-2.5 text-[9px] font-bold uppercase tracking-[.2em] text-slate-600">{group.title}</div>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const active = view === item.id;
                    const count =
                      item.id === 'kitchen'
                        ? openOrders.filter(order => ['Pending', 'Accepted', 'Preparing'].includes(order.status)).length
                        : item.id === 'orders'
                          ? openOrders.length
                          : item.id === 'pos'
                            ? held.length
                            : 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => go(item.id)}
                        title={item.hint}
                        className={`nav-item ${active ? 'nav-active' : ''}`}
                      >
                        <Icon size={15} strokeWidth={1.8} />
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        {count > 0 ? (
                          <span className="rounded-full bg-[#e7b943]/90 px-1.5 py-0.5 text-[9.5px] font-bold text-[#221a08]">{count}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-white/[.06] p-2.5">
            <div className="rounded-xl border border-[#e7b943]/12 bg-gradient-to-r from-[#211d13] to-[#14181a] p-2.5">
              <div className="text-[11px] font-medium text-[#ead18b]">Good Food • Good Mood</div>
              <div className="mt-0.5 text-[10px] text-slate-500">Today is a fresh service — make it count.</div>
            </div>
            <button
              onClick={logout}
              className="mt-1.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11.5px] text-slate-500 transition hover:bg-white/[.04] hover:text-slate-200"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </aside>

        {mobileNav ? (
          <button aria-label="Close navigation overlay" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-white/[.06] bg-[#0d1013]/92 px-3 backdrop-blur-xl md:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <button onClick={() => setMobileNav(true)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Open menu">
                <Menu size={19} />
              </button>
              <div className="hidden items-center gap-2 text-[11.5px] text-slate-500 sm:flex">
                <span className="truncate">{data.settings.branchName}</span>
                <span>/</span>
                <span className="whitespace-nowrap text-slate-200">{activeLabel}</span>
              </div>
              <div className="truncate text-[13px] font-medium text-white sm:hidden">{activeLabel}</div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className="relative hidden md:block">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Find module or item…"
                  className="w-[220px] rounded-lg border border-white/[.07] bg-white/[.03] py-1.5 pl-8 pr-2 text-[11.5px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#e7b943]/40"
                />
                {query ? (
                  <div className="absolute right-0 top-[calc(100%+6px)] w-[300px] overflow-hidden rounded-xl border border-white/[.09] bg-[#12161a] shadow-2xl">
                    {results.modules.length === 0 && results.products.length === 0 ? (
                      <div className="px-3 py-3 text-[11.5px] text-slate-500">No matches for “{query}”.</div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto py-1">
                        {results.modules.map(item => (
                          <button key={item.id} onClick={() => go(item.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11.5px] text-slate-300 hover:bg-white/[.05]">
                            <item.icon size={14} className="text-[#e7b943]" /> {item.label}
                          </button>
                        ))}
                        {results.products.map(product => (
                          <button key={product.id} onClick={() => go('menu')} className="flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-[11.5px] text-slate-300 hover:bg-white/[.05]">
                            <span className="truncate">{product.name}</span>
                            <span className="shrink-0 text-[10px] text-slate-500">{money(product.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => go('pos')}
                className="hidden rounded-lg border border-[#e7b943]/25 bg-[#e7b943]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#f0cd75] transition hover:bg-[#e7b943]/18 sm:block"
              >
                + New sale
              </button>

              <div className="relative">
                <button
                  onClick={() => setAlertsOpen(open => !open)}
                  className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5"
                  aria-label="Notifications"
                >
                  <Bell size={17} />
                  {lowStock.length > 0 || openOrders.length > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                  ) : null}
                </button>
                {alertsOpen ? (
                  <div className="absolute right-0 top-[calc(100%+6px)] w-[286px] overflow-hidden rounded-xl border border-white/[.09] bg-[#12161a] shadow-2xl">
                    <div className="border-b border-white/[.07] px-3 py-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Operational alerts</div>
                    <div className="max-h-72 space-y-1 overflow-y-auto p-1.5">
                      {lowStock.slice(0, 4).map(item => (
                        <button key={item.id} onClick={() => go('inventory')} className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-white/[.05]">
                          <div className="text-[11.5px] font-medium text-amber-200">{item.name} low stock</div>
                          <div className="text-[10px] text-slate-500">
                            {item.stock} {item.unit} left · reorder at {item.reorderLevel}
                          </div>
                        </button>
                      ))}
                      {openOrders.slice(0, 3).map(order => (
                        <button key={order.id} onClick={() => go('orders')} className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-white/[.05]">
                          <div className="text-[11.5px] font-medium text-slate-200">
                            #{order.number} · {order.status}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {order.customerName} · {money(order.total)}
                          </div>
                        </button>
                      ))}
                      {lowStock.length === 0 && openOrders.length === 0 ? (
                        <div className="px-2.5 py-4 text-center text-[11px] text-slate-500">Everything is on track.</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className={`hidden items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] sm:flex ${
                  sync === 'error' ? 'border-rose-400/25 bg-rose-500/10 text-rose-200' : sync === 'offline' ? 'border-amber-400/25 bg-amber-400/10 text-amber-200' : 'border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300'
                }`}
                title={message || syncLabel}
              >
                {sync === 'offline' ? <CloudOff size={11} /> : sync === 'saving' ? <Loader2 size={11} className="animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                {syncLabel}
              </div>

              <div className="relative">
                <button
                  onClick={() => setProfileOpen(open => !open)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[.08] px-2 py-1.5 text-[11px] text-slate-300 hover:bg-white/[.04]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e7b943]/15 text-[10px] font-bold text-[#e7b943]">
                    {(user?.displayName || 'A').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[92px] truncate sm:block">{user?.displayName || 'Admin'}</span>
                  <ChevronDown size={13} className="text-slate-500" />
                </button>
                {profileOpen ? (
                  <div className="absolute right-0 top-[calc(100%+6px)] w-[228px] overflow-hidden rounded-xl border border-white/[.09] bg-[#12161a] p-2 shadow-2xl">
                    <div className="rounded-lg bg-white/[.03] px-2.5 py-2">
                      <div className="truncate text-[12px] font-medium text-white">{user?.displayName || 'Admin'}</div>
                      <div className="truncate text-[10px] text-slate-500">{user?.email || 'offline@local'}</div>
                      <div className="mt-1 inline-flex rounded-full border border-[#e7b943]/25 bg-[#e7b943]/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#f0cd75]">
                        {user?.role || 'owner'}
                      </div>
                    </div>
                    <button onClick={() => go('settings')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] text-slate-300 hover:bg-white/[.05]">
                      <Settings size={13} /> Branch settings
                    </button>
                    <button onClick={() => go('roles')} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] text-slate-300 hover:bg-white/[.05]">
                      <ShieldCheck size={13} /> Roles & access
                    </button>
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] text-rose-300 hover:bg-rose-500/10">
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1560px] flex-1 px-3 py-4 md:px-6 md:py-6">
            {message ? (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[.07] px-3 py-2 text-[11.5px] text-amber-100">
                <CloudOff size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{message}</span>
              </div>
            ) : null}
            {children}
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/[.05] pt-3 text-[10px] text-slate-600">
              <span>
                {data.settings.restaurantName} · {data.settings.branchName}
              </span>
              <span>Good Food • Good Mood</span>
            </footer>
          </main>
        </div>
      </div>

      {toast ? (
        <button
          onClick={dismissToast}
          className="fixed bottom-4 right-4 z-[70] flex max-w-sm items-start gap-2 rounded-xl border border-[#e7b943]/20 bg-[#181c20] px-3.5 py-2.5 text-left text-[11.5px] text-slate-200 shadow-2xl"
        >
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e7b943]" />
          <span>{toast}</span>
        </button>
      ) : null}
    </div>
  );
}
