import { useMemo, useState } from 'react';
import { Banknote, CircleDollarSign, Plus, Receipt, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, statusTone, type Column } from '../components/ui';
import { monthLabel, today } from '../lib/format';
import type { PayrollRecord } from '../types';

export default function PayrollPage() {
  const { data, commit, notify, money } = useStore();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', baseSalary: '0', advanceDeducted: '0', bonus: '0' });

  const months = Array.from(new Set([month, ...data.payroll.map(record => record.month), today().slice(0, 7)])).sort().reverse();
  const records = useMemo(() => data.payroll.filter(record => record.month === month), [data.payroll, month]);
  const totalNet = records.reduce((sum, record) => sum + record.netPay, 0);
  const paidNet = records.filter(record => record.status === 'Paid').reduce((sum, record) => sum + record.netPay, 0);

  const generate = () => {
    const existing = new Set(data.payroll.filter(record => record.month === month).map(record => record.employeeId));
    const created: PayrollRecord[] = data.employees
      .filter(employee => !existing.has(employee.id))
      .map(employee => ({
        id: `pay-${Date.now()}-${employee.id}`,
        employeeId: employee.id,
        employeeName: employee.name,
        role: employee.role,
        month,
        baseSalary: employee.salary,
        advanceDeducted: Math.min(employee.advance, employee.salary),
        bonus: 0,
        netPay: Math.max(0, employee.salary - Math.min(employee.advance, employee.salary)),
        status: 'Pending'
      }));
    if (created.length === 0) {
      notify('Every employee already has a payroll record for this month.');
      return;
    }
    commit({ payroll: [...created, ...data.payroll] }, { title: 'Payroll generated', detail: `${created.length} records for ${monthLabel(month)}` });
    notify(`${created.length} payroll records created.`);
  };

  const addManual = () => {
    const employee = data.employees.find(entry => entry.id === form.employeeId);
    if (!employee) {
      notify('Select an employee.');
      return;
    }
    const base = Math.max(0, Number(form.baseSalary) || employee.salary);
    const advance = Math.max(0, Number(form.advanceDeducted) || 0);
    const bonus = Math.max(0, Number(form.bonus) || 0);
    const record: PayrollRecord = {
      id: `pay-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.role,
      month,
      baseSalary: base,
      advanceDeducted: advance,
      bonus,
      netPay: Math.max(0, base - advance + bonus),
      status: 'Pending'
    };
    commit({ payroll: [record, ...data.payroll.filter(entry => !(entry.employeeId === employee.id && entry.month === month))] }, { title: 'Payroll record added', detail: `${employee.name} · ${monthLabel(month)} · ${money(record.netPay)}` });
    notify(`Payroll for ${employee.name} recorded.`);
    setOpen(false);
    setForm({ employeeId: '', baseSalary: '0', advanceDeducted: '0', bonus: '0' });
  };

  const pay = (record: PayrollRecord) => {
    commit(
      {
        payroll: data.payroll.map(entry => (entry.id === record.id ? { ...entry, status: 'Paid', paidAt: today() } : entry)),
        employees: data.employees.map(employee => (employee.id === record.employeeId ? { ...employee, advance: Math.max(0, employee.advance - record.advanceDeducted) } : employee)),
        payments: [
          {
            id: `pmt-${Date.now()}`,
            direction: 'out',
            category: 'Payroll',
            referenceId: record.id,
            partyName: record.employeeName,
            amount: record.netPay,
            method: 'Bank transfer',
            note: `Salary ${monthLabel(record.month)}`,
            createdAt: new Date().toISOString()
          },
          ...data.payments
        ]
      },
      { title: 'Salary paid', detail: `${record.employeeName} · ${money(record.netPay)}` }
    );
    notify(`${record.employeeName} salary paid.`);
  };

  const payAll = () => {
    const pending = records.filter(record => record.status === 'Pending');
    if (pending.length === 0) {
      notify('No pending salary for this month.');
      return;
    }
    const stamp = new Date().toISOString();
    commit(
      {
        payroll: data.payroll.map(record => (record.month === month && record.status === 'Pending' ? { ...record, status: 'Paid', paidAt: today() } : record)),
        employees: data.employees.map(employee => {
          const record = pending.find(entry => entry.employeeId === employee.id);
          return record ? { ...employee, advance: Math.max(0, employee.advance - record.advanceDeducted) } : employee;
        }),
        payments: [
          ...pending.map((record, index) => ({
            id: `pmt-${Date.now()}-${index}`,
            direction: 'out' as const,
            category: 'Payroll' as const,
            referenceId: record.id,
            partyName: record.employeeName,
            amount: record.netPay,
            method: 'Bank transfer' as const,
            note: `Salary ${monthLabel(record.month)}`,
            createdAt: stamp
          })),
          ...data.payments
        ]
      },
      { title: 'Payroll run completed', detail: `${pending.length} salaries paid · ${money(pending.reduce((sum, r) => sum + r.netPay, 0))}` }
    );
    notify(`${pending.length} salaries paid.`);
  };

  const columns: Column<PayrollRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: record => (
        <div>
          <div className="font-medium text-slate-100">{record.employeeName}</div>
          <div className="text-[10px] text-slate-500">{record.role}</div>
        </div>
      )
    },
    { key: 'base', header: 'Base', align: 'right', render: record => <span className="text-[11.5px] text-slate-300">{money(record.baseSalary)}</span> },
    { key: 'advance', header: 'Advance', align: 'right', render: record => <span className="text-[11.5px] text-amber-300">−{money(record.advanceDeducted)}</span> },
    { key: 'bonus', header: 'Bonus', align: 'right', render: record => <span className="text-[11.5px] text-emerald-300">+{money(record.bonus)}</span> },
    { key: 'net', header: 'Net pay', align: 'right', render: record => <span className="font-semibold text-white">{money(record.netPay)}</span> },
    { key: 'status', header: 'Status', render: record => <Badge tone={statusTone(record.status)}>{record.status}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: record =>
        record.status === 'Paid' ? (
          <span className="text-[10px] text-slate-500">paid {record.paidAt}</span>
        ) : (
          <div className="flex justify-end gap-1">
            <Button size="sm" onClick={() => pay(record)}><Banknote size={12} /> Pay</Button>
            <IconButton tone="danger" title="Delete record" onClick={() => commit({ payroll: data.payroll.filter(entry => entry.id !== record.id) }, { title: 'Payroll record deleted', detail: record.employeeName })}>
              <Trash2 size={13} />
            </IconButton>
          </div>
        )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Salary"
        title="Payroll"
        subtitle={`${monthLabel(month)} · ${records.length} employees · ${money(totalNet)} net salary.`}
        actions={
          <>
            <Select value={month} onChange={setMonth} options={months.map(value => ({ value, label: monthLabel(value) }))} className="w-[168px]" />
            <Button variant="outline" onClick={() => setOpen(true)}><Plus size={13} /> Manual</Button>
            <Button variant="outline" onClick={generate}><Receipt size={13} /> Generate</Button>
            <Button onClick={payAll} disabled={records.every(record => record.status === 'Paid')}><CircleDollarSign size={13} /> Pay all</Button>
          </>
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Gross base', value: money(records.reduce((sum, r) => sum + r.baseSalary, 0)) },
          { label: 'Deductions', value: money(records.reduce((sum, r) => sum + r.advanceDeducted, 0)) },
          { label: 'Paid out', value: money(paidNet) },
          { label: 'Pending', value: money(totalNet - paidNet) }
        ].map(item => (
          <div key={item.label} className={`${panel} px-4 py-3`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-serif text-[18px] text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={records} rowKey={record => record.id} empty="No payroll records for this month. Generate from the employee directory." />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add payroll record"
        subtitle={monthLabel(month)}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={addManual}>Save record</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Employee" className="sm:col-span-2">
            <Select
              value={form.employeeId}
              onChange={value => {
                const employee = data.employees.find(entry => entry.id === value);
                setForm(current => ({ ...current, employeeId: value, baseSalary: String(employee?.salary ?? 0), advanceDeducted: String(employee?.advance ?? 0) }));
              }}
              options={[{ value: '', label: 'Select employee' }, ...data.employees.map(employee => ({ value: employee.id, label: `${employee.name} · ${employee.role}` }))]}
            />
          </Labeled>
          <Labeled label="Base salary"><input type="number" min="0" value={form.baseSalary} onChange={event => setForm(current => ({ ...current, baseSalary: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Advance deducted"><input type="number" min="0" value={form.advanceDeducted} onChange={event => setForm(current => ({ ...current, advanceDeducted: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Bonus" className="sm:col-span-2"><input type="number" min="0" value={form.bonus} onChange={event => setForm(current => ({ ...current, bonus: event.target.value }))} className={inputCls} /></Labeled>
        </div>
        <div className="mt-3 rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-[11px] text-slate-400">
          Net pay: <span className="font-semibold text-[#f0cd75]">{money(Math.max(0, (Number(form.baseSalary) || 0) - (Number(form.advanceDeducted) || 0) + (Number(form.bonus) || 0)))}</span>
        </div>
      </Modal>
    </div>
  );
}
