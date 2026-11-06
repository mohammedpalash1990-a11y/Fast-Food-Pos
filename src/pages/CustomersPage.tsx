import { useMemo, useState } from 'react';
import { HandCoins, Phone, Plus, UserPlus } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, inputCls, Labeled, Modal, PageHeader, panel, SearchInput, textareaCls, type Column } from '../components/ui';
import type { Customer } from '../types';

export default function CustomersPage() {
  const { data, commit, notify, money } = useStore();
  const [term, setTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [collectFor, setCollectFor] = useState<Customer | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', address: '', due: '0', loyaltyPoints: '0' });

  const customers = useMemo(() => {
    const query = term.trim().toLowerCase();
    return data.customers.filter(customer => !query || customer.name.toLowerCase().includes(query) || customer.phone.includes(query));
  }, [data.customers, term]);

  const spendByCustomer = useMemo(() => {
    const map = new Map<string, { orders: number; spend: number }>();
    data.orders.forEach(order => {
      if (!order.customerId || order.status === 'Cancelled') return;
      const entry = map.get(order.customerId) ?? { orders: 0, spend: 0 };
      entry.orders += 1;
      entry.spend += order.total;
      map.set(order.customerId, entry);
    });
    return map;
  }, [data.orders]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '', due: '0', loyaltyPoints: '0' });
    setFormOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      due: String(customer.due),
      loyaltyPoints: String(customer.loyaltyPoints)
    });
    setFormOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      notify('Customer name is required.');
      return;
    }
    if (editing) {
      commit(
        {
          customers: data.customers.map(customer =>
            customer.id === editing.id
              ? { ...customer, name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), due: Math.max(0, Number(form.due) || 0), loyaltyPoints: Math.max(0, Number(form.loyaltyPoints) || 0) }
              : customer
          )
        },
        { title: 'Customer updated', detail: `${form.name} profile saved` }
      );
      notify(`${form.name} updated.`);
    } else {
      const customer: Customer = {
        id: `c-${Date.now()}`,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        due: Math.max(0, Number(form.due) || 0),
        loyaltyPoints: Math.max(0, Number(form.loyaltyPoints) || 0),
        favoriteItems: []
      };
      commit({ customers: [customer, ...data.customers] }, { title: 'Customer added', detail: `${customer.name} · ${customer.phone}` });
      notify(`${customer.name} added to the customer book.`);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const collect = () => {
    if (!collectFor) return;
    const amount = Math.min(Number(collectAmount) || 0, collectFor.due);
    if (amount <= 0) {
      notify('Enter an amount greater than zero.');
      return;
    }
    commit(
      {
        customers: data.customers.map(customer => (customer.id === collectFor.id ? { ...customer, due: Number((customer.due - amount).toFixed(2)) } : customer)),
        payments: [
          {
            id: `pmt-${Date.now()}`,
            direction: 'in',
            category: 'Due Collection',
            referenceId: collectFor.id,
            partyName: collectFor.name,
            amount,
            method: 'Cash',
            note: `Customer due collection${collectFor.phone ? ` · ${collectFor.phone}` : ''}`,
            createdAt: new Date().toISOString()
          },
          ...data.payments
        ]
      },
      { title: 'Due collected', detail: `${collectFor.name} paid ${money(amount)}` }
    );
    notify(`Collected ${money(amount)} from ${collectFor.name}.`);
    setCollectFor(null);
    setCollectAmount('');
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: customer => (
        <div>
          <button onClick={() => openEdit(customer)} className="text-left font-medium text-slate-100 hover:text-[#f0cd75]">{customer.name}</button>
          <div className="flex items-center gap-1 text-[10px] text-slate-500"><Phone size={9} /> {customer.phone || 'No phone'}</div>
        </div>
      )
    },
    { key: 'address', header: 'Address', render: customer => <span className="line-clamp-2 max-w-[220px] text-[11px] text-slate-400">{customer.address || '—'}</span> },
    {
      key: 'orders',
      header: 'Orders',
      align: 'center',
      render: customer => {
        const stats = spendByCustomer.get(customer.id);
        return (
          <div>
            <div className="text-[11.5px] text-slate-200">{stats?.orders ?? 0}</div>
            <div className="text-[10px] text-slate-500">{money(stats?.spend ?? 0)} lifetime</div>
          </div>
        );
      }
    },
    {
      key: 'loyalty',
      header: 'Loyalty',
      align: 'center',
      render: customer => <Badge tone={customer.loyaltyPoints >= 400 ? 'gold' : 'slate'}>{customer.loyaltyPoints} pts</Badge>
    },
    {
      key: 'due',
      header: 'Due',
      align: 'right',
      render: customer => <span className={customer.due > 0 ? 'font-semibold text-rose-300' : 'text-slate-500'}>{money(customer.due)}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: customer => (
        <Button
          size="sm"
          variant={customer.due > 0 ? 'primary' : 'outline'}
          disabled={customer.due <= 0}
          onClick={() => {
            setCollectFor(customer);
            setCollectAmount(String(customer.due));
          }}
        >
          <HandCoins size={12} /> Collect
        </Button>
      )
    }
  ];

  const totalDue = data.customers.reduce((sum, customer) => sum + customer.due, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Guest book"
        title="Customers"
        subtitle={`${data.customers.length} guest profiles · ${money(totalDue)} outstanding across the ledger.`}
        actions={
          <Button onClick={openCreate}>
            <UserPlus size={14} /> Add customer
          </Button>
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Total customers', value: String(data.customers.length) },
          { label: 'With outstanding due', value: String(data.customers.filter(c => c.due > 0).length) },
          { label: 'Loyalty points issued', value: data.customers.reduce((sum, c) => sum + c.loyaltyPoints, 0).toLocaleString('en-US') }
        ].map(item => (
          <div key={item.label} className={`${panel} px-4 py-3`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-serif text-[19px] text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <div className="mb-3 max-w-xs">
          <SearchInput value={term} onChange={setTerm} placeholder="Search name or phone…" />
        </div>
        <DataTable columns={columns} rows={customers} rowKey={customer => customer.id} empty="No customers match this search." />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add customer'}
        subtitle="Guest contact details, opening due balance and loyalty points."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save}><Plus size={13} /> {editing ? 'Save changes' : 'Add customer'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Full name">
            <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Guest name" />
          </Labeled>
          <Labeled label="Phone">
            <input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className={inputCls} placeholder="01711223344" />
          </Labeled>
          <Labeled label="Opening due (৳)">
            <input type="number" min="0" value={form.due} onChange={event => setForm(current => ({ ...current, due: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Loyalty points">
            <input type="number" min="0" value={form.loyaltyPoints} onChange={event => setForm(current => ({ ...current, loyaltyPoints: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Address" className="sm:col-span-2">
            <textarea value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} className={textareaCls} placeholder="Delivery address" />
          </Labeled>
        </div>
      </Modal>

      <Modal
        open={Boolean(collectFor)}
        onClose={() => setCollectFor(null)}
        title="Collect customer due"
        subtitle={collectFor ? `${collectFor.name} · ${money(collectFor.due)} outstanding` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setCollectFor(null)}>Cancel</Button>
            <Button onClick={collect}><HandCoins size={13} /> Record payment</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Labeled label="Amount to collect" hint={`Outstanding balance is ${money(collectFor?.due ?? 0)}`}>
            <input type="number" min="0" max={collectFor?.due ?? 0} value={collectAmount} onChange={event => setCollectAmount(event.target.value)} className={inputCls} />
          </Labeled>
          <div className="flex gap-1.5">
            {[0.5, 1].map(ratio => (
              <button
                key={ratio}
                onClick={() => setCollectAmount(String(Number(((collectFor?.due ?? 0) * ratio).toFixed(2))))}
                className="rounded-lg border border-white/[.09] px-2.5 py-1 text-[10.5px] text-slate-300 hover:border-[#e7b943]/35 hover:text-[#f0cd75]"
              >
                {ratio === 1 ? 'Full balance' : 'Half balance'}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-[11px] text-slate-400">
            Payment is recorded in the accounting ledger as a due collection and reduces the customer’s balance immediately.
          </div>
        </div>
      </Modal>
    </div>
  );
}
