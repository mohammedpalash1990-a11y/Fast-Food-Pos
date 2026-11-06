import { useMemo, useState } from 'react';
import { Eye, Printer, Search, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Modal, PageHeader, panel, Select, statusTone, type Column } from '../components/ui';
import { ORDER_STATUSES, orderStats, statusFlow } from '../lib/pos';
import { clock } from '../lib/format';
import type { Order, OrderStatus } from '../types';

export default function OrdersPage() {
  const { data, commit, notify, money } = useStore();
  const [status, setStatus] = useState('All');
  const [type, setType] = useState('All');
  const [term, setTerm] = useState('');
  const [detail, setDetail] = useState<Order | null>(null);

  const orders = data.orders.filter(order => order.number !== 'HOLD');
  const filtered = useMemo(
    () =>
      orders.filter(order => {
        if (status !== 'All' && order.status !== status) return false;
        if (type !== 'All' && order.type !== type) return false;
        const query = term.trim().toLowerCase();
        if (!query) return true;
        return (
          order.number.includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.items.some(item => item.name.toLowerCase().includes(query))
        );
      }),
    [orders, status, type, term]
  );

  const stats = orderStats(filtered);

  const advance = (order: Order) => {
    const next = statusFlow(order.status);
    if (!next) {
      notify(`#${order.number} is already ${order.status.toLowerCase()}.`);
      return;
    }
    commit(
      {
        orders: data.orders.map(entry => (entry.id === order.id ? { ...entry, status: next } : entry)),
        tables:
          next === 'Completed' && order.tableId
            ? data.tables.map(table => (table.id === order.tableId ? { ...table, status: 'Cleaning', currentGuests: 0, currentOrderId: undefined } : table))
            : data.tables
      },
      { title: 'Order status updated', detail: `#${order.number} moved to ${next}` }
    );
    notify(`#${order.number} → ${next}`);
    setDetail(current => (current && current.id === order.id ? { ...current, status: next } : current));
  };

  const cancelOrder = (order: Order) => {
    if (order.status === 'Cancelled') return;
    commit(
      {
        orders: data.orders.map(entry => (entry.id === order.id ? { ...entry, status: 'Cancelled' as OrderStatus } : entry)),
        customers: order.customerId && order.due > 0
          ? data.customers.map(customer => (customer.id === order.customerId ? { ...customer, due: Math.max(0, customer.due - order.due) } : customer))
          : data.customers
      },
      { title: 'Order cancelled', detail: `#${order.number} cancelled and ${money(order.due)} due cleared` }
    );
    notify(`#${order.number} cancelled.`);
    setDetail(null);
  };

  const settleDue = (order: Order) => {
    if (order.due <= 0) {
      notify('This order has no outstanding balance.');
      return;
    }
    commit(
      {
        orders: data.orders.map(entry => (entry.id === order.id ? { ...entry, paid: entry.total, due: 0 } : entry)),
        customers: order.customerId
          ? data.customers.map(customer => (customer.id === order.customerId ? { ...customer, due: Math.max(0, customer.due - order.due) } : customer))
          : data.customers,
        payments: [
          {
            id: `pmt-${Date.now()}`,
            direction: 'in',
            category: 'Due Collection',
            referenceId: order.id,
            partyName: order.customerName,
            amount: order.due,
            method: order.paymentMethod,
            note: `Balance settled for #${order.number}`,
            createdAt: new Date().toISOString()
          },
          ...data.payments
        ]
      },
      { title: 'Due collected', detail: `#${order.number} · ${money(order.due)} settled` }
    );
    notify(`Collected ${money(order.due)} for #${order.number}.`);
    setDetail(current => (current && current.id === order.id ? { ...current, paid: current.total, due: 0 } : current));
  };

  const printTicket = (order: Order) => {
    const win = window.open('', '_blank', 'width=360,height=620');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Ticket #${order.number}</title><style>
      body{font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:14px;color:#111}
      h2{font-size:14px;margin:0 0 6px}.muted{color:#555;font-size:10px}.big{font-size:20px;font-weight:800;letter-spacing:1px}
      .line{border-top:1px dashed #999;margin:7px 0}li{margin:2px 0}</style></head><body>
      <div class="big">#${order.number}</div>
      <div class="muted">${order.type} · ${order.status}</div>
      <div class="line"></div>
      <div>${new Date(order.createdAt).toLocaleString()}</div>
      <div>Guest: ${order.customerName}</div>
      ${order.tableId ? `<div>Table: ${data.tables.find(t => t.id === order.tableId)?.number ?? order.tableId}</div>` : ''}
      <div class="line"></div>
      <ul>${order.items.map(item => `<li>${item.qty}× ${item.name}${item.note ? ` (${item.note})` : ''}</li>`).join('')}</ul>
      <div class="line"></div>
      <div>Total: ${money(order.total)}</div>
      <div>Paid: ${money(order.paid)} · Due: ${money(order.due)}</div>
      ${order.kitchenNote ? `<div class="line"></div><div><b>Note:</b> ${order.kitchenNote}</div>` : ''}
      </body></html>`);
    win.document.close();
    win.print();
  };

  const columns: Column<Order>[] = [
    {
      key: 'order',
      header: 'Order',
      render: order => (
        <div>
          <div className="font-semibold text-white">#{order.number}</div>
          <div className="text-[10px] text-slate-500">{new Date(order.createdAt).toLocaleDateString('en-GB')} · {clock(order.createdAt)}</div>
        </div>
      )
    },
    {
      key: 'customer',
      header: 'Guest / channel',
      render: order => (
        <div>
          <div className="text-slate-200">{order.customerName}</div>
          <div className="text-[10px] text-slate-500">{order.type}</div>
        </div>
      )
    },
    {
      key: 'items',
      header: 'Items',
      render: order => <span className="text-[11px] text-slate-400">{order.items.reduce((sum, item) => sum + item.qty, 0)} pcs</span>
    },
    { key: 'status', header: 'Status', render: order => <Badge tone={statusTone(order.status)}>{order.status}</Badge> },
    {
      key: 'payment',
      header: 'Payment',
      render: order => (
        <div>
          <div className="text-[11px] text-slate-300">{order.paymentMethod}</div>
          <div className={`text-[10px] ${order.due > 0 ? 'text-rose-300' : 'text-emerald-300/80'}`}>{order.due > 0 ? `${money(order.due)} due` : 'Settled'}</div>
        </div>
      )
    },
    { key: 'total', header: 'Total', align: 'right', render: order => <span className="font-semibold text-white">{money(order.total)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: order => (
        <div className="flex items-center justify-end gap-1">
          {statusFlow(order.status) ? (
            <Button size="sm" variant="soft" onClick={() => advance(order)}>
              {statusFlow(order.status)}
            </Button>
          ) : null}
          <IconButton title="View order" onClick={() => setDetail(order)}>
            <Eye size={13} />
          </IconButton>
          <IconButton title="Print ticket" onClick={() => printTicket(order)}>
            <Printer size={13} />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Order book"
        title="Orders"
        subtitle="Every ticket from all channels, with status transitions, payment balances and kitchen printing."
        actions={<Button variant="outline" onClick={() => setStatus('All')}>Reset filters</Button>}
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Orders in view', value: String(stats.count) },
          { label: 'Revenue', value: money(stats.revenue) },
          { label: 'Collected', value: money(stats.collected) },
          { label: 'Outstanding', value: money(stats.due) }
        ].map(item => (
          <div key={item.label} className={`${panel} px-4 py-3`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-serif text-[18px] text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`${panel} p-3`}>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_150px_150px]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={term} onChange={event => setTerm(event.target.value)} placeholder="Search order #, guest or item…" className={`${inputCls} pl-8`} />
          </div>
          <Select value={status} onChange={setStatus} options={[{ value: 'All', label: 'All statuses' }, ...ORDER_STATUSES.map(value => ({ value, label: value }))]} />
          <Select
            value={type}
            onChange={setType}
            options={[{ value: 'All', label: 'All channels' }, ...['Dine-in', 'Takeaway', 'Pickup', 'Home Delivery'].map(value => ({ value, label: value }))]}
          />
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={order => order.id} empty="No orders match these filters." />
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Order #${detail.number}` : 'Order'}
        subtitle={detail ? `${detail.type} · ${new Date(detail.createdAt).toLocaleString()}` : undefined}
        wide
        footer={
          detail ? (
            <>
              <Button variant="danger" onClick={() => cancelOrder(detail)} disabled={detail.status === 'Cancelled'}>
                <X size={13} /> Cancel order
              </Button>
              <Button variant="outline" onClick={() => printTicket(detail)}>
                <Printer size={13} /> Print ticket
              </Button>
              {detail.due > 0 ? <Button onClick={() => settleDue(detail)}>Collect {money(detail.due)}</Button> : null}
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[.07] p-3">
                <div className="mb-2 text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">Guest & delivery</div>
                <div className="space-y-1 text-[11.5px]">
                  <div className="flex justify-between gap-2"><span className="text-slate-500">Guest</span><span className="text-slate-200">{detail.customerName}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-slate-500">Channel</span><span className="text-slate-200">{detail.type}</span></div>
                  {detail.tableId ? (
                    <div className="flex justify-between gap-2"><span className="text-slate-500">Table</span><span className="text-slate-200">{data.tables.find(t => t.id === detail.tableId)?.number ?? detail.tableId}</span></div>
                  ) : null}
                  {detail.deliveryAddress ? <div className="flex justify-between gap-2"><span className="text-slate-500">Address</span><span className="text-right text-slate-200">{detail.deliveryAddress}</span></div> : null}
                  {detail.deliveryPhone ? <div className="flex justify-between gap-2"><span className="text-slate-500">Phone</span><span className="text-slate-200">{detail.deliveryPhone}</span></div> : null}
                  {detail.riderName ? <div className="flex justify-between gap-2"><span className="text-slate-500">Rider</span><span className="text-slate-200">{detail.riderName}</span></div> : null}
                  {detail.deliveryStatus ? <div className="flex justify-between gap-2"><span className="text-slate-500">Delivery</span><Badge tone={statusTone(detail.deliveryStatus)}>{detail.deliveryStatus}</Badge></div> : null}
                </div>
              </div>
              <div className="rounded-xl border border-white/[.07] p-3">
                <div className="mb-2 text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">Status</div>
                <div className="flex flex-wrap gap-1.5">
                  {ORDER_STATUSES.map(value => (
                    <button
                      key={value}
                      onClick={() =>
                        commit(
                          { orders: data.orders.map(entry => (entry.id === detail.id ? { ...entry, status: value } : entry)) },
                          { title: 'Order status updated', detail: `#${detail.number} → ${value}` }
                        )
                      }
                      className={`rounded-lg border px-2 py-1 text-[10.5px] transition ${
                        detail.status === value ? 'border-[#e7b943]/40 bg-[#e7b943]/15 text-[#f0cd75]' : 'border-white/[.08] text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {detail.kitchenNote ? (
                  <div className="mt-2 rounded-lg border border-[#e7b943]/15 bg-[#e7b943]/[.05] px-2.5 py-2 text-[11px] text-amber-100">“{detail.kitchenNote}”</div>
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[.07]">
                <div className="border-b border-white/[.06] px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">Order lines</div>
                {detail.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 border-b border-white/[.04] px-3 py-2 text-[11.5px] last:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-slate-200">{item.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {money(item.unitPrice)} × {item.qty}
                        {item.note ? ` · ${item.note}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 text-slate-200">{money(item.unitPrice * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/[.07] p-3 text-[11.5px]">
                <div className="flex justify-between py-0.5 text-slate-400"><span>Subtotal</span><span>{money(detail.subtotal)}</span></div>
                {detail.discount > 0 ? <div className="flex justify-between py-0.5 text-emerald-300"><span>Discount {detail.couponCode ? `(${detail.couponCode})` : ''}</span><span>−{money(detail.discount)}</span></div> : null}
                <div className="flex justify-between py-0.5 text-slate-400"><span>VAT</span><span>{money(detail.tax)}</span></div>
                {detail.deliveryFee ? <div className="flex justify-between py-0.5 text-slate-400"><span>Delivery</span><span>{money(detail.deliveryFee)}</span></div> : null}
                <div className="mt-1 flex justify-between border-t border-white/[.07] pt-1.5 text-[13px] font-semibold text-white"><span>Total</span><span>{money(detail.total)}</span></div>
                <div className="flex justify-between py-0.5 text-slate-300"><span>Paid</span><span>{money(detail.paid)}</span></div>
                <div className="flex justify-between py-0.5 font-medium text-rose-300"><span>Due</span><span>{money(detail.due)}</span></div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
