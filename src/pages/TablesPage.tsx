import { useState } from 'react';
import { Armchair, Check, Clock, Plus, Sparkles, Users, X } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, statusTone, type Column } from '../components/ui';
import { money as formatMoney } from '../lib/format';
import type { DiningTable } from '../types';

const zones: DiningTable['zone'][] = ['Main Hall', 'Family Zone', 'Outdoor Patio', 'VIP Lounge'];
const statuses: DiningTable['status'][] = ['Available', 'Occupied', 'Reserved', 'Cleaning'];
const emptyForm = { number: '', name: '', capacity: '4', zone: 'Main Hall' as DiningTable['zone'], status: 'Available' as DiningTable['status'] };

export default function TablesPage() {
  const { data, commit, notify, money } = useStore();
  const [zone, setZone] = useState<string>('All');
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const tables = data.tables.filter(table => zone === 'All' || table.zone === zone);
  const occupancy = data.tables.filter(table => table.status === 'Occupied').length;

  const openCreate = () => {
    const numbers = data.tables.map(table => Number(table.number.replace(/\D/g, ''))).filter(value => Number.isFinite(value) && value > 0);
    const next = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(2, '0');
    setForm({ ...emptyForm, number: `T-${next}`, name: `Table ${next}` });
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (table: DiningTable) => {
    setEditing(table);
    setForm({ number: table.number, name: table.name, capacity: String(table.capacity), zone: table.zone, status: table.status });
    setCreating(true);
  };

  const saveTable = () => {
    if (!form.number.trim() || !form.name.trim()) {
      notify('Table number and name are required.');
      return;
    }
    const capacity = Math.max(1, Number(form.capacity) || 4);
    if (editing) {
      commit(
        {
          tables: data.tables.map(table =>
            table.id === editing.id
              ? { ...table, number: form.number.trim().toUpperCase(), name: form.name.trim(), capacity, zone: form.zone, status: form.status }
              : table
          )
        },
        { title: 'Table updated', detail: `${form.number} · ${form.zone} · ${capacity} seats` }
      );
      notify(`${form.number} updated.`);
    } else {
      const clientTable: DiningTable = {
        id: `t-${Date.now()}`,
        number: form.number.trim().toUpperCase(),
        name: form.name.trim(),
        capacity,
        zone: form.zone,
        status: 'Available',
        currentGuests: 0
      };
      commit({ tables: [...data.tables, clientTable] }, { title: 'Table added', detail: `${clientTable.number} · ${clientTable.zone} · ${capacity} seats` });
      notify(`${clientTable.number} added to the floor.`);
    }
    setCreating(false);
    setEditing(null);
  };

  const setStatus = (table: DiningTable, status: DiningTable['status']) => {
    commit(
      {
        tables: data.tables.map(entry =>
          entry.id === table.id
            ? { ...entry, status, currentGuests: status === 'Occupied' ? Math.max(entry.currentGuests || 1, 1) : 0, currentOrderId: status === 'Occupied' ? entry.currentOrderId : undefined }
            : entry
        )
      },
      { title: 'Table status', detail: `${table.number} → ${status}` }
    );
    notify(`${table.number} is now ${status.toLowerCase()}.`);
  };

  const closeBill = (table: DiningTable) => {
    const order = data.orders.find(entry => entry.id === table.currentOrderId);
    commit(
      {
        tables: data.tables.map(entry => (entry.id === table.id ? { ...entry, status: 'Cleaning', currentGuests: 0, currentOrderId: undefined } : entry)),
        orders: order ? data.orders.map(entry => (entry.id === order.id ? { ...entry, status: 'Completed' } : entry)) : data.orders
      },
      { title: 'Table closed', detail: `${table.number} released${order ? ` · order #${order.number} completed` : ''}` }
    );
    notify(`${table.number} closed${order ? ` · #${order.number} completed` : ''}.`);
  };

  const columns: Column<DiningTable>[] = [
    {
      key: 'table',
      header: 'Table',
      render: table => (
        <div>
          <div className="font-semibold text-white">{table.number}</div>
          <div className="text-[10px] text-slate-500">{table.name}</div>
        </div>
      )
    },
    { key: 'zone', header: 'Zone', render: table => <span className="text-[11px] text-slate-400">{table.zone}</span> },
    { key: 'capacity', header: 'Seats', align: 'center', render: table => <span className="text-[11px] text-slate-300">{table.capacity}</span> },
    {
      key: 'status',
      header: 'Status',
      render: table => (
        <div className="flex items-center gap-1.5">
          <Badge tone={statusTone(table.status)}>{table.status}</Badge>
          {table.currentGuests > 0 ? <span className="text-[10px] text-slate-500">{table.currentGuests} guests</span> : null}
        </div>
      )
    },
    {
      key: 'order',
      header: 'Linked order',
      render: table => {
        const order = data.orders.find(entry => entry.id === table.currentOrderId);
        return order ? (
          <div>
            <div className="text-[11px] text-slate-200">#{order.number}</div>
            <div className="text-[10px] text-slate-500">{money(order.total)}</div>
          </div>
        ) : (
          <span className="text-[10.5px] text-slate-600">—</span>
        );
      }
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: table => (
        <div className="flex items-center justify-end gap-1">
          {table.status === 'Occupied' ? (
            <Button size="sm" variant="soft" onClick={() => closeBill(table)}>
              Close bill
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setStatus(table, 'Occupied')}>
              Seat
            </Button>
          )}
          <IconButton title="Edit table" onClick={() => openEdit(table)}>
            <Sparkles size={13} />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Front of house"
        title="Tables management"
        subtitle="Live floor plan with seating capacity, occupancy and linked running bills."
        actions={
          <>
            <Select value={zone} onChange={setZone} options={[{ value: 'All', label: 'All zones' }, ...zones.map(value => ({ value, label: value }))]} className="w-[150px]" />
            <Button onClick={openCreate}>
              <Plus size={14} /> Add table
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Total tables', value: data.tables.length, icon: Armchair },
          { label: 'Occupied', value: occupancy, icon: Users },
          { label: 'Available', value: data.tables.filter(t => t.status === 'Available').length, icon: Check },
          { label: 'Cover capacity', value: data.tables.reduce((sum, t) => sum + t.capacity, 0), icon: Users }
        ].map(item => (
          <div key={item.label} className={`${panel} flex items-center gap-2.5 px-3.5 py-3`}>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-300"><item.icon size={14} /></div>
            <div>
              <div className="font-serif text-[17px] text-white">{item.value}</div>
              <div className="text-[10px] text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map(table => {
          const order = data.orders.find(entry => entry.id === table.currentOrderId);
          const tone =
            table.status === 'Occupied' ? 'border-rose-400/30 bg-rose-400/[.06]' : table.status === 'Reserved' ? 'border-sky-400/25 bg-sky-400/[.05]' : table.status === 'Cleaning' ? 'border-amber-400/25 bg-amber-400/[.05]' : 'border-emerald-400/20 bg-emerald-400/[.04]';
          return (
            <div key={table.id} className={`rounded-2xl border p-3.5 ${tone}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-serif text-[19px] leading-none text-white">{table.number}</div>
                  <div className="mt-1 text-[10.5px] text-slate-400">{table.name}</div>
                </div>
                <Badge tone={statusTone(table.status)}>{table.status}</Badge>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span className="rounded bg-black/30 px-1.5 py-0.5">{table.zone}</span>
                <span className="rounded bg-black/30 px-1.5 py-0.5">{table.capacity} seats</span>
                {table.currentGuests > 0 ? <span className="rounded bg-black/30 px-1.5 py-0.5">{table.currentGuests} guests</span> : null}
              </div>
              {order ? (
                <div className="mt-2.5 rounded-lg border border-white/[.07] bg-black/25 px-2.5 py-1.5">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Order #{order.number}</span>
                    <span className="font-semibold text-[#f0cd75]">{formatMoney(order.total, data.settings.currency)}</span>
                  </div>
                  <div className="mt-0.5 text-[9.5px] text-slate-500">
                    {order.items.reduce((sum, item) => sum + item.qty, 0)} items · {order.status}
                  </div>
                </div>
              ) : null}
              <div className="mt-2.5 flex flex-wrap gap-1">
                {statuses
                  .filter(value => value !== table.status)
                  .map(value => (
                    <button key={value} onClick={() => setStatus(table, value)} className="rounded-md border border-white/[.08] px-1.5 py-0.5 text-[9.5px] text-slate-400 hover:border-white/20 hover:text-slate-200">
                      {value}
                    </button>
                  ))}
                {table.status === 'Occupied' ? (
                  <button onClick={() => closeBill(table)} className="rounded-md border border-[#e7b943]/25 bg-[#e7b943]/10 px-1.5 py-0.5 text-[9.5px] text-[#f0cd75]">
                    close bill
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {tables.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-[12px] text-slate-500">No tables in this zone yet.</div>
        ) : null}
      </div>

      <div className={`${panel} p-3`}>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h3 className="text-[12.5px] font-semibold text-slate-200">Floor register</h3>
          <span className="text-[10px] text-slate-500"><Clock size={10} className="mr-1 inline" />Live status per table</span>
        </div>
        <DataTable columns={columns} rows={tables} rowKey={table => table.id} dense />
      </div>

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.number}` : 'Add table'}
        subtitle="Configure the table number, zone and seating capacity."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              <X size={13} /> Cancel
            </Button>
            <Button onClick={saveTable}><Check size={13} /> Save table</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Table number">
            <input value={form.number} onChange={event => setForm(current => ({ ...current, number: event.target.value }))} className={inputCls} placeholder="T-09" />
          </Labeled>
          <Labeled label="Display name">
            <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Patio Two-Top" />
          </Labeled>
          <Labeled label="Capacity">
            <input type="number" min="1" value={form.capacity} onChange={event => setForm(current => ({ ...current, capacity: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Zone">
            <Select value={form.zone} onChange={value => setForm(current => ({ ...current, zone: value as DiningTable['zone'] }))} options={zones.map(value => ({ value, label: value }))} />
          </Labeled>
          {editing ? (
            <Labeled label="Status" className="sm:col-span-2">
              <Select value={form.status} onChange={value => setForm(current => ({ ...current, status: value as DiningTable['status'] }))} options={statuses.map(value => ({ value, label: value }))} />
            </Labeled>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
