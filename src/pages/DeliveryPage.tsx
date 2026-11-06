import { useState } from 'react';
import { Bike, Check, MapPin, Phone, UserCheck } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, inputCls, Labeled, Modal, PageHeader, panel, Select, statusTone, type Column } from '../components/ui';
import { clock } from '../lib/format';
import type { Order } from '../types';

const deliveryStates: NonNullable<Order['deliveryStatus']>[] = ['Pending', 'Assigned', 'Picked Up', 'Delivered'];

export default function DeliveryPage() {
  const { data, commit, notify, money } = useStore();
  const [assignFor, setAssignFor] = useState<Order | null>(null);
  const [rider, setRider] = useState('');
  const [filter, setFilter] = useState('Active');

  const riders = data.employees.filter(employee => /rider|delivery/i.test(employee.role)).map(employee => employee.name);
  const deliveries = data.orders
    .filter(order => order.type === 'Home Delivery' && order.number !== 'HOLD')
    .filter(order => (filter === 'Active' ? order.deliveryStatus !== 'Delivered' && order.status !== 'Cancelled' : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const setStatus = (order: Order, deliveryStatus: NonNullable<Order['deliveryStatus']>) => {
    commit(
      {
        orders: data.orders.map(entry =>
          entry.id === order.id
            ? {
                ...entry,
                deliveryStatus,
                status: deliveryStatus === 'Delivered' ? 'Completed' : entry.status,
                riderName: entry.riderName || (deliveryStatus === 'Assigned' ? rider || riders[0] || 'Kamal Rider' : entry.riderName)
              }
            : entry
        )
      },
      { title: 'Delivery updated', detail: `#${order.number} → ${deliveryStatus}` }
    );
    notify(`#${order.number} delivery is ${deliveryStatus.toLowerCase()}.`);
  };

  const assign = () => {
    if (!assignFor) return;
    const name = rider.trim() || riders[0];
    if (!name) {
      notify('Choose or type a rider name.');
      return;
    }
    commit(
      { orders: data.orders.map(entry => (entry.id === assignFor.id ? { ...entry, riderName: name, deliveryStatus: 'Assigned' } : entry)) },
      { title: 'Rider assigned', detail: `#${assignFor.number} assigned to ${name}` }
    );
    notify(`${name} assigned to #${assignFor.number}.`);
    setAssignFor(null);
    setRider('');
  };

  const columns: Column<Order>[] = [
    {
      key: 'order',
      header: 'Order',
      render: order => (
        <div>
          <div className="font-semibold text-white">#{order.number}</div>
          <div className="text-[10px] text-slate-500">{clock(order.createdAt)} · {order.items.reduce((sum, i) => sum + i.qty, 0)} items</div>
        </div>
      )
    },
    {
      key: 'guest',
      header: 'Guest',
      render: order => (
        <div>
          <div className="text-slate-200">{order.customerName}</div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500"><Phone size={9} /> {order.deliveryPhone || '—'}</div>
        </div>
      )
    },
    {
      key: 'address',
      header: 'Address',
      render: order => (
        <div className="flex max-w-[240px] items-start gap-1 text-[11px] text-slate-400">
          <MapPin size={11} className="mt-0.5 shrink-0 text-slate-600" />
          <span className="line-clamp-2">{order.deliveryAddress || 'No address recorded'}</span>
        </div>
      )
    },
    { key: 'rider', header: 'Rider', render: order => <span className="text-[11px] text-slate-300">{order.riderName || 'Unassigned'}</span> },
    { key: 'status', header: 'Delivery', render: order => <Badge tone={statusTone(order.deliveryStatus || 'Pending')}>{order.deliveryStatus || 'Pending'}</Badge> },
    { key: 'fee', header: 'Fee', align: 'right', render: order => <span className="text-[11px] text-slate-400">{money(order.deliveryFee || 0)}</span> },
    { key: 'total', header: 'Total', align: 'right', render: order => <span className="font-semibold text-white">{money(order.total)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: order => (
        <div className="flex flex-wrap justify-end gap-1">
          <Select
            value={order.deliveryStatus || 'Pending'}
            onChange={value => setStatus(order, value as NonNullable<Order['deliveryStatus']>)}
            options={deliveryStates.map(value => ({ value, label: value }))}
            className="w-[112px] py-1 text-[10.5px]"
          />
          <Button size="sm" variant="outline" onClick={() => { setAssignFor(order); setRider(order.riderName || riders[0] || ''); }}>
            <UserCheck size={12} /> Assign
          </Button>
        </div>
      )
    }
  ];

  const active = data.orders.filter(order => order.type === 'Home Delivery' && order.deliveryStatus !== 'Delivered' && order.status !== 'Cancelled');

  return (
    <div>
      <PageHeader
        eyebrow="Last mile"
        title="Delivery management"
        subtitle="Track every home delivery from rider assignment through to handover."
        actions={
          <Select value={filter} onChange={setFilter} options={[{ value: 'Active', label: 'Active deliveries' }, { value: 'All', label: 'All deliveries' }]} className="w-[160px]" />
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Active deliveries', value: String(active.length) },
          { label: 'Awaiting rider', value: String(active.filter(o => !o.riderName).length) },
          { label: 'On the road', value: String(active.filter(o => o.deliveryStatus === 'Picked Up').length) },
          { label: 'Delivered all-time', value: String(data.orders.filter(o => o.deliveryStatus === 'Delivered').length) }
        ].map(item => (
          <div key={item.label} className={`${panel} px-4 py-3`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-serif text-[18px] text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={deliveries} rowKey={order => order.id} empty="No deliveries in this view." />
      </div>

      <div className={`${panel} mt-3 p-4`}>
        <div className="mb-2.5 flex items-center gap-2">
          <Bike size={14} className="text-[#e7b943]" />
          <h3 className="text-[12.5px] font-semibold text-slate-200">Rider roster</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(riders.length ? riders : ['Kamal Rider']).map(name => {
            const assigned = active.filter(order => order.riderName === name).length;
            const delivered = data.orders.filter(order => order.riderName === name && order.deliveryStatus === 'Delivered').length;
            return (
              <div key={name} className="rounded-xl border border-white/[.07] bg-white/[.02] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-slate-200">{name}</span>
                  <Badge tone={assigned > 0 ? 'amber' : 'slate'}>{assigned} active</Badge>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">{delivered} deliveries completed</div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={Boolean(assignFor)}
        onClose={() => setAssignFor(null)}
        title="Assign rider"
        subtitle={assignFor ? `#${assignFor.number} · ${assignFor.customerName}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={assign}><Check size={13} /> Assign rider</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Labeled label="Rider">
            <Select value={rider} onChange={setRider} options={[{ value: '', label: 'Choose rider' }, ...(riders.length ? riders : ['Kamal Rider']).map(name => ({ value: name, label: name }))]} />
          </Labeled>
          <Labeled label="Or type a name">
            <input value={rider} onChange={event => setRider(event.target.value)} className={inputCls} placeholder="Rider name" />
          </Labeled>
          <div className="rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-[10.5px] text-slate-500">
            Delivery fee for this order is {money(assignFor?.deliveryFee ?? 0)}. Assigning a rider marks the delivery as “Assigned”.
          </div>
        </div>
      </Modal>
    </div>
  );
}
