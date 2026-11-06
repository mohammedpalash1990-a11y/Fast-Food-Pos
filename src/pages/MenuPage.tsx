import { useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, DataTable, IconButton, inputCls, Labeled, Modal, PageHeader, panel, SearchInput, Select, type Column } from '../components/ui';
import type { Product } from '../types';

const emptyForm = {
  name: '',
  sku: '',
  category: '',
  price: '0',
  image: '',
  popularity: '80',
  active: true
};

const fallbackImage = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

export default function MenuPage() {
  const { data, commit, notify, money } = useStore();
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);

  const products = useMemo(
    () =>
      data.products.filter(product => {
        if (category !== 'All' && product.category !== category) return false;
        const query = term.trim().toLowerCase();
        return !query || product.name.toLowerCase().includes(query) || (product.sku || '').toLowerCase().includes(query);
      }),
    [data.products, category, term]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: data.categories[0] || 'Burgers', sku: `SKU-${String(data.products.length + 1).padStart(3, '0')}` });
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku || '',
      category: product.category,
      price: String(product.price),
      image: product.image,
      popularity: String(product.popularity),
      active: product.active !== false
    });
    setFormOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      notify('Product name is required.');
      return;
    }
    const price = Math.max(0, Number(form.price) || 0);
    if (editing) {
      commit(
        {
          products: data.products.map(product =>
            product.id === editing.id
              ? {
                  ...product,
                  name: form.name.trim(),
                  sku: form.sku.trim() || product.sku,
                  category: form.category,
                  price,
                  image: form.image.trim() || product.image,
                  popularity: Math.min(100, Math.max(0, Number(form.popularity) || 80)),
                  active: form.active
                }
              : product
          )
        },
        { title: 'Menu item updated', detail: `${form.name} · ${money(price)}` }
      );
      notify(`${form.name} updated.`);
    } else {
      const product: Product = {
        id: `p-${Date.now()}`,
        sku: form.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        name: form.name.trim(),
        category: form.category,
        price,
        image: form.image.trim() || fallbackImage,
        popularity: Math.min(100, Math.max(0, Number(form.popularity) || 80)),
        active: form.active,
        recipe: []
      };
      commit({ products: [product, ...data.products] }, { title: 'Menu item added', detail: `${product.name} · ${product.category} · ${money(price)}` });
      notify(`${product.name} added to the menu.`);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const toggleActive = (product: Product) => {
    commit(
      { products: data.products.map(entry => (entry.id === product.id ? { ...entry, active: entry.active === false } : entry)) },
      { title: 'Menu availability changed', detail: `${product.name} • ${product.active === false ? 'listed' : 'hidden'}` }
    );
    notify(`${product.name} is now ${product.active === false ? 'available' : 'hidden'}.`);
  };

  const remove = (product: Product) => {
    if (data.orders.some(order => order.items.some(item => item.productId === product.id))) {
      notify(`${product.name} appears on past orders — hide it instead of deleting.`);
      return;
    }
    commit({ products: data.products.filter(entry => entry.id !== product.id) }, { title: 'Menu item removed', detail: product.name });
    notify(`${product.name} removed from the menu.`);
  };

  const columns: Column<Product>[] = [
    {
      key: 'item',
      header: 'Item',
      render: product => (
        <div className="flex items-center gap-2.5">
          <img src={product.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-100">{product.name}</div>
            <div className="font-mono text-[9.5px] text-slate-500">{product.sku || product.id}</div>
          </div>
        </div>
      )
    },
    { key: 'category', header: 'Category', render: product => <Badge tone="slate">{product.category}</Badge> },
    { key: 'price', header: 'Price', align: 'right', render: product => <span className="font-semibold text-white">{money(product.price)}</span> },
    {
      key: 'recipe',
      header: 'Recipe',
      align: 'center',
      render: product => <span className="text-[10.5px] text-slate-400">{product.recipe.length} ingredients</span>
    },
    {
      key: 'popularity',
      header: 'Popularity',
      align: 'center',
      render: product => (
        <div className="mx-auto w-16">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[.08]">
            <div className="h-full rounded-full bg-[#e7b943]" style={{ width: `${Math.min(100, product.popularity)}%` }} />
          </div>
          <div className="mt-0.5 text-[9.5px] text-slate-500">{product.popularity}</div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: product => <Badge tone={product.active === false ? 'red' : 'green'}>{product.active === false ? 'Hidden' : 'Live'}</Badge>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: product => (
        <div className="flex items-center justify-end gap-1">
          <IconButton title={product.active === false ? 'Publish' : 'Hide'} onClick={() => toggleActive(product)}>
            {product.active === false ? <Eye size={13} /> : <EyeOff size={13} />}
          </IconButton>
          <IconButton title="Edit" onClick={() => openEdit(product)}>
            <Pencil size={13} />
          </IconButton>
          <IconButton title="Delete" tone="danger" onClick={() => remove(product)}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Menu management"
        subtitle={`${data.products.length} products across ${data.categories.length} categories · ${data.products.filter(p => p.active !== false).length} currently live.`}
        actions={
          <Button onClick={openCreate}>
            <Plus size={14} /> Add menu item
          </Button>
        }
      />

      <div className={`${panel} p-3`}>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
          <SearchInput value={term} onChange={setTerm} placeholder="Search item or SKU…" />
          <Select value={category} onChange={setCategory} options={[{ value: 'All', label: 'All categories' }, ...data.categories.map(value => ({ value, label: value }))]} />
          <div className="flex items-center justify-end gap-2 text-[10.5px] text-slate-500">
            {products.length} shown · avg {money(products.reduce((sum, p) => sum + p.price, 0) / Math.max(1, products.length))}
          </div>
        </div>
        <DataTable columns={columns} rows={products} rowKey={product => product.id} empty="No menu items match these filters." />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add menu item'}
        subtitle="Pricing and availability shown on the POS and QR menu."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save changes' : 'Add to menu'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Name" className="sm:col-span-2">
            <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Chicken Burger" />
          </Labeled>
          <Labeled label="SKU">
            <input value={form.sku} onChange={event => setForm(current => ({ ...current, sku: event.target.value }))} className={inputCls} placeholder="BRG-001" />
          </Labeled>
          <Labeled label="Category">
            <Select value={form.category} onChange={value => setForm(current => ({ ...current, category: value }))} options={data.categories.map(value => ({ value, label: value }))} />
          </Labeled>
          <Labeled label="Price (৳)">
            <input type="number" min="0" value={form.price} onChange={event => setForm(current => ({ ...current, price: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Popularity score" hint="0–100, drives POS ordering and ‘popular’ badges">
            <input type="number" min="0" max="100" value={form.popularity} onChange={event => setForm(current => ({ ...current, popularity: event.target.value }))} className={inputCls} />
          </Labeled>
          <Labeled label="Image URL" className="sm:col-span-2">
            <input value={form.image} onChange={event => setForm(current => ({ ...current, image: event.target.value }))} className={inputCls} placeholder="https://…" />
          </Labeled>
          <label className="flex items-center gap-2 text-[11.5px] text-slate-300 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} className="h-3.5 w-3.5 accent-[#e7b943]" />
            Show this item on the POS and QR menu
          </label>
        </div>
      </Modal>
    </div>
  );
}
