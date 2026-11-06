import { useState } from 'react';
import { Building2, Database, Percent, Save, Server, Store } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, inputCls, Labeled, PageHeader, panel, textareaCls } from '../components/ui';
import type { RestaurantSettings } from '../types';

export default function SettingsPage() {
  const { data, commit, notify, sync, message, reload } = useStore();
  const [form, setForm] = useState<RestaurantSettings>(data.settings);
  const [dirty, setDirty] = useState(false);

  const set = (patch: Partial<RestaurantSettings>) => {
    setForm(current => ({ ...current, ...patch }));
    setDirty(true);
  };

  const save = () => {
    if (!form.restaurantName.trim() || !form.branchName.trim()) {
      notify('Restaurant and branch names are required.');
      return;
    }
    commit({ settings: { ...form, taxRate: Math.max(0, Math.min(50, Number(form.taxRate) || 0)) } }, { title: 'Settings saved', detail: `${form.restaurantName} · ${form.branchName} · VAT ${form.taxRate}%` });
    setDirty(false);
    notify('Branch settings saved to the database.');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Settings"
        subtitle="Branch identity, tax rate, receipt footer and the public menu URL used in QR codes."
        actions={
          <>
            <Button variant="outline" onClick={() => void reload()}><Database size={13} /> Reload from database</Button>
            <Button onClick={save} disabled={!dirty}><Save size={13} /> Save settings</Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className={`${panel} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <Store size={14} className="text-[#e7b943]" />
              <h3 className="text-[12.5px] font-semibold text-slate-200">Restaurant profile</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Restaurant name"><input value={form.restaurantName} onChange={event => set({ restaurantName: event.target.value })} className={inputCls} /></Labeled>
              <Labeled label="Branch name"><input value={form.branchName} onChange={event => set({ branchName: event.target.value })} className={inputCls} /></Labeled>
              <Labeled label="Branch code"><input value={form.branchCode} onChange={event => set({ branchCode: event.target.value.toUpperCase() })} className={`${inputCls} font-mono`} /></Labeled>
              <Labeled label="Phone"><input value={form.phone} onChange={event => set({ phone: event.target.value })} className={inputCls} /></Labeled>
              <Labeled label="Address" className="sm:col-span-2"><textarea value={form.address} onChange={event => set({ address: event.target.value })} className={textareaCls} /></Labeled>
            </div>
          </div>

          <div className={`${panel} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <Percent size={14} className="text-[#e7b943]" />
              <h3 className="text-[12.5px] font-semibold text-slate-200">Billing & receipts</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Currency symbol"><input value={form.currency} onChange={event => set({ currency: event.target.value })} className={inputCls} /></Labeled>
              <Labeled label="VAT / tax rate (%)" hint="Applied to every POS bill after discounts.">
                <input type="number" min="0" max="50" step="0.5" value={form.taxRate} onChange={event => set({ taxRate: Number(event.target.value) })} className={inputCls} />
              </Labeled>
              <Labeled label="Receipt footer" className="sm:col-span-2">
                <textarea value={form.receiptFooter} onChange={event => set({ receiptFooter: event.target.value })} className={textareaCls} />
              </Labeled>
            </div>
          </div>

          <div className={`${panel} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={14} className="text-[#e7b943]" />
              <h3 className="text-[12.5px] font-semibold text-slate-200">QR menu channel</h3>
            </div>
            <Labeled label="Public menu base URL" hint="Encoded in every table QR code. Point it at your hosted guest menu.">
              <input value={form.publicMenuUrl} onChange={event => set({ publicMenuUrl: event.target.value })} className={inputCls} />
            </Labeled>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`${panel} p-4`}>
            <div className="mb-2 flex items-center gap-2">
              <Server size={14} className="text-[#e7b943]" />
              <h3 className="text-[12.5px] font-semibold text-slate-200">Backend status</h3>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between"><span className="text-slate-400">API engine</span><Badge tone="blue">Express · SQLite</Badge></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Database file</span><span className="font-mono text-[10px] text-slate-300">data/pos.db</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Sync state</span><Badge tone={sync === 'error' ? 'red' : sync === 'offline' ? 'amber' : 'green'}>{sync === 'idle' ? 'connected' : sync}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Auth</span><span className="text-slate-300">JWT · bcrypt</span></div>
            </div>
            {message ? <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[.07] px-2.5 py-2 text-[10.5px] text-amber-100">{message}</div> : null}
            <div className="mt-2 rounded-lg border border-white/[.07] bg-white/[.02] px-2.5 py-2 text-[10px] leading-5 text-slate-500">
              Every change in the console is written back to SQLite. Use <span className="font-mono text-slate-300">npm run db:seed</span> to re-seed a fresh database.
            </div>
          </div>

          <div className={`${panel} p-4`}>
            <h3 className="text-[12.5px] font-semibold text-slate-200">Data footprint</h3>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10.5px]">
              {[
                ['Orders', data.orders.length],
                ['Menu items', data.products.length],
                ['Ingredients', data.inventory.length],
                ['Customers', data.customers.length],
                ['Employees', data.employees.length],
                ['Ledger entries', data.payments.length]
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-white/[.06] bg-white/[.02] px-2 py-1.5">
                  <div className="text-slate-500">{label}</div>
                  <div className="text-[12px] font-medium text-slate-200">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${panel} p-4`}>
            <h3 className="text-[12.5px] font-semibold text-slate-200">Preview</h3>
            <div className="mt-2 rounded-xl border border-white/[.08] bg-[#f7f3e9] p-3 text-[#1c1e20]">
              <div className="font-serif text-[15px]">{form.restaurantName}</div>
              <div className="text-[9.5px] uppercase tracking-[.18em] text-[#a37c14]">{form.branchName}</div>
              <div className="mt-1 text-[9.5px] text-[#6b6656]">{form.address}</div>
              <div className="text-[9.5px] text-[#6b6656]">{form.phone}</div>
              <div className="my-1.5 border-t border-dashed border-[#c9c2b1]" />
              <div className="flex justify-between text-[10px]"><span>Sample burger</span><span>{form.currency}250</span></div>
              <div className="flex justify-between text-[10px]"><span>VAT ({form.taxRate}%)</span><span>{form.currency}{((250 * form.taxRate) / 100).toFixed(0)}</span></div>
              <div className="mt-1 flex justify-between border-t border-[#d8d2c2] pt-1 text-[11px] font-semibold"><span>Total</span><span>{form.currency}{(250 + (250 * form.taxRate) / 100).toFixed(0)}</span></div>
              <div className="mt-2 text-center text-[8.5px] text-[#8a8474]">{form.receiptFooter}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
