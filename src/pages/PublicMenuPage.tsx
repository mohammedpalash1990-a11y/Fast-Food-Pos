import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Search, ShoppingBag, X } from 'lucide-react';
import { useStore } from '../store';
import { inputCls } from '../components/ui';

export default function PublicMenuPage() {
  const { data, money } = useStore();
  const params = new URLSearchParams(window.location.search);
  const tableNumber = params.get('table');
  const [category, setCategory] = useState('All');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const products = useMemo(
    () =>
      data.products
        .filter(product => product.active !== false)
        .filter(product => category === 'All' || product.category === category)
        .filter(product => product.name.toLowerCase().includes(term.trim().toLowerCase())),
    [data.products, category, term]
  );

  const detail = data.products.find(product => product.id === selected) ?? null;

  useEffect(() => {
    document.title = `${data.settings.restaurantName} · Menu`;
  }, [data.settings.restaurantName]);

  return (
    <div className="min-h-screen bg-[#0b0e11] pb-16 text-slate-100">
      <div className="bg-gradient-to-br from-[#1c1f1c] via-[#12161a] to-[#0d1114] px-4 pb-6 pt-7">
        <div className="mx-auto max-w-3xl">
          <div className="text-[9.5px] uppercase tracking-[.3em] text-[#cba84c]">{data.settings.branchName}</div>
          <h1 className="mt-1 font-serif text-[27px] leading-tight text-white">{data.settings.restaurantName}</h1>
          <p className="mt-1 text-[11.5px] text-slate-400">
            {data.settings.address} · {data.settings.phone}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {tableNumber ? <span className="rounded-full border border-[#e7b943]/25 bg-[#e7b943]/10 px-2.5 py-1 text-[10.5px] text-[#f0cd75]">Table {tableNumber}</span> : null}
            <span className="rounded-full border border-white/10 bg-white/[.03] px-2.5 py-1 text-[10.5px] text-slate-400">VAT {data.settings.taxRate}% included at billing</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-3">
        <div className="relative -mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={term} onChange={event => setTerm(event.target.value)} placeholder="Search the menu…" className={`${inputCls} pl-8`} />
        </div>

        <div className="custom-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {['All', ...Array.from(new Set(data.products.filter(p => p.active !== false).map(p => p.category)))].map(name => (
            <button
              key={name}
              onClick={() => setCategory(name)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] transition ${
                category === name ? 'border-[#e7b943]/40 bg-[#e7b943]/15 text-[#f2d490]' : 'border-white/[.08] text-slate-400'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {products.map(product => (
            <button key={product.id} onClick={() => setSelected(product.id)} className="flex gap-2.5 rounded-xl border border-white/[.07] bg-white/[.022] p-2 text-left transition hover:border-[#e7b943]/30">
              <img src={product.image} alt={product.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-slate-100">{product.name}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{product.category}</div>
                <div className="mt-1 text-[12.5px] font-semibold text-[#f0cd75]">{money(product.price)}</div>
              </div>
            </button>
          ))}
          {products.length === 0 ? <div className="col-span-full rounded-xl border border-dashed border-white/10 py-10 text-center text-[12px] text-slate-500">No items match this search.</div> : null}
        </div>

        <div className="mt-5 rounded-xl border border-white/[.07] bg-white/[.02] p-3 text-center">
          <div className="text-[11px] text-slate-400">Order at the counter or call {data.settings.phone}</div>
          <div className="mt-1 text-[10px] text-slate-600">{data.settings.receiptFooter}</div>
        </div>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-white/[.09] bg-[#12161a] sm:rounded-2xl">
            <div className="relative">
              <img src={detail.image} alt={detail.name} className="h-44 w-full object-cover" />
              <button onClick={() => setSelected(null)} className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-slate-200" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <div className="text-[9.5px] uppercase tracking-[.2em] text-[#cba84c]">{detail.category}</div>
              <h2 className="mt-1 font-serif text-[21px] text-white">{detail.name}</h2>
              <div className="mt-1 text-[16px] font-semibold text-[#f0cd75]">{money(detail.price)}</div>
              <div className="mt-3 space-y-1">
                {detail.recipe.map(usage => (
                  <div key={usage.ingredientId} className="flex justify-between text-[11px] text-slate-400">
                    <span>{usage.name}</span>
                    <span className="text-slate-500">{usage.qty} {usage.unit}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setSelected(null)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#f1cb6b] to-[#d9a63a] px-3 py-2.5 text-[12.5px] font-semibold text-[#241a06]">
                <ChevronLeft size={14} /> Back to menu
              </button>
              <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-500">
                <ShoppingBag size={11} /> Ask our counter team to place this order for you
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
