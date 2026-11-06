import { useState } from 'react';
import { CalendarPlus, Check, Clock, Phone, Users, X } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, statusTone, textareaCls, type Column } from '../components/ui';
import { today } from '../lib/format';
import type { Reservation } from '../types';

const emptyForm = {
  customerName: '',
  phone: '',
  guests: '2',
  date: today(),
  time: '19:30',
  tableId: '',
  notes: ''
};

export default function ReservationsPage() {
  const { data, commit, notify } = useStore();
  const [filter, setFilter] = useState('Upcoming');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const reservations = data.reservations
    .filter(reservation => {
      if (filter === 'All') return true;
      if (filter === 'Upcoming') return ['Confirmed', 'Seated'].includes(reservation.status);
      return reservation.status === filter;
    })
    .slice()
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const create = () => {
    if (!form.customerName.trim() || !form.phone.trim() || !form.tableId) {
      notify('Guest name, phone and a table are required.');
      return;
    }
    const reservation: Reservation = {
      id: `r-${Date.now()}`,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      guests: Math.max(1, Number(form.guests) || 1),
      date: form.date,
      time: form.time,
      tableId: form.tableId,
      status: 'Confirmed',
      notes: form.notes.trim()
    };
    commit(
      {
        reservations: [reservation, ...data.reservations],
        tables: data.tables.map(table => (table.id === reservation.tableId ? { ...table, status: 'Reserved' } : table))
      },
      { title: 'Reservation created', detail: `${reservation.customerName} · ${reservation.guests} guests · ${reservation.date} ${reservation.time}` }
    );
    notify(`Table booked for ${reservation.customerName}.`);
    setForm({ ...emptyForm, date: today() });
    setFormOpen(false);
  };

  const setStatus = (reservation: Reservation, status: Reservation['status']) => {
    commit(
      {
        reservations: data.reservations.map(entry => (entry.id === reservation.id ? { ...entry, status } : entry)),
        tables: data.tables.map(table => {
          if (table.id !== reservation.tableId) return table;
          if (status === 'Seated') return { ...table, status: 'Occupied', currentGuests: reservation.guests };
          if (status === 'Completed' || status === 'Cancelled') return { ...table, status: status === 'Cancelled' ? 'Available' : 'Cleaning', currentGuests: 0 };
          return { ...table, status: 'Reserved' };
        })
      },
      { title: 'Reservation updated', detail: `${reservation.customerName} → ${status}` }
    );
    notify(`Reservation for ${reservation.customerName} is ${status.toLowerCase()}.`);
  };

  const columns: Column<Reservation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      render: reservation => (
        <div>
          <div className="font-medium text-slate-100">{reservation.customerName}</div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500"><Phone size={9} /> {reservation.phone}</div>
        </div>
      )
    },
    {
      key: 'when',
      header: 'Date & time',
      render: reservation => (
        <div>
          <div className="text-[11.5px] text-slate-200">{new Date(`${reservation.date}T${reservation.time}`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
          <div className="text-[10px] text-slate-500">{reservation.time}</div>
        </div>
      )
    },
    {
      key: 'table',
      header: 'Table',
      render: reservation => <span className="text-[11px] text-slate-300">{data.tables.find(table => table.id === reservation.tableId)?.number ?? '—'}</span>
    },
    {
      key: 'guests',
      header: 'Guests',
      align: 'center',
      render: reservation => <span className="text-[11px] text-slate-300">{reservation.guests}</span>
    },
    { key: 'status', header: 'Status', render: reservation => <Badge tone={statusTone(reservation.status)}>{reservation.status}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: reservation => (
        <div className="flex items-center justify-end gap-1">
          {reservation.status === 'Confirmed' ? (
            <Button size="sm" onClick={() => setStatus(reservation, 'Seated')}>Seat</Button>
          ) : null}
          {reservation.status === 'Seated' ? (
            <Button size="sm" variant="soft" onClick={() => setStatus(reservation, 'Completed')}>Complete</Button>
          ) : null}
          {['Confirmed', 'Seated'].includes(reservation.status) ? (
            <IconButton tone="danger" title="Cancel reservation" onClick={() => setStatus(reservation, 'Cancelled')}>
              <X size={13} />
            </IconButton>
          ) : null}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Advance bookings"
        title="Reservations"
        subtitle="Hold tables for future guests, then seat them straight into the floor plan."
        actions={
          <>
            <Select
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'Upcoming', label: 'Upcoming' },
                { value: 'All', label: 'All bookings' },
                { value: 'Confirmed', label: 'Confirmed' },
                { value: 'Seated', label: 'Seated' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Cancelled', label: 'Cancelled' }
              ]}
              className="w-[150px]"
            />
            <Button onClick={() => setFormOpen(true)}>
              <CalendarPlus size={14} /> New reservation
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Today’s bookings', value: data.reservations.filter(r => r.date === today() && r.status !== 'Cancelled').length },
          { label: 'Guests expected', value: data.reservations.filter(r => r.date === today() && ['Confirmed', 'Seated'].includes(r.status)).reduce((sum, r) => sum + r.guests, 0) },
          { label: 'Tables reserved', value: data.tables.filter(t => t.status === 'Reserved').length }
        ].map(item => (
          <div key={item.label} className={`${panel} px-4 py-3`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-serif text-[19px] text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={reservations} rowKey={reservation => reservation.id} empty="No reservations in this view." />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New reservation"
        subtitle="Book a table for an upcoming guest."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={create}><Check size={13} /> Confirm booking</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Guest name">
            <input value={form.customerName} onChange={event => setForm(current => ({ ...current, customerName: event.target.value }))} className={inputCls} placeholder="Guest name" />
          </Labeled>
          <Labeled label="Phone">
            <input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className={inputCls} placeholder="01711223344" />
          </Labeled>
          <Labeled label="Guests">
            <input type="number" min="1" value={form.guests} onChange={event => setForm(current => ({ ...current, guests: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Table">
            <Select
              value={form.tableId}
              onChange={value => setForm(current => ({ ...current, tableId: value }))}
              options={[{ value: '', label: 'Select table' }, ...data.tables.map(table => ({ value: table.id, label: `${table.number} · ${table.capacity} seats · ${table.zone}` }))]}
            />
          </Labeled>
          <Labeled label="Date">
            <input type="date" value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Time">
            <input type="time" value={form.time} onChange={event => setForm(current => ({ ...current, time: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Notes" className="sm:col-span-2">
            <textarea value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className={textareaCls} placeholder="Birthday setup, high chair needed, allergies…" />
          </Labeled>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.02] px-2.5 py-2 text-[10.5px] text-slate-500">
          <Users size={12} /> {data.tables.filter(table => table.status === 'Available').length} tables are currently available
          <span className="ml-auto inline-flex items-center gap-1"><Clock size={10} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </Modal>
    </div>
  );
}
