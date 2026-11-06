import { useMemo, useState } from 'react';
import { ChefHat, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, IconButton, inputCls, PageHeader, panel, SearchInput, Select } from '../components/ui';
import type { IngredientUsage } from '../types';

export default function RecipesPage() {
  const { data, commit, notify, money } = useStore();
  const [term, setTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string>(data.products[0]?.id ?? '');
  const [draft, setDraft] = useState<IngredientUsage[] | null>(null);
  const [pickId, setPickId] = useState('');

  const products = useMemo(() => {
    const query = term.trim().toLowerCase();
    return data.products.filter(product => !query || product.name.toLowerCase().includes(query) || product.category.toLowerCase().includes(query));
  }, [data.products, term]);

  const selected = data.products.find(product => product.id === selectedId) ?? products[0] ?? null;
  const recipe = draft ?? selected?.recipe ?? [];

  const costOf = (usage: IngredientUsage) => {
    const ingredient = data.inventory.find(item => item.id === usage.ingredientId);
    return ingredient ? ingredient.cost * usage.qty : 0;
  };
  const recipeCost = recipe.reduce((sum, usage) => sum + costOf(usage), 0);
  const margin = selected ? selected.price - recipeCost : 0;
  const marginPct = selected && selected.price > 0 ? (margin / selected.price) * 100 : 0;

  const startEdit = (productId: string) => {
    setSelectedId(productId);
    setDraft(null);
  };

  const lines: IngredientUsage[] = draft ?? selected?.recipe ?? [];

  const setLines = (next: IngredientUsage[]) => setDraft(next);

  const addIngredient = () => {
    const ingredient = data.inventory.find(item => item.id === pickId);
    if (!ingredient || !selected) return;
    if (lines.some(line => line.ingredientId === ingredient.id)) {
      notify(`${ingredient.name} is already in this recipe.`);
      return;
    }
    setLines([...lines, { ingredientId: ingredient.id, name: ingredient.name, qty: 1, unit: ingredient.unit }]);
    setPickId('');
  };

  const updateLine = (ingredientId: string, patch: Partial<IngredientUsage>) => {
    setLines(lines.map(line => (line.ingredientId === ingredientId ? { ...line, ...patch } : line)));
  };

  const save = () => {
    if (!selected) return;
    commit(
      { products: data.products.map(product => (product.id === selected.id ? { ...product, recipe: lines } : product)) },
      { title: 'Recipe updated', detail: `${selected.name} · ${lines.length} ingredients · cost ${money(recipeCost)}` }
    );
    notify(`${selected.name} recipe saved (${lines.length} ingredients).`);
    setDraft(null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Bill of materials"
        title="Recipes & ingredients"
        subtitle="Link every menu item to its ingredients so sales deduct stock automatically and margins stay accurate."
        actions={
          <Button onClick={save} disabled={!draft}>
            <Save size={13} /> {draft ? 'Save recipe' : 'No unsaved changes'}
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <div className={`${panel} p-3`}>
          <SearchInput value={term} onChange={setTerm} placeholder="Search menu…" />
          <div className="custom-scrollbar mt-2 max-h-[560px] space-y-1 overflow-y-auto pr-0.5">
            {products.map(product => {
              const linked = product.recipe.length;
              return (
                <button
                  key={product.id}
                  onClick={() => startEdit(product.id)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                    selected?.id === product.id ? 'border-[#e7b943]/35 bg-[#e7b943]/[.08]' : 'border-transparent hover:border-white/10 hover:bg-white/[.03]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <img src={product.image} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" loading="lazy" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-medium text-slate-200">{product.name}</div>
                      <div className="text-[9.5px] text-slate-500">{product.category} · {money(product.price)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${linked > 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>
                      {linked > 0 ? `${linked} ing` : 'no recipe'}
                    </span>
                  </div>
                </button>
              );
            })}
            {products.length === 0 ? <div className="py-6 text-center text-[11px] text-slate-500">No menu items match.</div> : null}
          </div>
        </div>

        <div className={`${panel} p-4`}>
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[.07] pb-3">
                <div className="flex items-center gap-3">
                  <img src={selected.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <div>
                    <div className="text-[10px] uppercase tracking-[.18em] text-[#cba84c]">{selected.category}</div>
                    <h3 className="font-serif text-[19px] text-white">{selected.name}</h3>
                    <div className="text-[10.5px] text-slate-500">Selling price {money(selected.price)} · {selected.sku || selected.id}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="rounded-lg border border-white/[.08] bg-white/[.02] px-3 py-1.5 text-right">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Plate cost</div>
                    <div className="text-[13px] font-semibold text-slate-100">{money(recipeCost)}</div>
                  </div>
                  <div className={`rounded-lg border px-3 py-1.5 text-right ${margin >= 0 ? 'border-emerald-400/20 bg-emerald-400/[.06]' : 'border-rose-400/20 bg-rose-400/[.06]'}`}>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Margin</div>
                    <div className={`text-[13px] font-semibold ${margin >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{marginPct.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500">Add ingredient</span>
                  <Select
                    value={pickId}
                    onChange={setPickId}
                    options={[{ value: '', label: 'Choose ingredient…' }, ...data.inventory.map(item => ({ value: item.id, label: `${item.name} · ${item.stock} ${item.unit} left` }))]}
                  />
                </div>
                <Button variant="soft" onClick={addIngredient} disabled={!selected}>
                  <Plus size={13} /> Add to recipe
                </Button>
              </div>

              <div className="mt-3 space-y-1.5">
                {lines.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-9 text-center">
                    <ChefHat size={20} className="mx-auto text-slate-600" />
                    <div className="mt-1.5 text-[11.5px] text-slate-500">No ingredients linked yet. Add them above to enable automatic stock deduction.</div>
                  </div>
                ) : (
                  lines.map(line => {
                    const ingredient = data.inventory.find(item => item.id === line.ingredientId);
                    const unitCost = ingredient?.cost ?? 0;
                    const available = ingredient?.stock ?? 0;
                    const canMake = line.qty > 0 ? Math.floor(available / line.qty) : 0;
                    return (
                      <div key={line.ingredientId} className="grid items-center gap-2 rounded-lg border border-white/[.06] bg-white/[.02] px-2.5 py-2 sm:grid-cols-[1fr_100px_90px_100px_auto]">
                        <div className="min-w-0">
                          <div className="truncate text-[11.5px] font-medium text-slate-200">{line.name}</div>
                          <div className="text-[9.5px] text-slate-500">{available.toLocaleString('en-US')} {line.unit} in stock · {canMake} portions possible</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton title="Decrease" onClick={() => updateLine(line.ingredientId, { qty: Math.max(0, Number((line.qty - 1).toFixed(2))) })}>
                            <Minus size={11} />
                          </IconButton>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.qty}
                            onChange={event => updateLine(line.ingredientId, { qty: Math.max(0, Number(event.target.value) || 0) })}
                            className={`${inputCls} px-1.5 py-1 text-center text-[11px]`}
                          />
                          <IconButton title="Increase" onClick={() => updateLine(line.ingredientId, { qty: Number((line.qty + 1).toFixed(2)) })}>
                            <Plus size={11} />
                          </IconButton>
                        </div>
                        <div className="text-[10.5px] text-slate-500">{line.unit}</div>
                        <div className="text-right text-[11px] text-slate-300">{(unitCost * line.qty).toFixed(2)}</div>
                        <IconButton tone="danger" title="Remove" onClick={() => setLines(lines.filter(entry => entry.ingredientId !== line.ingredientId))}>
                          <Trash2 size={12} />
                        </IconButton>
                      </div>
                    );
                  })
                )}
              </div>

              {line_summary(recipe, costOf, money)}
            </>
          ) : (
            <div className="py-10 text-center text-[12px] text-slate-500">Select a menu item to manage its recipe.</div>
          )}
        </div>
      </div>

      <div className={`${panel} mt-3 p-3`}>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[12.5px] font-semibold text-slate-200">Recipe coverage</h3>
          <span className="text-[10px] text-slate-500">{data.products.filter(p => p.recipe.length > 0).length}/{data.products.length} items linked</span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {data.products.filter(product => product.recipe.length === 0).map(product => (
            <button key={product.id} onClick={() => startEdit(product.id)} className="flex items-center gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[.04] px-2.5 py-1.5 text-left hover:bg-amber-400/[.08]">
              <Badge tone="amber">missing</Badge>
              <span className="truncate text-[11px] text-slate-300">{product.name}</span>
            </button>
          ))}
          {data.products.every(product => product.recipe.length > 0) ? (
            <div className="text-[11px] text-emerald-300">Every menu item has a linked recipe.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function line_summary(recipe: IngredientUsage[], costOf: (usage: IngredientUsage) => number, money: (value: number) => string) {
  const total = recipe.reduce((sum, usage) => sum + costOf(usage), 0);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[.07] bg-black/25 px-3 py-2">
      <div className="text-[10.5px] text-slate-500">
        {recipe.length} ingredient{recipe.length === 1 ? '' : 's'} · batch cost <span className="font-semibold text-slate-200">{money(total)}</span>
      </div>
      <div className="text-[10px] text-slate-600">Stock changes are saved to the database when you press Save recipe.</div>
    </div>
  );
}
