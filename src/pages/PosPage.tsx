import { useMemo, useState } from 'react';
import {
  BadgePercent,
  Banknote,
  Bike,
  Check,
  CreditCard,
  Minus,
  Pause,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  UtensilsCrossed,
  X
} from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, Divider, IconButton, inputCls, Labeled, Modal, PageHeader, panel, Select, textareaCls } from '../components/ui';
import { computeTotals, deductStock, nextOrderNumber, orderTypeOptions, projectedStock } from '../lib/pos';
import { uid } from '../lib/format';
import type { CartItem, Coupon, Order, OrderType, PaymentMethod, Product } from '../types';

const paymentMethods: { value: PaymentMethod; icon: typeof Banknote }[] = [
  { value: 'Cash', icon: Banknote },
  { value: 'Card', icon: CreditCard },
  { value: 'Digital', icon: Smartphone },
  { value: 'Bank transfer', icon: Banknote }
];

const typeIcons: Record<OrderType, typeof Store> = {
  'Dine-in': UtensilsCrossed,
  Takeaway: ShoppingBag,
  Pickup: Store,
  'Home Delivery': Bike
};

export default function PosPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { data, commit, notify, money } = useStore();
  const { products, categories, customers, tables, coupons, settings, orders } = data;

  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableId, setTableId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [manualDiscount, setManualDiscount] = useState('0');
  const [note, setNote] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [cashReceived, setCashReceived] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('60');
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);
  const [itemNoteFor, setItemNoteFor] = useState<CartItem | null>(null);
  const [itemNote, setItemNote] = useState('');

  const filtered = useMemo(
    () =>
      products
        .filter(product => product.active !== false)
        .filter(product => category === 'All' || product.category === category)
        .filter(product => product.name.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)),
    [products, category, search]
  );

  const held = orders.filter(order => order.number === 'HOLD');
  const activeCoupon = coupons.find(coupon => coupon.code.toUpperCase() === couponCode.toUpperCase()) ?? null;
  const totals = computeTotals(
    cart.map(item => ({ price: item.price, qty: item.qty })),
    settings.taxRate,
    Number(manualDiscount) || 0,
    activeCoupon,
    orderType === 'Home Delivery' ? Number(deliveryFee) || 0 : 0
  );

  // An empty cash field means "exact tender" (the common counter fast-path) — never
  // silently create an uncollectable due with no customer attached.
  const cashTendered = cashReceived.trim() === '';
  const cashValue = cashTendered ? totals.total : Number(cashReceived) || 0;
  const paid = payMethod === 'Cash' ? Math.min(cashValue, totals.total) : totals.total;
  const due = Number(Math.max(0, totals.total - paid).toFixed(2));
  const change = payMethod === 'Cash' ? Math.max(0, cashValue - totals.total) : 0;
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const selectedCustomer = customers.find(customer => customer.id === customerId);
  const availableTables = tables.filter(table => table.status !== 'Occupied' || table.currentOrderId === undefined);

  const addToCart = (product: Product) => {
    setCart(current => {
      const existing = current.find(item => item.productId === product.id);
      if (existing) return current.map(item => (item.productId === product.id ? { ...item, qty: item.qty + 1 } : item));
      return [...current, { id: uid('ci'), productId: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart(current => (qty <= 0 ? current.filter(item => item.id !== id) : current.map(item => (item.id === id ? { ...item, qty } : item))));
  };

  const resetCart = () => {
    setCart([]);
    setCashReceived('');
    setManualDiscount('0');
    setCouponCode('');
    setNote('');
    setCustomerId('');
    setGuestName('');
    setDeliveryAddress('');
    setDeliveryPhone('');
    setTableId('');
  };

  const buildOrder = (status: Order['status'], amountPaid: number, amountDue: number): Order => {
    const number = nextOrderNumber(orders);
    const customer = selectedCustomer;
    return {
      id: `o-${number}`,
      number,
      type: orderType,
      status,
      tableId: orderType === 'Dine-in' ? tableId || undefined : undefined,
      customerId: customer?.id,
      customerName: customer?.name || guestName.trim() || 'Walk-in Guest',
      createdAt: new Date().toISOString(),
      items: cart.map(item => ({
        id: uid('li'),
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.price,
        note: item.note
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      couponCode: totals.couponCode,
      total: totals.total,
      paid: amountPaid,
      due: amountDue,
      paymentMethod: payMethod,
      kitchenNote: note.trim() || undefined,
      deliveryAddress: orderType === 'Home Delivery' ? deliveryAddress.trim() || customer?.address : undefined,
      deliveryPhone: orderType === 'Home Delivery' ? deliveryPhone.trim() || customer?.phone : undefined,
      deliveryStatus: orderType === 'Home Delivery' ? 'Pending' : undefined,
      deliveryFee: orderType === 'Home Delivery' ? Number(deliveryFee) || 0 : 0
    };
  };

  const placeOrder = () => {
    if (cart.length === 0) {
      notify('Add at least one item to the cart first.');
      return;
    }
    if (orderType === 'Dine-in' && !tableId) {
      notify('Pick a table for this dine-in order.');
      return;
    }
    if (payMethod === 'Cash' && !cashTendered && cashValue < totals.total && !customerId) {
      notify('Under-tendered cash needs a saved customer so the balance can be tracked. Select a customer or collect the full amount.');
      return;
    }
    const order = buildOrder('Pending', Number(paid.toFixed(2)), due);
    const stock = deductStock(data.inventory, products, order.items);

    commit(
      {
        orders: [order, ...orders],
        inventory: stock.inventory,
        stockMovements: [...stock.movements, ...data.stockMovements],
        tables:
          orderType === 'Dine-in' && tableId
            ? tables.map(table => (table.id === tableId ? { ...table, status: 'Occupied', currentGuests: Math.max(1, order.items.length), currentOrderId: order.id } : table))
            : tables,
        customers: customerId
          ? customers.map(customer =>
              customer.id === customerId
                ? {
                    ...customer,
                    due: Number((customer.due + due).toFixed(2)),
                    loyaltyPoints: customer.loyaltyPoints + Math.floor(order.total / 100),
                    favoriteItems: Array.from(new Set([...customer.favoriteItems, ...order.items.map(item => item.name)])).slice(0, 6)
                  }
                : customer
            )
          : customers,
        coupons: totals.couponCode
          ? coupons.map(coupon => (coupon.code === totals.couponCode ? { ...coupon, usedCount: coupon.usedCount + 1 } : coupon))
          : coupons,
        payments:
          paid > 0
            ? [
                {
                  id: uid('pmt'),
                  direction: 'in' as const,
                  category: due > 0 ? ('Due Collection' as const) : ('Order Sale' as const),
                  referenceId: order.id,
                  partyName: order.customerName,
                  amount: Number(paid.toFixed(2)),
                  method: payMethod,
                  note: due > 0 ? `Partial payment for #${order.number}` : `Payment for order #${order.number}`,
                  createdAt: new Date().toISOString()
                },
                ...data.payments
              ]
            : data.payments
      },
      {
        title: 'Order placed',
        detail: `#${order.number} · ${order.type} · ${money(order.total)} · ${payMethod}${due > 0 ? ` · ${money(due)} due` : ''}`
      }
    );

    if (stock.shortfalls.length) {
      notify(`Order #${order.number} saved. Stock shortfall: ${stock.shortfalls.slice(0, 2).join(', ')}.`);
    } else {
      notify(`Order #${order.number} placed — ${money(order.total)} billed.`);
    }
    setReceipt(order);
    resetCart();
  };

  const holdOrder = () => {
    if (cart.length === 0) {
      notify('There is nothing in the cart to hold.');
      return;
    }
    const order = buildOrder('Pending', 0, totals.total);
    const heldOrder: Order = { ...order, id: uid('hold'), number: 'HOLD', customerName: selectedCustomer?.name || guestName.trim() || 'Held guest' };
    commit({ orders: [heldOrder, ...orders] }, { title: 'Order held', detail: `${cartCount} items held in the cart for later` });
    notify('Order parked. Resume it from “Held orders”.');
    resetCart();
  };

  const resumeOrder = (order: Order) => {
    setCart(
      order.items.map(item => ({
        id: uid('ci'),
        productId: item.productId,
        name: item.name,
        price: item.unitPrice,
        qty: item.qty,
        note: item.note
      }))
    );
    setOrderType(order.type);
    setNote(order.kitchenNote || '');
    setTableId(order.tableId || '');
    setCustomerId(order.customerId || '');
    commit({ orders: orders.filter(entry => entry.id !== order.id) });
    setHeldOpen(false);
    notify(`Held order restored (${order.items.length} lines).`);
  };

  const printReceipt = () => {
    if (!receipt) return;
    const win = window.open('', '_blank', 'width=380,height=640');
    if (!win) return;
    const rows = receipt.items
      .map(item => `<tr><td>${item.name} × ${item.qty}</td><td style="text-align:right">${money(item.unitPrice * item.qty)}</td></tr>`)
      .join('');
    win.document.write(`<!doctype html><html><head><title>Receipt #${receipt.number}</title>
    <style>body{font-family:ui-monospace,Menlo,monospace;padding:16px;font-size:12px;color:#111}h2{font-size:15px;margin:0 0 2px;text-align:center}
    .muted{color:#555;text-align:center;font-size:10px}.line{border-top:1px dashed #999;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}
    .total{font-weight:700;font-size:13px}</style></head><body>
    <h2>${settings.restaurantName}</h2>
    <div class="muted">${settings.branchName}<br/>${settings.address}<br/>${settings.phone}</div>
    <div class="line"></div>
    <div>Invoice #${receipt.number} · ${receipt.type}</div>
    <div>${new Date(receipt.createdAt).toLocaleString()}</div>
    <div>Guest: ${receipt.customerName}</div>
    <div class="line"></div>
    <table>${rows}
    <tr><td>Subtotal</td><td style="text-align:right">${money(receipt.subtotal)}</td></tr>
    <tr><td>Discount</td><td style="text-align:right">-${money(receipt.discount)}</td></tr>
    <tr><td>VAT (${settings.taxRate}%)</td><td style="text-align:right">${money(receipt.tax)}</td></tr>
    ${receipt.deliveryFee ? `<tr><td>Delivery</td><td style="text-align:right">${money(receipt.deliveryFee)}</td></tr>` : ''}
    <tr class="total"><td>Total</td><td style="text-align:right">${money(receipt.total)}</td></tr>
    <tr><td>Paid (${receipt.paymentMethod})</td><td style="text-align:right">${money(receipt.paid)}</td></tr>
    ${receipt.due > 0 ? `<tr><td>Due</td><td style="text-align:right">${money(receipt.due)}</td></tr>` : ''}
    </table>
    <div class="line"></div>
    <div class="muted">${settings.receiptFooter}</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Counter"
        title="POS & billing"
        subtitle="Build the ticket, attach the guest or table, then take payment. Stock and ledgers update instantly."
        actions={
          <>
            <button
              onClick={() => setHeldOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-[12px] text-slate-300 hover:bg-white/[.04]"
            >
              <Pause size={13} /> Held ({held.length})
            </button>
            <Button variant="outline" onClick={resetCart} disabled={cart.length === 0}>
              <Trash2 size={13} /> Clear
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_378px]">
        <div className={`${panel} p-3 md:p-4`}>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the menu…" className={`${inputCls} pl-8`} />
            </div>
            <div className="text-[10.5px] text-slate-500">{filtered.length} items available</div>
          </div>

          <div className="custom-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {['All', ...categories].map(name => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                  category === name
                    ? 'border-[#e7b943]/40 bg-[#e7b943]/15 text-[#f2d490]'
                    : 'border-white/[.08] bg-white/[.02] text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map(product => {
              const stockLimit = projectedStock(products, data.inventory, product.id);
              const inCart = cart.find(item => item.productId === product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={stockLimit !== null && stockLimit <= 0}
                  className="group relative overflow-hidden rounded-xl border border-white/[.07] bg-[#101418] text-left transition hover:border-[#e7b943]/35 hover:shadow-[0_12px_30px_-18px_rgba(231,185,67,.5)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <div className="relative h-[92px] overflow-hidden bg-white/[.03]">
                    <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1013] via-transparent to-transparent" />
                    {product.popularity >= 90 ? (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-[#e7b943] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-[#241a06]">
                        Popular
                      </span>
                    ) : null}
                    {stockLimit !== null ? (
                      <span
                        className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold ${
                          stockLimit <= 0 ? 'bg-rose-500/90 text-white' : stockLimit <= 5 ? 'bg-amber-400/90 text-[#241a06]' : 'bg-black/60 text-slate-200'
                        }`}
                      >
                        {stockLimit <= 0 ? 'Out of stock' : `${stockLimit} left`}
                      </span>
                    ) : null}
                    {inCart ? (
                      <span className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#e7b943] text-[10px] font-bold text-[#241a06]">
                        {inCart.qty}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-2.5">
                    <div className="line-clamp-2 min-h-[30px] text-[11.5px] font-medium leading-4 text-slate-200">{product.name}</div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[12px] font-semibold text-[#f0cd75]">{money(product.price)}</span>
                      <span className="text-[9px] text-slate-600">{product.category}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-[12px] text-slate-500">
                No menu items match this filter.
              </div>
            ) : null}
          </div>
        </div>

        <div className={`${panel} flex h-fit flex-col p-3.5 xl:sticky xl:top-[80px]`}>
          <div className="grid grid-cols-2 gap-1.5">
            {orderTypeOptions.map(type => {
              const Icon = typeIcons[type];
              return (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition ${
                    orderType === type
                      ? 'border-[#e7b943]/45 bg-[#e7b943]/12 text-[#f2d490]'
                      : 'border-white/[.07] text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <Icon size={12} /> {type}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Labeled label="Customer">
              <Select
                value={customerId}
                onChange={value => {
                  setCustomerId(value);
                  if (value) setGuestName('');
                }}
                options={[{ value: '', label: 'Walk-in guest' }, ...customers.map(customer => ({ value: customer.id, label: customer.name }))]}
              />
            </Labeled>
            {orderType === 'Dine-in' ? (
              <Labeled label="Table">
                <Select
                  value={tableId}
                  onChange={setTableId}
                  options={[{ value: '', label: 'Select table' }, ...availableTables.map(table => ({ value: table.id, label: `${table.number} · ${table.capacity}p` }))]}
                />
              </Labeled>
            ) : (
              <Labeled label="Guest name">
                <input value={guestName} onChange={event => setGuestName(event.target.value)} placeholder="Optional" className={inputCls} />
              </Labeled>
            )}
          </div>

          {orderType === 'Home Delivery' ? (
            <div className="mt-2 space-y-2 rounded-xl border border-sky-400/15 bg-sky-400/[.05] p-2.5">
              <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-sky-300">Delivery details</div>
              <input value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} placeholder={selectedCustomer?.address || 'Delivery address'} className={inputCls} />
              <div className="grid grid-cols-2 gap-2">
                <input value={deliveryPhone} onChange={event => setDeliveryPhone(event.target.value)} placeholder={selectedCustomer?.phone || 'Phone'} className={inputCls} />
                <input value={deliveryFee} onChange={event => setDeliveryFee(event.target.value)} type="number" min="0" placeholder="Fee" className={inputCls} />
              </div>
            </div>
          ) : null}

          <Divider label={`Cart · ${cartCount} item${cartCount === 1 ? '' : 's'}`} />

          <div className="custom-scrollbar max-h-[248px] space-y-1.5 overflow-y-auto pr-0.5">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-7 text-center">
                <ShoppingBag size={20} className="mx-auto text-slate-600" />
                <div className="mt-2 text-[11.5px] text-slate-500">Tap a menu item to start the bill.</div>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="rounded-lg border border-white/[.06] bg-white/[.022] p-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-medium text-slate-200">{item.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {money(item.price)} × {item.qty} = <span className="text-slate-300">{money(item.price * item.qty)}</span>
                      </div>
                      {item.note ? <div className="mt-0.5 truncate text-[9.5px] italic text-[#e7b943]/80">“{item.note}”</div> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => setQty(item.id, item.qty - 1)} className="qty-btn" aria-label="Decrease quantity">
                        <Minus size={11} />
                      </button>
                      <span className="w-5 text-center text-[11px] font-semibold text-white">{item.qty}</span>
                      <button type="button" onClick={() => setQty(item.id, item.qty + 1)} className="qty-btn" aria-label="Increase quantity">
                        <Plus size={11} />
                      </button>
                      <IconButton
                        title="Item note"
                        tone="gold"
                        onClick={() => {
                          setItemNoteFor(item);
                          setItemNote(item.note || '');
                        }}
                      >
                        <Sparkles size={11} />
                      </IconButton>
                      <IconButton title="Remove" tone="danger" onClick={() => setQty(item.id, 0)}>
                        <X size={12} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Labeled label="Coupon">
              <div className="relative">
                <input value={couponCode} onChange={event => setCouponCode(event.target.value.toUpperCase())} placeholder="e.g. MUSAFIR10" className={`${inputCls} pr-7`} />
                {couponCode ? (
                  <button type="button" onClick={() => setCouponCode('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label="Clear coupon">
                    <X size={12} />
                  </button>
                ) : (
                  <BadgePercent size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                )}
              </div>
            </Labeled>
            <Labeled label="Manual discount %">
              <input value={manualDiscount} onChange={event => setManualDiscount(event.target.value)} type="number" min="0" max="100" className={inputCls} />
            </Labeled>
          </div>
          {totals.couponError ? <div className="mt-1 text-[10px] text-rose-300">{totals.couponError}</div> : null}
          {totals.couponLabel ? <div className="mt-1 text-[10px] text-emerald-300">{totals.couponLabel} applied</div> : null}

          <div className="mt-2">
            <Labeled label="Kitchen note">
              <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="No onions, extra spicy, pack sauces separately…" className={textareaCls} />
            </Labeled>
          </div>

          <div className="mt-2.5 rounded-xl border border-white/[.07] bg-black/25 p-2.5">
            <div className="space-y-1 text-[11.5px]">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="text-slate-200">{money(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 ? (
                <div className="flex justify-between text-emerald-300">
                  <span>Discount</span>
                  <span>−{money(totals.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-400">
                <span>VAT ({settings.taxRate}%)</span>
                <span className="text-slate-200">{money(totals.tax)}</span>
              </div>
              {orderType === 'Home Delivery' && Number(deliveryFee) > 0 ? (
                <div className="flex justify-between text-slate-400">
                  <span>Delivery fee</span>
                  <span className="text-slate-200">{money(Number(deliveryFee))}</span>
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between border-t border-white/[.07] pt-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</span>
                <span className="font-serif text-[19px] text-[#f0cd75]">{money(totals.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1">
            {paymentMethods.map(method => {
              const Icon = method.icon;
              return (
                <button
                  key={method.value}
                  onClick={() => setPayMethod(method.value)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[9.5px] transition ${
                    payMethod === method.value
                      ? 'border-[#e7b943]/45 bg-[#e7b943]/12 text-[#f2d490]'
                      : 'border-white/[.07] text-slate-500 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  <Icon size={13} />
                  {method.value}
                </button>
              );
            })}
          </div>

          {payMethod === 'Cash' ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Labeled label="Cash received">
                <input
                  value={cashReceived}
                  onChange={event => setCashReceived(event.target.value)}
                  type="number"
                  min="0"
                  placeholder={`Exact ${Math.round(totals.total)}`}
                  className={inputCls}
                />
              </Labeled>
              <div className="flex flex-col justify-end">
                <div className="rounded-xl border border-white/[.07] bg-white/[.02] px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">{due > 0 ? 'Balance due' : 'Change'}</div>
                  <div className={`text-[13px] font-semibold ${due > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(due > 0 ? due : change)}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex gap-1.5">
            <Button variant="outline" className="flex-1" onClick={holdOrder} disabled={cart.length === 0}>
              <Pause size={13} /> Hold
            </Button>
            <Button className="flex-[1.6]" onClick={placeOrder} disabled={cart.length === 0}>
              <Check size={14} /> Charge {money(totals.total)}
            </Button>
          </div>
          <div className="mt-1.5 text-center text-[9.5px] text-slate-600">
            {cart.length > 0 ? `${cartCount} items · ${orderType}${selectedCustomer ? ` · ${selectedCustomer.name}` : ''}` : 'Nothing in the cart yet'}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title={receipt ? `Order #${receipt.number} created` : 'Order'}
        subtitle={receipt ? `${receipt.type} · ${receipt.status} · ${receipt.paymentMethod}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setReceipt(null)}>
              Keep selling
            </Button>
            <Button variant="outline" onClick={() => { setReceipt(null); onNavigate('kitchen'); }}>
              <ChefHatIcon /> Send to kitchen
            </Button>
            <Button onClick={printReceipt}>
              <Printer size={13} /> Print receipt
            </Button>
          </>
        }
      >
        {receipt ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-200">
                <Check size={14} /> Payment recorded and stock deducted
              </div>
              <div className="mt-0.5 text-[10.5px] text-emerald-200/60">
                {money(receipt.paid)} collected{receipt.due > 0 ? ` · ${money(receipt.due)} added to customer due` : ''}
              </div>
            </div>
            <div className="divide-y divide-white/[.06] rounded-xl border border-white/[.07]">
              {receipt.items.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[11.5px]">
                  <span className="text-slate-300">
                    {item.name} <span className="text-slate-500">× {item.qty}</span>
                  </span>
                  <span className="text-slate-200">{money(item.unitPrice * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-[11.5px]">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>{money(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Discount</span>
                <span>−{money(receipt.discount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VAT</span>
                <span>{money(receipt.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-white/[.07] pt-1.5 text-[13px] font-semibold text-white">
                <span>Total</span>
                <span>{money(receipt.total)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title="Held orders" subtitle="Park a ticket here and resume it whenever the guest is ready." wide>
        {held.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-9 text-center text-[12px] text-slate-500">
            No held tickets. Use “Hold” on the POS screen to park an order.
          </div>
        ) : (
          <div className="space-y-2">
            {held.map(order => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] font-medium text-slate-200">{order.customerName}</span>
                    <Badge tone="amber">{order.type}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-slate-500">
                    {order.items.map(item => `${item.name} ×${item.qty}`).join(' · ')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#f0cd75]">{money(order.total)}</span>
                  <Button size="sm" onClick={() => resumeOrder(order)}>
                    Resume
                  </Button>
                  <IconButton title="Discard held order" tone="danger" onClick={() => commit({ orders: orders.filter(entry => entry.id !== order.id) })}>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(itemNoteFor)}
        onClose={() => setItemNoteFor(null)}
        title="Item note"
        subtitle={itemNoteFor?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setItemNoteFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!itemNoteFor) return;
                setCart(current => current.map(item => (item.id === itemNoteFor.id ? { ...item, note: itemNote.trim() || undefined } : item)));
                setItemNoteFor(null);
              }}
            >
              Save note
            </Button>
          </>
        }
      >
        <textarea value={itemNote} onChange={event => setItemNote(event.target.value)} className={textareaCls} placeholder="Extra cheese, no sauce, well done…" />
      </Modal>
    </div>
  );
}

function ChefHatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 14a4 4 0 1 1 1.2-7.8 4 4 0 0 1 7.6 0A4 4 0 1 1 18 14v5H6z" />
    </svg>
  );
}
