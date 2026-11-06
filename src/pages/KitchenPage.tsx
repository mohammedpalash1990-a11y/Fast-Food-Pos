import { useState } from 'react';
import { Bell, ChefHat, Check, Clock, Flame, Timer, Utensils } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, PageHeader, panel, Segmented, statusTone } from '../components/ui';
import { clock } from '../lib/format';
import type { Order } from '../types';

const lanes: { status: Order['status']; label: string; icon: typeof Clock; accent: string }[] = [
  { status: 'Pending', label: 'New tickets', icon: Bell, accent: 'from-amber-400/20' },
  { status: 'Accepted', label: 'Accepted', icon: Check, accent: 'from-sky-400/20' },
  { status: 'Preparing', label: 'On the grill', icon: Flame, accent: 'from-orange-400/20' },
  { status: 'Ready', label: 'Ready to serve', icon: Utensils, accent: 'from-emerald-400/20' }
];

export default function KitchenPage() {
  const { data, commit, notify, money } = useStore();
  const [channel, setChannel] = useState<'All' | 'Dine-in' | 'Takeaway' | 'Home Delivery' | 'Pickup'>('All');

  const queue = data.orders.filter(
    order => order.number !== 'HOLD' && ['Pending', 'Accepted', 'Preparing', 'Ready'].includes(order.status) && (channel === 'All' || order.type === channel)
  );

  const move = (order: Order, status: Order['status']) => {
    commit(
      {
        orders: data.orders.map(entry => (entry.id === order.id ? { ...entry, status } : entry)),
        tables:
          status === 'Ready' && order.tableId
            ? data.tables
            : status === 'Completed' && order.tableId
              ? data.tables.map(table => (table.id === order.tableId ? { ...table, status: 'Cleaning', currentGuests: 0, currentOrderId: undefined } : table))
              : data.tables
      },
      { title: 'Kitchen update', detail: `#${order.number} → ${status}` }
    );
    notify(`#${order.number} marked ${status}.`);
  };

  const ageMinutes = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  const itemsInQueue = queue.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.qty, 0), 0);
  const oldest = queue.reduce((max, order) => Math.max(max, ageMinutes(order.createdAt)), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Back of house"
        title="Kitchen display"
        subtitle="Ticket board grouped by preparation stage. Tap a ticket to advance it through the line."
        actions={
          <Segmented
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'All', label: 'All' },
              { value: 'Dine-in', label: 'Dine-in' },
              { value: 'Takeaway', label: 'Takeaway' },
              { value: 'Pickup', label: 'Pickup' },
              { value: 'Home Delivery', label: 'Delivery' }
            ]}
          />
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        <div className={`${panel} flex items-center gap-3 px-4 py-3`}>
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#e7b943]/20 bg-[#e7b943]/10 text-[#e7b943]"><ChefHat size={16} /></div>
          <div>
            <div className="font-serif text-[18px] text-white">{queue.length}</div>
            <div className="text-[10px] text-slate-500">Live tickets</div>
          </div>
        </div>
        <div className={`${panel} flex items-center gap-3 px-4 py-3`}>
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-300"><Utensils size={16} /></div>
          <div>
            <div className="font-serif text-[18px] text-white">{itemsInQueue}</div>
            <div className="text-[10px] text-slate-500">Items to cook</div>
          </div>
        </div>
        <div className={`${panel} flex items-center gap-3 px-4 py-3`}>
          <div className={`grid h-9 w-9 place-items-center rounded-lg border ${oldest > 20 ? 'border-rose-400/25 bg-rose-400/10 text-rose-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}><Timer size={16} /></div>
          <div>
            <div className="font-serif text-[18px] text-white">{oldest} min</div>
            <div className="text-[10px] text-slate-500">Oldest ticket age</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {lanes.map(lane => {
          const tickets = queue.filter(order => order.status === lane.status);
          const Icon = lane.icon;
          return (
            <div key={lane.status} className={`${panel} overflow-hidden`}>
              <div className={`flex items-center justify-between border-b border-white/[.06] bg-gradient-to-r ${lane.accent} to-transparent px-3 py-2.5`}>
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-slate-200" />
                  <span className="text-[11.5px] font-semibold text-white">{lane.label}</span>
                </div>
                <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-300">{tickets.length}</span>
              </div>
              <div className="custom-scrollbar max-h-[calc(100vh-300px)] min-h-[160px] space-y-2 overflow-y-auto p-2">
                {tickets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/[.08] px-3 py-7 text-center text-[10.5px] text-slate-600">No tickets in this lane.</div>
                ) : (
                  tickets
                    .slice()
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map(order => {
                      const age = ageMinutes(order.createdAt);
                      const late = age > 20;
                      return (
                        <div key={order.id} className={`rounded-xl border bg-[#0f1317] p-2.5 ${late ? 'border-rose-400/30' : 'border-white/[.07]'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-serif text-[16px] leading-none text-white">#{order.number}</div>
                              <div className="mt-1 text-[9.5px] text-slate-500">{order.type}{order.tableId ? ` · ${data.tables.find(t => t.id === order.tableId)?.number}` : ''}</div>
                            </div>
                            <Badge tone={late ? 'red' : age > 12 ? 'amber' : 'slate'}>
                              <Clock size={9} /> {age}m
                            </Badge>
                          </div>
                          <div className="mt-2 space-y-1 border-t border-white/[.05] pt-1.5">
                            {order.items.map(item => (
                              <div key={item.id} className="flex items-start gap-1.5 text-[11px]">
                                <span className="mt-px rounded bg-white/[.07] px-1 text-[9.5px] font-semibold text-slate-300">{item.qty}×</span>
                                <div className="min-w-0">
                                  <div className="truncate text-slate-200">{item.name}</div>
                                  {item.note ? <div className="truncate text-[9.5px] italic text-[#e7b943]/80">{item.note}</div> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                          {order.kitchenNote ? (
                            <div className="mt-1.5 rounded-md border border-amber-400/20 bg-amber-400/[.07] px-1.5 py-1 text-[9.5px] text-amber-100">{order.kitchenNote}</div>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between gap-1.5">
                            <span className="text-[9.5px] text-slate-600">{clock(order.createdAt)} · {money(order.total)}</span>
                            {lane.status === 'Ready' ? (
                              <Button size="sm" onClick={() => move(order, 'Completed')}>Serve</Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => move(order, lane.status === 'Pending' ? 'Accepted' : lane.status === 'Accepted' ? 'Preparing' : 'Ready')}
                              >
                                {lane.status === 'Pending' ? 'Accept' : lane.status === 'Accepted' ? 'Start' : 'Ready'}
                              </Button>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                            <button onClick={() => move(order, 'Ready')} className="text-[9px] text-slate-600 underline decoration-dotted hover:text-slate-400">
                              jump to ready
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
