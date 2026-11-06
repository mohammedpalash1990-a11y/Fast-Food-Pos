import { useState } from 'react';
import { HandCoins, Receipt, Search } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, inputCls, Labeled, Modal, PageHeader, panel, statusTone, type Column } from '../components/ui';
import type { Order } from '../types';

export default function DuesPage() {
  const { data, commit, notify, money } = useStore();
  const [term, setTerm] = useState('');
  const [settleFor, setSettleFor] = useState<Order | null>(null);
  const [amount, setAmount] = useState('');

  const dueOrders = data.orders
    .filter(order => order.number !== 'HOLD' && order.due > 0 && order.status !== 'Cancelled')
    .filter(order => {
      const query = term.trim().toLowerCase();
      return !query || order.customerName.toLowerCase().includes(query) || order.number.includes(query);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const customerDue = data.customers.reduce((sum, customer) => sum + customer.due, 0);
  const orderDue = data.orders.filter(order => order.status !== 'Cancelled').reduce((sum, order) => sum + order.due, 0);

  const settle = () => {
    if (!settleFor) return;
    const value = Math.min(Number(amount) || 0, settleFor.due);
    if (value <= 0) {
      notify('Enter an amount greater than zero.');
      return;
    }
    const fullyPaid = value >= settleFor.due;
    commit(
      {
        orders: data.orders.map(order =>
          order.id === settleFor.id ? { ...order, paid: Number((order.paid + value).toFixed(2)), due: Number((order.due - value).toFixed(2)) } : order
        ),
        customers: settleFor.customerId
          ? data.customers.map(customer => (customer.id === settleFor.customerId ? { ...customer, due: Math.max(0, Number((customer.due - value).toFixed(2))) } : customer))
          : data.customers,
        payments: [
          {
            id: `pmt-${Date.now()}`,
            direction: 'in',
            category: 'Due Collection',
            referenceId: settleFor.id,
            partyName: settleFor.customerName,
            amount: value,
            method: settleFor.paymentMethod,
            note: fullyPaid ? `Order #${settleFor.number} settled in full` : `Partial collection for #${settleFor.number}`,
            createdAt: new Date().toISOString()
          },
          ...data.payments
        ]
      },
      { title: 'Due collected', detail: `#${settleFor.number} · ${money(value)} via ${settleFor.paymentMethod}` }
    );
    notify(`Collected ${money(value)} for #${settleFor.number}.`);
    setSettleFor(null);
    setAmount('');
  };

  const columns: Column<Order>[] = [
    {
      key: 'order',
      header: 'Order',
      render: order => (
        <div>
          <div className="font-semibold text-white">#{order.number}</div>
          <div className="text-[10px] text-slate-500">{new Date(order.createdAt).toLocaleDateString('en-GB')} · {order.type}</div>
        </div>
      )
    },
    {
      key: 'customer',
      header: 'Customer',
      render: order => (
        <div>
          <div className="text-slate-200">{order.customerName}</div>
          <div className="text-[10px] text-slate-500">{order.paymentMethod}</div>
        </div>
      )
    },
    { key: 'status', header: 'Order status', render: order => <Badge tone={statusTone(order.status)}>{order.status}</Badge> },
    { key: 'total', header: 'Total', align: 'right', render: order => <span className="text-[11.5px] text-slate-300">{money(order.total)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', render: order => <span className="text-[11.5px] text-emerald-300">{money(order.paid)}</span> },
    { key: 'due', header: 'Balance', align: 'right', render: order => <span className="font-semibold text-rose-300">{money(order.due)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: order => (
        <Button size="sm" onClick={() => { setSettleFor(order); setAmount(String(order.due)); }}>
          <HandCoins size={12} /> Collect
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Receivables"
        title="Customer due"
        subtitle={`${dueOrders.length} orders carry a balance · ${money(orderDue)} outstanding on orders.`}
        actions={<div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Search guest or order…" className={`${inputCls} w-[220px] pl-8`} /></div>}
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Order-level due', value: money(orderDue) },
          { label: 'Customer ledger due', value: money(customerDue) },
          { label: 'Accounts with balance', value: String(data.customers.filter(c => c.due > 0).length) }
        ].map(item => (
          <div key={item.label} className={`${panel} flex items-center gap-2.5 px-4 py-3`}>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-rose-400/20 bg-rose-400/10 text-rose-300"><Receipt size={14} /></div>
            <div>
              <div className="font-serif text-[18px] text-white">{item.value}</div>
              <div className="text-[10px] text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={dueOrders} rowKey={order => order.id} empty="No outstanding order balances — nicely collected." />
      </div>

      <Modal
        open={Boolean(settleFor)}
        onClose={() => setSettleFor(null)}
        title="Collect payment"
        subtitle={settleFor ? `#${settleFor.number} · ${settleFor.customerName} · ${money(settleFor.due)} balance` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setSettleFor(null)}>Cancel</Button>
            <Button onClick={settle}><HandCoins size={13} /> Record collection</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Labeled label="Amount" hint="A partial amount keeps the remaining balance on the order.">
            <input type="number" min="0" max={settleFor?.due ?? 0} value={amount} onChange={event => setAmount(event.target.value)} className={inputCls} />
          </Labeled>
          <div className="flex gap-1.5">
            <button onClick={() => setAmount(String(settleFor?.due ?? 0))} className="rounded-lg border border-[#e7b943]/30 bg-[#e7b943]/10 px-2.5 py-1 text-[10.5px] text-[#f0cd75]">Full balance</button>
            <button onClick={() => setAmount(String(Number(((settleFor?.due ?? 0) / 2).toFixed(2))))} className="rounded-lg border border-white/[.09] px-2.5 py-1 text-[10.5px] text-slate-300">Half</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
