import { useState } from 'react';
import { HandCoins, Plus, Truck } from 'lucide-react';
import { useStore } from '../store';
import { Button, DataTable, inputCls, Labeled, Modal, PageHeader, panel, type Column } from '../components/ui';
import type { Supplier } from '../types';

const emptyForm = { name: '', phone: '', category: '', due: '0' };

export default function SuppliersPage() {
  const { data, commit, notify, money } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [payFor, setPayFor] = useState<Supplier | null>(null);
  const [amount, setAmount] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      notify('Supplier name is required.');
      return;
    }
    const payload = { name: form.name.trim(), phone: form.phone.trim(), category: form.category.trim(), due: Math.max(0, Number(form.due) || 0) };
    if (editing) {
      commit({ suppliers: data.suppliers.map(supplier => (supplier.id === editing.id ? { ...supplier, ...payload } : supplier)) }, { title: 'Supplier updated', detail: payload.name });
      notify(`${payload.name} updated.`);
    } else {
      const supplier: Supplier = { id: `s-${Date.now()}`, ...payload };
      commit({ suppliers: [supplier, ...data.suppliers] }, { title: 'Supplier added', detail: `${supplier.name} · ${supplier.category}` });
      notify(`${supplier.name} added.`);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const pay = () => {
    if (!payFor) return;
    const value = Math.min(Number(amount) || 0, payFor.due);
    if (value <= 0) {
      notify('Enter a valid amount.');
      return;
    }
    commit(
      {
        suppliers: data.suppliers.map(supplier => (supplier.id === payFor.id ? { ...supplier, due: Number((supplier.due - value).toFixed(2)) } : supplier)),
        payments: [
          {
            id: `pmt-${Date.now()}`,
            direction: 'out',
            category: 'Supplier Payment',
            referenceId: payFor.id,
            partyName: payFor.name,
            amount: value,
            method: 'Bank transfer',
            note: 'Supplier payable settlement',
            createdAt: new Date().toISOString()
          },
          ...data.payments
        ]
      },
      { title: 'Supplier paid', detail: `${payFor.name} · ${money(value)}` }
    );
    notify(`Paid ${money(value)} to ${payFor.name}.`);
    setPayFor(null);
    setAmount('');
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      render: supplier => (
        <div>
          <div className="font-medium text-slate-100">{supplier.name}</div>
          <div className="text-[10px] text-slate-500">{supplier.phone || 'No phone'}</div>
        </div>
      )
    },
    { key: 'category', header: 'Supplies', render: supplier => <span className="text-[11px] text-slate-400">{supplier.category || '—'}</span> },
    { key: 'ingredients', header: 'Ingredients', align: 'center', render: supplier => <span className="text-[11px] text-slate-300">{data.inventory.filter(item => item.supplier === supplier.name).length}</span> },
    { key: 'purchases', header: 'Purchases', align: 'center', render: supplier => <span className="text-[11px] text-slate-300">{data.purchases.filter(p => p.supplierId === supplier.id).length}</span> },
    { key: 'due', header: 'Payable', align: 'right', render: supplier => <span className={supplier.due > 0 ? 'font-semibold text-rose-300' : 'text-slate-500'}>{money(supplier.due)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: supplier => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => { setEditing(supplier); setForm({ name: supplier.name, phone: supplier.phone, category: supplier.category, due: String(supplier.due) }); setFormOpen(true); }}>
            Edit
          </Button>
          <Button size="sm" disabled={supplier.due <= 0} onClick={() => { setPayFor(supplier); setAmount(String(supplier.due)); }}>
            <HandCoins size={12} /> Pay
          </Button>
        </div>
      )
    }
  ];

  const totalPayable = data.suppliers.reduce((sum, supplier) => sum + supplier.due, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Vendors"
        title="Suppliers"
        subtitle={`${data.suppliers.length} vendors · ${money(totalPayable)} total payable across supplier accounts.`}
        actions={<Button onClick={openCreate}><Plus size={14} /> Add supplier</Button>}
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Suppliers', value: String(data.suppliers.length) },
          { label: 'Total payable', value: money(totalPayable) },
          { label: 'Purchase invoices', value: String(data.purchases.length) }
        ].map(item => (
          <div key={item.label} className={`${panel} flex items-center gap-2.5 px-4 py-3`}>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-300"><Truck size={14} /></div>
            <div>
              <div className="font-serif text-[18px] text-white">{item.value}</div>
              <div className="text-[10px] text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={data.suppliers} rowKey={supplier => supplier.id} empty="No suppliers registered yet." />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add supplier'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save changes' : 'Add supplier'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Supplier name" className="sm:col-span-2">
            <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Prime Poultry" />
          </Labeled>
          <Labeled label="Phone"><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className={inputCls} placeholder="01810000002" /></Labeled>
          <Labeled label="Supplies"><input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} className={inputCls} placeholder="Meat & poultry" /></Labeled>
          <Labeled label="Opening payable (৳)" className="sm:col-span-2">
            <input type="number" min="0" value={form.due} onChange={event => setForm(current => ({ ...current, due: event.target.value }))} className={inputCls} />
          </Labeled>
        </div>
      </Modal>

      <Modal
        open={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        title="Pay supplier"
        subtitle={payFor ? `${payFor.name} · ${money(payFor.due)} payable` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={pay}><HandCoins size={13} /> Record payment</Button>
          </>
        }
      >
        <Labeled label="Payment amount" hint="Recorded as an outgoing payment in the accounting ledger.">
          <input type="number" min="0" max={payFor?.due ?? 0} value={amount} onChange={event => setAmount(event.target.value)} className={inputCls} />
        </Labeled>
      </Modal>
    </div>
  );
}
