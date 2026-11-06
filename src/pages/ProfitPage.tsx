import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Bar, PageHeader, panel, Segmented, StatCard } from '../components/ui';
import { cogsForOrder, lastDays, orderStats } from '../lib/pos';
import { monthLabel, shortDate, today } from '../lib/format';

export default function ProfitPage() {
  const { data, money } = useStore();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');

  const days = lastDays(Number(range));
  const month = today().slice(0, 7);
  const orders = data.orders.filter(order => order.number !== 'HOLD' && order.status !== 'Cancelled' && days.includes(order.createdAt.slice(0, 10)));
  const stats = orderStats(orders);
  const cogs = orders.reduce((sum, order) => sum + cogsForOrder(order, data.products, data.inventory), 0);
  const expenses = data.expenses.filter(expense => days.includes(expense.date)).reduce((sum, expense) => sum + expense.amount, 0);
  const payroll = data.payroll.filter(record => days.some(day => day.startsWith(record.month))).reduce((sum, record) => sum + record.netPay, 0);
  const grossProfit = stats.revenue - cogs;
  const netProfit = grossProfit - expenses - payroll;
  const grossMargin = stats.revenue ? (grossProfit / stats.revenue) * 100 : 0;
  const netMargin = stats.revenue ? (netProfit / stats.revenue) * 100 : 0;

  const daily = useMemo(
    () =>
      days.map(day => {
        const entries = orders.filter(order => order.createdAt.slice(0, 10) === day);
        const revenue = entries.reduce((sum, order) => sum + order.total, 0);
        const dayCogs = entries.reduce((sum, order) => sum + cogsForOrder(order, data.products, data.inventory), 0);
        const dayExpense = data.expenses.filter(expense => expense.date === day).reduce((sum, expense) => sum + expense.amount, 0);
        return { day, label: shortDate(day), revenue, cogs: dayCogs, profit: revenue - dayCogs - dayExpense, expense: dayExpense };
      }),
    [days, orders, data.products, data.inventory, data.expenses]
  );

  const maxProfit = Math.max(1, ...daily.map(row => Math.abs(row.profit)));

  const productMargins = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; cost: number; qty: number }>();
    orders.forEach(order =>
      order.items.forEach(item => {
        const product = data.products.find(entry => entry.id === item.productId);
        const unitCost = product
          ? product.recipe.reduce((sum, usage) => {
              const ingredient = data.inventory.find(entry => entry.id === usage.ingredientId);
              return sum + (ingredient ? ingredient.cost * usage.qty : 0);
            }, 0)
          : 0;
        const entry = map.get(item.productId) ?? { name: item.name, revenue: 0, cost: 0, qty: 0 };
        entry.revenue += item.unitPrice * item.qty;
        entry.cost += unitCost * item.qty;
        entry.qty += item.qty;
        map.set(item.productId, entry);
      })
    );
    return [...map.values()]
      .map(entry => ({ ...entry, profit: entry.revenue - entry.cost, margin: entry.revenue ? ((entry.revenue - entry.cost) / entry.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [orders, data.products, data.inventory]);

  return (
    <div>
      <PageHeader
        eyebrow="Margin control"
        title="Profit & loss"
        subtitle="Revenue against recipe cost, operating expenses and paid salaries for the selected window."
        actions={<Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />}
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={money(stats.revenue)} icon={<TrendingUp size={15} />} hint={`${stats.count} orders · ${money(stats.average)} avg`} />
        <StatCard label="Gross profit" value={money(grossProfit)} tone={grossProfit >= 0 ? 'green' : 'red'} icon={<Scale size={15} />} hint={`${grossMargin.toFixed(1)}% margin after COGS`} />
        <StatCard label="Operating cost" value={money(expenses + payroll)} tone="amber" icon={<TrendingDown size={15} />} hint={`${money(expenses)} expenses · ${money(payroll)} payroll`} />
        <StatCard label="Net profit" value={money(netProfit)} tone={netProfit >= 0 ? 'blue' : 'red'} icon={netProfit >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} hint={`${netMargin.toFixed(1)}% net margin`} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <div className={`${panel} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[12.5px] font-semibold text-slate-200">Daily profit trend</h3>
            <Badge tone="gold">{range} days</Badge>
          </div>
          <div className="flex h-[160px] items-end gap-1.5">
            {daily.map(row => (
              <div key={row.day} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={`w-full rounded-t transition ${row.profit >= 0 ? 'bg-gradient-to-t from-[#2c6e4f] to-[#57d9a3]' : 'bg-gradient-to-t from-[#7a2436] to-[#f87171]'}`}
                  style={{ height: `${Math.max(3, (Math.abs(row.profit) / maxProfit) * 100)}%` }}
                  title={`${row.label} · ${money(row.profit)}`}
                />
                <span className="text-[8.5px] text-slate-600">{Number(range) > 14 ? '' : row.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${panel} p-4`}>
          <h3 className="text-[12.5px] font-semibold text-slate-200">P&L statement</h3>
          <div className="mt-2.5 space-y-1.5 text-[11.5px]">
            <div className="flex justify-between text-slate-400"><span>Gross revenue</span><span className="text-slate-100">{money(stats.revenue)}</span></div>
            <div className="flex justify-between text-slate-400"><span>Cost of goods sold</span><span className="text-rose-300">−{money(cogs)}</span></div>
            <div className="flex justify-between border-t border-white/[.07] pt-1.5 font-medium text-slate-100"><span>Gross profit</span><span>{money(grossProfit)}</span></div>
            <div className="flex justify-between text-slate-400"><span>Operating expenses</span><span className="text-rose-300">−{money(expenses)}</span></div>
            <div className="flex justify-between text-slate-400"><span>Payroll</span><span className="text-rose-300">−{money(payroll)}</span></div>
            <div className={`flex justify-between border-t border-white/[.07] pt-1.5 text-[13px] font-semibold ${netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              <span>Net profit</span>
              <span>{money(netProfit)}</span>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-[10.5px] text-slate-500">
            COGS uses the recipe cost of every ingredient at the moment of sale.{' '}
            {expenses > 0 ? `${monthLabel(month)} expenses and payroll are applied to the window.` : 'No operating expenses in this window.'}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className={`${panel} p-4`}>
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-slate-200">Product profitability</h3>
          <div className="space-y-2">
            {productMargins.slice(0, 10).map(item => (
              <div key={item.name}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-slate-300">{item.name}</span>
                  <span className={item.margin >= 40 ? 'text-emerald-300' : item.margin >= 20 ? 'text-slate-200' : 'text-amber-300'}>
                    {item.margin.toFixed(0)}% · {money(item.profit)}
                  </span>
                </div>
                <div className="mt-1"><Bar value={Math.max(0, item.margin)} max={100} tone={item.margin >= 40 ? 'green' : item.margin >= 20 ? 'gold' : 'red'} /></div>
              </div>
            ))}
            {productMargins.length === 0 ? <div className="py-4 text-center text-[11px] text-slate-600">No sales in this window.</div> : null}
          </div>
        </div>

        <div className={`${panel} p-4`}>
          <h3 className="mb-2.5 text-[12.5px] font-semibold text-slate-200">Daily breakdown</h3>
          <div className="custom-scrollbar max-h-[340px] space-y-1 overflow-y-auto pr-0.5">
            {daily.slice().reverse().map(row => (
              <div key={row.day} className="grid grid-cols-[64px_1fr_1fr_1fr] items-center gap-1.5 rounded-lg border border-white/[.05] bg-white/[.02] px-2 py-1.5 text-[10.5px]">
                <span className="text-slate-500">{row.label}</span>
                <span className="text-right text-slate-300">{money(row.revenue)}</span>
                <span className="text-right text-rose-300/80">−{money(row.cogs)}</span>
                <span className={`text-right font-medium ${row.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(row.profit)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
