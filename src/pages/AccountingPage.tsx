import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Landmark, Scale } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, PageHeader, panel, Select, StatCard, type Column } from '../components/ui';
import { csv, download, shortDate, today } from '../lib/format';
import type { PaymentEntry } from '../types';

export default function AccountingPage() {
  const { data, commit, notify, money } = useStore();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [direction, setDirection] = useState('All');
  const [category, setCategory] = useState('All');

  const months = Array.from(new Set([month, ...data.payments.map(payment => payment.createdAt.slice(0, 7)), today().slice(0, 7)])).sort().reverse();
  const payments = useMemo(
    () =>
      data.payments
        .filter(payment => payment.createdAt.startsWith(month))
        .filter(payment => direction === 'All' || payment.direction === direction)
        .filter(payment => category === 'All' || payment.category === category)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.payments, month, direction, category]
  );

  const cashIn = data.payments.filter(payment => payment.createdAt.startsWith(month) && payment.direction === 'in').reduce((sum, payment) => sum + payment.amount, 0);
  const cashOut = data.payments.filter(payment => payment.createdAt.startsWith(month) && payment.direction === 'out').reduce((sum, payment) => sum + payment.amount, 0);

  const byCategory = ['Order Sale', 'Due Collection', 'Supplier Payment', 'Expense', 'Payroll'].map(value => ({
    category: value,
    amount: data.payments.filter(payment => payment.createdAt.startsWith(month) && payment.category === value).reduce((sum, payment) => sum + payment.amount, 0),
    direction: data.payments.find(payment => payment.category === value)?.direction ?? 'in'
  }));

  const remove = (payment: PaymentEntry) => {
    commit({ payments: data.payments.filter(entry => entry.id !== payment.id) }, { title: 'Ledger entry deleted', detail: `${payment.category} · ${money(payment.amount)} · ${payment.partyName}` });
    notify('Ledger entry removed.');
  };

  const columns: Column<PaymentEntry>[] = [
    {
      key: 'date',
      header: 'Date',
      render: payment => (
        <div>
          <div className="text-[11.5px] text-slate-200">{shortDate(payment.createdAt)}</div>
          <div className="text-[10px] text-slate-500">{new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      )
    },
    {
      key: 'direction',
      header: 'Flow',
      render: payment => (
        <Badge tone={payment.direction === 'in' ? 'green' : 'red'}>
          {payment.direction === 'in' ? <ArrowDownLeft size={9} /> : <ArrowUpRight size={9} />}
          {payment.direction === 'in' ? 'Cash in' : 'Cash out'}
        </Badge>
      )
    },
    { key: 'category', header: 'Category', render: payment => <span className="text-[11px] text-slate-300">{payment.category}</span> },
    {
      key: 'party',
      header: 'Party',
      render: payment => (
        <div>
          <div className="text-[11.5px] text-slate-200">{payment.partyName}</div>
          <div className="line-clamp-1 max-w-[240px] text-[10px] text-slate-500">{payment.note}</div>
        </div>
      )
    },
    { key: 'method', header: 'Method', render: payment => <span className="text-[10.5px] text-slate-400">{payment.method}</span> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: payment => <span className={`font-semibold ${payment.direction === 'in' ? 'text-emerald-300' : 'text-rose-300'}`}>{payment.direction === 'in' ? '+' : '−'}{money(payment.amount)}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: payment => (
        <button onClick={() => remove(payment)} className="text-[9.5px] text-rose-400/70 hover:text-rose-300">reverse</button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Cash book"
        title="Accounting"
        subtitle="Every sale, due collection, supplier payment, expense and salary posts to this ledger automatically."
        actions={
          <>
            <Select value={month} onChange={setMonth} options={months.map(value => ({ value, label: value }))} className="w-[130px]" />
            <Button
              variant="outline"
              onClick={() =>
                download(
                  `ledger-${month}.csv`,
                  csv([
                    ['Date', 'Flow', 'Category', 'Party', 'Method', 'Amount', 'Note'],
                    ...payments.map(p => [p.createdAt, p.direction, p.category, p.partyName, p.method, p.amount, p.note])
                  ])
                )
              }
            >
              <Download size={13} /> Export ledger
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cash in" value={money(cashIn)} tone="green" icon={<ArrowDownLeft size={15} />} hint="Sales, dues and other receipts" />
        <StatCard label="Cash out" value={money(cashOut)} tone="red" icon={<ArrowUpRight size={15} />} hint="Suppliers, expenses and payroll" />
        <StatCard label="Net position" value={money(cashIn - cashOut)} tone={cashIn - cashOut >= 0 ? 'blue' : 'red'} icon={<Scale size={15} />} hint={`For ${month}`} />
        <StatCard label="Ledger entries" value={payments.length} icon={<Landmark size={15} />} hint={`${data.payments.length} entries all-time`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className={`${panel} p-3`}>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            <Select value={direction} onChange={setDirection} options={[{ value: 'All', label: 'All flows' }, { value: 'in', label: 'Cash in' }, { value: 'out', label: 'Cash out' }]} className="w-[130px]" />
            <Select value={category} onChange={setCategory} options={[{ value: 'All', label: 'All categories' }, ...['Order Sale', 'Due Collection', 'Supplier Payment', 'Expense', 'Payroll'].map(value => ({ value, label: value }))]} className="w-[160px]" />
          </div>
          <DataTable columns={columns} rows={payments} rowKey={payment => payment.id} dense empty="No ledger entries in this view." />
        </div>

        <div className="space-y-3">
          <div className={`${panel} p-4`}>
            <h3 className="text-[12.5px] font-semibold text-slate-200">Category split · {month}</h3>
            <div className="mt-2.5 space-y-2.5">
              {byCategory.map(entry => (
                <div key={entry.category}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{entry.category}</span>
                    <span className={entry.direction === 'in' ? 'text-emerald-300' : 'text-rose-300'}>{money(entry.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[.07]">
                    <div className={`h-full rounded-full ${entry.direction === 'in' ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${(entry.amount / Math.max(1, cashIn, cashOut)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${panel} p-4`}>
            <h3 className="text-[12.5px] font-semibold text-slate-200">Open balances</h3>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-400">Customer receivables</span><span className="text-rose-300">{money(data.customers.reduce((sum, c) => sum + c.due, 0))}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Supplier payables</span><span className="text-amber-300">{money(data.suppliers.reduce((sum, s) => sum + s.due, 0))}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unpaid payroll</span><span className="text-sky-300">{money(data.payroll.filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.netPay, 0))}</span></div>
              <div className="mt-1 flex justify-between border-t border-white/[.07] pt-1.5 font-medium"><span className="text-slate-300">Net open position</span><span className="text-white">{money(data.customers.reduce((sum, c) => sum + c.due, 0) - data.suppliers.reduce((sum, s) => sum + s.due, 0) - data.payroll.filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.netPay, 0))}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
