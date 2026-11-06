import { useState } from 'react';
import { Check, PackageCheck, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, statusTone, type Column } from '../components/ui';
import type { Purchase, PurchaseItem } from '../types';

interface DraftLine {
  ingredientId: string;
  qty: string;
  unitCost: string;
}

export default function PurchasesPage() {
  const { data, commit, notify, money } = useStore();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [invoice, setInvoice] = useState('');
  const [paid, setPaid] = useState('0');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [detail, setDetail] = useState<Purchase | null>(null);

  const openForm = () => {
    setSupplierId(data.suppliers[0]?.id ?? '');
    setInvoice(`INV-${new Date().getFullYear()}-${String(data.purchases.length + 101)}`);
    setPaid('0');
    setLines([{ ingredientId: data.inventory[0]?.id ?? '', qty: '0', unitCost: String(data.inventory[0]?.cost ?? 0) }]);
    setOpen(true);
  };

  const parsed: PurchaseItem[] = lines
    .map(line => {
      const ingredient = data.inventory.find(item => item.id === line.ingredientId);
      const qty = Number(line.qty) || 0;
      const unitCost = Number(line.unitCost) || 0;
      return {
        ingredientId: line.ingredientId,
        ingredientName: ingredient?.name ?? 'Unknown',
        qty,
        unitCost,
        lineTotal: Number((qty * unitCost).toFixed(2))
      };
    })
    .filter(line => line.qty > 0 && line.ingredientName !== 'Unknown');

  const total = parsed.reduce((sum, line) => sum + line.lineTotal, 0);
  const paidValue = Math.min(Math.max(0, Number(paid) || 0), total);

  const save = () => {
    if (!supplierId) {
      notify('Select a supplier.');
      return;
    }
    if (parsed.length === 0) {
      notify('Add at least one ingredient line with quantity.');
      return;
    }
    const supplier = data.suppliers.find(entry => entry.id === supplierId);
    const purchase: Purchase = {
      id: `pur-${Date.now()}`,
      invoiceNumber: invoice.trim() || `INV-${Date.now()}`,
      supplierId,
      supplierName: supplier?.name ?? 'Unknown supplier',
      total,
      paid: paidValue,
      due: Number((total - paidValue).toFixed(2)),
      status: 'received',
      createdAt: new Date().toISOString(),
      items: parsed
    };

    commit(
      {
        purchases: [purchase, ...data.purchases],
        suppliers: data.suppliers.map(entry => (entry.id === supplierId ? { ...entry, due: Number((entry.due + purchase.due).toFixed(2)) } : entry)),
        inventory: data.inventory.map(item => {
          const line = parsed.find(entry => entry.ingredientId === item.id);
          return line ? { ...item, stock: Number((item.stock + line.qty).toFixed(2)), cost: line.unitCost || item.cost } : item;
        }),
        stockMovements: [
          ...parsed.map((line, index) => ({
            id: `sm-${Date.now()}-${index}`,
            ingredientId: line.ingredientId,
            ingredientName: line.ingredientName,
            movementType: 'purchase' as const,
            quantityDelta: line.qty,
            note: `Purchase ${purchase.invoiceNumber}`,
            createdAt: new Date().toISOString()
          })),
          ...data.stockMovements
        ],
        payments: paidValue > 0
          ? [
              {
                id: `pmt-${Date.now()}`,
                direction: 'out',
                category: 'Supplier Payment',
                referenceId: purchase.id,
                partyName: purchase.supplierName,
                amount: paidValue,
                method: 'Bank transfer',
                note: `Payment against ${purchase.invoiceNumber}`,
                createdAt: new Date().toISOString()
              },
              ...data.payments
            ]
          : data.payments
      },
      { title: 'Purchase received', detail: `${purchase.invoiceNumber} · ${purchase.supplierName} · ${money(purchase.total)}` }
    );
    notify(`${purchase.invoiceNumber} recorded — stock updated.`);
    setOpen(false);
  };

  const columns: Column<Purchase>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: purchase => (
        <div>
          <div className="font-medium text-slate-100">{purchase.invoiceNumber}</div>
          <div className="text-[10px] text-slate-500">{new Date(purchase.createdAt).toLocaleDateString('en-GB')}</div>
        </div>
      )
    },
    { key: 'supplier', header: 'Supplier', render: purchase => <span className="text-[11.5px] text-slate-300">{purchase.supplierName}</span> },
    { key: 'lines', header: 'Lines', align: 'center', render: purchase => <span className="text-[11px] text-slate-400">{purchase.items.length}</span> },
    { key: 'total', header: 'Total', align: 'right', render: purchase => <span className="font-semibold text-white">{money(purchase.total)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', render: purchase => <span className="text-[11.5px] text-emerald-300">{money(purchase.paid)}</span> },
    { key: 'due', header: 'Due', align: 'right', render: purchase => <span className={purchase.due > 0 ? 'text-[11.5px] font-semibold text-rose-300' : 'text-[11.5px] text-slate-500'}>{money(purchase.due)}</span> },
    { key: 'status', header: 'Status', render: purchase => <Badge tone={statusTone(purchase.status)}>{purchase.status}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: purchase => (
        <Button size="sm" variant="outline" onClick={() => setDetail(purchase)}>
          View
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Purchase management"
        subtitle="Record supplier invoices, receive stock into the store and track payables automatically."
        actions={<Button onClick={openForm}><Plus size={14} /> Record purchase</Button>}
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Purchase invoices', value: String(data.purchases.length) },
          { label: 'Total purchased', value: money(data.purchases.reduce((sum, p) => sum + p.total, 0)) },
          { label: 'Outstanding payable', value: money(data.purchases.reduce((sum, p) => sum + p.due, 0)) }
        ].map(item => (
          <div key={item.label} className={`${panel} flex items-center gap-2.5 px-4 py-3`}>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#e7b943]/20 bg-[#e7b943]/10 text-[#e7b943]"><PackageCheck size={14} /></div>
            <div>
              <div className="font-serif text-[18px] text-white">{item.value}</div>
              <div className="text-[10px] text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <DataTable columns={columns} rows={data.purchases} rowKey={purchase => purchase.id} empty="No purchase invoices recorded yet." />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record purchase"
        subtitle="Receiving a purchase increases ingredient stock immediately."
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}><Check size={13} /> Receive {money(total)}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Labeled label="Supplier">
            <Select value={supplierId} onChange={setSupplierId} options={data.suppliers.map(supplier => ({ value: supplier.id, label: supplier.name }))} />
          </Labeled>
          <Labeled label="Invoice number">
            <input value={invoice} onChange={event => setInvoice(event.target.value)} className={inputCls} />
          </Labeled>
          <Labeled label="Amount paid now (৳)">
            <input type="number" min="0" value={paid} onChange={event => setPaid(event.target.value)} className={inputCls} />
          </Labeled>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500">Ingredient lines</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLines(current => [...current, { ingredientId: data.inventory[0]?.id ?? '', qty: '0', unitCost: String(data.inventory[0]?.cost ?? 0) }])}
            >
              <Plus size={12} /> Add line
            </Button>
          </div>
          <div className="space-y-1.5">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_80px_90px_auto] items-end gap-1.5">
                <Select
                  value={line.ingredientId}
                  onChange={value => {
                    const ingredient = data.inventory.find(item => item.id === value);
                    setLines(current => current.map((entry, i) => (i === index ? { ...entry, ingredientId: value, unitCost: String(ingredient?.cost ?? entry.unitCost) } : entry)));
                  }}
                  options={data.inventory.map(item => ({ value: item.id, label: item.name }))}
                />
                <input
                  type="number"
                  min="0"
                  value={line.qty}
                  onChange={event => setLines(current => current.map((entry, i) => (i === index ? { ...entry, qty: event.target.value } : entry)))}
                  className={inputCls}
                  placeholder="Qty"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitCost}
                  onChange={event => setLines(current => current.map((entry, i) => (i === index ? { ...entry, unitCost: event.target.value } : entry)))}
                  className={inputCls}
                  placeholder="Unit cost"
                />
                <IconButton tone="danger" title="Remove line" onClick={() => setLines(current => current.filter((_, i) => i !== index))}>
                  <Trash2 size={13} />
                </IconButton>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-1 rounded-xl border border-white/[.07] bg-black/25 px-3 py-2 text-[11.5px]">
          <div className="flex justify-between text-slate-400"><span>Invoice total</span><span className="text-slate-100">{money(total)}</span></div>
          <div className="flex justify-between text-slate-400"><span>Paying now</span><span className="text-emerald-300">{money(paidValue)}</span></div>
          <div className="flex justify-between border-t border-white/[.07] pt-1 font-semibold text-rose-300"><span>Added to supplier payable</span><span>{money(total - paidValue)}</span></div>
        </div>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? detail.invoiceNumber : 'Purchase'} subtitle={detail ? `${detail.supplierName} · ${new Date(detail.createdAt).toLocaleString()}` : undefined} wide>
        {detail ? (
          <div className="space-y-3">
            <div className="divide-y divide-white/[.06] rounded-xl border border-white/[.07]">
              {detail.items.map(line => (
                <div key={line.ingredientId} className="flex items-center justify-between px-3 py-2 text-[11.5px]">
                  <div>
                    <div className="text-slate-200">{line.ingredientName}</div>
                    <div className="text-[10px] text-slate-500">{line.qty} × {money(line.unitCost)}</div>
                  </div>
                  <span className="text-slate-200">{money(line.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-white/[.07] px-3 py-2 text-[11.5px]">
              <div className="flex justify-between py-0.5 text-slate-400"><span>Total</span><span className="text-slate-100">{money(detail.total)}</span></div>
              <div className="flex justify-between py-0.5 text-slate-400"><span>Paid</span><span className="text-emerald-300">{money(detail.paid)}</span></div>
              <div className="flex justify-between py-0.5 text-slate-400"><span>Due</span><span className="text-rose-300">{money(detail.due)}</span></div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
