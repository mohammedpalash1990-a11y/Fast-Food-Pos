import { useState } from 'react';
import { BadgePercent, Plus, Power, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, type Column } from '../components/ui';
import type { Coupon } from '../types';

const emptyForm = { code: '', description: '', type: 'percent' as Coupon['type'], value: '10', minOrder: '0', active: true };

export default function DiscountsPage() {
  const { data, commit, notify, money } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const save = () => {
    const code = form.code.trim().toUpperCase();
    if (!code) {
      notify('Coupon code is required.');
      return;
    }
    if (data.coupons.some(coupon => coupon.code.toUpperCase() === code && coupon.id !== editing?.id)) {
      notify('That coupon code already exists.');
      return;
    }
    const value = Math.max(0, Number(form.value) || 0);
    if (form.type === 'percent' && value > 100) {
      notify('A percentage discount cannot exceed 100%.');
      return;
    }
    const payload = {
      code,
      description: form.description.trim() || (form.type === 'percent' ? `${value}% off` : `Flat ${money(value)} off`),
      type: form.type,
      value,
      minOrder: Math.max(0, Number(form.minOrder) || 0),
      active: form.active
    };
    if (editing) {
      commit({ coupons: data.coupons.map(coupon => (coupon.id === editing.id ? { ...coupon, ...payload } : coupon)) }, { title: 'Coupon updated', detail: `${payload.code} · ${payload.description}` });
      notify(`${payload.code} updated.`);
    } else {
      const coupon: Coupon = { id: `cpn-${Date.now()}`, ...payload, usedCount: 0 };
      commit({ coupons: [coupon, ...data.coupons] }, { title: 'Coupon created', detail: `${coupon.code} · ${coupon.description}` });
      notify(`${coupon.code} is live.`);
    }
    setOpen(false);
    setEditing(null);
  };

  const toggle = (coupon: Coupon) => {
    commit(
      { coupons: data.coupons.map(entry => (entry.id === coupon.id ? { ...entry, active: !entry.active } : entry)) },
      { title: 'Coupon availability', detail: `${coupon.code} ${coupon.active ? 'paused' : 'activated'}` }
    );
    notify(`${coupon.code} ${coupon.active ? 'paused' : 'activated'}.`);
  };

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Coupon',
      render: coupon => (
        <div>
          <div className="font-mono text-[12px] font-semibold tracking-wide text-[#f0cd75]">{coupon.code}</div>
          <div className="text-[10px] text-slate-500">{coupon.description}</div>
        </div>
      )
    },
    { key: 'type', header: 'Discount', render: coupon => <Badge tone="gold">{coupon.type === 'percent' ? `${coupon.value}%` : `${money(coupon.value)} flat`}</Badge> },
    { key: 'min', header: 'Min order', align: 'right', render: coupon => <span className="text-[11px] text-slate-400">{money(coupon.minOrder)}</span> },
    { key: 'used', header: 'Used', align: 'center', render: coupon => <span className="text-[11px] text-slate-300">{coupon.usedCount}×</span> },
    { key: 'status', header: 'Status', render: coupon => <Badge tone={coupon.active ? 'green' : 'red'}>{coupon.active ? 'Active' : 'Paused'}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: coupon => (
        <div className="flex items-center justify-end gap-1">
          <IconButton title={coupon.active ? 'Pause coupon' : 'Activate coupon'} onClick={() => toggle(coupon)}>
            <Power size={13} />
          </IconButton>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(coupon);
              setForm({ code: coupon.code, description: coupon.description, type: coupon.type, value: String(coupon.value), minOrder: String(coupon.minOrder), active: coupon.active });
              setOpen(true);
            }}
          >
            Edit
          </Button>
          <IconButton tone="danger" title="Delete coupon" onClick={() => { commit({ coupons: data.coupons.filter(entry => entry.id !== coupon.id) }, { title: 'Coupon deleted', detail: coupon.code }); notify(`${coupon.code} deleted.`); }}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Promotions"
        title="Discounts & coupons"
        subtitle="Create promo codes that the POS validates against cart value automatically."
        actions={<Button onClick={openCreate}><Plus size={14} /> New coupon</Button>}
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Coupons', value: String(data.coupons.length) },
          { label: 'Active now', value: String(data.coupons.filter(c => c.active).length) },
          { label: 'Redemptions', value: String(data.coupons.reduce((sum, c) => sum + c.usedCount, 0)) }
        ].map(item => (
          <div key={item.label} className={`${panel} flex items-center gap-2.5 px-4 py-3`}>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#e7b943]/20 bg-[#e7b943]/10 text-[#e7b943]"><BadgePercent size={14} /></div>
            <div>
              <div className="font-serif text-[18px] text-white">{item.value}</div>
              <div className="text-[10px] text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={data.coupons} rowKey={coupon => coupon.id} empty="No coupons created yet." />
      </div>

      <div className={`${panel} mt-3 p-4`}>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={14} className="text-[#e7b943]" />
          <h3 className="text-[12.5px] font-semibold text-slate-200">How coupons behave at the counter</h3>
        </div>
        <ul className="grid gap-1.5 text-[11px] text-slate-400 sm:grid-cols-2">
          <li>• A coupon is only accepted when the cart subtotal meets its minimum order.</li>
          <li>• Percentage coupons apply to the subtotal before VAT is calculated.</li>
          <li>• Manual percentage discounts can be combined with an active coupon.</li>
          <li>• Every successful redemption increments the used counter on the coupon.</li>
        </ul>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? `Edit ${editing.code}` : 'New coupon'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save coupon' : 'Create coupon'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Code"><input value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))} className={`${inputCls} font-mono`} placeholder="MUSAFIR10" /></Labeled>
          <Labeled label="Type"><Select value={form.type} onChange={value => setForm(current => ({ ...current, type: value as Coupon['type'] }))} options={[{ value: 'percent', label: 'Percentage off' }, { value: 'flat', label: 'Flat amount off' }]} /></Labeled>
          <Labeled label={form.type === 'percent' ? 'Percentage (0–100)' : 'Amount off (৳)'}>
            <input type="number" min="0" value={form.value} onChange={event => setForm(current => ({ ...current, value: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Minimum order (৳)">
            <input type="number" min="0" value={form.minOrder} onChange={event => setForm(current => ({ ...current, minOrder: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Description" className="sm:col-span-2">
            <input value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className={inputCls} placeholder="10% off orders above ৳300" />
          </Labeled>
          <label className="flex items-center gap-2 text-[11.5px] text-slate-300 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} className="h-3.5 w-3.5 accent-[#e7b943]" />
            Active and redeemable at the POS
          </label>
        </div>
      </Modal>
    </div>
  );
}
