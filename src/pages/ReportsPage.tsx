import { useMemo, useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Bar, Button, DataTable, PageHeader, panel, Segmented, type Column } from '../components/ui';
import { lastDays, orderStats } from '../lib/pos';
import { csv, download, shortDate } from '../lib/format';

type Row = { key: string; label: string; orders: number; revenue: number; avg: number };

export default function ReportsPage() {
  const { data, money } = useStore();
  const [range, setRange] = useState<'7' | '30' | '90'>('7');

  const orders = data.orders.filter(order => order.number !== 'HOLD' && order.status !== 'Cancelled');
  const days = lastDays(Number(range));
  const scoped = orders.filter(order => days.includes(order.createdAt.slice(0, 10)));
  const stats = orderStats(scoped);

  const daily: Row[] = days.map(day => {
    const entries = scoped.filter(order => order.createdAt.slice(0, 10) === day);
    const revenue = entries.reduce((sum, order) => sum + order.total, 0);
    return { key: day, label: shortDate(day), orders: entries.length, revenue, avg: entries.length ? revenue / entries.length : 0 };
  });
  const maxRevenue = Math.max(1, ...daily.map(row => row.revenue));

  const byCategory = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; qty: number }>();
    scoped.forEach(order =>
      order.items.forEach(item => {
        const product = data.products.find(entry => entry.id === item.productId);
        const key = product?.category ?? 'Other';
        const entry = map.get(key) ?? { orders: 0, revenue: 0, qty: 0 };
        entry.revenue += item.unitPrice * item.qty;
        entry.qty += item.qty;
        entry.orders += 1;
        map.set(key, entry);
      })
    );
    const total = [...map.values()].reduce((sum, value) => sum + value.revenue, 0);
    return [...map.entries()]
      .map(([category, value]) => ({ category, ...value, share: total ? (value.revenue / total) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [scoped, data.products]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; category: string }>();
    scoped.forEach(order =>
      order.items.forEach(item => {
        const product = data.products.find(entry => entry.id === item.productId);
        const entry = map.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0, category: product?.category ?? 'Other' };
        entry.qty += item.qty;
        entry.revenue += item.unitPrice * item.qty;
        map.set(item.productId, entry);
      })
    );
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [scoped, data.products]);

  const byChannel = ['Dine-in', 'Takeaway', 'Pickup', 'Home Delivery'].map(channel => {
    const entries = scoped.filter(order => order.type === channel);
    return { channel, count: entries.length, revenue: entries.reduce((sum, order) => sum + order.total, 0) };
  });

  const byPayment = ['Cash', 'Card', 'Digital', 'Bank transfer'].map(method => {
    const entries = scoped.filter(order => order.paymentMethod === method);
    return { method, count: entries.length, revenue: entries.reduce((sum, order) => sum + order.total, 0) };
  });

  const columns: Column<Row>[] = [
    { key: 'day', header: 'Date', render: row => <span className="text-[11.5px] text-slate-200">{row.label}</span> },
    { key: 'orders', header: 'Orders', align: 'center', render: row => <span className="text-[11px] text-slate-300">{row.orders}</span> },
    { key: 'avg', header: 'Avg ticket', align: 'right', render: row => <span className="text-[11px] text-slate-400">{money(row.avg)}</span> },
    { key: 'revenue', header: 'Revenue', align: 'right', render: row => <span className="font-semibold text-white">{money(row.revenue)}</span> }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Sales reports"
        subtitle="Revenue patterns, category mix, channel split and best sellers for the selected window."
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
            <Button
              variant="outline"
              onClick={() =>
                download(
                  `sales-report-${range}d.csv`,
                  csv([
                    ['Date', 'Orders', 'Revenue', 'Average ticket'],
                    ...daily.map(row => [row.key, row.orders, row.revenue.toFixed(2), row.avg.toFixed(2)])
                  ])
                )
              }
            >
              <Download size={13} /> Export
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Revenue', value: money(stats.revenue), hint: `${stats.count} orders billed` },
          { label: 'Average ticket', value: money(stats.average), hint: 'Per completed order' },
          { label: 'Collected', value: money(stats.collected), hint: `${money(stats.due)} outstanding` },
          { label: 'Items sold', value: byProduct.reduce((sum, item) => sum + item.qty, 0).toLocaleString('en-US'), hint: `${byProduct.length} distinct products` }
        ].map(item => (
          <div key={item.label} className={`${panel} p-4`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1.5 font-serif text-[20px] text-white">{item.value}</div>
            <div className="mt-1 text-[10.5px] text-slate-500">{item.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <div className={`${panel} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[12.5px] font-semibold text-slate-200">Daily revenue</h3>
            <Badge tone="gold"><TrendingUp size={9} /> last {range} days</Badge>
          </div>
          <div className="flex h-[150px] items-end gap-1.5">
            {daily.map(row => (
              <div key={row.key} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-[#8f6114] to-[#f0ca69] transition group-hover:brightness-110"
                  style={{ height: `${Math.max(3, (row.revenue / maxRevenue) * 100)}%` }}
                  title={`${row.label} · ${money(row.revenue)}`}
                />
                <span className="text-[8.5px] text-slate-600">{Number(range) > 14 ? '' : row.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${panel} p-4`}>
          <h3 className="text-[12.5px] font-semibold text-slate-200">Channel mix</h3>
          <div className="mt-2.5 space-y-2.5">
            {byChannel.map(entry => (
              <div key={entry.channel}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{entry.channel}</span>
                  <span className="text-slate-200">{money(entry.revenue)} <span className="text-slate-600">· {entry.count}</span></span>
                </div>
                <div className="mt-1"><Bar value={entry.revenue} max={Math.max(1, ...byChannel.map(c => c.revenue))} /></div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-white/[.07] pt-2.5">
            <h4 className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500">Payment methods</h4>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {byPayment.map(entry => (
                <div key={entry.method} className="rounded-lg border border-white/[.07] bg-white/[.02] px-2 py-1.5">
                  <div className="text-[10px] text-slate-500">{entry.method}</div>
                  <div className="text-[11.5px] font-medium text-slate-200">{money(entry.revenue)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className={`${panel} p-4`}>
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-slate-200">Category performance</h3>
          <div className="space-y-2">
            {byCategory.map(entry => (
              <div key={entry.category} className="grid grid-cols-[1fr_56px_80px] items-center gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] text-slate-300">{entry.category}</div>
                  <Bar value={entry.share} max={100} tone="gold" />
                </div>
                <div className="text-right text-[10.5px] text-slate-500">{entry.qty} pcs</div>
                <div className="text-right text-[11px] text-slate-200">{money(entry.revenue)}</div>
              </div>
            ))}
            {byCategory.length === 0 ? <div className="py-4 text-center text-[11px] text-slate-600">No sales in this window.</div> : null}
          </div>
        </div>

        <div className={`${panel} p-4`}>
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-slate-200">Top products</h3>
          <div className="space-y-1.5">
            {byProduct.slice(0, 8).map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 rounded-lg border border-white/[.05] bg-white/[.02] px-2 py-1.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#e7b943]/10 text-[9.5px] font-bold text-[#e7b943]">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] text-slate-200">{item.name}</div>
                  <div className="text-[9.5px] text-slate-500">{item.category} · {item.qty} sold</div>
                </div>
                <span className="text-[11px] font-medium text-slate-200">{money(item.revenue)}</span>
              </div>
            ))}
            {byProduct.length === 0 ? <div className="py-4 text-center text-[11px] text-slate-600">Nothing sold yet.</div> : null}
          </div>
        </div>
      </div>

      <div className={`${panel} mt-3 p-3`}>
        <h3 className="mb-2 px-1 text-[12.5px] font-semibold text-slate-200">Day-by-day ledger</h3>
        <DataTable columns={columns} rows={daily.slice().reverse()} rowKey={row => row.key} dense />
      </div>
    </div>
  );
}
