import { useEffect, useMemo, useState } from 'react';
import { categories, demoAuditLogs, demoCustomers, demoEmployees, demoInventory, demoOrders, demoProducts, demoSuppliers } from './data/demoData';
import { type CartItem, type Customer, type Employee, type InventoryItem, type Order, type OrderStatus, type PaymentMethod, type Product, type Supplier } from './types';

const currency = (value: number) => `৳${value.toLocaleString()}`;

const storage = {
  read<T>(key: string, fallback: T): T {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    try {
      return JSON.parse(item) as T;
    } catch {
      return fallback;
    }
  },
  write<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const nextOrderNumber = () => {
  const current = storage.read<number>('musafir-last-order', 1000);
  const next = current + 1;
  storage.write('musafir-last-order', next);
  return String(next);
};

const getInventoryAvailability = (product: Product, inventory: InventoryItem[]) => {
  const required = product.recipe;
  return required.every((item) => {
    const stockItem = inventory.find((x) => x.name.toLowerCase() === item.name.toLowerCase());
    if (!stockItem) return false;
    return stockItem.stock >= item.qty;
  });
};

const cycleStatus = (status: OrderStatus): OrderStatus => {
  const steps: OrderStatus[] = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Completed'];
  const index = steps.indexOf(status);
  return steps[(index + 1) % steps.length];
};

function App() {
  const [selectedView, setSelectedView] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>(() => storage.read('musafir-products', demoProducts));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => storage.read('musafir-inventory', demoInventory));
  const [customers, setCustomers] = useState<Customer[]>(() => storage.read('musafir-customers', demoCustomers));
  const [orders, setOrders] = useState<Order[]>(() => storage.read('musafir-orders', demoOrders));
  const [employees, setEmployees] = useState<Employee[]>(() => storage.read('musafir-employees', demoEmployees));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => storage.read('musafir-suppliers', demoSuppliers));
  const [auditLogs, setAuditLogs] = useState(() => storage.read('musafir-audit', demoAuditLogs));
  const [searchTerm, setSearchTerm] = useState('');
  const [currentCategory, setCurrentCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>(() => storage.read('musafir-cart', []));
  const [orderType, setOrderType] = useState<Order['type']>('Dine-in');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [specialNote, setSpecialNote] = useState('');

  useEffect(() => {
    storage.write('musafir-products', products);
  }, [products]);

  useEffect(() => {
    storage.write('musafir-inventory', inventory);
  }, [inventory]);

  useEffect(() => {
    storage.write('musafir-inventory', inventory);
  }, [inventory]);

  useEffect(() => {
    storage.write('musafir-orders', orders);
  }, [orders]);

  useEffect(() => {
    storage.write('musafir-cart', cart);
  }, [cart]);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = currentCategory === 'All' || product.category === currentCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, currentCategory, searchTerm]);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const taxValue = cartSubtotal * 0.05;
  const discountValue = (cartSubtotal + taxValue) * (discountPercent / 100);
  const total = cartSubtotal + taxValue - discountValue;
  const paidAmount = paymentMethod === 'Cash' ? Math.min(cashTendered, total) : total;
  const dueAmount = Math.max(total - paidAmount, 0);

  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const todaySales = orders.reduce((sum, order) => {
      const today = new Date().toDateString();
      return new Date(order.createdAt).toDateString() === today ? sum + order.total : sum;
    }, 0);
    const customerCount = customers.length;
    const expenseTotal = employees.reduce((sum, employee) => sum + employee.salary, 0) / 12;
    const profit = revenue * 0.32;
    return { revenue, todaySales, customerCount, expenseTotal, profit };
  }, [orders, customers, employees]);

  const addItemToCart = (product: Product) => {
    const inventoryForRecipe = product.recipe.every((ingredient) => {
      const stockItem = inventory.find((item) => item.name.toLowerCase() === ingredient.name.toLowerCase());
      return !!stockItem && stockItem.stock >= ingredient.qty;
    });

    if (!inventoryForRecipe) {
      alert('Not enough stock to fulfill this menu item. Please restock from inventory.');
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...current, { productId: product.id, id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.productId === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setCashTendered(0);
    setPaymentMethod('Cash');
    setSpecialNote('');
  };

  const placeOrder = () => {
    if (!cart.length) return;

    const orderTotal = total;
    const paid = paymentMethod === 'Cash' ? Math.min(cashTendered || orderTotal, orderTotal) : orderTotal;
    const due = Math.max(orderTotal - paid, 0);

    const newOrder: Order = {
      id: `o-${nextOrderNumber()}`,
      number: String(nextOrderNumber()),
      type: orderType,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      customerName: customers[0]?.name ?? 'Walk-in Guest',
      items: cart.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.price,
        note: specialNote || undefined
      })),
      subtotal: cartSubtotal,
      tax: taxValue,
      discount: discountValue,
      total: orderTotal,
      paid,
      due,
      paymentMethod,
      kitchenNote: specialNote || undefined
    };

    setOrders((current) => [newOrder, ...current]);

    setInventory((current) =>
      current.map((stockItem) => {
        const matchedProduct = cart
          .map((item) => products.find((product) => product.id === item.productId))
          .filter(Boolean) as Product[];

        let quantityDeduction = 0;
        for (const product of matchedProduct) {
          const cartItem = cart.find((entry) => entry.productId === product.id);
          if (!cartItem) continue;
          for (const ingredient of product.recipe) {
            if (stockItem.name.toLowerCase() === ingredient.name.toLowerCase()) {
              quantityDeduction += ingredient.qty * cartItem.qty;
            }
          }
        }

        if (stockItem.name.toLowerCase() === 'burger bun'.toLowerCase()) {
          // this branch is intentionally left as part of the recipe deduction flow
        }

        return stockItem.name.toLowerCase() === 'burger bun'.toLowerCase() || quantityDeduction > 0
          ? {
              ...stockItem,
              stock: Math.max(0, stockItem.stock - quantityDeduction)
            }
          : stockItem;
      })
    );

    clearCart();
    setSelectedView('orders');
    setAuditLogs((current) => [
      {
        id: `log-${Date.now()}`,
        title: 'New order placed',
        detail: `${newOrder.number} created for ${newOrder.customerName}.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...current
    ]);
  };

  const holdOrder = () => {
    if (!cart.length) return;
    const held = {
      id: `hold-${Date.now()}`,
      number: 'HOLD',
      type: orderType,
      status: 'Pending' as OrderStatus,
      createdAt: new Date().toISOString(),
      customerName: 'Held Order',
      items: cart.map((item) => ({ id: item.id, productId: item.productId, name: item.name, qty: item.qty, unitPrice: item.price })),
      subtotal: cartSubtotal,
      tax: taxValue,
      discount: discountValue,
      total,
      paid: 0,
      due: total,
      paymentMethod,
      kitchenNote: specialNote || undefined
    };

    setOrders((current) => [held, ...current]);
    clearCart();
    setSelectedView('orders');
  };

  const advanceOrderStatus = (orderId: string) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: cycleStatus(order.status) } : order
      )
    );
  };

  const lowStockItems = inventory.filter((item) => item.stock <= item.reorderLevel);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-brand-200">Control center</p>
          <h2 className="text-3xl font-bold text-white">Dashboard Overview</h2>
        </div>
        <div className="flex gap-2 text-xs text-slate-300">
          <button className="rounded-full border border-brand-300/40 bg-brand-500/10 px-3 py-2 text-brand-100">Today</button>
          <button className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">This week</button>
          <button className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">This month</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Today Sales', value: currency(stats.todaySales), change: '+12.5%' },
          { label: 'Total Orders', value: String(orders.length), change: '+8.3%' },
          { label: 'Total Customers', value: String(stats.customerCount), change: '+10.1%' },
          { label: 'Gross Profit', value: currency(stats.profit), change: '+14.2%' }
        ].map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-soft">
            <div className="flex items-center justify-between text-slate-300">
              <span>{card.label}</span>
              <span className="rounded-full bg-brand-500/10 px-2 py-1 text-xs text-brand-100">{card.change}</span>
            </div>
            <div className="mt-4 text-3xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Sales Overview</h3>
            <span className="text-sm text-slate-400">Last 7 days</span>
          </div>
          <div className="grid h-56 grid-cols-7 items-end gap-3">
            {[52, 68, 44, 92, 76, 108, 130].map((height, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3">
                <div className="w-full rounded-t-2xl bg-gradient-to-t from-brand-500 to-brand-300" style={{ height: `${height}px` }} />
                <span className="text-xs text-slate-400">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][idx]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Top Selling</h3>
            <span className="text-sm text-brand-200">This week</span>
          </div>
          <div className="space-y-4">
            {['Chicken Burger','French Fries','Cold Coffee','Pizza Slice'].map((item, idx) => (
              <div key={item} className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-lg text-brand-200">{idx + 1}</div>
                  <div>
                    <div className="font-medium text-white">{item}</div>
                    <div className="text-xs text-slate-400">{Math.max(40, 120 - idx * 14)} sold</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-brand-100">{currency(180 + idx * 20)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Recent Orders</h3>
            <button className="rounded-full border border-brand-300/40 bg-brand-500/10 px-3 py-1.5 text-xs text-brand-100">View all</button>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
                <div>
                  <div className="font-medium text-white">#{order.number}</div>
                  <div className="text-xs text-slate-400">{order.customerName} • {order.type}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-brand-100">{currency(order.total)}</div>
                  <div className="text-xs text-slate-400">{order.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Low Stock Alerts</h3>
            <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-300">{lowStockItems.length} items</span>
          </div>
          <div className="space-y-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
                <div>
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-xs text-slate-400">Reorder: {item.reorderLevel}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-300">{item.stock} left</div>
                  <div className="text-xs text-slate-400">{item.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPos = () => (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-bold text-white">POS / Billing</h2>
          <div className="flex gap-2">
            {['Dine-in','Takeaway','Pickup','Home Delivery'].map((choice) => (
              <button
                key={choice}
                className={`rounded-full px-3 py-2 text-xs font-medium ${orderType === choice ? 'bg-brand-500 text-slate-900' : 'border border-slate-700 bg-slate-800 text-slate-300'}`}
                onClick={() => setOrderType(choice as Order['type'])}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search menu items..."
            className="flex-1 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-400"
          />
          <select
            value={currentCategory}
            onChange={(event) => setCurrentCategory(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-200"
          >
            <option value="All">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addItemToCart(product)}
              className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-800 text-left shadow-soft transition hover:-translate-y-1 hover:border-brand-400"
            >
              <img src={product.image} alt={product.name} className="h-32 w-full object-cover" />
              <div className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-brand-200">{product.category}</span>
                  <span className="rounded-full bg-brand-500/15 px-2 py-1 text-xs text-brand-100">{product.popularity}%</span>
                </div>
                <div className="mb-2 font-semibold text-white">{product.name}</div>
                <div className="text-lg font-bold text-brand-100">{currency(product.price)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Current Order</h3>
          <button onClick={clearCart} className="text-xs text-red-300">Clear All</button>
        </div>

        <div className="space-y-3">
          {cart.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-slate-400">No items selected</div>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="rounded-2xl border border-slate-700 bg-slate-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="text-xs text-slate-400">{currency(item.price)} each</div>
                  </div>
                  <button onClick={() => updateQty(item.productId, -1)} className="h-8 w-8 rounded-full bg-slate-700 text-lg text-white">−</button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-700 px-2 py-1 text-sm text-white">{item.qty}</span>
                    <button onClick={() => updateQty(item.productId, 1)} className="h-8 w-8 rounded-full bg-brand-500 text-lg text-slate-900">+</button>
                  </div>
                  <div className="font-semibold text-brand-100">{currency(item.price * item.qty)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 space-y-3 rounded-2xl bg-slate-800 p-4">
          <div className="flex items-center justify-between text-sm text-slate-300"><span>Subtotal</span><span>{currency(cartSubtotal)}</span></div>
          <div className="flex items-center justify-between text-sm text-slate-300"><span>Tax (5%)</span><span>{currency(taxValue)}</span></div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Discount</span>
            <input value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} className="w-20 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-right text-white" type="number" min={0} max={100} />
          </div>
          <div className="flex items-center justify-between pt-2 text-lg font-bold text-white"><span>Total</span><span>{currency(total)}</span></div>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block text-sm text-slate-300">Special instructions</label>
          <textarea value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} rows={2} className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          <div className="grid grid-cols-3 gap-2">
            {(['Cash','Card','Digital'] as PaymentMethod[]).map((method) => (
              <button key={method} onClick={() => setPaymentMethod(method)} className={`rounded-xl border px-3 py-2 text-sm ${paymentMethod===method ? 'border-brand-400 bg-brand-500/10 text-brand-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
                {method}
              </button>
            ))}
          </div>
          {paymentMethod === 'Cash' && (
            <input
              type="number"
              value={cashTendered}
              onChange={(event) => setCashTendered(Number(event.target.value))}
              placeholder="Cash tendered"
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
            />
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={holdOrder} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-100">Hold Order</button>
          <button onClick={() => window.print()} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-100">Print Bill</button>
          <button onClick={placeOrder} className="col-span-2 rounded-2xl bg-brand-500 px-4 py-3 font-bold text-slate-900">Pay Now • {currency(total)}</button>
        </div>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Orders</h2>
        <div className="text-sm text-slate-400">{orders.length} active orders</div>
      </div>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-white">#{order.number} • {order.customerName}</div>
                <div className="text-xs text-slate-400">{order.type} • {new Date(order.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-brand-500/10 px-2 py-1 text-xs text-brand-100">{order.status}</span>
                <button onClick={() => advanceOrderStatus(order.id)} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-slate-900">Advance Status</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {order.items.map((item) => (
                <div key={item.productId} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-sm text-slate-400">Qty: {item.qty}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm text-slate-300">
              <span>Subtotal: {currency(order.subtotal)}</span>
              <span>Tax: {currency(order.tax)}</span>
              <span>Discount: {currency(order.discount)}</span>
              <span className="font-semibold text-brand-100">Total: {currency(order.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderKitchen = () => (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Kitchen Display</h2>
          <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs text-brand-100">Live Orders</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {['Pending','Accepted','Preparing','Ready','Completed'].map((status) => (
            <div key={status} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">{status}</h3>
                <span className="text-xs text-slate-400">{orders.filter((order) => order.status === status).length}</span>
              </div>
              <div className="space-y-3">
                {orders.filter((order) => order.status === status).map((order) => (
                  <div key={order.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-medium text-white">#{order.number}</div>
                      <div className="text-xs text-brand-100">{order.type}</div>
                    </div>
                    <div className="space-y-1 text-sm text-slate-300">
                      {order.items.map((item) => (
                        <div key={item.productId}>{item.qty}x {item.name}</div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-slate-400">{order.kitchenNote || 'No special note'}</div>
                    {status !== 'Completed' && (
                      <button onClick={() => advanceOrderStatus(order.id)} className="mt-3 w-full rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-slate-900">Update</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Inventory & Ingredients</h2>
          <button className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-slate-900">+ Add Stock</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {inventory.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold text-white">{item.name}</div>
                <span className={`rounded-full px-2 py-1 text-xs ${item.stock <= item.reorderLevel ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                  {item.stock <= item.reorderLevel ? 'Low Stock' : 'In Stock'}
                </span>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between"><span>Stock</span><span>{item.stock} {item.unit}</span></div>
                <div className="flex justify-between"><span>Supplier</span><span>{item.supplier}</span></div>
                <div className="flex justify-between"><span>Expiry</span><span>{item.expiry}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="mb-5 text-2xl font-bold text-white">Recipe Map</h2>
        <div className="space-y-4">
          {products.slice(0, 5).map((product) => (
            <div key={product.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <div className="mb-2 font-medium text-white">{product.name}</div>
              <div className="space-y-2 text-sm text-slate-300">
                {product.recipe.map((ingredient) => (
                  <div key={ingredient.ingredientId} className="flex justify-between"><span>{ingredient.name}</span><span>{ingredient.qty}{ingredient.unit}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Customers</h2>
        <button className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-slate-900">+ New Customer</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => (
          <div key={customer.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold text-white">{customer.name}</div>
              <span className="rounded-full bg-brand-500/10 px-2 py-1 text-xs text-brand-100">{customer.loyaltyPoints} pts</span>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div>Phone: {customer.phone}</div>
              <div>Address: {customer.address}</div>
              <div>Due: {currency(customer.due)}</div>
              <div>Favorites: {customer.favoriteItems.join(', ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAccounting = () => (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="text-2xl font-bold text-white">Finance Overview</h2>
        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <div className="flex justify-between"><span>Daily sales</span><span>{currency(stats.todaySales)}</span></div>
          <div className="flex justify-between"><span>Total purchases</span><span>{currency(228000)}</span></div>
          <div className="flex justify-between"><span>Operating expenses</span><span>{currency(42000)}</span></div>
          <div className="flex justify-between"><span>Gross profit</span><span>{currency(stats.profit)}</span></div>
          <div className="flex justify-between"><span>Net profit</span><span>{currency(stats.profit * 0.72)}</span></div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="text-2xl font-bold text-white">Supplier Due</h2>
        <div className="mt-5 space-y-4 text-sm text-slate-300">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
              <div>
                <div className="font-medium text-white">{supplier.name}</div>
                <div className="text-xs text-slate-400">{supplier.category}</div>
              </div>
              <div className="font-semibold text-brand-100">{currency(supplier.due)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="text-2xl font-bold text-white">Roles & Permissions</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {['Super Admin','Restaurant Owner','Manager','Cashier','Kitchen Staff','Inventory Manager','Accountant','Delivery Staff'].map((role) => (
            <div key={role} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <div className="mb-2 font-semibold text-white">{role}</div>
              <div className="text-sm text-slate-300">{role === 'Super Admin' ? 'Full access' : role === 'Cashier' ? 'POS + orders' : role === 'Kitchen Staff' ? 'KDS view' : 'Operational access'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="text-2xl font-bold text-white">Audit Log</h2>
        <div className="mt-5 space-y-3">
          {auditLogs.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-3">
              <div className="font-medium text-white">{entry.title}</div>
              <div className="mt-1 text-sm text-slate-300">{entry.detail}</div>
              <div className="mt-2 text-xs text-slate-400">{entry.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderQrMenu = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="text-2xl font-bold text-white">QR Menu Ordering</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {products.slice(0, 6).map((product) => (
            <div key={product.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-3">
              <img src={product.image} alt={product.name} className="mb-3 h-28 w-full rounded-xl object-cover" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{product.name}</div>
                  <div className="text-sm text-brand-100">{currency(product.price)}</div>
                </div>
                <button className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-slate-900">Add</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
        <h3 className="text-xl font-semibold text-white">QR for Table 8</h3>
        <div className="mt-5 rounded-3xl bg-white p-6 text-center shadow-soft">
          <div className="mx-auto grid h-52 w-52 place-items-center border-2 border-dashed border-slate-800 text-5xl text-slate-800">QR</div>
        </div>
      </div>
    </div>
  );

  const views: Record<string, React.ReactNode> = {
    dashboard: renderDashboard(),
    pos: renderPos(),
    orders: renderOrders(),
    kitchen: renderKitchen(),
    inventory: renderInventory(),
    customers: renderCustomers(),
    accounting: renderAccounting(),
    settings: renderSettings(),
    qr: renderQrMenu(),
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pos', label: 'POS / Billing' },
    { id: 'orders', label: 'Orders' },
    { id: 'kitchen', label: 'Kitchen Display' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'customers', label: 'Customers' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'qr', label: 'QR Menu' },
    { id: 'settings', label: 'Settings' }
  ];

  return (
    <div className="min-h-screen bg-shell bg-hero text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
        <header className="mb-6 flex flex-col gap-5 rounded-[28px] border border-slate-700 bg-[#121821]/90 p-4 shadow-soft md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-2xl font-black text-slate-900">M</div>
            <div>
              <div className="text-3xl font-black tracking-tight text-white">Musafir</div>
              <div className="text-xs uppercase tracking-[0.35em] text-brand-200">Fast Food</div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-300">
            <span className="font-medium text-white">Good Food • Good Mood</span>
            <span className="text-brand-200">{new Date().toLocaleDateString()}</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-200">
            <div className="rounded-full bg-brand-500/10 px-3 py-2 text-brand-100">Online</div>
            <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">6:00 PM</div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[250px_1fr]">
          <aside className="rounded-[28px] border border-slate-700 bg-[#121821]/90 p-4 shadow-soft">
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-brand-500/10 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-bold text-slate-900">A</div>
              <div>
                <div className="font-semibold text-white">Admin</div>
                <div className="text-xs text-brand-200">Super Admin</div>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedView(item.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${selectedView === item.id ? 'bg-brand-500 text-slate-900' : 'bg-slate-900 text-slate-200 hover:bg-slate-800'}`}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="space-y-6">
            {views[selectedView]}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
