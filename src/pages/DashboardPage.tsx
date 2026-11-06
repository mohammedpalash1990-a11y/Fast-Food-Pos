import { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChefHat,
  CircleDollarSign,
  Clock,
  Flame,
  Package,
  Receipt,
  ShoppingBag,
  TriangleAlert,
  Users
} from 'lucide-react';
import { useStore } from '../store';
import { Badge, Bar, Button, Card, DataTable, PageHeader, panel, StatCard, statusTone, type Column } from '../components/ui';
import { isToday, lastDays } from '../lib/pos';
import { clock, shortDate } from '../lib/format';
import type { Order } from '../types';

export default function DashboardPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { data, money } = useStore();
  const { orders, inventory, products, customers, attendance, employees } = data;

  const live = orders.filter(order => order.number !== 'HOLD' && order.status !== 'Cancelled');
  const todayOrders = live.filter(order => isToday(order.createdAt));
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const todayCollected = todayOrders.reduce((sum, order) => sum + order.paid, 0);
  const openOrders = live.filter(order => !['Completed', 'Cancelled'].includes(order.status));
  const kitchenQueue = live.filter(order => ['Pending', 'Accepted', 'Preparing'].includes(order.status));
  const lowStock = inventory.filter(item => item.stock <= item.reorderLevel);
  const stockValue = inventory.reduce((sum, item) => sum + item.stock * item.cost, 0);
  const dueTotal = customers.reduce((sum, customer) => sum + customer.due, 0);

  const days = lastDays(7);
  const series = days.map(day => ({
    day,
    total: live.filter(order => order.createdAt.slice(0, 10) === day).reduce((sum, order) => sum + order.total, 0)
  }));
  const maxSeries = Math.max(1, ...series.map(point => point.total));
  const yesterday = series[series.length - 2]?.total ?? 0;
  const delta = yesterday > 0 ? ((todayRevenue - yesterday) / yesterday) * 100 : 0;

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    todayOrders.forEach(order =>
      order.items.forEach(item => {
        const entry = map.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 };
        entry.qty += item.qty;
        entry.revenue += item.unitPrice * item.qty;
        map.set(item.productId, entry);
      })
    );
    const rows = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    return rows.length ? rows : products.slice(0, 5).map(product => ({ name: product.name, qty: 0, revenue: 0 }));
  }, [todayOrders, products]);

  const maxTop = Math.max(1, ...topProducts.map(item => item.qty));
  const presentToday = attendance.filter(record => isToday(record.date) && record.status === 'Present').length;
  const hourly = Array.from({ length: 12 }, (_, index) => {
    const from = 9 + index;
    const total = todayOrders
      .filter(order => {
        const hour = new Date(order.createdAt).getHours();
        return hour >= from && hour < from + 2;
      })
      .reduce((sum, order) => sum + order.total, 0);
    return { label: `${String(from).padStart(2, '0')}:00`, total };
  });
  const maxHourly = Math.max(1, ...hourly.map(entry => entry.total));

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Order',
      render: order => (
        <div>
          <div className="font-semibold text-white">#{order.number}</div>
          <div className="text-[10px] text-slate-500">{order.type}</div>
        </div>
      )
    },
    {
      key: 'customer',
      header: 'Customer',
      render: order => (
        <div>
          <div className="text-slate-200">{order.customerName}</div>
          <div className="text-[10px] text-slate-500">
            {order.items.reduce((sum, item) => sum + item.qty, 0)} items · {clock(order.createdAt)}
          </div>
        </div>
      )
    },
    { key: 'status', header: 'Status', render: order => <Badge tone={statusTone(order.status)}>{order.status}</Badge> },
    { key: 'pay', header: 'Payment', render: order => <span className="text-[11px] text-slate-400">{order.paymentMethod}</span> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: order => (
        <div>
          <div className="font-semibold text-white">{money(order.total)}</div>
          {order.due > 0 ? <div className="text-[10px] text-rose-300">{money(order.due)} due</div> : null}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Branch overview"
        title="Service dashboard"
        subtitle={`${data.settings.branchName} · live numbers refresh as your team bills orders, settles dues and receives stock.`}
        actions={
          <>
            <Button variant="outline" onClick={() => onNavigate('kitchen')}>
              <ChefHat size={14} /> Kitchen ({kitchenQueue.length})
            </Button>
            <Button onClick={() => onNavigate('pos')}>
              <ShoppingBag size={14} /> New order
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales today"
          value={money(todayRevenue)}
          icon={<CircleDollarSign size={15} />}
          hint={
            <span className="inline-flex items-center gap-1">
              {delta >= 0 ? <ArrowUpRight size={11} className="text-emerald-400" /> : <ArrowDownRight size={11} className="text-rose-400" />}
              {Math.abs(delta).toFixed(1)}% vs yesterday · {todayOrders.length} orders
            </span>
          }
        />
        <StatCard label="Collected today" value={money(todayCollected)} tone="green" icon={<Receipt size={15} />} hint={`${money(todayRevenue - todayCollected)} still to collect`} />
        <StatCard label="Open orders" value={openOrders.length} tone="amber" icon={<Clock size={15} />} hint={`${kitchenQueue.length} in kitchen pipeline`} />
        <StatCard label="Customer dues" value={money(dueTotal)} tone="red" icon={<Users size={15} />} hint={`${customers.filter(c => c.due > 0).length} accounts with balance`} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[13.5px] font-semibold text-slate-100">Revenue — last 7 days</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Total billed value per service day</p>
            </div>
            <div className="text-right">
              <div className="font-serif text-[19px] text-white">{money(series.reduce((sum, point) => sum + point.total, 0))}</div>
              <div className="text-[10px] text-slate-500">7-day total</div>
            </div>
          </div>
          <div className="flex h-[168px] items-end gap-2.5">
            {series.map(point => (
              <div key={point.day} className="group flex flex-1 flex-col items-center gap-2">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      point.day === days[days.length - 1] ? 'bg-gradient-to-t from-[#b37a18] to-[#f0ca69]' : 'bg-white/[.09] group-hover:bg-white/[.16]'
                    }`}
                    style={{ height: `${Math.max(4, (point.total / maxSeries) * 100)}%` }}
                    title={`${shortDate(point.day)} · ${money(point.total)}`}
                  />
                </div>
                <div className="text-[9.5px] text-slate-500">{new Date(`${point.day}T12:00:00`).toLocaleDateString('en', { weekday: 'short' })}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-[13.5px] font-semibold text-slate-100">Today’s service rhythm</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Two-hour billing windows</p>
            </div>
            <Badge tone="gold">Live</Badge>
          </div>
          <div className="space-y-2">
            {hourly.map(slot => (
              <div key={slot.label} className="flex items-center gap-2.5">
                <span className="w-9 shrink-0 text-[9.5px] text-slate-500">{slot.label}</span>
                <Bar value={slot.total} max={maxHourly} tone={slot.total > 0 ? 'gold' : 'blue'} />
                <span className="w-14 shrink-0 text-right text-[10px] text-slate-400">{slot.total > 0 ? money(slot.total) : '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-4">
            <div>
              <h3 className="text-[13.5px] font-semibold text-slate-100">Recent orders</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Latest tickets across all channels</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>
              View all
            </Button>
          </div>
          <div className="mt-3 px-2 pb-2">
            <DataTable columns={columns} rows={[...orders.filter(o => o.number !== 'HOLD')].slice(0, 6)} rowKey={order => order.id} dense />
          </div>
        </Card>

        <div className="space-y-3">
          <Card>
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-[13.5px] font-semibold text-slate-100">Best sellers today</h3>
              <Flame size={15} className="text-[#e7b943]" />
            </div>
            <div className="space-y-2.5">
              {topProducts.map(item => (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate text-slate-300">{item.name}</span>
                    <span className="shrink-0 text-slate-500">{item.qty} sold</span>
                  </div>
                  <Bar value={item.qty} max={maxTop} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13.5px] font-semibold text-slate-100">Attention needed</h3>
              <TriangleAlert size={15} className="text-amber-300" />
            </div>
            <div className="space-y-1.5">
              <button onClick={() => onNavigate('inventory')} className="flex w-full items-center gap-2.5 rounded-lg border border-amber-400/15 bg-amber-400/[.05] px-2.5 py-2 text-left transition hover:bg-amber-400/10">
                <Package size={14} className="shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-medium text-amber-100">{lowStock.length} items below reorder level</div>
                  <div className="truncate text-[10px] text-amber-200/60">Stock value {money(stockValue)}</div>
                </div>
              </button>
              <button onClick={() => onNavigate('attendance')} className="flex w-full items-center gap-2.5 rounded-lg border border-white/[.07] bg-white/[.02] px-2.5 py-2 text-left transition hover:bg-white/[.05]">
                <Users size={14} className="shrink-0 text-sky-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-medium text-slate-200">
                    {presentToday}/{employees.length} staff present today
                  </div>
                  <div className="text-[10px] text-slate-500">Attendance register</div>
                </div>
              </button>
              <button onClick={() => onNavigate('dues')} className="flex w-full items-center gap-2.5 rounded-lg border border-white/[.07] bg-white/[.02] px-2.5 py-2 text-left transition hover:bg-white/[.05]">
                <CircleDollarSign size={14} className="shrink-0 text-rose-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-medium text-slate-200">{money(dueTotal)} customer due outstanding</div>
                  <div className="text-[10px] text-slate-500">Collect from the due ledger</div>
                </div>
              </button>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Menu items', value: products.length, hint: `${products.filter(p => p.active !== false).length} live on the menu`, view: 'menu' },
          { label: 'Stock value', value: money(stockValue), hint: `${inventory.length} ingredients tracked`, view: 'inventory' },
          { label: 'Customers', value: customers.length, hint: `${customers.reduce((sum, c) => sum + c.loyaltyPoints, 0)} loyalty points issued`, view: 'customers' },
          { label: 'Average ticket', value: money(todayOrders.length ? todayRevenue / todayOrders.length : 0), hint: 'Today’s average order value', view: 'reports' }
        ].map(item => (
          <button key={item.label} onClick={() => onNavigate(item.view)} className={`${panel} p-4 text-left transition hover:border-[#e7b943]/25`}>
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1.5 font-serif text-[19px] text-white">{item.value}</div>
            <div className="mt-1 text-[10.5px] text-slate-500">{item.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
