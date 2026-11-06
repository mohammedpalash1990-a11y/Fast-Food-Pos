import { useState } from 'react';
import { ArrowDown, ArrowUp, Grid2X2, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Button, IconButton, inputCls, Labeled, Modal, PageHeader, panel } from '../components/ui';

export default function CategoriesPage() {
  const { data, commit, notify, money } = useStore();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ from: string; to: string } | null>(null);

  const stats = data.categories.map(category => {
    const items = data.products.filter(product => product.category === category);
    return {
      category,
      items: items.length,
      live: items.filter(product => product.active !== false).length,
      value: items.reduce((sum, product) => sum + product.price, 0)
    };
  });

  const addCategory = () => {
    const value = name.trim();
    if (!value) {
      notify('Category name cannot be empty.');
      return;
    }
    if (data.categories.some(category => category.toLowerCase() === value.toLowerCase())) {
      notify('That category already exists.');
      return;
    }
    commit({ categories: [...data.categories, value] }, { title: 'Category added', detail: value });
    notify(`“${value}” added to the menu structure.`);
    setName('');
    setOpen(false);
  };

  const rename = () => {
    if (!renameTarget || !renameTarget.to.trim()) return;
    const next = renameTarget.to.trim();
    commit(
      {
        categories: data.categories.map(category => (category === renameTarget.from ? next : category)),
        products: data.products.map(product => (product.category === renameTarget.from ? { ...product, category: next } : product))
      },
      { title: 'Category renamed', detail: `${renameTarget.from} → ${next}` }
    );
    notify(`Renamed to “${next}”.`);
    setRenameTarget(null);
  };

  const removeCategory = (category: string) => {
    if (data.products.some(product => product.category === category)) {
      notify('Move or delete the items in this category first.');
      return;
    }
    if (data.categories.length <= 1) {
      notify('At least one category must remain.');
      return;
    }
    commit({ categories: data.categories.filter(entry => entry !== category) }, { title: 'Category removed', detail: category });
    notify(`“${category}” removed.`);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...data.categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    commit({ categories: next }, { title: 'Category order changed', detail: `${next.join(' → ')}` });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Menu structure"
        title="Categories"
        subtitle="Order the sections guests see on the POS grid and the public QR menu."
        actions={
          <>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus size={13} /> Add
            </Button>
            <Button onClick={() => { setName(''); setOpen(true); }}>New category</Button>
          </>
        }
      />

      <div className={`${panel} p-3`}>
        <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-2 px-1 text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500 sm:grid-cols-[auto_1fr_90px_90px_100px]">
          <span className="hidden sm:block">Order</span>
          <span>Category</span>
          <span className="hidden text-center sm:block">Items</span>
          <span className="hidden text-center sm:block">Live</span>
          <span className="hidden text-right sm:block">Menu value</span>
        </div>
        <div className="space-y-1.5">
          {stats.map((row, index) => (
            <div
              key={row.category}
              className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.02] px-2.5 py-2 sm:grid-cols-[auto_1fr_90px_90px_100px]"
            >
              <div className="hidden items-center gap-1 sm:flex">
                <IconButton title="Move up" onClick={() => move(index, -1)}>
                  <ArrowUp size={13} />
                </IconButton>
                <IconButton title="Move down" onClick={() => move(index, 1)}>
                  <ArrowDown size={13} />
                </IconButton>
              </div>
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#e7b943]/10 text-[#e7b943]"><Grid2X2 size={12} /></div>
                <button onClick={() => setRenameTarget({ from: row.category, to: row.category })} className="text-left text-[12px] font-medium text-slate-100 hover:text-[#f0cd75]">
                  {row.category}
                </button>
              </div>
              <div className="hidden text-center text-[11.5px] text-slate-300 sm:block">{row.items}</div>
              <div className="hidden text-center text-[11.5px] text-emerald-300 sm:block">{row.live}</div>
              <div className="hidden text-right text-[11.5px] text-slate-300 sm:block">{money(row.value)}</div>
              <div className="flex justify-end gap-1 sm:hidden">
                <IconButton title="Move up" onClick={() => move(index, -1)}>
                  <ArrowUp size={12} />
                </IconButton>
                <IconButton title="Delete" tone="danger" onClick={() => removeCategory(row.category)}>
                  <Trash2 size={12} />
                </IconButton>
              </div>
              <div className="hidden justify-end gap-1 sm:col-start-5 sm:flex sm:items-center">
                <button onClick={() => removeCategory(row.category)} className="text-[9.5px] text-rose-400/70 hover:text-rose-300">
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Categories', value: data.categories.length },
          { label: 'Menu items', value: data.products.length },
          { label: 'Average price', value: money(data.products.reduce((sum, p) => sum + p.price, 0) / Math.max(1, data.products.length)) }
        ].map(item => (
          <div key={item.label} className={`${panel} px-4 py-3`}>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-serif text-[19px] text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New category"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={addCategory}>Add category</Button>
          </>
        }
      >
        <Labeled label="Category name">
          <input value={name} onChange={event => setName(event.target.value)} className={inputCls} placeholder="e.g. Wraps" autoFocus />
        </Labeled>
      </Modal>

      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename category"
        subtitle={renameTarget ? `Menu items in “${renameTarget.from}” move with the category.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={rename}>Save name</Button>
          </>
        }
      >
        <Labeled label="New name">
          <input value={renameTarget?.to ?? ''} onChange={event => setRenameTarget(current => (current ? { ...current, to: event.target.value } : current))} className={inputCls} />
        </Labeled>
      </Modal>
    </div>
  );
}
