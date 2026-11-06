import { useMemo, useState } from 'react';
import { CalendarCheck, Check, Clock, Plus } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, inputCls, Labeled, Modal, PageHeader, panel, Select, statusTone, type Column } from '../components/ui';
import { today } from '../lib/format';
import type { AttendanceRecord } from '../types';

const statuses: AttendanceRecord['status'][] = ['Present', 'Late', 'Absent', 'On Leave'];

export default function AttendancePage() {
  const { data, commit, notify } = useStore();
  const [date, setDate] = useState(today());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', status: 'Present' as AttendanceRecord['status'], checkIn: '09:00', checkOut: '18:00', note: '' });

  const dates = Array.from(new Set([today(), ...data.attendance.map(record => record.date)])).sort().reverse();
  const records = useMemo(() => data.attendance.filter(record => record.date === date), [data.attendance, date]);
  const missing = data.employees.filter(employee => !records.some(record => record.employeeId === employee.id));

  const counts = {
    Present: records.filter(record => record.status === 'Present').length,
    Late: records.filter(record => record.status === 'Late').length,
    Absent: records.filter(record => record.status === 'Absent').length,
    'On Leave': records.filter(record => record.status === 'On Leave').length
  };

  const mark = (employeeId: string, status: AttendanceRecord['status']) => {
    const employee = data.employees.find(entry => entry.id === employeeId);
    if (!employee) return;
    const existing = data.attendance.find(record => record.date === date && record.employeeId === employeeId);
    if (existing) {
      commit(
        { attendance: data.attendance.map(record => (record.id === existing.id ? { ...record, status, checkIn: status === 'Present' || status === 'Late' ? record.checkIn : '-', checkOut: status === 'Present' ? record.checkOut : '-' } : record)) },
        { title: 'Attendance updated', detail: `${employee.name} · ${status} on ${date}` }
      );
    } else {
      const record: AttendanceRecord = {
        id: `att-${Date.now()}-${employeeId}`,
        employeeId,
        employeeName: employee.name,
        role: employee.role,
        shift: employee.shift,
        date,
        status,
        checkIn: status === 'Present' || status === 'Late' ? '09:00' : '-',
        checkOut: status === 'Present' ? '18:00' : '-',
        note: ''
      };
      commit({ attendance: [record, ...data.attendance] }, { title: 'Attendance recorded', detail: `${employee.name} · ${status}` });
    }
    notify(`${employee.name} marked ${status.toLowerCase()}.`);
  };

  const addManual = () => {
    if (!form.employeeId) {
      notify('Select an employee.');
      return;
    }
    const employee = data.employees.find(entry => entry.id === form.employeeId);
    if (!employee) return;
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.role,
      shift: employee.shift,
      date,
      status: form.status,
      checkIn: form.checkIn || '-',
      checkOut: form.checkOut || '-',
      note: form.note.trim()
    };
    commit({ attendance: [record, ...data.attendance.filter(entry => !(entry.employeeId === employee.id && entry.date === date))] }, { title: 'Attendance logged', detail: `${employee.name} · ${form.status} · ${date}` });
    notify(`Attendance logged for ${employee.name}.`);
    setOpen(false);
    setForm({ employeeId: '', status: 'Present', checkIn: '09:00', checkOut: '18:00', note: '' });
  };

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: record => (
        <div>
          <div className="font-medium text-slate-100">{record.employeeName}</div>
          <div className="text-[10px] text-slate-500">{record.role} · {record.shift}</div>
        </div>
      )
    },
    { key: 'status', header: 'Status', render: record => <Badge tone={statusTone(record.status)}>{record.status}</Badge> },
    { key: 'in', header: 'Check in', align: 'center', render: record => <span className="text-[11px] text-slate-300">{record.checkIn}</span> },
    { key: 'out', header: 'Check out', align: 'center', render: record => <span className="text-[11px] text-slate-300">{record.checkOut}</span> },
    { key: 'note', header: 'Note', render: record => <span className="line-clamp-1 max-w-[220px] text-[10.5px] text-slate-500">{record.note || '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: record => (
        <Select
          value={record.status}
          onChange={value => mark(record.employeeId, value as AttendanceRecord['status'])}
          options={statuses.map(value => ({ value, label: value }))}
          className="w-[104px] py-1 text-[10.5px]"
        />
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Daily register"
        title="Attendance"
        subtitle="Check the team in and out, keep a clean history and feed payroll accuracy."
        actions={
          <>
            <Select value={date} onChange={setDate} options={dates.map(value => ({ value, label: value }))} className="w-[140px]" />
            <Button onClick={() => setOpen(true)}><Plus size={14} /> Log entry</Button>
          </>
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-4">
        {(['Present', 'Late', 'Absent', 'On Leave'] as AttendanceRecord['status'][]).map(status => (
          <div key={status} className={`${panel} px-4 py-3`}>
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{status}</span>
              <Badge tone={statusTone(status)}>{status === 'Present' ? <Check size={9} /> : null}{counts[status]}</Badge>
            </div>
            <div className="mt-1 font-serif text-[19px] text-white">{counts[status]}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className={`${panel} p-3`}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-[12.5px] font-semibold text-slate-200">Register · {date}</h3>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><CalendarCheck size={11} /> {records.length} records</span>
          </div>
          <DataTable columns={columns} rows={records} rowKey={record => record.id} empty="No attendance recorded for this date." />
        </div>

        <div className={`${panel} p-4`}>
          <h3 className="text-[12.5px] font-semibold text-slate-200">Quick mark</h3>
          <p className="mt-0.5 text-[10.5px] text-slate-500">Tap a status to log the shift instantly.</p>
          <div className="mt-3 space-y-2">
            {(missing.length ? missing : data.employees).map(employee => (
              <div key={employee.id} className="rounded-xl border border-white/[.07] bg-white/[.02] p-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-[11.5px] font-medium text-slate-200">{employee.name}</div>
                    <div className="text-[9.5px] text-slate-500">{employee.role} · {employee.shift}</div>
                  </div>
                  {missing.length === 0 ? <Badge tone="green">logged</Badge> : <Badge tone="amber">pending</Badge>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {statuses.map(status => (
                    <button key={status} onClick={() => mark(employee.id, status)} className="rounded-md border border-white/[.08] px-1.5 py-0.5 text-[9.5px] text-slate-400 hover:border-[#e7b943]/35 hover:text-[#f0cd75]">
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log attendance"
        subtitle={`Manual entry for ${date}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={addManual}><Clock size={13} /> Save entry</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Employee" className="sm:col-span-2">
            <Select value={form.employeeId} onChange={value => setForm(current => ({ ...current, employeeId: value }))} options={[{ value: '', label: 'Select employee' }, ...data.employees.map(employee => ({ value: employee.id, label: `${employee.name} · ${employee.role}` }))]} />
          </Labeled>
          <Labeled label="Status">
            <Select value={form.status} onChange={value => setForm(current => ({ ...current, status: value as AttendanceRecord['status'] }))} options={statuses.map(value => ({ value, label: value }))} />
          </Labeled>
          <Labeled label="Check in"><input type="time" value={form.checkIn} onChange={event => setForm(current => ({ ...current, checkIn: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Check out"><input type="time" value={form.checkOut} onChange={event => setForm(current => ({ ...current, checkOut: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Note"><input value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} className={inputCls} placeholder="Reason or remark" /></Labeled>
        </div>
      </Modal>
    </div>
  );
}
