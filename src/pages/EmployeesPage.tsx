import { useState } from 'react';
import { Phone, Plus, Trash2, UserRound } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, statusTone, type Column } from '../components/ui';
import type { Employee } from '../types';

const shifts: Employee['shift'][] = ['Morning', 'Day', 'Evening', 'Night'];
const statuses: Employee['status'][] = ['Present', 'Absent', 'On Leave', 'Late'];
const emptyForm = { name: '', role: '', phone: '', shift: 'Morning' as Employee['shift'], status: 'Present' as Employee['status'], salary: '0', advance: '0' };

export default function EmployeesPage() {
  const { data, commit, notify, money } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);

  const save = () => {
    if (!form.name.trim() || !form.role.trim()) {
      notify('Name and role are required.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      phone: form.phone.trim(),
      shift: form.shift,
      status: form.status,
      salary: Math.max(0, Number(form.salary) || 0),
      advance: Math.max(0, Number(form.advance) || 0)
    };
    if (editing) {
      commit({ employees: data.employees.map(employee => (employee.id === editing.id ? { ...employee, ...payload } : employee)) }, { title: 'Employee updated', detail: `${payload.name} · ${payload.role}` });
      notify(`${payload.name} updated.`);
    } else {
      const employee: Employee = { id: `e-${Date.now()}`, ...payload };
      commit({ employees: [...data.employees, employee] }, { title: 'Employee added', detail: `${employee.name} · ${employee.role} · ${employee.shift} shift` });
      notify(`${employee.name} added to staff.`);
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const remove = (employee: Employee) => {
    commit({ employees: data.employees.filter(entry => entry.id !== employee.id) }, { title: 'Employee removed', detail: employee.name });
    notify(`${employee.name} removed from the directory.`);
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: employee => (
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e7b943]/12 text-[11px] font-bold text-[#e7b943]"><UserRound size={13} /></div>
          <div>
            <div className="font-medium text-slate-100">{employee.name}</div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500"><Phone size={8} /> {employee.phone || '—'}</div>
          </div>
        </div>
      )
    },
    { key: 'role', header: 'Role', render: employee => <span className="text-[11px] text-slate-300">{employee.role}</span> },
    { key: 'shift', header: 'Shift', render: employee => <Badge tone="slate">{employee.shift}</Badge> },
    { key: 'status', header: 'Today', render: employee => <Badge tone={statusTone(employee.status)}>{employee.status}</Badge> },
    { key: 'salary', header: 'Salary', align: 'right', render: employee => <span className="text-[11.5px] text-slate-200">{money(employee.salary)}</span> },
    { key: 'advance', header: 'Advance', align: 'right', render: employee => <span className={employee.advance > 0 ? 'text-[11.5px] text-amber-300' : 'text-[11.5px] text-slate-500'}>{money(employee.advance)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: employee => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(employee);
              setForm({ name: employee.name, role: employee.role, phone: employee.phone || '', shift: employee.shift, status: employee.status, salary: String(employee.salary), advance: String(employee.advance) });
              setOpen(true);
            }}
          >
            Edit
          </Button>
          <IconButton tone="danger" title="Remove employee" onClick={() => remove(employee)}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      )
    }
  ];

  const monthlyPayroll = data.employees.reduce((sum, employee) => sum + employee.salary, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Employee management"
        subtitle={`${data.employees.length} staff members · monthly salary commitment ${money(monthlyPayroll)}.`}
        actions={<Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}><Plus size={14} /> Add employee</Button>}
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Staff', value: String(data.employees.length) },
          { label: 'Present today', value: String(data.employees.filter(e => e.status === 'Present').length) },
          { label: 'On leave', value: String(data.employees.filter(e => e.status === 'On Leave').length) },
          { label: 'Advance out', value: money(data.employees.reduce((sum, e) => sum + e.advance, 0)) }
        ].map(item => (
          <div key={item.label} className={`${panel} px-4 py-3`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-serif text-[18px] text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={data.employees} rowKey={employee => employee.id} empty="No employees in the directory." />
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'Add employee'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save changes' : 'Add employee'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Full name"><input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Sabbir Ahmed" /></Labeled>
          <Labeled label="Role"><input value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value }))} className={inputCls} placeholder="Cashier / Head Chef / Rider" /></Labeled>
          <Labeled label="Phone"><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className={inputCls} placeholder="01812002200" /></Labeled>
          <Labeled label="Shift"><Select value={form.shift} onChange={value => setForm(current => ({ ...current, shift: value as Employee['shift'] }))} options={shifts.map(value => ({ value, label: value }))} /></Labeled>
          <Labeled label="Monthly salary (৳)"><input type="number" min="0" value={form.salary} onChange={event => setForm(current => ({ ...current, salary: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Advance outstanding (৳)"><input type="number" min="0" value={form.advance} onChange={event => setForm(current => ({ ...current, advance: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Attendance status" className="sm:col-span-2">
            <Select value={form.status} onChange={value => setForm(current => ({ ...current, status: value as Employee['status'] }))} options={statuses.map(value => ({ value, label: value }))} />
          </Labeled>
        </div>
      </Modal>
    </div>
  );
}
