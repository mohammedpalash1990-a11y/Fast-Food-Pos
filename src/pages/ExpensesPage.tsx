import { useMemo, useState } from 'react';
import { Download, Plus, Trash2, Wallet } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, textareaCls, type Column } from '../components/ui';
import { csv, download, today } from '../lib/format';
import type { Expense, PaymentMethod } from '../types';

const categories: Expense['category'][] = ['Rent', 'Utilities', 'Packaging', 'Maintenance', 'Marketing', 'Ingredients', 'Misc'];
const methods: PaymentMethod[] = ['Cash', 'Card', 'Digital', 'Bank transfer'];

export default function ExpensesPage() {
  const { data, commit, notify, money } = useStore();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [form, setForm] = useState({ title: '', category: 'Utilities' as Expense['category'], amount: '', method: 'Cash' as PaymentMethod, date: today(), note: '' });

  const months = Array.from(new Set([...data.expenses.map(expense => expense.date.slice(0, 7)), today().slice(0, 7)])).sort().reverse();
  const expenses = useMemo(() => data.expenses.filter(expense => expense.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date)), [data.expenses, month]);
  const monthlyTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const save = () => {
    const amount = Number(form.amount) || 0;
    if (!form.title.trim() || amount <= 0) {
      notify('Enter a title and an amount greater than zero.');
      return;
    }
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      amount,
      method: form.method,
      date: form.date,
      note: form.note.trim()
    };
    commit(
      {
        expenses: [expense, ...data.expenses],
        payments: [
          {
            id: `pmt-${Date.now()}`,
            direction: 'out',
            category: 'Expense',
            referenceId: expense.id,
            partyName: expense.title,
            amount: expense.amount,
            method: expense.method,
            note: `${expense.category} expense on ${expense.date}`,
            createdAt: new Date().toISOString()
          },
          ...data.payments
        ]
      },
      { title: 'Expense recorded', detail: `${expense.title} · ${money(expense.amount)} · ${expense.category}` }
    );
    notify(`${expense.title} logged (${money(expense.amount)}).`);
    setForm({ title: '', category: 'Utilities', amount: '', method: 'Cash', date: today(), note: '' });
    setOpen(false);
  };

  const remove = (expense: Expense) => {
    commit(
      {
        expenses: data.expenses.filter(entry => entry.id !== expense.id),
        payments: data.payments.filter(payment => payment.referenceId !== expense.id)
      },
      { title: 'Expense removed', detail: `${expense.title} · ${money(expense.amount)}` }
    );
    notify(`${expense.title} removed.`);
  };

  const byCategory = categories
    .map(category => ({ category, amount: expenses.filter(expense => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0) }))
    .filter(entry => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const columns: Column<Expense>[] = [
    {
      key: 'title',
      header: 'Expense',
      render: expense => (
        <div>
          <div className="font-medium text-slate-100">{expense.title}</div>
          <div className="text-[10px] text-slate-500">{expense.note || 'No note'}</div>
        </div>
      )
    },
    { key: 'category', header: 'Category', render: expense => <Badge tone="slate">{expense.category}</Badge> },
    { key: 'date', header: 'Date', render: expense => <span className="text-[11px] text-slate-400">{expense.date}</span> },
    { key: 'method', header: 'Method', render: expense => <span className="text-[11px] text-slate-400">{expense.method}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: expense => <span className="font-semibold text-rose-300">{money(expense.amount)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: expense => (
        <IconButton tone="danger" title="Delete expense" onClick={() => remove(expense)}>
          <Trash2 size={13} />
        </IconButton>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operating cost"
        title="Expenses"
        subtitle={`${money(monthlyTotal)} recorded in ${month}. Every entry posts an outgoing payment to the ledger.`}
        actions={
          <>
            <Select value={month} onChange={setMonth} options={months.map(value => ({ value, label: value }))} className="w-[132px]" />
            <Button variant="outline" onClick={() => download(`expenses-${month}.csv`, csv([['Title', 'Category', 'Amount', 'Method', 'Date', 'Note'], ...expenses.map(e => [e.title, e.category, e.amount, e.method, e.date, e.note])]))}>
              <Download size={13} /> Export
            </Button>
            <Button onClick={() => setOpen(true)}><Plus size={14} /> Add expense</Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className={`${panel} p-3`}>
          <DataTable columns={columns} rows={expenses} rowKey={expense => expense.id} empty="No expenses recorded for this month." />
        </div>
        <div className={`${panel} p-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-[12.5px] font-semibold text-slate-200">Month breakdown</h3>
            <Wallet size={14} className="text-[#e7b943]" />
          </div>
          <div className="mt-2 font-serif text-[24px] text-white">{money(monthlyTotal)}</div>
          <div className="text-[10.5px] text-slate-500">{expenses.length} entries this month</div>
          <div className="mt-3 space-y-2">
            {byCategory.map(entry => (
              <div key={entry.category}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{entry.category}</span>
                  <span className="text-slate-200">{money(entry.amount)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[.07]">
                  <div className="h-full rounded-full bg-[#e7b943]" style={{ width: `${(entry.amount / Math.max(1, monthlyTotal)) * 100}%` }} />
                </div>
              </div>
            ))}
            {byCategory.length === 0 ? <div className="text-[11px] text-slate-600">Nothing recorded yet.</div> : null}
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add expense"
        subtitle="Record an operating cost against this month."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save expense</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Title" className="sm:col-span-2">
            <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={inputCls} placeholder="Electricity bill" />
          </Labeled>
          <Labeled label="Category">
            <Select value={form.category} onChange={value => setForm(current => ({ ...current, category: value as Expense['category'] }))} options={categories.map(value => ({ value, label: value }))} />
          </Labeled>
          <Labeled label="Amount (৳)">
            <input type="number" min="0" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Paid with">
            <Select value={form.method} onChange={value => setForm(current => ({ ...current, method: value as PaymentMethod }))} options={methods.map(value => ({ value, label: value }))} />
          </Labeled>
          <Labeled label="Date">
            <input type="date" value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Note" className="sm:col-span-2">
            <textarea value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} className={textareaCls} placeholder="Reference, vendor or justification" />
          </Labeled>
        </div>
      </Modal>
    </div>
  );
}
