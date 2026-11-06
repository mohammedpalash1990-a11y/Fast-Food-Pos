import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Boxes, CircleAlert, PackagePlus, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Bar, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, SearchInput, Select, type Column } from '../components/ui';
import { stockHealth } from '../lib/pos';
import { shortDate } from '../lib/format';
import type { InventoryItem, StockMovement } from '../types';

const emptyForm = {
  name: '',
  sku: '',
  category: 'Meat',
  unit: 'piece',
  stock: '0',
  reorderLevel: '0',
  cost: '0',
  supplier: '',
  expiry: ''
};

export default function InventoryPage() {
  const { data, commit, notify, money } = useStore();
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [adjustFor, setAdjustFor] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<StockMovement['movementType']>('adjustment');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const items = useMemo(
    () =>
      data.inventory.filter(item => {
        if (filter === 'Low' && stockHealth(item) === 'ok') return false;
        if (filter === 'Out' && item.stock > 0) return false;
        const query = term.trim().toLowerCase();
        return !query || item.name.toLowerCase().includes(query) || item.supplier.toLowerCase().includes(query) || (item.sku || '').toLowerCase().includes(query);
      }),
    [data.inventory, filter, term]
  );

  const stockValue = data.inventory.reduce((sum, item) => sum + item.stock * item.cost, 0);
  const lowCount = data.inventory.filter(item => item.stock <= item.reorderLevel).length;

  const applyStock = (item: InventoryItem, delta: number, type: StockMovement['movementType'], note: string) => {
    const nextStock = Number(Math.max(0, item.stock + delta).toFixed(2));
    commit(
      {
        inventory: data.inventory.map(entry => (entry.id === item.id ? { ...entry, stock: nextStock } : entry)),
        stockMovements: [
          {
            id: `sm-${Date.now()}`,
            ingredientId: item.id,
            ingredientName: item.name,
            movementType: type,
            quantityDelta: Number(delta.toFixed(2)),
            note: note || `${type} adjustment`,
            createdAt: new Date().toISOString()
          },
          ...data.stockMovements
        ]
      },
      { title: `Stock ${delta >= 0 ? 'increased' : 'reduced'}`, detail: `${item.name} · ${delta > 0 ? '+' : ''}${delta} ${item.unit} → ${nextStock} ${item.unit}` }
    );
    notify(`${item.name} stock is now ${nextStock} ${item.unit}.`);
  };

  const saveItem = () => {
    if (!form.name.trim()) {
      notify('Ingredient name is required.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || `ING-${Date.now().toString().slice(-4)}`,
      category: form.category,
      unit: form.unit,
      stock: Math.max(0, Number(form.stock) || 0),
      reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
      cost: Math.max(0, Number(form.cost) || 0),
      supplier: form.supplier.trim(),
      expiry: form.expiry
    };
    if (editing) {
      commit(
        { inventory: data.inventory.map(item => (item.id === editing.id ? { ...item, ...payload } : item)) },
        { title: 'Ingredient updated', detail: `${payload.name} · reorder at ${payload.reorderLevel} ${payload.unit}` }
      );
      notify(`${payload.name} updated.`);
    } else {
      const item: InventoryItem = { id: `i-${Date.now()}`, ...payload };
      commit(
        {
          inventory: [...data.inventory, item],
          stockMovements: [
            {
              id: `sm-${Date.now()}`,
              ingredientId: item.id,
              ingredientName: item.name,
              movementType: 'purchase',
              quantityDelta: item.stock,
              note: 'Opening stock recorded',
              createdAt: new Date().toISOString()
            },
            ...data.stockMovements
          ]
        },
        { title: 'Ingredient added', detail: `${item.name} · opening ${item.stock} ${item.unit}` }
      );
      notify(`${item.name} added to inventory.`);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku || '',
      category: item.category,
      unit: item.unit,
      stock: String(item.stock),
      reorderLevel: String(item.reorderLevel),
      cost: String(item.cost),
      supplier: item.supplier,
      expiry: item.expiry
    });
    setFormOpen(true);
  };

  const submitAdjustment = () => {
    if (!adjustFor) return;
    const qty = Number(adjustQty) || 0;
    if (qty <= 0) {
      notify('Enter a quantity greater than zero.');
      return;
    }
    const delta = adjustType === 'purchase' ? qty : -qty;
    applyStock(adjustFor, delta, adjustType, adjustNote.trim());
    setAdjustFor(null);
    setAdjustQty('');
    setAdjustNote('');
  };

  const columns: Column<InventoryItem>[] = [
    {
      key: 'item',
      header: 'Ingredient',
      render: item => (
        <div>
          <div className="font-medium text-slate-100">{item.name}</div>
          <div className="font-mono text-[9.5px] text-slate-500">{item.sku || item.id} · {item.category}</div>
        </div>
      )
    },
    {
      key: 'stock',
      header: 'On hand',
      render: item => {
        const health = stockHealth(item);
        return (
          <div className="min-w-[110px]">
            <div className="flex items-center gap-1.5">
              <span className={`text-[12px] font-semibold ${health === 'out' ? 'text-rose-300' : health === 'low' ? 'text-amber-300' : 'text-slate-100'}`}>
                {item.stock.toLocaleString('en-US')} {item.unit}
              </span>
              {health !== 'ok' ? <Badge tone={health === 'out' ? 'red' : 'amber'}>{health === 'out' ? 'Out' : 'Low'}</Badge> : null}
            </div>
            <div className="mt-1 w-24"><Bar value={item.stock} max={Math.max(item.reorderLevel * 3, item.stock)} tone={health === 'ok' ? 'green' : health === 'low' ? 'gold' : 'red'} /></div>
          </div>
        );
      }
    },
    { key: 'reorder', header: 'Reorder', align: 'center', render: item => <span className="text-[11px] text-slate-400">{item.reorderLevel} {item.unit}</span> },
    { key: 'cost', header: 'Unit cost', align: 'right', render: item => <span className="text-[11.5px] text-slate-300">{money(item.cost)}</span> },
    { key: 'value', header: 'Stock value', align: 'right', render: item => <span className="font-medium text-white">{money(item.stock * item.cost)}</span> },
    { key: 'supplier', header: 'Supplier', render: item => <span className="text-[11px] text-slate-400">{item.supplier || '—'}</span> },
    { key: 'expiry', header: 'Expiry', render: item => <span className={`text-[10.5px] ${item.expiry && item.expiry < new Date().toISOString().slice(0, 10) ? 'text-rose-300' : 'text-slate-500'}`}>{item.expiry ? shortDate(item.expiry) : '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: item => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => { setAdjustFor(item); setAdjustType('purchase'); setAdjustQty(''); setAdjustNote(''); }}>
            <PackagePlus size={12} /> Stock
          </Button>
          <IconButton title="Edit" onClick={() => openEdit(item)}>
            <Boxes size={13} />
          </IconButton>
          <IconButton
            title="Remove ingredient"
            tone="danger"
            onClick={() => {
              if (data.products.some(product => product.recipe.some(usage => usage.ingredientId === item.id))) {
                notify('This ingredient is used in a recipe — remove it from the recipe first.');
                return;
              }
              commit({ inventory: data.inventory.filter(entry => entry.id !== item.id) }, { title: 'Ingredient removed', detail: item.name });
              notify(`${item.name} removed.`);
            }}
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Stores"
        title="Inventory"
        subtitle={`${data.inventory.length} ingredients · ${lowCount} at or below reorder level · ${money(stockValue)} on-hand value.`}
        actions={
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setFormOpen(true); }}>
            <Plus size={14} /> Add ingredient
          </Button>
        }
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${panel} flex items-center gap-2.5 px-3.5 py-3`}>
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#e7b943]/20 bg-[#e7b943]/10 text-[#e7b943]"><Boxes size={14} /></div>
          <div><div className="font-serif text-[18px] text-white">{data.inventory.length}</div><div className="text-[10px] text-slate-500">Tracked ingredients</div></div>
        </div>
        <div className={`${panel} flex items-center gap-2.5 px-3.5 py-3`}>
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300"><TriangleAlert size={14} /></div>
          <div><div className="font-serif text-[18px] text-white">{lowCount}</div><div className="text-[10px] text-slate-500">Low stock alerts</div></div>
        </div>
        <div className={`${panel} flex items-center gap-2.5 px-3.5 py-3`}>
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><ArrowUpCircle size={14} /></div>
          <div><div className="font-serif text-[18px] text-white">{money(stockValue)}</div><div className="text-[10px] text-slate-500">Stock value</div></div>
        </div>
        <div className={`${panel} flex items-center gap-2.5 px-3.5 py-3`}>
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-300"><ArrowDownCircle size={14} /></div>
          <div><div className="font-serif text-[18px] text-white">{data.stockMovements.filter(m => m.movementType === 'waste').length}</div><div className="text-[10px] text-slate-500">Waste entries logged</div></div>
        </div>
      </div>

      <div className={`${panel} p-3`}>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_170px]">
          <SearchInput value={term} onChange={setTerm} placeholder="Search ingredient, supplier or SKU…" />
          <Select value={filter} onChange={setFilter} options={[{ value: 'All', label: 'All stock' }, { value: 'Low', label: 'Low & out of stock' }, { value: 'Out', label: 'Out of stock only' }]} />
        </div>
        <DataTable columns={columns} rows={items} rowKey={item => item.id} empty="No ingredients match this filter." />
      </div>

      <div className={`${panel} mt-3 p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[12.5px] font-semibold text-slate-200">Recent stock movements</h3>
          <span className="text-[10px] text-slate-500">{data.stockMovements.length} entries</span>
        </div>
        <div className="space-y-1.5">
          {data.stockMovements.slice(0, 10).map(movement => (
            <div key={movement.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[.055] bg-white/[.018] px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${movement.quantityDelta >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                  {movement.quantityDelta >= 0 ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] text-slate-200">{movement.ingredientName}</div>
                  <div className="truncate text-[10px] text-slate-500">{movement.note}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={movement.movementType === 'purchase' ? 'green' : movement.movementType === 'waste' ? 'red' : movement.movementType === 'sale' ? 'blue' : 'slate'}>{movement.movementType}</Badge>
                <span className={`text-[11.5px] font-semibold ${movement.quantityDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}
                </span>
              </div>
            </div>
          ))}
          {data.stockMovements.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 py-6 text-center text-[11px] text-slate-600">No movements recorded yet.</div> : null}
        </div>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add ingredient'}
        subtitle="Stock levels drive recipe availability and POS out-of-stock badges."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveItem}>{editing ? 'Save changes' : 'Add ingredient'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Name" className="sm:col-span-2">
            <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Chicken patty" />
          </Labeled>
          <Labeled label="SKU"><input value={form.sku} onChange={event => setForm(current => ({ ...current, sku: event.target.value }))} className={inputCls} placeholder="ING-PTY" /></Labeled>
          <Labeled label="Unit"><input value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))} className={inputCls} placeholder="piece / g / ml" /></Labeled>
          <Labeled label="Stock on hand"><input type="number" min="0" value={form.stock} onChange={event => setForm(current => ({ ...current, stock: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Reorder level"><input type="number" min="0" value={form.reorderLevel} onChange={event => setForm(current => ({ ...current, reorderLevel: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Unit cost (৳)"><input type="number" min="0" step="0.01" value={form.cost} onChange={event => setForm(current => ({ ...current, cost: event.target.value }))} className={inputCls} /></Labeled>
          <Labeled label="Category"><input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} className={inputCls} placeholder="Meat / Bakery / Dairy" /></Labeled>
          <Labeled label="Supplier"><input value={form.supplier} onChange={event => setForm(current => ({ ...current, supplier: event.target.value }))} className={inputCls} placeholder="Prime Poultry" /></Labeled>
          <Labeled label="Expiry date"><input type="date" value={form.expiry} onChange={event => setForm(current => ({ ...current, expiry: event.target.value }))} className={inputCls} /></Labeled>
        </div>
      </Modal>

      <Modal
        open={Boolean(adjustFor)}
        onClose={() => setAdjustFor(null)}
        title="Stock movement"
        subtitle={adjustFor ? `${adjustFor.name} · currently ${adjustFor.stock} ${adjustFor.unit}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setAdjustFor(null)}>Cancel</Button>
            <Button onClick={submitAdjustment}><CircleAlert size={13} /> Record movement</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {(['purchase', 'adjustment', 'waste'] as StockMovement['movementType'][]).map(type => (
              <button
                key={type}
                onClick={() => setAdjustType(type)}
                className={`rounded-lg border px-2 py-2 text-[11px] capitalize transition ${
                  adjustType === type ? 'border-[#e7b943]/40 bg-[#e7b943]/12 text-[#f0cd75]' : 'border-white/[.08] text-slate-400 hover:border-white/20'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <Labeled label={adjustType === 'purchase' ? 'Quantity received' : 'Quantity to deduct'}>
            <input type="number" min="0" value={adjustQty} onChange={event => setAdjustQty(event.target.value)} className={inputCls} placeholder="0" />
          </Labeled>
          <Labeled label="Note">
            <input value={adjustNote} onChange={event => setAdjustNote(event.target.value)} className={inputCls} placeholder={adjustType === 'waste' ? 'Spoiled during prep' : 'Reference or reason'} />
          </Labeled>
          <div className="rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-[10.5px] text-slate-500">
            New stock will be{' '}
            <span className="font-semibold text-slate-200">
              {Math.max(0, (adjustFor?.stock ?? 0) + (adjustType === 'purchase' ? 1 : -1) * (Number(adjustQty) || 0)).toLocaleString('en-US')} {adjustFor?.unit}
            </span>{' '}
            and the movement is logged with a timestamp.
          </div>
        </div>
      </Modal>
    </div>
  );
}
