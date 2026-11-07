import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Bike, BookOpen, Boxes, BriefcaseBusiness, CalendarDays, ChefHat, ChevronDown, CircleDollarSign, ClipboardList, Grid2X2, LayoutDashboard, LogOut, Menu, Package, Plus, Printer, Search, Settings, ShoppingBag, ShoppingCart, Sparkles, Table2, Users, Wallet, X } from 'lucide-react';
import { categories, demoAuditLogs, demoCustomers, demoEmployees, demoInventory, demoOrders, demoProducts, demoSuppliers } from './data/demoData';
import { type CartItem, type Customer, type Employee, type InventoryItem, type Order, type OrderStatus, type PaymentMethod, type Product, type Supplier } from './types';

const currency = (amount: number) => `SAR ${amount.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const localDate = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const safeRead = <T,>(key: string, initial: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial; } catch { return initial; }
};
const save = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled or full; app remains usable for this session. */ } };
const readSession = (key: string) => { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } };
const saveSession = (key: string, value: string) => { try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch { /* Session storage may be unavailable; login remains usable until reload. */ } };
const moduleGroups = [
  { title: 'Workspace', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'pos', label: 'POS / Billing', icon: ShoppingCart }, { id: 'orders', label: 'Orders', icon: ClipboardList }, { id: 'kitchen', label: 'Kitchen Display', icon: ChefHat }, { id: 'tables', label: 'Tables Management', icon: Table2 }, { id: 'reservations', label: 'Reservations', icon: CalendarDays }] },
  { title: 'Restaurant', items: [{ id: 'customers', label: 'Customers', icon: Users }, { id: 'menu', label: 'Menu Management', icon: BookOpen }, { id: 'categories', label: 'Categories', icon: Grid2X2 }, { id: 'inventory', label: 'Inventory', icon: Boxes }, { id: 'recipes', label: 'Recipes & Ingredients', icon: Package }, { id: 'suppliers', label: 'Suppliers', icon: BriefcaseBusiness }, { id: 'purchases', label: 'Purchase Management', icon: ShoppingBag }, { id: 'delivery', label: 'Delivery Management', icon: Bike }] },
  { title: 'Finance & team', items: [{ id: 'expenses', label: 'Expenses', icon: Wallet }, { id: 'employees', label: 'Employee Management', icon: Users }, { id: 'attendance', label: 'Attendance', icon: CalendarDays }, { id: 'payroll', label: 'Salary & Payroll', icon: CircleDollarSign }, { id: 'accounting', label: 'Accounting', icon: BarChart3 }, { id: 'reports', label: 'Sales Reports', icon: BarChart3 }, { id: 'profit', label: 'Profit & Loss', icon: Activity },  { id: 'discounts', label: 'Discounts & Coupons', icon: Sparkles }] },
  { title: 'Channels & setup', items: [{ id: 'qr', label: 'QR Menu', icon: Grid2X2 }, { id: 'settings', label: 'Settings', icon: Settings }, { id: 'roles', label: 'User Roles & Permissions', icon: Users }] }
];
const workflow: OrderStatus[] = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Completed'];

type ReservationRecord = { id:string; guestName:string; phone:string; partySize:number; reservedFor:string; status:'Booked'|'Seated'|'Completed'|'Cancelled'|'No-show'; notes:string; createdAt:string };
type TableRecord = { id:string; tableNumber:string; seats:number; status:'Available'|'Occupied'|'Reserved'|'Cleaning'|'Out of Service'; notes:string; createdAt:string; updatedAt:string };
type DeliveryRecord = { id:string; order_id:string; order_number:number|string; order_status:string; total:string|number; order_created_at:string; customer_name:string; customer_phone:string; delivery_address:string; delivery_note:string; status:'Pending'|'Assigned'|'Picked Up'|'Delivered'|'Failed'; assigned_driver_id:string|null; driver_name:string; assigned_at:string|null; picked_up_at:string|null; delivered_at:string|null; updated_at:string };
type DeliveryDriver = { id:string; display_name:string };
type ExpenseRecord = { id: string; date: string; category: string; description: string; amount: number; paymentMethod: PaymentMethod; createdAt: string };
type PurchaseRecord = { id: string; date: string; supplierId: string; supplierName: string; inventoryId: string; itemName: string; quantity: number; unit: string; unitCost: number; total: number; paid: number; paymentStatus: 'Paid' | 'Part-paid' | 'Credit'; paymentMethod?: PaymentMethod; createdAt: string };
type PayrollPayment = { id: string; amount: number; paymentMethod: PaymentMethod; date: string; createdAt: string };
type PayrollRecord = { id: string; employeeId: string; employeeName: string; period: string; baseSalary: number; bonus: number; deduction: number; advanceDeduction: number; netSalary: number; payments: PayrollPayment[]; createdAt: string };

function App() {
  const [view, setView] = useState('dashboard');
  const [reportRange, setReportRange] = useState('This month');
  const [products, setProducts] = useState<Product[]>(() => safeRead('musafir-products', demoProducts));
  const [menuCategories, setMenuCategories] = useState<{id:string;name:string;product_count?:number}[]>(() => safeRead('musafir-menu-categories', categories.map((name,index)=>({id:`local-${index}`,name}))));
  const [inactiveMenuProducts, setInactiveMenuProducts] = useState<Product[]>(() => safeRead('musafir-inactive-products', []));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => safeRead('musafir-inventory', demoInventory));
  const [customers, setCustomers] = useState<Customer[]>(() => safeRead('musafir-customers', demoCustomers));
  const [orders, setOrders] = useState<Order[]>(() => safeRead('musafir-orders', demoOrders));
  const [cart, setCart] = useState<CartItem[]>(() => safeRead('musafir-cart', []));
  const [employees, setEmployees] = useState<Employee[]>(() => safeRead('musafir-employees', demoEmployees));
  const [suppliers, setSuppliers] = useState(() => safeRead('musafir-suppliers', demoSuppliers));
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => safeRead('musafir-expenses', []));
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => safeRead<PurchaseRecord[]>('musafir-purchases', []).map(item => ({ ...item, paid: Number(item.paid ?? (item.paymentStatus === 'Paid' ? item.total : 0)) })));
  const [payroll, setPayroll] = useState<PayrollRecord[]>(() => safeRead('musafir-payroll', []));
  const [logs, setLogs] = useState(() => safeRead('musafir-audit', demoAuditLogs));
  const [reservations, setReservations] = useState<ReservationRecord[]>(() => safeRead('musafir-reservations', []));
  const [restaurantTables, setRestaurantTables] = useState<TableRecord[]>(() => safeRead('musafir-restaurant-tables', []));
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [deliveryDrivers, setDeliveryDrivers] = useState<DeliveryDriver[]>([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<Order['type']>('Dine-in');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [discount, setDiscount] = useState('0');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [light, setLight] = useState(false);
  const [apiBase, setApiBase] = useState(() => safeRead('musafir-api-base', import.meta.env.VITE_API_URL || ''));
  const [apiEmail, setApiEmail] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [apiToken, setApiToken] = useState(() => readSession('musafir-api-token'));
  const [apiBranchId, setApiBranchId] = useState(() => readSession('musafir-api-branch'));
  const [apiRole, setApiRole] = useState(() => readSession('musafir-api-role'));
  const [apiConnected, setApiConnected] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const orderSubmissionLock = useRef(false);
  const orderIdempotencyKey = useRef(readSession('musafir-order-idempotency-key'));
  const orderIdempotencyPayload = useRef(readSession('musafir-order-idempotency-payload'));
  const [apiMessage, setApiMessage] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const backupInputRef = useRef<HTMLInputElement>(null);
  const canManageTeam = !apiConnected || apiRole === 'owner' || apiRole === 'manager';

  useEffect(() => { save('musafir-products', products); }, [products]);
  useEffect(() => { save('musafir-menu-categories', menuCategories); }, [menuCategories]);
  useEffect(() => { save('musafir-inactive-products', inactiveMenuProducts); }, [inactiveMenuProducts]);
  useEffect(() => { save('musafir-inventory', inventory); }, [inventory]);
  useEffect(() => { save('musafir-customers', customers); }, [customers]);
  useEffect(() => { save('musafir-orders', orders); }, [orders]);
  useEffect(() => { save('musafir-cart', cart); }, [cart]);
  useEffect(() => { if (!apiConnected) save('musafir-employees', employees); }, [employees, apiConnected]);
  useEffect(() => { save('musafir-suppliers', suppliers); }, [suppliers]);
  useEffect(() => { save('musafir-expenses', expenses); }, [expenses]);
  useEffect(() => { save('musafir-purchases', purchases); }, [purchases]);
  useEffect(() => { if (!apiConnected) save('musafir-payroll', payroll); }, [payroll, apiConnected]);
  useEffect(() => { save('musafir-audit', logs); }, [logs]);
  useEffect(() => { save('musafir-reservations', reservations); }, [reservations]);
  useEffect(() => { save('musafir-restaurant-tables', restaurantTables); }, [restaurantTables]);

  useEffect(() => {
    if (!apiToken || !apiBranchId || !apiBase) return;
    let active = true;
    fetch(`${apiBase.replace(/\/$/, '')}/api/auth/me`, { headers: { Authorization: `Bearer ${apiToken}` } })
      .then(response => { if (!response.ok) throw new Error('Session expired'); return response.json(); })
      .then(data => { if (active) { setApiConnected(true); setApiRole(data.user?.role || ''); } })
      .catch(() => {
        if (!active) return;
        saveSession('musafir-api-token', '');
        saveSession('musafir-api-branch', '');
        setApiToken(''); setApiBranchId(''); setApiRole(''); setApiConnected(false);
      });
    return () => { active = false; };
  }, [apiBase, apiToken, apiBranchId]);

  useEffect(() => {
    if (!apiConnected || !apiToken || !apiBranchId) return;
    let active = true;
    const refreshLiveData = async () => {
      try {
        const headers = { Authorization: `Bearer ${apiToken}` };
        const [ordersResponse, inventoryResponse, expensesResponse, purchasesResponse, suppliersResponse, employeesResponse, payrollResponse, reservationsResponse, tablesResponse, deliveriesResponse] = await Promise.all([
          fetch(`${apiBase.replace(/\/$/, '')}/api/orders?limit=150`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/inventory`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/expenses`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/purchases`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/suppliers`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/employees?date=${localDate()}`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/payroll`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/reservations`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/tables`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/deliveries`, { headers })
        ]);
        if (!ordersResponse.ok || !inventoryResponse.ok) return;
        const [orderData, inventoryData] = await Promise.all([ordersResponse.json(), inventoryResponse.json()]);
        if (!active || !Array.isArray(orderData.orders) || !Array.isArray(inventoryData.items)) return;
        if (expensesResponse.ok) {
          const expenseData = await expensesResponse.json();
          if (active && Array.isArray(expenseData.expenses)) setExpenses(expenseData.expenses.map((item: {id:string;date:string;category:string;description:string;amount:string|number;paymentMethod:string;createdAt:string}) => ({
            id:item.id,date:item.date,category:item.category,description:item.description,amount:Number(item.amount),
            paymentMethod:item.paymentMethod === 'Mada' ? 'Mada' : 'Cash',createdAt:item.createdAt
          })));
        }
        if (purchasesResponse.ok) {
          const purchaseData = await purchasesResponse.json();
          if (active && Array.isArray(purchaseData.purchases)) setPurchases(purchaseData.purchases.map((item: {
            id:string;created_at:string;supplier_id:string;supplier_name:string;ingredient_id:string;item_name:string;quantity:string|number;unit:string;
            unit_cost:string|number;total:string|number;paid:string|number;payment_method?:string;
          }) => {
            const amount = Number(item.total);
            const paidAmount = Number(item.paid);
            return {
              id:item.id,date:String(item.created_at).slice(0,10),supplierId:item.supplier_id,supplierName:item.supplier_name,
              inventoryId:item.ingredient_id,itemName:item.item_name,quantity:Number(item.quantity),unit:item.unit,
              unitCost:Number(item.unit_cost),total:amount,paid:paidAmount,
              paymentStatus:paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Part-paid' : 'Credit',
              paymentMethod:item.payment_method === 'Mada' ? 'Mada' : paidAmount > 0 ? 'Cash' : undefined,createdAt:item.created_at
            } as PurchaseRecord;
          }));
        }
        if (suppliersResponse.ok) {
          const supplierData = await suppliersResponse.json();
          if (active && Array.isArray(supplierData.suppliers)) setSuppliers(supplierData.suppliers.map((item: {
            id:string;name:string;phone?:string;category?:string;payable:string|number;
          }) => ({id:item.id,name:item.name,phone:item.phone || '',category:item.category || 'General',due:Number(item.payable)})));
        }
        if (employeesResponse.ok) {
          const employeeData = await employeesResponse.json();
          if (active && Array.isArray(employeeData.employees)) setEmployees(employeeData.employees.map((item: {
            id:string;name:string;role:string;shift:string;status:'Present'|'Absent'|'On Leave'|'Not marked';salary:string|number;advance:string|number;
          }) => ({id:item.id,name:item.name,role:item.role,shift:item.shift,status:item.status,salary:Number(item.salary),advance:Number(item.advance)})));
        }
        if (payrollResponse.ok) {
          const payrollData = await payrollResponse.json();
          if (active && Array.isArray(payrollData.payroll)) setPayroll(payrollData.payroll.map((item: {
            id:string;employeeId:string;employeeName:string;period:string;baseSalary:string|number;bonus:string|number;deduction:string|number;
            advanceDeduction:string|number;netSalary:string|number;createdAt:string;
            payments:Array<{id:string;amount:string|number;paymentMethod:'Cash'|'Mada';date:string;createdAt:string}>;
          }) => ({
            id:item.id,employeeId:item.employeeId,employeeName:item.employeeName,period:item.period,
            baseSalary:Number(item.baseSalary),bonus:Number(item.bonus),deduction:Number(item.deduction??0),advanceDeduction:Number(item.advanceDeduction),
            netSalary:Number(item.netSalary),createdAt:item.createdAt,
            payments:item.payments.map(payment=>({id:payment.id,amount:Number(payment.amount),paymentMethod:payment.paymentMethod,date:payment.date,createdAt:payment.createdAt}))
          })));
        }
        if (reservationsResponse.ok) {
          const reservationData = await reservationsResponse.json();
          if (active && Array.isArray(reservationData.reservations)) setReservations(reservationData.reservations.map((item: {
            id:string;guest_name:string;phone:string;party_size:number;reserved_for:string;status:ReservationRecord['status'];notes:string;created_at:string;
          }) => ({id:item.id,guestName:item.guest_name,phone:item.phone,partySize:Number(item.party_size),reservedFor:item.reserved_for,status:item.status,notes:item.notes||'',createdAt:item.created_at})));
        }
        if (tablesResponse.ok) {
          const tableData = await tablesResponse.json();
          if (active && Array.isArray(tableData.tables)) setRestaurantTables(tableData.tables.map((item: {
            id:string;table_number:string;seats:number;status:TableRecord['status'];notes:string;created_at:string;updated_at:string;
          }) => ({id:item.id,tableNumber:item.table_number,seats:Number(item.seats),status:item.status,notes:item.notes||'',createdAt:item.created_at,updatedAt:item.updated_at})));
        }
        if (deliveriesResponse.ok) {
          const deliveryData=await deliveriesResponse.json();
          if(active&&Array.isArray(deliveryData.deliveries))setDeliveries(deliveryData.deliveries);
          if(active&&Array.isArray(deliveryData.drivers))setDeliveryDrivers(deliveryData.drivers);
        }
        const liveOrders: Order[] = orderData.orders.map((saved: {
          id: string; order_number: number | string; order_type: Order['type']; status: string;
          created_at: string; customer_name: string; table_number?: string | null; subtotal: string | number; tax: string | number;
          discount: string | number; total: string | number; paid: string | number;
          payment_method: string; notes?: string;
          items: Array<{ id: string; productId: string | null; name: string; qty: number; unitPrice: string | number }>;
        }) => ({
          id: saved.id,
          number: String(saved.order_number),
          type: saved.order_type,
          status: saved.status as OrderStatus,
          createdAt: saved.created_at,
          customerName: saved.customer_name,
          tableNumber: saved.table_number || undefined,
          subtotal: Number(saved.subtotal),
          tax: Number(saved.tax),
          discount: Number(saved.discount),
          total: Number(saved.total),
          paid: Number(saved.paid),
          paymentMethod: saved.payment_method === 'Mada' ? 'Mada' : 'Cash',
          kitchenNote: saved.notes || undefined,
          items: saved.items.map(item => ({
            id: item.id,
            productId: item.productId || '',
            name: item.name,
            qty: Number(item.qty),
            unitPrice: Number(item.unitPrice)
          }))
        }));
        setOrders(current => [
          ...current.filter(order => order.number === 'HOLD'),
          ...liveOrders
        ]);
        setInventory(inventoryData.items.map((item: {
          id: string; name: string; category?: string; unit: string;
          stock: string | number; trackStock?: boolean; reorderLevel: string | number; unitCost: string | number;
          supplier?: string; expiresOn?: string | null;
        }) => ({
          id: item.id,
          name: item.name,
          category: item.category || 'General',
          unit: item.unit,
          stock: Number(item.stock),
          trackStock: Boolean(item.trackStock),
          reorderLevel: Number(item.reorderLevel),
          cost: Number(item.unitCost),
          supplier: item.supplier || '—',
          expiry: item.expiresOn || ''
        })));
      } catch {
        // Keep the last confirmed server snapshot during temporary network failures.
      }
    };
    void refreshLiveData();
    const interval = window.setInterval(() => { void refreshLiveData(); }, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [apiBase, apiToken, apiBranchId, apiConnected]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.15;
  const discountAmount = (subtotal + tax) * Math.max(0, Math.min(100, Number(discount) || 0)) / 100;
  const total = Math.max(0, subtotal + tax - discountAmount);
  const paid = total;
  const filteredProducts = useMemo(() => products.filter(p => (category === 'All' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase())), [products, category, search]);
  const lowStock = inventory.filter(item => item.trackStock && item.stock <= item.reorderLevel);
  const todayOrders = orders.filter(order => new Date(order.createdAt).toDateString() === new Date().toDateString() && order.number !== 'HOLD');
  const salesToday = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const amount = orders.filter(order => order.number !== 'HOLD' && new Date(order.createdAt).toDateString() === date.toDateString()).reduce((sum, order) => sum + order.total, 0);
    return { day: date.toLocaleDateString('en', { weekday: 'short' }), amount };
  });
  const maxWeek = Math.max(1, ...week.map(item => item.amount));
  const topProducts = [...orders.filter(order => order.number !== 'HOLD').flatMap(order => order.items)].reduce<{name:string; qty:number}[]>((list, item) => {
    const found = list.find(entry => entry.name === item.name); if (found) found.qty += item.qty; else list.push({ name: item.name, qty: item.qty }); return list;
  }, []).sort((a,b) => b.qty - a.qty).slice(0,4);

  const flash = (message: string) => setToast(message);
  const nextNumber = () => { const next = Math.max(1000, ...orders.map(order => Number(order.number) || 0)) + 1; return String(next); };
  const addToCart = (product: Product) => {
    setCart(current => { const exists = current.find(item => item.productId === product.id); return exists ? current.map(item => item.productId === product.id ? { ...item, qty: item.qty + 1 } : item) : [...current, { id: `${product.id}-${Date.now()}`, productId: product.id, name: product.name, price: product.price, qty: 1 }]; });
  };
  const clearCart = () => { orderIdempotencyKey.current = ''; orderIdempotencyPayload.current = ''; saveSession('musafir-order-idempotency-key',''); saveSession('musafir-order-idempotency-payload',''); setCart([]); setDiscount('0'); setNote(''); setSelectedCustomerId(''); setSelectedTableId(''); };
  const placeOrder = async () => {
    if (orderSubmissionLock.current) return;
    if (!cart.length) { flash('Add at least one menu item first.'); return; }
    if (orderType==='Dine-in' && apiConnected && (!selectedTableId || !restaurantTables.some(table=>table.id===selectedTableId&&['Available','Reserved'].includes(table.status)))) { flash('Select an available restaurant table for this dine-in order.'); return; }
    const orderPayload = { orderType, tableId: orderType==='Dine-in' ? selectedTableId || null : null, customerId: selectedCustomerId || null, paymentMethod: payMethod, discount: discountAmount, taxRate: 0.15, notes: note, items: cart.map(item => ({ productId: item.productId, quantity: item.qty })) };
    const payloadFingerprint = JSON.stringify(orderPayload);
    if (orderIdempotencyPayload.current !== payloadFingerprint) { orderIdempotencyKey.current = ''; orderIdempotencyPayload.current = payloadFingerprint; saveSession('musafir-order-idempotency-payload',payloadFingerprint); }
    orderSubmissionLock.current = true;
    if (!orderIdempotencyKey.current) { orderIdempotencyKey.current = crypto.randomUUID(); saveSession('musafir-order-idempotency-key',orderIdempotencyKey.current); }
    setIsSubmittingOrder(true);
    if (apiToken && apiBranchId) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}`, 'Idempotency-Key': orderIdempotencyKey.current },
          body: JSON.stringify(orderPayload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Order could not be saved to the server.');
        const saved = result.order;
        const serverTotal = Number(saved.total);
        const order: Order = {
          id: saved.id,
          number: String(saved.order_number),
          type: orderType,
          status: saved.status || 'Pending',
          createdAt: saved.created_at || new Date().toISOString(),
          customerName: customers.find(customer => customer.id === selectedCustomerId)?.name || 'Walk-in Guest',
          tableNumber: restaurantTables.find(table=>table.id===selectedTableId)?.tableNumber,
          items: cart.map(item => ({ id: item.id, productId: item.productId, name: item.name, qty: item.qty, unitPrice: item.price, note: note || undefined })),
          subtotal: Number(saved.subtotal),
          tax: Number(saved.tax),
          discount: Number(saved.discount),
          total: serverTotal,
          paid: serverTotal,
          paymentMethod: payMethod,
          kitchenNote: note || undefined
        };
        setOrders(current => [order, ...current]);
        setLogs(current => [{ id: `log-${Date.now()}`, title: 'Server sale completed', detail: `Order #${order.number} · ${currency(serverTotal)} · ${payMethod}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
        clearCart(); setView('orders'); flash(`Order #${order.number} saved to the database.`);
      } catch (error) {
        flash(error instanceof Error ? error.message : 'Backend connection failed. Order was not submitted.');
      }
      orderSubmissionLock.current = false;
      setIsSubmittingOrder(false);
      return;
    }
    const deductions = new Map<string, number>();
    cart.forEach(item => products.find(product => product.id === item.productId)?.recipe.forEach(ingredient => {
      const key = ingredient.name.trim().toLowerCase();
      deductions.set(key, (deductions.get(key) || 0) + ingredient.qty * item.qty);
    }));
    const shortages = inventory.filter(item => {
      const required = deductions.get(item.name.trim().toLowerCase()) || 0;
      return item.trackStock && required > item.stock;
    });
    if (shortages.length) {
      flash(`Insufficient stock: ${shortages.map(item => item.name).join(', ')}. Receive stock before checkout.`);
      orderSubmissionLock.current = false;
      setIsSubmittingOrder(false);
      return;
    }
    const number = nextNumber();
    const order: Order = { id: `o-${number}`, number, type: orderType, status: 'Pending', createdAt: new Date().toISOString(), customerName: customers.find(customer => customer.id === selectedCustomerId)?.name || 'Walk-in Guest', tableNumber: restaurantTables.find(table=>table.id===selectedTableId)?.tableNumber, items: cart.map(item => ({ id: item.id, productId: item.productId, name: item.name, qty: item.qty, unitPrice: item.price, note: note || undefined })), subtotal, tax, discount: discountAmount, total, paid: total, paymentMethod: payMethod, kitchenNote: note || undefined };
    setInventory(current => current.map(item => {
      const amount = deductions.get(item.name.trim().toLowerCase()) || 0;
      return amount && item.trackStock ? { ...item, stock: item.stock - amount } : item;
    }));
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const stockLogs = inventory.flatMap(item => {
      const amount = deductions.get(item.name.trim().toLowerCase()) || 0;
      return amount && item.trackStock ? [{ id: `consume-${number}-${item.id}`, title: 'Stock consumed', detail: `Order #${number} · ${item.name} · -${amount} ${item.unit}`, time }] : [];
    });
    setOrders(current => [order, ...current]);
    if(selectedTableId)setRestaurantTables(current=>current.map(table=>table.id===selectedTableId?{...table,status:'Occupied' as TableRecord['status']}:table));
    setLogs(current => [
      { id: `log-${Date.now()}`, title: 'Sale completed', detail: `Order #${number} · ${currency(total)} · ${payMethod}`, time },
      ...stockLogs,
      ...current
    ]);
    clearCart(); setView('orders'); flash(`Order #${number} placed successfully (offline demo).`);
    orderSubmissionLock.current = false;
    setIsSubmittingOrder(false);
  };
  const connectBackend = async () => {
    const base = apiBase.trim().replace(/\/$/, '');
    if (!base || !apiEmail.trim() || !apiPassword) { setApiMessage('API URL, email and password are required.'); return; }
    setApiBusy(true); setApiMessage('');
    try {
      const loginResponse = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: apiEmail.trim(), password: apiPassword })
      });
      const login = await loginResponse.json();
      if (!loginResponse.ok) throw new Error(login.error || 'Login failed.');
      const branchId = login.user?.branchId;
      if (!login.token || !branchId) throw new Error('Login response did not include a branch session.');
      const authHeaders = { Authorization: `Bearer ${login.token}` };
      const [menuResponse, categoryResponse, productsResponse, ordersResponse, inventoryResponse, suppliersResponse, purchasesResponse, customersResponse] = await Promise.all([
        fetch(`${base}/api/menu?branchId=${encodeURIComponent(branchId)}`),
        fetch(`${base}/api/categories`, { headers: authHeaders }),
        fetch(`${base}/api/products`, { headers: authHeaders }),
        fetch(`${base}/api/orders?limit=150`, { headers: authHeaders }),
        fetch(`${base}/api/inventory`, { headers: authHeaders }),
        fetch(`${base}/api/suppliers`, { headers: authHeaders }),
        fetch(`${base}/api/purchases`, { headers: authHeaders }),
        fetch(`${base}/api/customers`, { headers: authHeaders })
      ]);
      const [menu, categoryData, productData, orderData, inventoryData, supplierData, purchaseData, customerData] = await Promise.all([menuResponse.json(), categoryResponse.json(), productsResponse.json(), ordersResponse.json(), inventoryResponse.json(), suppliersResponse.json(), purchasesResponse.json(), customersResponse.json()]);
      if (!menuResponse.ok || !Array.isArray(menu.products)) throw new Error(menu.error || 'Could not load the branch menu.');
      if (!categoryResponse.ok || !Array.isArray(categoryData.categories)) throw new Error(categoryData.error || 'Could not load menu categories.');
      if (!productsResponse.ok || !Array.isArray(productData.products)) throw new Error(productData.error || 'Could not load product management data.');
      if (!ordersResponse.ok || !Array.isArray(orderData.orders)) throw new Error(orderData.error || 'Could not load branch order history.');
      if (!inventoryResponse.ok || !Array.isArray(inventoryData.items)) throw new Error(inventoryData.error || 'Could not load branch inventory.');
      if (!suppliersResponse.ok || !Array.isArray(supplierData.suppliers)) throw new Error(supplierData.error || 'Could not load branch suppliers.');
      if (!purchasesResponse.ok || !Array.isArray(purchaseData.purchases)) throw new Error(purchaseData.error || 'Could not load branch purchase history.');
      if (!customersResponse.ok || !Array.isArray(customerData.customers)) throw new Error(customerData.error || 'Could not load customer records.');
      setInventory(inventoryData.items.map((item: {id:string;name:string;category?:string;unit:string;stock:string|number;trackStock?:boolean;reorderLevel:string|number;unitCost:string|number;supplier?:string;expiresOn?:string|null})=>({id:item.id,name:item.name,category:item.category||'General',unit:item.unit,stock:Number(item.stock),trackStock:Boolean(item.trackStock),reorderLevel:Number(item.reorderLevel),cost:Number(item.unitCost),supplier:item.supplier||'—',expiry:item.expiresOn||''})));
      setSuppliers(supplierData.suppliers.map((supplier: {id:string;name:string;phone?:string;category?:string;payable:string|number})=>({id:supplier.id,name:supplier.name,phone:supplier.phone||'',category:supplier.category||'General',due:Number(supplier.payable)})));
      setCustomers(customerData.customers.map((customer: {id:string;name:string;phone?:string;address?:string;loyaltyPoints?:number|string;orderCount?:number|string;lifetimeSpend?:number|string;lastOrderAt?:string|null})=>({id:customer.id,name:customer.name,phone:customer.phone||'',address:customer.address||'',loyaltyPoints:Number(customer.loyaltyPoints||0),orderCount:Number(customer.orderCount||0),lifetimeSpend:Number(customer.lifetimeSpend||0),lastOrderAt:customer.lastOrderAt||undefined,favoriteItems:[]})));
      setPurchases(purchaseData.purchases.filter((purchase: {ingredient_id?:string;item_name?:string})=>purchase.ingredient_id && purchase.item_name).map((purchase: {id:string;created_at:string;supplier_id:string;supplier_name:string;ingredient_id:string;item_name:string;unit:string;quantity:string|number;unit_cost:string|number;total:string|number;paid:string|number;payment_method:string})=>({id:purchase.id,date:purchase.created_at.slice(0,10),supplierId:purchase.supplier_id,supplierName:purchase.supplier_name,inventoryId:purchase.ingredient_id,itemName:purchase.item_name,quantity:Number(purchase.quantity),unit:purchase.unit,unitCost:Number(purchase.unit_cost),total:Number(purchase.total),paid:Number(purchase.paid),paymentStatus:Number(purchase.paid)>=Number(purchase.total)?'Paid':Number(purchase.paid)>0?'Part-paid':'Credit',paymentMethod:purchase.payment_method as PaymentMethod,createdAt:purchase.created_at})));
      setOrders(orderData.orders.map((saved: { id:string; order_number:number|string; order_type:Order['type']; status:string; created_at:string; customer_name:string; subtotal:string|number; tax:string|number; discount:string|number; total:string|number; paid:string|number; payment_method:string; notes?:string; items:Array<{id:string;productId:string|null;name:string;qty:number;unitPrice:string|number}> }) => ({
        id: saved.id,
        number: String(saved.order_number),
        type: saved.order_type,
        status: saved.status as OrderStatus,
        createdAt: saved.created_at,
        customerName: saved.customer_name,
        subtotal: Number(saved.subtotal),
        tax: Number(saved.tax),
        discount: Number(saved.discount),
        total: Number(saved.total),
        paid: Number(saved.paid),
        paymentMethod: saved.payment_method === 'Mada' ? 'Mada' : 'Cash',
        kitchenNote: saved.notes || undefined,
        items: saved.items.map(item => ({ id:item.id, productId:item.productId || '', name:item.name, qty:Number(item.qty), unitPrice:Number(item.unitPrice) }))
      })));
      setMenuCategories(categoryData.categories);
      const mappedProducts = productData.products.map((item: {id:string;name:string;category?:string;price:string|number;imageUrl?:string;image_url?:string;active:boolean;recipe?:Array<{ingredientId:string;name:string;qty:string|number;unit:string}>}) => ({
        id:item.id,name:item.name,category:(item.category||'Snacks') as Product['category'],price:Number(item.price),
        image:item.imageUrl||item.image_url||'',popularity:0,recipe:(item.recipe||[]).map(ingredient=>({ingredientId:ingredient.ingredientId,name:ingredient.name,qty:Number(ingredient.qty),unit:ingredient.unit}))
      }));
      setProducts(mappedProducts.filter((_:Product,index:number)=>productData.products[index].active));
      setInactiveMenuProducts(mappedProducts.filter((_:Product,index:number)=>!productData.products[index].active));
      setApiBase(base); save('musafir-api-base', base);
      saveSession('musafir-api-token', login.token);
      saveSession('musafir-api-branch', branchId);
      saveSession('musafir-api-role', login.user.role || '');
      setApiToken(login.token); setApiBranchId(branchId); setApiRole(login.user.role || ''); setApiConnected(true);
      setApiPassword('');
      setApiMessage(`Connected to branch ${branchId}. ${productData.products.filter((item: {active:boolean})=>item.active).length} menu products, ${orderData.orders.length} orders and ${inventoryData.items.length} inventory items loaded.`);
    } catch (error) {
      setApiToken(''); setApiBranchId(''); setApiConnected(false);
      setApiMessage(error instanceof Error ? error.message : 'Could not connect to backend.');
    } finally { setApiBusy(false); }
  };
  const disconnectBackend = () => {
    saveSession('musafir-api-token', ''); saveSession('musafir-api-branch', ''); saveSession('musafir-api-role', '');
    setApiToken(''); setApiBranchId(''); setApiRole(''); setApiConnected(false); setProducts(demoProducts);
    setApiMessage('Disconnected. POS is using local demo data.');
  };
  const exportBackup = () => {
    const backup = {
      app: 'Musafir Fast Food POS',
      formatVersion: 5,
      exportedAt: new Date().toISOString(),
      data: { products, inactiveMenuProducts, menuCategories, inventory, customers, orders, cart, employees, suppliers, expenses, purchases, payroll, logs }
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `musafir-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBackupMessage('Backup file generated. Keep a copy outside this device.');
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.data;
      const required = ['products', 'inventory', 'customers', 'orders', 'cart', 'employees', 'suppliers', 'logs'];
      if (parsed?.app !== 'Musafir Fast Food POS' || ![1, 2, 3, 4, 5].includes(parsed?.formatVersion) || !data || required.some(key => !Array.isArray(data[key])) || (data.expenses !== undefined && !Array.isArray(data.expenses)) || (data.purchases !== undefined && !Array.isArray(data.purchases)) || (data.payroll !== undefined && !Array.isArray(data.payroll)) || (data.inactiveMenuProducts !== undefined && !Array.isArray(data.inactiveMenuProducts)) || (data.menuCategories !== undefined && !Array.isArray(data.menuCategories))) {
        throw new Error('This is not a valid Musafir POS backup file.');
      }
      if (!window.confirm('Restore this backup? Current POS data on this device will be replaced.')) return;
      setProducts(data.products);
      setInactiveMenuProducts(Array.isArray(data.inactiveMenuProducts) ? data.inactiveMenuProducts : []);
      setMenuCategories(Array.isArray(data.menuCategories) ? data.menuCategories : categories.map((name:string,index:number)=>({id:`local-${index}`,name})));
      setInventory(data.inventory);
      setCustomers(data.customers);
      setOrders(data.orders);
      setCart(data.cart);
      setEmployees(data.employees);
      setSuppliers(data.suppliers);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      setPurchases(Array.isArray(data.purchases) ? data.purchases.map((item: PurchaseRecord) => ({ ...item, paid: Number(item.paid ?? (item.paymentStatus === 'Paid' ? item.total : 0)) })) : []);
      setPayroll(Array.isArray(data.payroll) ? data.payroll : []);
      setLogs(data.logs);
      setBackupMessage('Backup restored on this device.');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Backup could not be restored.');
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const apiSettings = (): ReactNode => <div className="space-y-4"><section className={`${panel} max-w-2xl p-5 md:p-7`}>
    <div className="mb-5">{heading('Local data protection','POS backup & restore','Export or restore this device’s saved POS records. Restore replaces the current local data.')}</div>
    <div className="flex flex-wrap gap-2">
      <button onClick={exportBackup} className="rounded-xl bg-[#e7b943] px-4 py-2.5 text-sm font-semibold text-[#17130b]">Export backup</button>
      <button onClick={() => backupInputRef.current?.click()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Restore backup</button>
      <input ref={backupInputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { void importBackup(event.target.files?.[0]); }} />
    </div>
    {backupMessage && <p role="status" className="mt-3 text-xs text-slate-300">{backupMessage}</p>}
    <p className="mt-3 text-xs leading-5 text-amber-200/70">Backups contain active and inactive menu products, categories, orders, stock, customers, employees, suppliers, purchases, expenses and audit history. Store backup files securely. This does not copy data from the connected server database.</p>
  </section><section className={`${panel} max-w-2xl p-5 md:p-7`}>
    <div className="mb-5">{heading('System integration','Backend connection','Connect this POS to the live Saudi branch database.')}</div>
    <label className="mb-1 block text-xs text-slate-400">Backend API URL</label>
    <input value={apiBase} onChange={event=>setApiBase(event.target.value)} placeholder="https://your-api-service.onrender.com" className="field mb-4 w-full"/>
    <label className="mb-1 block text-xs text-slate-400">Admin email</label>
    <input type="email" value={apiEmail} onChange={event=>setApiEmail(event.target.value)} placeholder="admin@example.com" className="field mb-4 w-full"/>
    <label className="mb-1 block text-xs text-slate-400">Admin password</label>
    <input type="password" value={apiPassword} onChange={event=>setApiPassword(event.target.value)} placeholder="Enter backend admin password" className="field mb-4 w-full"/>
    <div className="flex flex-wrap gap-2">
      <button onClick={connectBackend} disabled={apiBusy} className="rounded-xl bg-[#e7b943] px-4 py-2.5 text-sm font-semibold text-[#17130b] disabled:opacity-50">{apiBusy?'Connecting…':'Connect backend'}</button>
      {apiConnected&&<button onClick={disconnectBackend} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Disconnect</button>}
    </div>
    <p className={`mt-4 text-xs ${apiConnected?'text-emerald-300':'text-slate-400'}`}>{apiConnected?'Connected: new checkouts are written to PostgreSQL.':'Not connected: checkout remains in local demo mode.'}</p>
    {apiMessage&&<p role="status" className="mt-2 rounded-lg bg-white/[.04] p-3 text-xs text-slate-300">{apiMessage}</p>}
    {apiConnected&&<p className="mt-3 text-[11px] text-slate-500">Branch ID: {apiBranchId}</p>}
  </section></div>;
  const holdOrder = () => {
    if (!cart.length) { flash('There is no order to hold.'); return; }
    const number = `H-${Date.now()}`;
    const order: Order = { id: number, number: 'HOLD', type: orderType, status: 'Pending', createdAt: new Date().toISOString(), customerName: 'Held order', items: cart.map(item => ({ id: `${item.id}-hold`, productId: item.productId, name: item.name, qty: item.qty, unitPrice: item.price })), subtotal, tax, discount: discountAmount, total, paid: 0, paymentMethod: payMethod, kitchenNote: note || undefined };
    setOrders(current => [order, ...current]); clearCart(); setView('orders'); flash('Order held. Resume it from the Orders list.');
  };
  const resumeOrder = (order: Order) => { setCart(order.items.map(item => ({ id: item.id, productId: item.productId, name: item.name, price: item.unitPrice, qty: item.qty }))); setOrderType(order.type); setOrders(current => current.filter(entry => entry.id !== order.id)); setView('pos'); flash('Held order restored to the cart.'); };
  const changeStatus = async (id: string) => {
    const currentOrder = orders.find(order => order.id === id);
    if (!currentOrder) return;
    const index = workflow.indexOf(currentOrder.status);
    const nextStatus = workflow[Math.min(index + 1, workflow.length - 1)];
    if (apiToken && apiConnected) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/orders/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
          body: JSON.stringify({ status: nextStatus })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Order status could not be updated.');
      } catch (error) {
        flash(error instanceof Error ? error.message : 'Could not update order status on server.');
        return;
      }
    }
    setOrders(current => current.map(order => order.id === id ? { ...order, status: nextStatus } : order));
  };
  const addInventoryItem = async () => {
    const name = window.prompt('Stock item name');
    if (!name?.trim()) return;
    const category = window.prompt('Category', 'General') || 'General';
    const unit = window.prompt('Unit (piece, can, kg, g, litre...)', 'piece') || 'piece';
    const quantityInput = window.prompt('Initial quantity (leave blank for Unlimited)', '');
    if (quantityInput === null) return;
    const trackStock = quantityInput.trim() !== '';
    const stock = trackStock ? Number(quantityInput) : 0;
    if (trackStock && (!Number.isFinite(stock) || stock < 0)) { flash('Enter a valid stock quantity or leave it blank for Unlimited.'); return; }
    const item: InventoryItem = { id: `i-${Date.now()}`, name: name.trim(), category, unit, stock, trackStock, reorderLevel: 0, cost: 0, supplier: '—', expiry: '' };
    if (apiToken && apiConnected) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
          body: JSON.stringify({ sku: `POS-${Date.now()}`, name: item.name, category, unit, stock, trackStock, reorderLevel: 0, unitCost: 0 })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Stock item could not be saved.');
        item.id = result.item.id;
      } catch (error) { flash(error instanceof Error ? error.message : 'Stock item could not be saved.'); return; }
    }
    setInventory(current => [item, ...current]);
    flash(`${item.name} added as ${trackStock ? `${stock} ${unit}` : 'Unlimited'}.`);
  };
  const editInventoryItem = async (item: InventoryItem) => {
    const name = window.prompt('Stock item name', item.name)?.trim();
    if (!name) return;
    const category = window.prompt('Category', item.category);
    if (category === null) return;
    const unit = window.prompt('Unit', item.unit);
    if (!unit?.trim()) return;
    const reorderLevel = Number(window.prompt('Reorder level', String(item.reorderLevel)));
    const unitCost = Number(window.prompt('Unit cost (SAR)', String(item.cost)));
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0 || !Number.isFinite(unitCost) || unitCost < 0) { flash('Enter valid reorder and unit-cost values.'); return; }
    const changes = { name, category: category.trim() || 'General', unit: unit.trim(), reorderLevel, unitCost };
    if (apiToken && apiConnected) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/inventory/${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` }, body: JSON.stringify(changes) });
        const result = await response.json();
        if (!response.ok || !result.item) throw new Error(result.error || 'Inventory item could not be updated.');
        const saved = result.item;
        setInventory(current => current.map(entry => entry.id === item.id ? { ...entry, name: saved.name, category: saved.category, unit: saved.unit, stock: Number(saved.stock), trackStock: Boolean(saved.trackStock ?? saved.track_stock), reorderLevel: Number(saved.reorderLevel ?? saved.reorder_level), cost: Number(saved.unitCost ?? saved.unit_cost) } : entry));
        flash('Inventory item updated in database.');
        return;
      } catch (error) { flash(error instanceof Error ? error.message : 'Inventory update failed.'); return; }
    }
    setInventory(current => current.map(entry => entry.id === item.id ? { ...entry, ...changes } : entry));
    flash('Inventory item updated on this device only.');
  };
  const addStock = async (item: InventoryItem) => { const quantity = Number(window.prompt(`How many ${item.unit} should be added to ${item.name}?`, '10')); if (!Number.isFinite(quantity) || quantity <= 0) return; if(apiToken&&apiConnected){try{const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/inventory/${encodeURIComponent(item.id)}/adjust`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({quantity,note:'Stock received from POS inventory'})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Stock could not be updated.');const saved=result.item;setInventory(current=>current.map(entry=>entry.id===item.id?{...entry,stock:Number(saved.stock),trackStock:Boolean(saved.trackStock??saved.track_stock)}:entry));flash(`${item.name} stock updated in database.`);return;}catch(error){flash(error instanceof Error?error.message:'Stock update failed.');return;}}setInventory(current=>current.map(entry=>entry.id===item.id?{...entry,stock:entry.stock+quantity,trackStock:true}:entry));setLogs(current=>[{id:`stock-${Date.now()}`,title:'Stock received',detail:`${item.name} · +${quantity} ${item.unit} · Offline demo`,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})},...current]);flash(`${item.name} stock updated in offline demo.`); };
  const addCustomer = async () => { const name = window.prompt('Customer name'); if (!name?.trim()) return; const phone = (window.prompt('Phone number') || '').trim(); const address = (window.prompt('Address (optional)') || '').trim(); if (apiToken && apiConnected) { try { const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` }, body: JSON.stringify({ name: name.trim(), phone, address }) }); const result = await response.json(); if (!response.ok || !result.customer) throw new Error(result.error || 'Customer could not be saved.'); const saved = result.customer; setCustomers(current => [{ id: saved.id, name: saved.name, phone: saved.phone || '', address: saved.address || '', loyaltyPoints: Number(saved.loyaltyPoints || 0), favoriteItems: [] }, ...current]); flash('Customer saved to the database.'); } catch (error) { flash(error instanceof Error ? error.message : 'Customer save failed.'); } return; } setCustomers(current => [{ id: `c-${Date.now()}`, name: name.trim(), phone, address, loyaltyPoints: 0, favoriteItems: [] }, ...current]); setLogs(current => [{ id: `customer-${Date.now()}`, title: 'Customer added', detail: `${name.trim()} · ${phone || 'No phone saved'}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]); flash('Customer added to this device only. Connect the API to save across devices.'); };

  const editCustomer = async (customer: Customer) => {
    const name = window.prompt('Customer name', customer.name);
    if (!name?.trim()) return;
    const phone = (window.prompt('Phone number', customer.phone) || '').trim();
    const address = (window.prompt('Address (optional)', customer.address) || '').trim();
    if (apiToken && apiConnected) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/customers/${encodeURIComponent(customer.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
          body: JSON.stringify({ name: name.trim(), phone, address })
        });
        const result = await response.json();
        if (!response.ok || !result.customer) throw new Error(result.error || 'Customer could not be updated.');
        const saved = result.customer;
        setCustomers(current => current.map(item => item.id === customer.id ? { ...item, name: saved.name, phone: saved.phone || '', address: saved.address || '' } : item));
        flash('Customer updated in the database.');
      } catch (error) { flash(error instanceof Error ? error.message : 'Customer update failed.'); }
      return;
    }
    setCustomers(current => current.map(item => item.id === customer.id ? { ...item, name: name.trim(), phone, address } : item));
    flash('Customer updated on this device only.');
  };

  const panel = 'rounded-[24px] border border-white/[.07] bg-[#14191f] shadow-[0_18px_50px_rgba(0,0,0,.24)]';
  const heading = (eyebrow: string, title: string, subtitle?: string) => <div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#caa348]">{eyebrow}</p><h1 className="mt-1 text-[26px] font-semibold tracking-tight text-white">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}</div>;

  const dashboard = (): ReactNode => <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[26px] border border-[#d6a943]/20 bg-[radial-gradient(ellipse_at_82%_15%,rgba(228,172,54,.22),transparent_35%),linear-gradient(115deg,#191b1d,#111519)] p-6 md:p-8">
      <div className="relative z-10 max-w-xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d6a943]/30 bg-[#d6a943]/10 px-3 py-1.5 text-xs text-[#f3d890]"><Sparkles size={14}/> Good Food • Good Mood</div><h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">Your restaurant,<br/><span className="text-[#e7b943]">beautifully in control.</span></h1><p className="mt-3 max-w-md text-sm leading-6 text-slate-400">A live view of sales, orders, and service for Musafir Fast Food.</p><button onClick={() => setView('pos')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#e6b23d] px-4 py-2.5 text-sm font-semibold text-[#17130b] transition hover:bg-[#f4c75f]"><Plus size={16}/> Start a new order</button></div><div className="pointer-events-none absolute -right-10 -bottom-16 hidden h-72 w-72 rounded-full border border-[#e7b943]/15 md:block"><div className="absolute inset-8 rounded-full border border-[#e7b943]/20"/><div className="absolute inset-16 rounded-full bg-[#e7b943]/[.04]"/></div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{label:'Sales today',value:currency(salesToday),icon:CircleDollarSign,sub:`${todayOrders.length} paid orders`},{label:'Orders today',value:String(todayOrders.length),icon:ClipboardList,sub:`${orders.filter(o=>o.status!=='Completed'&&o.number!=='HOLD').length} in progress`},{label:'Customers',value:String(customers.length),icon:Users,sub:'Saved customer profiles'},{label:'Low stock',value:String(lowStock.length),icon:Boxes,sub:lowStock.length?'Restock recommended':'Stock levels healthy'}].map((card,index)=><div key={card.label} className={`${panel} p-4`}><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{card.label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${index===3&&lowStock.length?'bg-rose-400/10 text-rose-300':'bg-[#e6b23d]/10 text-[#e7b943]'}`}><card.icon size={17}/></span></div><div className="mt-4 text-2xl font-semibold text-white">{card.value}</div><div className="mt-1 text-xs text-slate-500">{card.sub}</div></div>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <section className={`${panel} p-5`}><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-white">Sales activity</h2><p className="mt-1 text-xs text-slate-500">Actual order totals · last 7 days</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">SAR</span></div><div className="flex h-44 items-end gap-3 border-b border-l border-white/[.07] px-3 pb-0">{week.map(item=><div key={item.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div title={currency(item.amount)} className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-[#a9791e] to-[#f0c85c] transition-all" style={{height:`${item.amount ? Math.max(8,item.amount/maxWeek*78):3}%`}}/><span className="mb-2 text-[10px] text-slate-500">{item.day}</span></div>)}</div></section>
      <section className={`${panel} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Best sellers</h2><p className="mt-1 text-xs text-slate-500">Based on recorded order items</p></div><button onClick={()=>setView('reports')} className="text-xs text-[#e7b943] hover:text-white">View report</button></div>{topProducts.length?<div className="grid grid-cols-2 gap-2">{topProducts.map((item,index)=><div key={item.name} className="min-w-0 rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e7b943]/10 text-[10px] font-semibold text-[#e7b943]">0{index+1}</span><span className="text-[10px] text-slate-500">{item.qty} sold</span></div><div className="mt-2 truncate text-xs font-medium text-slate-200">{item.name}</div></div>)}</div>:<p className="py-8 text-center text-sm text-slate-500">Sales data will appear here after orders are placed.</p>}</section>
    </div>
    <div className="grid gap-4 xl:grid-cols-2"><section className={`${panel} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Recent orders</h2><p className="mt-1 text-xs text-slate-500">Latest sales and held checks</p></div><button onClick={()=>setView('orders')} className="text-xs text-[#e7b943]">All orders →</button></div><div className="grid grid-cols-2 gap-2">{orders.slice(0,4).map(order=><div key={order.id} className="min-w-0 rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-200">{order.number==='HOLD'?'Held order':`#${order.number}`}</span><span className="shrink-0 text-[10px] text-[#d9b752]">{order.number==='HOLD'?'Hold':order.status}</span></div><div className="mt-2 truncate text-[11px] text-slate-400">{order.customerName}</div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-500">{order.type}</span><span className="text-xs font-semibold text-white">{currency(order.total)}</span></div></div>)}</div></section><section className={`${panel} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Stock watch</h2><p className="mt-1 text-xs text-slate-500">Items at or below reorder point</p></div><button onClick={()=>setView('inventory')} className="text-xs text-[#e7b943]">Inventory →</button></div>{lowStock.length?<div className="grid grid-cols-2 gap-2">{lowStock.slice(0,4).map(item=><div key={item.id} className="min-w-0 rounded-xl border border-rose-400/10 bg-rose-400/[.035] p-3"><div className="truncate text-xs font-medium text-slate-200">{item.name}</div><div className="mt-2 flex items-center justify-between gap-1"><span className="truncate text-[10px] text-slate-500">Reorder {item.reorderLevel}</span><span className="shrink-0 rounded-md bg-rose-400/10 px-2 py-1 text-[10px] text-rose-300">{item.stock} {item.unit}</span></div></div>)}</div>:<p className="py-8 text-center text-sm text-slate-500">No low-stock items.</p>}</section></div>
  </div>;

  const pos = (): ReactNode => <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]"><section className={`${panel} p-4 md:p-5`}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div>{heading('Front counter','Create an order','Choose items, then review and pay at the checkout.')}</div><div className="flex gap-1 rounded-xl bg-black/20 p-1">{(['Dine-in','Takeaway','Pickup','Home Delivery'] as Order['type'][]).map(type=><button key={type} onClick={()=>setOrderType(type)} className={`rounded-lg px-2.5 py-2 text-[11px] transition ${orderType===type?'bg-[#e7b943] font-semibold text-[#17130b]':'text-slate-400 hover:text-white'}`}>{type}</button>)}</div></div><div className="mb-4 flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search menu..." className="field w-full pl-9"/></div><button onClick={()=>setCategory('All')} className="rounded-xl border border-white/10 px-3 text-xs text-slate-300">Reset</button></div><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{['All',...menuCategories.map(item=>item.name)].map(item=><button key={item} onClick={()=>setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${category===item?'bg-[#e7b943] font-semibold text-[#17130b]':'border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}>{item}</button>)}</div><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{filteredProducts.map(product=><button key={product.id} onClick={()=>addToCart(product)} className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[.07] bg-[#191e24] text-left transition hover:border-[#d8a93f]/50 hover:bg-[#20262c]"><div className="relative aspect-[4/3] w-full overflow-hidden bg-[#22272c]"><img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/><span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-[#e7b943] text-[#17130b] shadow-lg"><Plus size={15}/></span></div><div className="flex min-h-[76px] w-full flex-col p-2.5"><div className="line-clamp-2 min-h-8 text-xs font-semibold leading-4 text-white">{product.name}</div><div className="mt-auto flex items-center justify-between gap-1 pt-2"><span className="truncate text-[11px] font-bold text-[#e7b943]">{currency(product.price)}</span><span className="max-w-[45%] truncate text-[9px] text-slate-500">{product.category}</span></div></div></button>)}</div>{!filteredProducts.length&&<div className="py-16 text-center text-sm text-slate-500">No menu items match this search.</div>}</section>
    <aside className={`${panel} flex flex-col p-4 md:p-5`}><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#caa348]">Checkout</p><h2 className="mt-1 text-lg font-semibold text-white">Current order <span className="text-sm text-slate-500">({cart.reduce((n,item)=>n+item.qty,0)})</span></h2></div><button onClick={clearCart} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/5 hover:text-rose-300">Clear</button></div><div className="mt-4 max-h-[34vh] min-h-24 flex-1 space-y-2 overflow-y-auto">{cart.length?cart.map(item=><div key={item.productId} className="flex items-center gap-3 rounded-xl bg-white/[.035] p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-white">{item.name}</div><div className="mt-1 text-xs text-slate-500">{currency(item.price)} each</div></div><div className="flex items-center gap-2"><button aria-label={`Decrease ${item.name}`} onClick={()=>setCart(current=>current.map(entry=>entry.productId===item.productId?{...entry,qty:entry.qty-1}:entry).filter(entry=>entry.qty>0))} className="qty-btn">−</button><span className="w-4 text-center text-xs text-white">{item.qty}</span><button aria-label={`Increase ${item.name}`} onClick={()=>setCart(current=>current.map(entry=>entry.productId===item.productId?{...entry,qty:entry.qty+1}:entry))} className="qty-btn">+</button></div><div className="w-16 text-right text-xs font-semibold text-white">{currency(item.price*item.qty)}</div></div>):<div className="grid h-full min-h-28 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-slate-600">Your order is empty</div>}</div><label className="mt-3 block text-xs text-slate-400">Restaurant table</label><select aria-label="Restaurant table" value={selectedTableId} onChange={event=>setSelectedTableId(event.target.value)} disabled={orderType!=='Dine-in'} className="field mt-1 w-full disabled:opacity-40"><option value="">No table selected</option>{restaurantTables.filter(table=>['Available','Reserved'].includes(table.status)).map(table=><option key={table.id} value={table.id}>Table {table.tableNumber} · {table.seats} seats · {table.status}</option>)}</select>{orderType==='Dine-in'&&apiConnected&&!restaurantTables.length&&<p className="mt-1 text-[11px] text-amber-200/70">Add restaurant tables before taking a dine-in order.</p>}<label className="mt-3 block text-xs text-slate-400">Customer (optional)</label><select aria-label="Select customer" value={selectedCustomerId} onChange={event=>setSelectedCustomerId(event.target.value)} className="field mt-1 w-full"><option value="">Walk-in Guest</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}{customer.phone?` · ${customer.phone}`:''}</option>)}</select><label className="mt-3 text-xs text-slate-400">Kitchen note</label><textarea value={note} onChange={event=>setNote(event.target.value)} rows={2} placeholder="Allergies, no onions, extra sauce…" className="field mt-1 resize-none"/><div className="mt-3 grid grid-cols-3 gap-2">{(['Cash','Mada'] as PaymentMethod[]).map(method=><button key={method} onClick={()=>setPayMethod(method)} className={`rounded-lg border py-2 text-xs ${payMethod===method?'border-[#dfb248]/50 bg-[#dfb248]/10 text-[#f0d27c]':'border-white/10 text-slate-400'}`}>{method}</button>)}</div><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Discount (%)</span><input aria-label="Discount percent" type="number" min="0" max="100" value={discount} disabled={apiConnected && apiRole !== "owner" && apiRole !== "manager"} onChange={event=>setDiscount(String(Math.max(0,Math.min(100,Number(event.target.value)||0))))} className="field w-20 py-1.5 text-right disabled:cursor-not-allowed disabled:opacity-40"/></div>{apiConnected && apiRole !== "owner" && apiRole !== "manager" && <p className="mt-2 text-[11px] text-amber-200/70">Discounts require owner or manager authorization.</p>}<div className="mt-3 space-y-2 border-t border-white/[.07] pt-3 text-sm"><div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{currency(subtotal)}</span></div><div className="flex justify-between text-slate-400"><span>VAT (15%)</span><span>{currency(tax)}</span></div><div className="flex justify-between text-slate-400"><span>Discount</span><span>−{currency(discountAmount)}</span></div><div className="flex justify-between pt-1 text-lg font-semibold text-white"><span>Total</span><span className="text-[#efc75e]">{currency(total)}</span></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={holdOrder} disabled={!cart.length} className="rounded-xl border border-white/10 py-2.5 text-xs text-slate-300 disabled:opacity-40">Hold order</button><button onClick={()=>window.print()} disabled={!cart.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs text-slate-300 disabled:opacity-40"><Printer size={14}/> Print</button><button onClick={placeOrder} disabled={!cart.length || isSubmittingOrder} className="col-span-2 rounded-xl bg-[#e7b943] py-3 text-sm font-bold text-[#17130b] transition hover:bg-[#f4ca60] disabled:cursor-not-allowed disabled:opacity-40">{isSubmittingOrder ? 'Saving order…' : `Complete payment · ${currency(total)}`}</button></div></aside></div>;

  const ordersView = (): ReactNode => <section className={`${panel} p-5`}><div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Service workflow','Orders','Monitor the order lifecycle and resume checks on hold.')}</div><div className="space-y-3">{orders.map(order=><article key={order.id} className="rounded-2xl border border-white/[.07] bg-[#191e24] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold text-white">{order.number==='HOLD'?'Held check':`Order #${order.number}`} <span className="ml-2 text-xs font-normal text-slate-400">{order.customerName}</span></div><div className="mt-1 text-xs text-slate-500">{order.type}{order.tableNumber?` · Table ${order.tableNumber}`:''} · {new Date(order.createdAt).toLocaleString()}</div></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs ${order.number==='HOLD'?'bg-amber-400/10 text-amber-300':'bg-white/[.06] text-slate-300'}`}>{order.number==='HOLD'?'On hold':order.status}</span>{order.number==='HOLD'?<button onClick={()=>resumeOrder(order)} className="rounded-lg bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">Resume</button>:order.status!=='Completed'&&<button onClick={()=>changeStatus(order.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-[#e7b943]/40">Next status</button>}</div></div><div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-white/[.06] pt-3 text-xs text-slate-400"><span>{order.items.map(item=>`${item.qty}× ${item.name}`).join(' · ')}</span><span className="font-semibold text-[#e7b943]">{currency(order.total)} · Paid {currency(order.paid)}</span></div>{order.kitchenNote&&<p className="mt-2 text-xs text-slate-500">Kitchen note: {order.kitchenNote}</p>}</article>)}</div>{!orders.length&&<p className="py-12 text-center text-slate-500">No orders yet.</p>}</section>;
  const kitchen = (): ReactNode => <div><div className="mb-5">{heading('Live kitchen','Kitchen Display','Advance tickets here; order status is shared with the Orders screen.')}</div><div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{workflow.slice(0,4).map(status=><section key={status} className={`${panel} min-h-64 p-4`}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-white">{status}</h2><span className="rounded-full bg-white/[.06] px-2 py-1 text-xs text-slate-400">{orders.filter(order=>order.status===status&&order.number!=='HOLD').length}</span></div>{orders.filter(order=>order.status===status&&order.number!=='HOLD').map(order=><article key={order.id} className="mb-3 rounded-xl border border-white/[.07] bg-[#191e24] p-3"><div className="flex justify-between"><strong className="text-white">#{order.number}</strong><span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div><div className="mt-3 space-y-1 text-sm text-slate-300">{order.items.map(item=><div key={`${order.id}-${item.id}`}>{item.qty}× {item.name}</div>)}</div>{order.kitchenNote&&<p className="mt-3 rounded-lg bg-amber-300/5 p-2 text-xs text-amber-200">{order.kitchenNote}</p>}<button onClick={()=>changeStatus(order.id)} className="mt-3 w-full rounded-lg bg-[#e7b943] py-2 text-xs font-semibold text-[#17130b]">{status==='Ready'?'Complete order':`Mark ${workflow[workflow.indexOf(status)+1]}`}</button></article>)}{!orders.some(order=>order.status===status&&order.number!=='HOLD')&&<p className="py-8 text-center text-xs text-slate-600">No tickets</p>}</section>)}</div></div>;
  const inventoryView = (): ReactNode => <section className={`${panel} p-5`}><div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Stock control','Inventory','Items are unlimited until you enter a quantity to track.')}<button onClick={addInventoryItem} className="inline-flex items-center gap-2 rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={14}/> Add stock item</button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Ingredient</th><th className="pb-3">Category</th><th className="pb-3">On hand</th><th className="pb-3">Reorder at</th><th className="pb-3">Supplier</th><th className="pb-3">Status</th><th/></tr></thead><tbody>{inventory.map(item=><tr key={item.id} className="border-t border-white/[.06]"><td className="py-3 font-medium text-slate-200">{item.name}</td><td className="py-3 text-slate-400">{item.category}</td><td className="py-3 text-slate-300">{item.trackStock?`${item.stock} ${item.unit}`:'Unlimited'}</td><td className="py-3 text-slate-400">{item.trackStock?`${item.reorderLevel} ${item.unit}`:'—'}</td><td className="py-3 text-slate-400">{item.supplier}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[11px] ${!item.trackStock?'bg-slate-400/10 text-slate-300':item.stock<=item.reorderLevel?'bg-rose-400/10 text-rose-300':'bg-emerald-400/10 text-emerald-300'}`}>{!item.trackStock?'Unlimited':item.stock<=item.reorderLevel?'Restock':'In stock'}</span></td><td className="py-3 text-right"><div className="flex justify-end gap-2"><button onClick={()=>editInventoryItem(item)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300">Edit</button><button onClick={()=>addStock(item)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:border-[#e7b943]/40">Receive stock</button></div></td></tr>)}</tbody></table></div></section>;
  const assignDelivery = async (order:Order) => {
    if(!apiConnected||!apiToken){flash('Connect the POS API before dispatching delivery orders.');return;}
    if(!deliveryDrivers.length){flash('Add active staff with the Delivery role before assigning drivers.');return;}
    const options=deliveryDrivers.map((driver,index)=>`${index+1}. ${driver.display_name}`).join('\n');
    const choice=Number(window.prompt(`Choose delivery driver number:\n${options}`));
    if(!Number.isInteger(choice)||choice<1||choice>deliveryDrivers.length)return;
    const driver=deliveryDrivers[choice-1];
    const address=(window.prompt('Delivery address')||'').trim();
    if(!address){flash('Delivery address is required.');return;}
    const note=(window.prompt('Delivery instructions (optional)')||'').trim();
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/deliveries/${order.id}/assign`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({driverId:driver.id,address,note})});
      const result=await response.json();
      if(!response.ok||!result.delivery)throw new Error(result.error||'Delivery assignment failed.');
      flash(`Order #${order.number} assigned to ${driver.display_name}.`);
      const refresh=await fetch(`${apiBase.replace(/\/$/,'')}/api/deliveries`,{headers:{Authorization:`Bearer ${apiToken}`}});
      const data=await refresh.json();
      if(refresh.ok){setDeliveries(data.deliveries||[]);setDeliveryDrivers(data.drivers||[]);}
    }catch(error){flash(error instanceof Error?error.message:'Delivery assignment failed.');}
  };
  const updateDeliveryStatus = async (delivery:DeliveryRecord,status:'Picked Up'|'Delivered'|'Failed') => {
    if(!apiToken)return;
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/deliveries/${delivery.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({status})});
      const result=await response.json();
      if(!response.ok||!result.delivery)throw new Error(result.error||'Delivery status update failed.');
      setDeliveries(current=>current.map(item=>item.id===delivery.id?{...item,...result.delivery,order_number:item.order_number,customer_name:item.customer_name,customer_phone:item.customer_phone,total:item.total,order_created_at:item.order_created_at,driver_name:item.driver_name}:item));
      if(status==='Delivered')setOrders(current=>current.map(order=>order.id===delivery.order_id?{...order,status:'Completed'}:order));
      flash(`Delivery marked ${status.toLowerCase()}.`);
    }catch(error){flash(error instanceof Error?error.message:'Delivery update failed.');}
  };
  const deliveryView = (): ReactNode => {
    const homeOrders=orders.filter(order=>order.type==='Home Delivery');
    const active=deliveries.filter(item=>!['Delivered','Failed'].includes(item.status));
    const history=deliveries.filter(item=>['Delivered','Failed'].includes(item.status));
    return <div className="space-y-4">
      <section className={`${panel} p-5`}>
        <div className="mb-5">{heading('Dispatch operations','Delivery Management','Assign home delivery orders to branch delivery staff and track dispatch progress.')}</div>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[{label:'Awaiting dispatch',value:homeOrders.filter(order=>!deliveries.some(item=>item.order_id===order.id)).length},{label:'Assigned / picked up',value:active.length},{label:'Delivered',value:deliveries.filter(item=>item.status==='Delivered').length},{label:'Available drivers',value:deliveryDrivers.length}].map(item=><div key={item.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="text-[10px] text-slate-400">{item.label}</div><div className="mt-1 text-xl font-semibold text-white">{item.value}</div></div>)}</div>
        <h3 className="mb-3 text-sm font-semibold text-white">Home delivery orders</h3>
        <div className="space-y-2">{homeOrders.map(order=>{const delivery=deliveries.find(item=>item.order_id===order.id);return <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div><div className="font-semibold text-white">Order #{order.number} · {order.customerName}</div><div className="mt-1 text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()} · {currency(order.total)} · {delivery?delivery.driver_name:'Not assigned'}</div>{delivery?.delivery_address&&<div className="mt-1 text-xs text-slate-500">{delivery.delivery_address}</div>}</div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/[.06] px-2.5 py-1 text-xs text-slate-300">{delivery?.status||'Awaiting dispatch'}</span>{!delivery||['Failed','Delivered'].includes(delivery.status)?<button onClick={()=>assignDelivery(order)} className="rounded-lg bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">{delivery?'Reassign':'Assign driver'}</button>:delivery.status==='Assigned'?<button onClick={()=>updateDeliveryStatus(delivery,'Picked Up')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Mark picked up</button>:delivery.status==='Picked Up'?<button onClick={()=>updateDeliveryStatus(delivery,'Delivered')} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs text-emerald-300">Mark delivered</button>:null}</div></article>;})}{!homeOrders.length&&<p className="py-10 text-center text-sm text-slate-500">No home delivery orders found.</p>}</div>
      </section>
      {history.length>0&&<section className={`${panel} p-5`}><h3 className="mb-3 text-sm font-semibold text-white">Delivery history</h3><div className="space-y-2">{history.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.06] py-3 text-sm"><span className="text-slate-300">Order #{item.order_number} · {item.customer_name} · {item.driver_name}</span><span className="text-xs text-slate-500">{item.status}</span></div>)}</div></section>}
      <p className="text-xs text-slate-500">{apiConnected?'Dispatch records and driver assignments are stored in the branch database.':'Connect the backend to dispatch orders across POS terminals.'} Add staff with the Delivery role in employee setup before assigning drivers.</p>
    </div>;
  };

  const addRestaurantTable = async () => {
    if (!apiConnected || !apiToken) { flash('Connect the POS API before creating shared restaurant tables.'); return; }
    const tableNumber=window.prompt('Table number or label (for example, T-01)')?.trim();
    if(!tableNumber)return;
    const seats=Number(window.prompt('Number of seats','2'));
    if(!Number.isInteger(seats)||seats<1||seats>30){flash('Seats must be between 1 and 30.');return;}
    const notes=(window.prompt('Table notes (optional)')||'').trim();
    try {
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/tables`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({tableNumber,seats,notes})});
      const result=await response.json();
      if(!response.ok||!result.table)throw new Error(result.error||'Table could not be created.');
      const item=result.table;
      setRestaurantTables(current=>[...current,{id:item.id,tableNumber:item.table_number,seats:Number(item.seats),status:item.status,notes:item.notes||'',createdAt:item.created_at,updatedAt:item.updated_at}].sort((a,b)=>a.tableNumber.localeCompare(b.tableNumber,undefined,{numeric:true})));
      flash('Restaurant table saved to the branch database.');
    } catch(error){flash(error instanceof Error?error.message:'Table creation failed.');}
  };
  const setRestaurantTableStatus = async (table:TableRecord,status:TableRecord['status']) => {
    if(!apiConnected||!apiToken){flash('Connect the POS API to update shared table status.');return;}
    try {
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/tables/${table.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({status})});
      const result=await response.json();
      if(!response.ok||!result.table)throw new Error(result.error||'Table status could not be updated.');
      const item=result.table;
      setRestaurantTables(current=>current.map(row=>row.id===table.id?{...row,status:item.status,notes:item.notes||'',updatedAt:item.updated_at}:row));
      flash(`${table.tableNumber} marked ${status.toLowerCase()}.`);
    } catch(error){flash(error instanceof Error?error.message:'Table update failed.');}
  };
  const tablesView = (): ReactNode => {
    const counts=['Available','Occupied','Reserved','Cleaning','Out of Service'].map(status=>({status,count:restaurantTables.filter(table=>table.status===status).length}));
    const statusStyles:Record<TableRecord['status'],string>={'Available':'border-emerald-400/20 bg-emerald-400/10 text-emerald-300','Occupied':'border-rose-400/20 bg-rose-400/10 text-rose-300','Reserved':'border-sky-400/20 bg-sky-400/10 text-sky-300','Cleaning':'border-amber-400/20 bg-amber-400/10 text-amber-300','Out of Service':'border-slate-400/20 bg-slate-400/10 text-slate-400'};
    return <section className={`${panel} p-5`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Floor operations','Tables Management','Track table capacity and live service status for this branch.')}<button onClick={addRestaurantTable} disabled={!apiConnected} className="inline-flex items-center gap-2 rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b] disabled:cursor-not-allowed disabled:opacity-40"><Plus size={15}/> Add table</button></div>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{counts.map(item=><div key={item.status} className="rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="text-[10px] text-slate-400">{item.status}</div><div className="mt-1 text-xl font-semibold text-white">{item.count}</div></div>)}</div>
      {restaurantTables.length?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{restaurantTables.slice().sort((a,b)=>a.tableNumber.localeCompare(b.tableNumber,undefined,{numeric:true})).map(table=><article key={table.id} className="rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-semibold text-white">{table.tableNumber}</div><div className="mt-1 text-xs text-slate-400">{table.seats} seats</div></div><span className={`rounded-full border px-2.5 py-1 text-[10px] ${statusStyles[table.status]}`}>{table.status}</span></div>{table.notes&&<p className="mt-3 text-xs text-slate-500">{table.notes}</p>}<label className="mt-4 block text-[10px] uppercase tracking-wider text-slate-500">Update status</label><select aria-label={`Status for ${table.tableNumber}`} value={table.status} onChange={event=>setRestaurantTableStatus(table,event.target.value as TableRecord['status'])} className="field mt-1 w-full"><option>Available</option><option>Occupied</option><option>Reserved</option><option>Cleaning</option><option>Out of Service</option></select></article>)}</div>:<div className="rounded-xl border border-dashed border-white/10 py-14 text-center"><Table2 size={30} className="mx-auto text-slate-600"/><p className="mt-3 text-sm text-slate-400">No restaurant tables have been configured.</p><p className="mt-1 text-xs text-slate-600">Add each table with its number and seating capacity.</p></div>}
      <p className="mt-4 text-xs text-slate-500">{apiConnected?'Table configuration and status are stored in the connected branch database.':'Connect the backend to manage tables across POS terminals.'} Table assignment to orders is not yet part of this module.</p>
    </section>;
  };

  const addReservation = async () => {
    const guestName = window.prompt('Guest name')?.trim();
    if (!guestName) return;
    const phone = (window.prompt('Phone number') || '').trim();
    const partySize = Number(window.prompt('Party size', '2'));
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 30) { flash('Party size must be between 1 and 30.'); return; }
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    defaultTime.setMinutes(Math.ceil(defaultTime.getMinutes() / 15) * 15, 0, 0);
    const localDefault = new Date(defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    const timeInput = window.prompt('Reservation date and time (YYYY-MM-DDTHH:mm)', localDefault);
    if (!timeInput) return;
    const reservedFor = new Date(timeInput);
    if (Number.isNaN(reservedFor.getTime()) || reservedFor.getTime() < Date.now() - 60000) { flash('Enter a valid future reservation time.'); return; }
    const notes = (window.prompt('Reservation notes (optional)') || '').trim();
    const payload = {guestName,phone,partySize,reservedFor:reservedFor.toISOString(),notes};
    if (apiToken && apiConnected) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/reservations`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify(payload)});
        const result = await response.json();
        if (!response.ok || !result.reservation) throw new Error(result.error || 'Reservation could not be saved.');
        const item=result.reservation;
        setReservations(current=>[{id:item.id,guestName:item.guest_name,phone:item.phone,partySize:Number(item.party_size),reservedFor:item.reserved_for,status:item.status,notes:item.notes||'',createdAt:item.created_at},...current]);
        flash('Reservation saved to branch database.'); return;
      } catch(error) { flash(error instanceof Error?error.message:'Reservation save failed.'); return; }
    }
    setReservations(current=>[{id:`local-reservation-${Date.now()}`,...payload,status:'Booked',createdAt:new Date().toISOString()},...current]);
    flash('Reservation saved on this device only. Connect the API to share it across devices.');
  };
  const updateReservationStatus = async (reservation:ReservationRecord,status:ReservationRecord['status']) => {
    if (apiToken && apiConnected && !reservation.id.startsWith('local-')) {
      try {
        const response=await fetch(`${apiBase.replace(/\/$/, '')}/api/reservations/${reservation.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({status})});
        const result=await response.json();
        if(!response.ok) throw new Error(result.error||'Reservation status could not be updated.');
      } catch(error) { flash(error instanceof Error?error.message:'Reservation update failed.'); return; }
    }
    setReservations(current=>current.map(item=>item.id===reservation.id?{...item,status}:item));
    flash(`Reservation marked ${status.toLowerCase()}.`);
  };
  const reservationsView = (): ReactNode => {
    const upcoming=reservations.filter(item=>item.status==='Booked'||item.status==='Seated').sort((a,b)=>a.reservedFor.localeCompare(b.reservedFor));
    const history=reservations.filter(item=>!['Booked','Seated'].includes(item.status)).sort((a,b)=>b.reservedFor.localeCompare(a.reservedFor));
    return <div className="space-y-4">
      <section className={`${panel} p-5`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Guest service','Reservations','Schedule guests, track seating and close completed or cancelled bookings.')}<button onClick={addReservation} className="inline-flex items-center gap-2 rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={15}/> New reservation</button></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:'Upcoming',value:upcoming.length},{label:'Seated now',value:reservations.filter(item=>item.status==='Seated').length},{label:'Today',value:reservations.filter(item=>item.reservedFor.slice(0,10)===localDate()&&item.status!=='Cancelled').length}].map(item=><div key={item.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{item.label}</div><div className="mt-2 text-xl font-semibold text-white">{item.value}</div></div>)}</div>
        <div className="space-y-3">{upcoming.map(item=><article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div className="min-w-0"><div className="font-semibold text-white">{item.guestName} <span className="ml-2 text-xs font-normal text-slate-400">{item.partySize} guests</span></div><div className="mt-1 text-xs text-slate-400">{new Date(item.reservedFor).toLocaleString()} {item.phone&&` · ${item.phone}`}</div>{item.notes&&<div className="mt-1 text-xs text-slate-500">{item.notes}</div>}</div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">{item.status}</span>{item.status==='Booked'&&<button onClick={()=>updateReservationStatus(item,'Seated')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Seat guest</button>}{item.status==='Seated'&&<button onClick={()=>updateReservationStatus(item,'Completed')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Complete</button>}<button onClick={()=>updateReservationStatus(item,'Cancelled')} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300">Cancel</button></div></article>)}{!upcoming.length&&<p className="py-10 text-center text-sm text-slate-500">No upcoming reservations.</p>}</div>
      </section>
      {history.length>0&&<section className={`${panel} p-5`}><h2 className="mb-4 font-semibold text-white">Reservation history</h2><div className="space-y-2">{history.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.06] py-3 text-sm"><span className="text-slate-300">{item.guestName} · {item.partySize} guests · {new Date(item.reservedFor).toLocaleString()}</span><span className="text-xs text-slate-500">{item.status}</span></div>)}</div></section>}
      <p className="text-xs text-slate-500">{apiConnected?'Reservations are stored in the connected branch database.':'Offline mode: new reservations are stored on this device and are not shared with other terminals.'}</p>
    </div>;
  };

  const addSupplier = async () => {
    const name = window.prompt('Supplier name')?.trim();
    if (!name) return;
    const phone = (window.prompt('Supplier phone number') || '').trim();
    const category = (window.prompt('Supplier category', 'General') || 'General').trim();
    if (apiToken && apiConnected) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/suppliers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` }, body: JSON.stringify({ name, phone, category }) });
        const result = await response.json();
        if (!response.ok || !result.supplier) throw new Error(result.error || 'Supplier could not be saved.');
        const saved = result.supplier;
        setSuppliers(current => [{ id: saved.id, name: saved.name, phone: saved.phone || '', category: saved.category || 'General', due: Number(saved.payable || 0) }, ...current]);
        flash('Supplier saved to database.');
        return;
      } catch (error) { flash(error instanceof Error ? error.message : 'Supplier save failed.'); return; }
    }
    setSuppliers(current => [{ id: `local-supplier-${Date.now()}`, name, phone, category, due: 0 }, ...current]);
    flash('Supplier added to this device only. Connect the API to save across devices.');
  };
  const editSupplier = async (supplier: Supplier) => {
    const name = window.prompt('Supplier name', supplier.name);
    if (name === null || !name.trim()) return;
    const phone = window.prompt('Supplier phone number', supplier.phone);
    if (phone === null) return;
    const category = window.prompt('Supplier category', supplier.category);
    if (category === null) return;
    const changes = { name: name.trim(), phone: phone.trim(), category: category.trim() || 'General' };
    if (apiToken && apiConnected) {
      try {
        const response = await fetch(apiBase.replace(/\/$/, '') + '/api/suppliers/' + encodeURIComponent(supplier.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiToken }, body: JSON.stringify(changes) });
        const result = await response.json();
        if (!response.ok || !result.supplier) throw new Error(result.error || 'Supplier could not be updated.');
        const saved = result.supplier;
        setSuppliers(current => current.map(entry => entry.id === supplier.id ? { id: saved.id, name: saved.name, phone: saved.phone || '', category: saved.category || 'General', due: Number(saved.payable ?? entry.due) } : entry));
        flash('Supplier updated in database.');
        return;
      } catch (error) { flash(error instanceof Error ? error.message : 'Supplier update failed.'); return; }
    }
    setSuppliers(current => current.map(entry => entry.id === supplier.id ? { ...entry, ...changes } : entry));
    flash('Supplier updated on this device only.');
  };
  const paySupplier = async (supplier: Supplier) => {
    if (!apiToken || !apiConnected) { flash('Connect the POS API before recording a supplier payment.'); return; }
    if (supplier.due <= 0) { flash('This supplier has no outstanding balance.'); return; }
    const amount = Number(window.prompt(`Outstanding balance: ${currency(supplier.due)}\nPayment amount (SAR)`, String(supplier.due)));
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (amount > supplier.due) { flash('Payment cannot exceed the outstanding balance.'); return; }
    const method = (window.prompt('Payment method: Cash or Mada', 'Cash') || '').trim();
    if (!['Cash', 'Mada'].includes(method)) { flash('Choose Cash or Mada.'); return; }
    const note = (window.prompt('Payment note (optional)') || '').trim();
    let paymentSaved = false;
    try {
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/suppliers/${encodeURIComponent(supplier.id)}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` }, body: JSON.stringify({ amount, method, note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Supplier payment failed.');
      paymentSaved = true;
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Supplier payment failed.');
      return;
    }
    try {
      const refresh = await fetch(`${apiBase.replace(/\/$/, '')}/api/suppliers`, { headers: { Authorization: `Bearer ${apiToken}` } });
      const data = await refresh.json();
      if (!refresh.ok || !Array.isArray(data.suppliers)) throw new Error(data.error || 'Balance refresh failed.');
      setSuppliers(data.suppliers.map((saved: {id:string;name:string;phone?:string;category?:string;payable:string|number}) => ({ id: saved.id, name: saved.name, phone: saved.phone || '', category: saved.category || 'General', due: Number(saved.payable) })));
      flash(`Supplier payment of ${currency(amount)} recorded by ${method}.`);
    } catch {
      if (paymentSaved) flash('Supplier payment was recorded. Balance refresh failed; reconnect to reload the current balance.');
    }
  };
  const suppliersView = (): ReactNode => {
    const outstanding = suppliers.reduce((sum,supplier)=>sum+Math.max(0,supplier.due),0);
    const withBalance = suppliers.filter(supplier=>supplier.due>0).length;
    const supplierInventory = (supplier:Supplier) => inventory.filter(item=>item.supplier===supplier.name).length;
    return <div className="space-y-4">
      <section className={`${panel} p-5`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Stock procurement','Supplier directory','Maintain supplier contacts, monitor outstanding purchase balances and record supplier payments.') }<button onClick={()=>void addSupplier()} className="inline-flex items-center gap-2 rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={14}/> Add supplier</button></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[{label:'Total suppliers',value:String(suppliers.length)},{label:'Suppliers with balance',value:String(withBalance)},{label:'Outstanding payable',value:currency(outstanding)}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{card.value}</div></div>)}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.slice().sort((a,b)=>b.due-a.due||a.name.localeCompare(b.name)).map(supplier=><article key={supplier.id} className="rounded-2xl border border-white/[.07] bg-[#191e24] p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-white">{supplier.name}</h3><p className="mt-1 text-xs text-slate-500">{supplier.category||'General'} · {supplierInventory(supplier)} linked stock items</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${supplier.due>0?'bg-amber-300/10 text-amber-200':'bg-emerald-300/10 text-emerald-200'}`}>{supplier.due>0?'Balance due':'Settled'}</span></div>
            <div className="mt-4 space-y-1 text-xs text-slate-400"><div>{supplier.phone||'No phone recorded'}</div><div>Supplier ID: <span className="text-slate-500">{supplier.id.slice(0,8)}</span></div></div>
            <div className="mt-4 flex items-end justify-between border-t border-white/[.06] pt-3"><div><div className="text-[10px] uppercase tracking-wider text-slate-500">Outstanding</div><div className="mt-1 text-lg font-semibold text-white">{currency(Math.max(0,supplier.due))}</div></div><div className="flex gap-2"><button onClick={()=>void editSupplier(supplier)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Edit</button><button onClick={()=>void paySupplier(supplier)} disabled={!apiConnected||supplier.due<=0} className="rounded-lg border border-[#e7b943]/30 px-3 py-2 text-xs font-semibold text-[#e7b943] disabled:cursor-not-allowed disabled:opacity-35">Pay balance</button></div></div>
          </article>)}
        </div>
        {!suppliers.length&&<div className="rounded-xl border border-dashed border-white/10 py-12 text-center"><BriefcaseBusiness size={28} className="mx-auto mb-3 text-slate-600"/><p className="text-sm text-slate-400">No suppliers added yet.</p><p className="mt-1 text-xs text-slate-600">Add suppliers before recording inventory purchases.</p></div>}
      </section>
      {!apiConnected&&<p className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs text-amber-100/70">Supplier records are stored on this device in demo mode. Connect the PostgreSQL backend to record supplier payments and share balances across devices.</p>}
    </div>;
  };
  const addPurchase = async () => {
    if (!inventory.length || !suppliers.length) { flash('Add at least one inventory item and supplier first.'); return; }
    const itemOptions = inventory.map((item, index) => `${index + 1}. ${item.name} (${item.trackStock ? `${item.stock} ${item.unit}` : 'Unlimited'})`).join('\n');
    const itemChoice = Number(window.prompt(`Select inventory item by number:\n${itemOptions}`, '1'));
    if (!Number.isInteger(itemChoice) || itemChoice < 1 || itemChoice > inventory.length) { flash('Select a valid inventory item.'); return; }
    const item = inventory[itemChoice - 1];
    const supplierOptions = suppliers.map((supplier, index) => `${index + 1}. ${supplier.name}`).join('\n');
    const supplierChoice = Number(window.prompt(`Select supplier by number:\n${supplierOptions}`, String(Math.max(1, suppliers.findIndex(supplier => supplier.name === item.supplier) + 1))));
    if (!Number.isInteger(supplierChoice) || supplierChoice < 1 || supplierChoice > suppliers.length) { flash('Select a valid supplier.'); return; }
    const supplier = suppliers[supplierChoice - 1];
    const quantity = Number(window.prompt(`Quantity received (${item.unit})`, '1'));
    const unitCost = Number(window.prompt('Unit cost (SAR)', String(item.cost || 0)));
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) { flash('Quantity and unit cost must be greater than zero.'); return; }
    const total = quantity * unitCost;
    const paid = Number(window.prompt(`Initial payment amount (SAR, 0–${total.toFixed(2)})`, total.toFixed(2)));
    if (!Number.isFinite(paid) || paid < 0 || paid > total) { flash('Initial payment must be between zero and the purchase total.'); return; }
    const paymentStatus: PurchaseRecord['paymentStatus'] = paid >= total ? 'Paid' : paid > 0 ? 'Part-paid' : 'Credit';
    let paymentMethod: PaymentMethod | undefined;
    if (paid > 0) {
      const method = (window.prompt('Payment method: Cash or Mada', 'Cash') || '').trim();
      if (!['Cash', 'Mada'].includes(method)) { flash('Payment method must be Cash or Mada.'); return; }
      paymentMethod = method as PaymentMethod;
    }
    const date = window.prompt('Purchase date (YYYY-MM-DD)', localDate()) || localDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime()) || localDate(new Date(`${date}T00:00:00`)) !== date) { flash('Enter a valid purchase date.'); return; }
    const purchase: PurchaseRecord = { id: `purchase-${Date.now()}`, date, supplierId: supplier.id, supplierName: supplier.name, inventoryId: item.id, itemName: item.name, quantity, unit: item.unit, unitCost, total, paid, paymentStatus, paymentMethod, createdAt: new Date().toISOString() };
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/purchases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
          body: JSON.stringify({
            supplierId: supplier.id,
            invoiceNumber: `POS-${Date.now()}`,
            paid: purchase.paid,
            paymentMethod: paymentMethod || 'Cash',
            items: [{ ingredientId: item.id, quantity, unitCost }]
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Purchase could not be saved to the database.');
        purchase.id = result.purchase.id;
      } catch (error) {
        flash(error instanceof Error ? error.message : 'Purchase was not saved to the server.');
        return;
      }
    }
    setInventory(current => current.map(entry => entry.id === item.id ? { ...entry, stock: entry.stock + quantity, trackStock: true, cost: unitCost, supplier: supplier.name } : entry));
    if (purchase.total > purchase.paid) setSuppliers(current => current.map(entry => entry.id === supplier.id ? { ...entry, due: entry.due + purchase.total - purchase.paid } : entry));
    setPurchases(current => [purchase, ...current]);
    setLogs(current => [{ id: `purchase-log-${Date.now()}`, title: 'Stock purchase received', detail: `${item.name} · +${quantity} ${item.unit} · ${currency(purchase.total)} · ${supplier.name} · ${paymentStatus}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(apiConnected ? `Purchase saved to database. ${quantity} ${item.unit} added to inventory.` : `Purchase saved locally. ${quantity} ${item.unit} added to inventory.`);
  };
  const deletePurchase = async (purchase: PurchaseRecord) => {
    if (!window.confirm(`Reverse purchase of ${purchase.quantity} ${purchase.unit} ${purchase.itemName}? Any amount already paid will be recorded as a supplier refund.`)) return;
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/purchases/${encodeURIComponent(purchase.id)}/reverse`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Purchase could not be reversed.');
        if (Array.isArray(result.inventory)) setInventory(current => current.map(entry => {
          const saved = result.inventory.find((item: { id: string }) => item.id === entry.id);
          return saved ? { ...entry, stock: Number(saved.stock), trackStock: Boolean(saved.trackStock), cost: Number(saved.unitCost), supplier: saved.supplier || '—' } : entry;
        }));
        if (result.supplier) setSuppliers(current => current.map(entry => entry.id === result.supplier.id ? { ...entry, due: Number(result.supplier.payable) } : entry));
      } catch (error) {
        flash(error instanceof Error ? error.message : 'Purchase reversal failed. No local changes were made.');
        return;
      }
    } else {
      const item = inventory.find(entry => entry.id === purchase.inventoryId);
      if (!item || item.stock < purchase.quantity) { flash('Cannot reverse this purchase: current stock is lower than the received quantity.'); return; }
      setInventory(current => current.map(entry => entry.id === purchase.inventoryId ? { ...entry, stock: Math.max(0, entry.stock - purchase.quantity) } : entry));
      if (purchase.total > purchase.paid) setSuppliers(current => current.map(entry => entry.id === purchase.supplierId ? { ...entry, due: Math.max(0, entry.due - (purchase.total - purchase.paid)) } : entry));
    }
    setPurchases(current => current.filter(entry => entry.id !== purchase.id));
    setLogs(current => [{ id: `purchase-delete-${Date.now()}`, title: 'Stock purchase reversed', detail: `${purchase.itemName} · -${purchase.quantity} ${purchase.unit} · ${currency(purchase.total)}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(apiConnected ? 'Purchase reversed in the database; stock and supplier balances updated.' : 'Local purchase reversed and stock adjusted.');
  };
  const purchasesView = (): ReactNode => {
    const today = localDate();
    const month = today.slice(0, 7);
    const todayTotal = purchases.filter(item => item.date === today).reduce((sum, item) => sum + item.total, 0);
    const monthTotal = purchases.filter(item => item.date.startsWith(month)).reduce((sum, item) => sum + item.total, 0);
    const creditTotal = purchases.reduce((sum, item) => sum + Math.max(0, item.total - item.paid), 0);
    return <section className={`${panel} p-5`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Stock procurement','Purchase management','Record received goods, update inventory and track supplier credit. Connected records sync with the branch database.')}<button onClick={addPurchase} className="inline-flex items-center gap-2 rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={15}/> Record purchase</button></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:'Today',value:todayTotal},{label:'This month',value:monthTotal},{label:'Supplier balance due',value:creditTotal}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{currency(card.value)}</div></div>)}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Date</th><th className="pb-3">Item</th><th className="pb-3">Supplier</th><th className="pb-3">Quantity</th><th className="pb-3">Unit cost</th><th className="pb-3">Total</th><th className="pb-3">Payment</th><th className="pb-3"/></tr></thead><tbody>{purchases.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).map(item=><tr key={item.id} className="border-t border-white/[.06]"><td className="py-3 text-slate-400">{item.date}</td><td className="py-3 font-medium text-white">{item.itemName}</td><td className="py-3 text-slate-400">{item.supplierName}</td><td className="py-3 text-slate-300">{item.quantity} {item.unit}</td><td className="py-3 text-slate-400">{currency(item.unitCost)}</td><td className="py-3 font-semibold text-white">{currency(item.total)}</td><td className="py-3 text-slate-400">{item.paymentStatus}{item.paymentMethod ? ` · ${item.paymentMethod}` : ''} · Due ${currency(Math.max(0,item.total-item.paid))}</td><td className="py-3 text-right"><button onClick={()=>deletePurchase(item)} className="rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-xs text-rose-300">Reverse</button></td></tr>)}</tbody></table>{!purchases.length&&<p className="py-10 text-center text-sm text-slate-500">No purchases recorded yet. Record a purchase to receive stock.</p>}</div>
    </section>;
  };
  const addEmployee = async () => {
    const name = window.prompt('Employee name');
    if (!name?.trim()) return;
    const role = window.prompt('Job role', 'Staff') || 'Staff';
    const shift = window.prompt('Shift', 'Morning') || 'Morning';
    const salary = Number(window.prompt('Monthly salary (SAR)', '2500'));
    if (!Number.isFinite(salary) || salary < 0) { flash('Enter a valid salary amount.'); return; }
    let employee: Employee = { id: `emp-${Date.now()}`, name: name.trim(), role: role.trim(), shift: shift.trim(), status: 'Present', salary, advance: 0 };
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/employees`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({name:employee.name,role:employee.role,shift:employee.shift,salary:employee.salary}) });
        const result = await response.json();
        if (!response.ok || !result.employee) throw new Error(result.error || 'Employee could not be saved.');
        employee = {...employee,...result.employee,salary:Number(result.employee.salary),advance:Number(result.employee.advance||0)};
      } catch(error) { flash(error instanceof Error ? error.message : 'Employee was not saved.'); return; }
    }
    setEmployees(current => [employee, ...current]);
    setLogs(current => [{ id: `employee-${Date.now()}`, title: 'Employee added', detail: `${employee.name} · ${employee.role}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(apiConnected ? 'Employee saved to PostgreSQL.' : 'Employee added.');
  };
  const editEmployee = async (employee: Employee) => {
    const name = window.prompt('Employee name', employee.name);
    if (!name?.trim()) return;
    const role = window.prompt('Job role', employee.role);
    const shift = window.prompt('Shift', employee.shift);
    const salary = Number(window.prompt('Monthly salary (SAR)', String(employee.salary)));
    if (!Number.isFinite(salary) || salary < 0) { flash('Enter a valid salary amount.'); return; }
    const updated = { ...employee, name:name.trim(), role:role?.trim() || employee.role, shift:shift?.trim() || employee.shift, salary };
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/employees/${encodeURIComponent(employee.id)}`, { method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({name:updated.name,role:updated.role,shift:updated.shift,salary:updated.salary}) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Employee could not be updated.');
      } catch(error) { flash(error instanceof Error ? error.message : 'Employee was not updated.'); return; }
    }
    setEmployees(current => current.map(item => item.id === employee.id ? updated : item));
    setLogs(current => [{ id: `employee-edit-${Date.now()}`, title: 'Employee details updated', detail: name.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(apiConnected ? 'Employee updated in PostgreSQL.' : 'Employee details updated.');
  };
  const updateAttendance = async (employee: Employee) => {
    const statuses: Employee['status'][] = ['Present', 'Absent', 'On Leave'];
    const next = statuses[(statuses.indexOf(employee.status) + 1) % statuses.length];
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/attendance`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({employeeId:employee.id,date:localDate(),status:next}) });
        const result = await response.json();
        if (!response.ok || !result.attendance) throw new Error(result.error || 'Attendance was not saved.');
      } catch(error) { flash(error instanceof Error ? error.message : 'Attendance was not saved.'); return; }
    }
    setEmployees(current => current.map(item => item.id === employee.id ? { ...item, status: next } : item));
    setLogs(current => [{ id: `attendance-${Date.now()}`, title: 'Attendance updated', detail: `${employee.name} · ${next}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
  };
  const employeesView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5 flex items-end justify-between gap-3">{heading('Team operations','Employee management','Maintain staff profiles, shifts and attendance status.') }{canManageTeam&&<button onClick={addEmployee} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">Add employee</button>}</div>
    <div className="mb-4 grid grid-cols-3 gap-2">{[{label:'Present',count:employees.filter(item=>item.status==='Present').length},{label:'Absent',count:employees.filter(item=>item.status==='Absent').length},{label:'On leave',count:employees.filter(item=>item.status==='On Leave').length}].map(item=><div key={item.label} className="rounded-xl bg-white/[.035] p-3"><div className="text-xs text-slate-400">{item.label}</div><div className="mt-1 text-xl font-semibold text-white">{item.count}</div></div>)}</div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{employees.map(employee=><article key={employee.id} className="rounded-2xl border border-white/[.07] bg-[#191e24] p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{employee.name}</h3><p className="mt-1 text-xs text-slate-400">{employee.role} · {employee.shift}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${employee.status==='Present'?'bg-emerald-400/10 text-emerald-300':employee.status==='Absent'?'bg-rose-400/10 text-rose-300':'bg-amber-400/10 text-amber-200'}`}>{employee.status}</span></div><div className="mt-4 border-t border-white/[.06] pt-3 text-sm"><div className="flex justify-between text-slate-400"><span>Monthly salary</span><strong className="text-white">{currency(employee.salary)}</strong></div><div className="mt-2 flex justify-between text-slate-400"><span>Advance recorded</span><strong className="text-white">{currency(employee.advance)}</strong></div></div><div className="mt-4 flex gap-2">{canManageTeam&&<><button onClick={()=>editEmployee(employee)} className="flex-1 rounded-lg border border-white/10 px-2 py-2 text-xs text-slate-300">Edit profile</button><button onClick={()=>updateAttendance(employee)} className="flex-1 rounded-lg border border-[#e7b943]/30 px-2 py-2 text-xs text-[#e7b943]">Update attendance</button></>}</div></article>)}</div>
  </section>;
  const attendanceView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5">{heading('Daily operations','Staff attendance','Cycle each employee through Present, Absent and On Leave. Attendance is stored in the branch database when connected.')}</div>
    <div className="space-y-2">{employees.map(employee=><div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[.035] p-3"><div><div className="text-sm font-medium text-white">{employee.name}</div><div className="mt-1 text-xs text-slate-500">{employee.role} · {employee.shift}</div></div><div className="flex items-center gap-2"><span className="text-xs text-slate-400">{employee.status}</span>{canManageTeam&&<button onClick={()=>updateAttendance(employee)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200">Change status</button>}</div></div>)}</div>
  </section>;
  const recordSalaryAdvance = async (employee: Employee) => {
    const amount = Number(window.prompt(`Advance amount for ${employee.name} (SAR)`, '0'));
    if (!Number.isFinite(amount) || amount <= 0) { flash('Enter an advance greater than zero.'); return; }
    const note = window.prompt('Advance note (optional)', 'Salary advance') || 'Salary advance';
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/employees/${encodeURIComponent(employee.id)}/advances`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({amount,note}) });
        const result = await response.json();
        if (!response.ok || !result.advance) throw new Error(result.error || 'Advance was not saved.');
      } catch(error) { flash(error instanceof Error ? error.message : 'Advance was not saved.'); return; }
    }
    setEmployees(current => current.map(item => item.id === employee.id ? { ...item, advance: item.advance + amount } : item));
    setLogs(current => [{ id: `advance-${Date.now()}`, title: 'Salary advance recorded', detail: `${employee.name} · ${currency(amount)} · ${note}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(apiConnected ? `Advance saved to PostgreSQL for ${employee.name}.` : `Advance recorded for ${employee.name}.`);
  };
  const createPayroll = async () => {
    if (!employees.length) { flash('Add an employee before creating payroll.'); return; }
    const period = window.prompt('Payroll month (YYYY-MM)', localDate().slice(0, 7)) || '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) { flash('Enter a valid payroll month in YYYY-MM format.'); return; }
    const employeeOptions = employees.map((employee, index) => `${index + 1}. ${employee.name} · ${currency(employee.salary)}`).join('\n');
    const choice = Number(window.prompt(`Select employee:\n${employeeOptions}`, '1'));
    if (!Number.isInteger(choice) || choice < 1 || choice > employees.length) { flash('Select a valid employee.'); return; }
    const employee = employees[choice - 1];
    if (payroll.some(item => item.employeeId === employee.id && item.period === period)) { flash('Payroll already exists for this employee and month.'); return; }
    const bonus = Number(window.prompt('Bonus (SAR)', '0'));
    if (!Number.isFinite(bonus) || bonus < 0) { flash('Enter a valid bonus amount.'); return; }
    const deduction = Number(window.prompt('Other deduction (SAR)', '0'));
    if (!Number.isFinite(deduction) || deduction < 0 || deduction > employee.salary + bonus) { flash('Enter a valid deduction amount.'); return; }
    const advanceDeduction = Number(window.prompt(`Outstanding advance: ${currency(employee.advance)}. Deduct how much?`, String(Math.min(employee.advance, employee.salary + bonus - deduction))));
    if (!Number.isFinite(advanceDeduction) || advanceDeduction < 0 || advanceDeduction > employee.advance || deduction + advanceDeduction > employee.salary + bonus) { flash('Total deductions exceed the available salary.'); return; }
    const netSalary = employee.salary + bonus - deduction - advanceDeduction;
    const record: PayrollRecord = { id: `payroll-${employee.id}-${period}`, employeeId: employee.id, employeeName: employee.name, period, baseSalary: employee.salary, bonus, deduction, advanceDeduction, netSalary, payments: [], createdAt: new Date().toISOString() };
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/payroll`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({employeeId:employee.id,period,bonus,deduction,advanceDeduction}) });
        const result = await response.json();
        if (!response.ok || !result.payroll) throw new Error(result.error || 'Payroll could not be created.');
        record.id = result.payroll.id; record.createdAt = result.payroll.createdAt;
      } catch(error) { flash(error instanceof Error ? error.message : 'Payroll was not saved.'); return; }
    }
    setPayroll(current => [record, ...current]);
    if (advanceDeduction > 0) setEmployees(current => current.map(item => item.id === employee.id ? { ...item, advance: item.advance - advanceDeduction } : item));
    setLogs(current => [{ id: `payroll-create-${Date.now()}`, title: 'Payroll created', detail: `${employee.name} · ${period} · Net ${currency(netSalary)} · Other deduction ${currency(deduction)} · Advance deduction ${currency(advanceDeduction)}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(`Payroll created for ${employee.name}.`);
  };
  const recordPayrollPayment = async (record: PayrollRecord) => {
    const paidSoFar = record.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = Math.max(0, record.netSalary - paidSoFar);
    if (remaining <= 0) { flash('This payroll is already fully paid.'); return; }
    const amount = Number(window.prompt(`Remaining salary: ${currency(remaining)}. Payment amount (SAR)`, String(remaining)));
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) { flash('Enter a payment amount within the remaining balance.'); return; }
    const method = (window.prompt('Payment method: Cash or Mada', 'Cash') || 'Cash').trim();
    if (!['Cash', 'Mada'].includes(method)) { flash('Payment method must be Cash or Mada.'); return; }
    let payment: PayrollPayment = { id: `salary-payment-${Date.now()}`, amount, paymentMethod: method as PaymentMethod, date: localDate(), createdAt: new Date().toISOString() };
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/payroll/${encodeURIComponent(record.id)}/payments`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({amount,method,date:localDate()}) });
        const result = await response.json();
        if (!response.ok || !result.payment) throw new Error(result.error || 'Salary payment was not saved.');
        payment = {id:result.payment.id,amount:Number(result.payment.amount),paymentMethod:result.payment.paymentMethod,date:result.payment.date,createdAt:result.payment.createdAt};
      } catch(error) { flash(error instanceof Error ? error.message : 'Salary payment was not saved.'); return; }
    }
    setPayroll(current => current.map(item => item.id === record.id ? { ...item, payments: [...item.payments, payment] } : item));
    setLogs(current => [{ id: `salary-payment-log-${Date.now()}`, title: 'Salary payment recorded', detail: `${record.employeeName} · ${record.period} · ${currency(amount)} · ${method}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(apiConnected ? 'Salary payment saved to PostgreSQL.' : 'Salary payment saved.');
  };
  const payrollView = (): ReactNode => {
    const totalDue = payroll.reduce((sum, item) => sum + Math.max(0, item.netSalary - item.payments.reduce((paid, payment) => paid + payment.amount, 0)), 0);
    const totalPaid = payroll.reduce((sum, item) => sum + item.payments.reduce((paid, payment) => paid + payment.amount, 0), 0);
    const month = localDate().slice(0, 7);
    const monthRecords = payroll.filter(item => item.period === month);
    return <div className="space-y-4">
      <section className={`${panel} p-5`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Finance & team','Salary & payroll','Create monthly salary records, track advances and record Cash or Mada payments. Connected mode stores team and payroll records in PostgreSQL.')}{canManageTeam&&<button onClick={createPayroll} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">Create payroll</button>}</div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:'This month payroll',value:monthRecords.reduce((sum,item)=>sum+item.netSalary,0)},{label:'Salary paid',value:totalPaid},{label:'Salary outstanding',value:totalDue}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{currency(card.value)}</div></div>)}</div>
        <div className="mb-5 space-y-2">{canManageTeam&&employees.map(employee=><div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[.035] p-3"><div><div className="text-sm font-medium text-white">{employee.name}</div><div className="mt-1 text-xs text-slate-500">Monthly salary {currency(employee.salary)} · Advance outstanding {currency(employee.advance)}</div></div><button onClick={()=>recordSalaryAdvance(employee)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Record advance</button></div>)}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Month</th><th className="pb-3">Employee</th><th className="pb-3 text-right">Net salary</th><th className="pb-3 text-right">Paid</th><th className="pb-3 text-right">Remaining</th><th className="pb-3">Status</th><th className="pb-3"/></tr></thead><tbody>{payroll.slice().sort((a,b)=>b.period.localeCompare(a.period)||a.employeeName.localeCompare(b.employeeName)).map(record=>{const paidAmount=record.payments.reduce((sum,payment)=>sum+payment.amount,0);const remaining=Math.max(0,record.netSalary-paidAmount);return <tr key={record.id} className="border-t border-white/[.06]"><td className="py-3 text-slate-400">{record.period}</td><td className="py-3 font-medium text-white">{record.employeeName}<div className="mt-1 text-[10px] text-slate-500">Base {currency(record.baseSalary)} · Bonus {currency(record.bonus)} · Other deduction {currency(record.deduction)} · Advance deduction {currency(record.advanceDeduction)}</div></td><td className="py-3 text-right text-white">{currency(record.netSalary)}</td><td className="py-3 text-right text-emerald-300">{currency(paidAmount)}</td><td className="py-3 text-right text-amber-200">{currency(remaining)}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[10px] ${remaining===0?'bg-emerald-400/10 text-emerald-300':paidAmount>0?'bg-amber-400/10 text-amber-200':'bg-white/[.06] text-slate-400'}`}>{remaining===0?'Paid':paidAmount>0?'Part-paid':'Unpaid'}</span></td><td className="py-3 text-right">{remaining>0&&<button onClick={()=>recordPayrollPayment(record)} className="rounded-lg border border-[#e7b943]/30 px-2.5 py-1.5 text-xs text-[#e7b943]">Pay salary</button>}</td></tr>})}</tbody></table>{!payroll.length&&<p className="py-10 text-center text-sm text-slate-500">No payroll records. Create a monthly payroll to begin.</p>}</div>
        {payroll.some(item=>item.payments.length>0)&&<div className="mt-5 border-t border-white/[.06] pt-4"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment history</h3><div className="space-y-2">{payroll.flatMap(record=>record.payments.map(payment=>({record,payment}))).sort((a,b)=>b.payment.createdAt.localeCompare(a.payment.createdAt)).map(({record,payment})=><div key={payment.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/[.03] px-3 py-2 text-xs"><span className="text-slate-300">{record.employeeName} · {record.period} · {payment.paymentMethod}</span><span className="text-white">{payment.date} · {currency(payment.amount)}</span></div>)}</div></div>}
      </section>
    </div>;
  };
  const addExpense = async () => {
    const categories = ['Rent', 'Utilities', 'Staff welfare', 'Transport', 'Maintenance', 'Packaging', 'Cleaning', 'Marketing', 'Other'];
    const category = window.prompt(`Expense category (\n${categories.join(', ')}\n)`, 'Other');
    if (!category?.trim()) return;
    const description = window.prompt('Expense description');
    if (!description?.trim()) return;
    const amount = Number(window.prompt('Amount (SAR)', '0'));
    if (!Number.isFinite(amount) || amount <= 0) { flash('Enter an expense amount greater than zero.'); return; }
    const paymentMethod = (window.prompt('Payment method: Cash or Mada', 'Cash') || 'Cash').trim();
    if (!['Cash', 'Mada'].includes(paymentMethod)) { flash('Payment method must be Cash or Mada.'); return; }
    const date = window.prompt('Expense date (YYYY-MM-DD)', localDate()) || localDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime()) || localDate(new Date(`${date}T00:00:00`)) !== date) { flash('Enter a valid date in YYYY-MM-DD format.'); return; }
    const expense: ExpenseRecord = { id: `expense-${Date.now()}`, date, category: category.trim(), description: description.trim(), amount, paymentMethod: paymentMethod as PaymentMethod, createdAt: new Date().toISOString() };
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/expenses`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({category:expense.category,description:expense.description,amount:expense.amount,paymentMethod:expense.paymentMethod,date:expense.date}) });
        const result = await response.json();
        if (!response.ok || !result.expense) throw new Error(result.error || 'Expense could not be saved to the server.');
        expense.id = result.expense.id; expense.createdAt = result.expense.createdAt;
      } catch (error) { flash(error instanceof Error ? error.message : 'Expense was not saved.'); return; }
    }
    setExpenses(current => [expense, ...current]);
    setLogs(current => [{ id: `expense-log-${Date.now()}`, title: 'Expense recorded', detail: `${expense.category} · ${expense.description} · ${currency(amount)} · ${paymentMethod}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash(apiConnected ? 'Expense saved to PostgreSQL.' : 'Expense saved on this device.');
  };
  const deleteExpense = async (expense: ExpenseRecord) => {
    if (!window.confirm(`Delete expense “${expense.description}” for ${currency(expense.amount)}?`)) return;
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/expenses/${encodeURIComponent(expense.id)}`, { method:'DELETE', headers:{Authorization:`Bearer ${apiToken}`} });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Expense could not be deleted from the server.');
      } catch (error) { flash(error instanceof Error ? error.message : 'Expense could not be deleted.'); return; }
    }
    setExpenses(current => current.filter(item => item.id !== expense.id));
    setLogs(current => [{ id: `expense-delete-${Date.now()}`, title: 'Expense deleted', detail: `${expense.description} · ${currency(expense.amount)}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
    flash('Expense deleted.');
  };
  const expensesView = (): ReactNode => {
    const today = localDate();
    const month = today.slice(0, 7);
    const todayTotal = expenses.filter(item => item.date === today).reduce((sum, item) => sum + item.amount, 0);
    const monthTotal = expenses.filter(item => item.date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0);
    const categoryTotals = expenses.reduce<Record<string, number>>((totals, item) => { totals[item.category] = (totals[item.category] || 0) + item.amount; return totals; }, {});
    return <div className="space-y-4">
      <section className={`${panel} p-5`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Finance control','Operating expenses','Record and review shop expenses in SAR. Connected records are shared through PostgreSQL.')}<button onClick={addExpense} className="inline-flex items-center gap-2 rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={15}/> Add expense</button></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[{label:'Today',value:todayTotal},{label:'This month',value:monthTotal},{label:'All recorded',value:expenses.reduce((sum,item)=>sum+item.amount,0)}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{currency(card.value)}</div></div>)}
        </div>
        {Object.keys(categoryTotals).length>0&&<div className="mb-5 flex flex-wrap gap-2">{Object.entries(categoryTotals).sort((a,b)=>b[1]-a[1]).map(([name,amount])=><span key={name} className="rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2 text-xs text-slate-300">{name} <strong className="ml-1 text-[#e7b943]">{currency(amount)}</strong></span>)}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Date</th><th className="pb-3">Category</th><th className="pb-3">Description</th><th className="pb-3">Payment</th><th className="pb-3 text-right">Amount</th><th className="pb-3"/></tr></thead><tbody>{expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).map(item=><tr key={item.id} className="border-t border-white/[.06]"><td className="py-3 text-slate-400">{item.date}</td><td className="py-3 text-slate-300">{item.category}</td><td className="py-3 font-medium text-white">{item.description}</td><td className="py-3 text-slate-400">{item.paymentMethod}</td><td className="py-3 text-right font-semibold text-white">{currency(item.amount)}</td><td className="py-3 text-right"><button onClick={()=>deleteExpense(item)} className="rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-xs text-rose-300">Delete</button></td></tr>)}</tbody></table>{!expenses.length&&<p className="py-10 text-center text-sm text-slate-500">No expenses recorded. Add the first shop expense to start tracking.</p>}</div>
      </section>
    </div>;
  };
  const customersView = (): ReactNode => {
    const query = customerSearch.trim().toLocaleLowerCase();
    const visibleCustomers = customers.filter(customer => !query || [customer.name, customer.phone, customer.address].some(value => value.toLocaleLowerCase().includes(query)));
    return <section className={`${panel} p-5`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Guest relationships','Customers','Search, manage and update customer contact details.')}<button onClick={addCustomer} className="inline-flex items-center gap-2 rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={15}/> Add customer</button></div>
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[.09] bg-[#191e24] px-3 py-2.5"><Search size={16} className="text-slate-500"/><input value={customerSearch} onChange={event=>setCustomerSearch(event.target.value)} placeholder="Search by name, phone or address" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"/></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleCustomers.map(customer=><article key={customer.id} className="rounded-2xl border border-white/[.07] bg-[#191e24] p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-white">{customer.name}</h3><span className="rounded-full bg-[#e7b943]/10 px-2 py-1 text-xs text-[#e7b943]">{customer.loyaltyPoints} pts</span></div><p className="mt-3 text-sm text-slate-400">{customer.phone || 'No phone saved'}</p><p className="mt-1 text-xs text-slate-500">{customer.address || 'No address saved'}</p><div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[.06] pt-3"><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Orders</p><p className="mt-1 text-sm font-semibold text-white">{customer.orderCount ?? 0}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-500">Lifetime spend</p><p className="mt-1 text-sm font-semibold text-white">{currency(customer.lifetimeSpend ?? 0)}</p></div></div><p className="mt-3 text-xs text-slate-500">Last order: <span className="text-slate-300">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("en-SA") : "No orders yet"}</span></p><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Loyalty account <strong className="text-white">Active</strong></span><button onClick={()=>void editCustomer(customer)} className="rounded-lg border border-[#e7b943]/25 px-3 py-1.5 font-semibold text-[#e7b943]">Edit</button></div></article>)}</div>
      {!visibleCustomers.length && <p className="py-10 text-center text-sm text-slate-500">{customers.length ? 'No customers match this search.' : 'No customers saved yet.'}</p>}
    </section>;
  };
  const accounting = (): ReactNode => {
    const startDate = reportStartDate(reportRange);
    const periodOrders = orders.filter(order=>order.number!=='HOLD'&&localDate(new Date(order.createdAt))>=startDate);
    const periodExpenses = expenses.filter(item=>item.date>=startDate);
    const periodPurchases = purchases.filter(item=>item.date>=startDate);
    const periodPayroll = payroll.filter(record=>record.period>=startDate.slice(0,7));
    const sales = periodOrders.reduce((sum,order)=>sum+order.total,0);
    const collected = periodOrders.reduce((sum,order)=>sum+order.paid,0);
    const cashCollected = periodOrders.filter(order=>order.paymentMethod==='Cash').reduce((sum,order)=>sum+order.paid,0);
    const madaCollected = periodOrders.filter(order=>order.paymentMethod==='Mada').reduce((sum,order)=>sum+order.paid,0);
    const expenseTotal = periodExpenses.reduce((sum,item)=>sum+item.amount,0);
    const purchaseTotal = periodPurchases.reduce((sum,item)=>sum+item.total,0);
    const purchasePayments = periodPurchases.reduce((sum,item)=>sum+item.paid,0);
    const salaryPaid = periodPayroll.flatMap(record=>record.payments).filter(payment=>payment.date>=startDate).reduce((sum,payment)=>sum+payment.amount,0);
    const salaryDue = periodPayroll.reduce((sum,record)=>sum+Math.max(0,record.netSalary-record.payments.reduce((paid,payment)=>paid+payment.amount,0)),0);
    const supplierDue = suppliers.reduce((sum,supplier)=>sum+Math.max(0,supplier.due),0);
    const operatingOutflow = expenseTotal+salaryPaid+purchasePayments;
    const netCashMovement = collected-operatingOutflow;
    const metric = (label:string,value:number,detail?:string) => <div className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-xl font-semibold text-white">{currency(value)}</div>{detail&&<div className="mt-1 text-[10px] text-slate-500">{detail}</div>}</div>;
    return <div className="space-y-4">
      <section className={`${panel} p-5`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Finance control','Accounting overview','Track recorded money received, recorded outflows, supplier balances and payroll liabilities. This is a management cash view, not a statutory ledger.') }<select value={reportRange} onChange={event=>setReportRange(event.target.value)} className="rounded-xl border border-white/10 bg-[#171d22] px-3 py-2 text-xs text-slate-200"><option>Today</option><option>Last 7 days</option><option>This month</option><option>All time</option></select></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metric('Sales recorded',sales,`${periodOrders.length} orders · including recorded VAT`)}
          {metric('Payments received',collected,'Based on order payment records')}
          {metric('Recorded cash outflow',operatingOutflow,'Expense + salary paid + purchase payments')}
          {metric('Net cash movement',netCashMovement,'Collected payments less recorded outflows')}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={`${panel} p-5`}>{heading('Payment channels','Collected by method','Order payment method totals for the selected period.')}<div className="mt-4 space-y-3 text-sm">{[{label:'Cash received',value:cashCollected},{label:'Mada received',value:madaCollected},{label:'Total collected',value:collected}].map(row=><div key={row.label} className="flex justify-between border-b border-white/[.06] pb-3 text-slate-400"><span>{row.label}</span><strong className="text-white">{currency(row.value)}</strong></div>)}</div></section>
        <section className={`${panel} p-5`}>{heading('Recorded outflows','Cash movement breakdown','Purchases are shown as payments made, not treated as operating expenses.')}<div className="mt-4 space-y-3 text-sm">{[{label:'Operating expenses',value:expenseTotal},{label:'Salary payments',value:salaryPaid},{label:'Purchase payments',value:purchasePayments},{label:'Total recorded outflow',value:operatingOutflow}].map(row=><div key={row.label} className="flex justify-between border-b border-white/[.06] pb-3 text-slate-400"><span>{row.label}</span><strong className="text-white">{currency(row.value)}</strong></div>)}</div></section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={`${panel} p-5`}>{heading('Outstanding balances','Supplier payables','Current branch supplier balances, independent of the selected reporting period.')}<div className="mt-4 space-y-2">{suppliers.slice().sort((a,b)=>b.due-a.due).map(supplier=><div key={supplier.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.035] p-3"><div className="min-w-0"><div className="text-sm text-white">{supplier.name}</div><div className="mt-1 text-xs text-slate-500">{supplier.phone||'No phone recorded'}</div></div><strong className="shrink-0 text-sm text-amber-200">{currency(Math.max(0,supplier.due))}</strong></div>)}{!suppliers.length&&<p className="py-5 text-center text-xs text-slate-500">No suppliers recorded.</p>}<div className="flex justify-between border-t border-white/[.06] pt-3 text-sm"><strong className="text-slate-300">Total supplier balance</strong><strong className="text-[#e7b943]">{currency(supplierDue)}</strong></div></div></section>
        <section className={`${panel} p-5`}>{heading('Team liabilities','Payroll and procurement','Selected period totals; salary outstanding is calculated for payroll records in the selected months.')}<div className="mt-4 space-y-3 text-sm">{[{label:'Salary paid in period',value:salaryPaid},{label:'Salary outstanding',value:salaryDue},{label:'Purchase value received',value:purchaseTotal},{label:'Purchase payments made',value:purchasePayments}].map(row=><div key={row.label} className="flex justify-between border-b border-white/[.06] pb-3 text-slate-400"><span>{row.label}</span><strong className="text-white">{currency(row.value)}</strong></div>)}</div></section>
      </div>
      <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-xs leading-5 text-amber-100/70">This overview is based on recorded order payments, expenses, payroll payments and purchase payments. It does not reconcile cash drawer opening/closing balances, refunds, bank settlements, VAT filings or inventory valuation. Supplier balances are current balances and are not historical as-of-period balances.</p>
    </div>;
  };
  const reportStartDate = (range: string): string => {
    const now = new Date();
    if (range === 'Today') return localDate(now);
    if (range === 'Last 7 days') { now.setDate(now.getDate() - 6); return localDate(now); }
    if (range === 'This month') return localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    return '0000-01-01';
  };
  const exportCsv = (filename: string, rows: Array<Array<string | number>>) => {
    const csv = rows.map(row => row.map(value => {
      const text = String(value ?? '');
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  };
  const reportsView = (): ReactNode => {
    const start = reportStartDate(reportRange);
    const validOrders = orders.filter(order => order.number !== 'HOLD' && localDate(new Date(order.createdAt)) >= start);
    const validExpenses = expenses.filter(item => item.date >= start);
    const validPurchases = purchases.filter(item => item.date >= start);
    const sales = validOrders.reduce((sum, order) => sum + order.total, 0);
    const paid = validOrders.reduce((sum, order) => sum + order.paid, 0);
    const paymentTotals: Record<PaymentMethod, number> = { Cash: 0, Mada: 0 };
    validOrders.forEach(order => { paymentTotals[order.paymentMethod] += order.paid; });
    const productTotals = validOrders.flatMap(order => order.items).reduce<Array<{name:string;quantity:number;revenue:number}>>((list,item) => {
      const found = list.find(entry => entry.name === item.name);
      if (found) { found.quantity += item.qty; found.revenue += item.qty * item.unitPrice; }
      else list.push({ name: item.name, quantity: item.qty, revenue: item.qty * item.unitPrice });
      return list;
    }, []).sort((a,b) => b.quantity-a.quantity);
    const dailyTotals = validOrders.reduce<Record<string,number>>((map,order) => {
      const day = localDate(new Date(order.createdAt)); map[day] = (map[day] || 0) + order.total; return map;
    }, {});
    const dailyRows = Object.entries(dailyTotals).sort((a,b)=>b[0].localeCompare(a[0]));
    const expenseTotal = validExpenses.reduce((sum,item)=>sum+item.amount,0);
    const purchaseTotal = validPurchases.reduce((sum,item)=>sum+item.total,0);
    const salaryPaid = payroll.flatMap(record => record.payments).filter(payment => payment.date >= start).reduce((sum,payment)=>sum+payment.amount,0);
    const maxDaily = Math.max(1,...dailyRows.map(([,amount])=>amount));
    const reportRows = [
      ['Report range',reportRange],['Orders',validOrders.length],['Sales (SAR)',sales.toFixed(2)],['Payments received (SAR)',paid.toFixed(2)],
      ['Cash received (SAR)',paymentTotals.Cash.toFixed(2)],['Mada received (SAR)',paymentTotals.Mada.toFixed(2)],
      ['Expenses recorded (SAR)',expenseTotal.toFixed(2)],['Purchases recorded (SAR)',purchaseTotal.toFixed(2)],['Salary paid (SAR)',salaryPaid.toFixed(2)]
    ];
    return <div className="space-y-4">
      <section className={`${panel} p-5`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Business intelligence','Sales reports','Review recorded sales, payment methods, popular items and operating outflows.')}<div className="flex flex-wrap gap-2"><select value={reportRange} onChange={event=>setReportRange(event.target.value)} className="rounded-xl border border-white/10 bg-[#171d22] px-3 py-2 text-xs text-slate-200"><option>Today</option><option>Last 7 days</option><option>This month</option><option>All time</option></select><button onClick={()=>exportCsv('musafir-sales-report.csv',reportRows)} className="rounded-xl border border-[#e7b943]/40 px-3 py-2 text-xs font-semibold text-[#e7b943]">Export summary CSV</button></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Sales',value:currency(sales)},{label:'Orders',value:String(validOrders.length)},{label:'Payments received',value:currency(paid)},{label:'Average order value',value:currency(validOrders.length?sales/validOrders.length:0)}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{card.value}</div></div>)}</div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={`${panel} p-5`}>{heading('Sales trend','Daily sales','Order totals grouped by the POS local date.')}<div className="mt-5 space-y-3">{dailyRows.slice(0,14).map(([day,amount])=><div key={day}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">{day}</span><strong className="text-white">{currency(amount)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-[#e7b943]" style={{width:`${amount/maxDaily*100}%`}}/></div></div>)}{!dailyRows.length&&<p className="py-8 text-center text-sm text-slate-500">No sales in this period.</p>}</div></section>
        <section className={`${panel} p-5`}>{heading('Tender mix','Cash and Mada','Based on recorded payments for the selected period.')}<div className="mt-5 space-y-4">{(['Cash','Mada'] as PaymentMethod[]).map(method=><div key={method} className="rounded-xl bg-white/[.035] p-4"><div className="flex justify-between text-sm"><span className="text-slate-300">{method}</span><strong className="text-white">{currency(paymentTotals[method])}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-[#e7b943]" style={{width:`${paid?paymentTotals[method]/paid*100:0}%`}}/></div></div>)}</div></section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={`${panel} p-5`}>{heading('Menu performance','Top selling items','Sorted by units sold; item revenue excludes no recorded discounts allocation.')}<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Item</th><th className="pb-3 text-right">Qty</th><th className="pb-3 text-right">Line value</th></tr></thead><tbody>{productTotals.slice(0,12).map(item=><tr key={item.name} className="border-t border-white/[.06]"><td className="py-3 font-medium text-white">{item.name}</td><td className="py-3 text-right text-slate-300">{item.quantity}</td><td className="py-3 text-right text-slate-300">{currency(item.revenue)}</td></tr>)}</tbody></table>{!productTotals.length&&<p className="py-8 text-center text-sm text-slate-500">No item sales in this period.</p>}</div></section>
        <section className={`${panel} p-5`}>{heading('Operating outflows','Recorded costs','Purchases are shown separately from expenses and are not treated as consumed cost of goods.')}<div className="mt-5 space-y-4 text-sm">{[{label:'Operating expenses',value:expenseTotal},{label:'Purchases received',value:purchaseTotal},{label:'Salary payments made',value:salaryPaid}].map(item=><div key={item.label} className="flex justify-between border-b border-white/[.06] pb-3 text-slate-400"><span>{item.label}</span><strong className="text-white">{currency(item.value)}</strong></div>)}</div></section>
      </div>
      <section className={`${panel} p-5`}>{heading('Daily ledger','Sales by date','Export contains the summary totals above.')}<div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Date</th><th className="pb-3 text-right">Orders</th><th className="pb-3 text-right">Sales</th></tr></thead><tbody>{dailyRows.map(([day,amount])=><tr key={day} className="border-t border-white/[.06]"><td className="py-3 text-slate-300">{day}</td><td className="py-3 text-right text-slate-300">{validOrders.filter(order=>localDate(new Date(order.createdAt))===day).length}</td><td className="py-3 text-right font-medium text-white">{currency(amount)}</td></tr>)}</tbody></table></div></section>
    </div>;
  };
  const profitView = (): ReactNode => {
    const start = reportStartDate(reportRange);
    const periodOrders = orders.filter(order=>order.number!=='HOLD' && localDate(new Date(order.createdAt))>=start);
    const periodExpenses = expenses.filter(item=>item.date>=start);
    const periodPurchases = purchases.filter(item=>item.date>=start);
    const periodPayroll = payroll.filter(record=>record.period>=start.slice(0,7));
    const grossSales = periodOrders.reduce((sum,order)=>sum+order.total,0);
    const recordedVat = periodOrders.reduce((sum,order)=>sum+order.tax,0);
    const salesBeforeVat = Math.max(0,grossSales-recordedVat);
    const expenseTotal = periodExpenses.reduce((sum,item)=>sum+item.amount,0);
    const salaryPaid = periodPayroll.flatMap(record=>record.payments).filter(payment=>payment.date>=start).reduce((sum,payment)=>sum+payment.amount,0);
    const salaryOutstanding = periodPayroll.reduce((sum,record)=>sum+Math.max(0,record.netSalary-record.payments.reduce((paid,payment)=>paid+payment.amount,0)),0);
    const purchaseTotal = periodPurchases.reduce((sum,item)=>sum+item.total,0);
    const purchasePaid = periodPurchases.reduce((sum,item)=>sum+item.paid,0);
    const operatingResult = salesBeforeVat-expenseTotal-salaryPaid;
    return <div className="space-y-4">
      <section className={`${panel} p-5`}><div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Financial overview','Profit & loss','A transparent operating view using recorded data only. Ingredient COGS is not calculated until recipe-cost reconciliation is complete.')}<select value={reportRange} onChange={event=>setReportRange(event.target.value)} className="rounded-xl border border-white/10 bg-[#171d22] px-3 py-2 text-xs text-slate-200"><option>Today</option><option>Last 7 days</option><option>This month</option><option>All time</option></select></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Sales before recorded VAT',value:currency(salesBeforeVat)},{label:'Operating expenses',value:currency(expenseTotal)},{label:'Salary paid',value:currency(salaryPaid)},{label:'Operating result before COGS',value:currency(operatingResult)}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{card.value}</div></div>)}</div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={`${panel} p-5`}>{heading('Income','Recorded sales bridge','Sales totals are taken from completed POS order records.')}<div className="mt-4 space-y-3 text-sm">{[{label:'Sales including VAT',value:grossSales},{label:'Less recorded VAT',value:-recordedVat},{label:'Sales before recorded VAT',value:salesBeforeVat},{label:'Less operating expenses',value:-expenseTotal},{label:'Less salary payments',value:-salaryPaid}].map(row=><div key={row.label} className="flex justify-between border-b border-white/[.06] pb-3 text-slate-400"><span>{row.label}</span><strong className={row.value<0?'text-rose-300':'text-white'}>{row.value<0?'−':''}{currency(Math.abs(row.value))}</strong></div>)}<div className="flex justify-between pt-1 text-sm"><strong className="text-slate-200">Operating result before COGS</strong><strong className="text-[#e7b943]">{currency(operatingResult)}</strong></div></div></section>
        <section className={`${panel} p-5`}>{heading('Liabilities & purchasing','Payroll and purchases','Purchases are cash/inventory acquisition records, not automatically expenses.')}<div className="mt-4 space-y-3 text-sm">{[{label:'Salary paid in period',value:salaryPaid},{label:'Salary outstanding on selected payrolls',value:salaryOutstanding},{label:'Purchase value',value:purchaseTotal},{label:'Initial purchase payments recorded',value:purchasePaid}].map(row=><div key={row.label} className="flex justify-between border-b border-white/[.06] pb-3 text-slate-400"><span>{row.label}</span><strong className="text-white">{currency(row.value)}</strong></div>)}</div></section>
      </div>
      <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-xs leading-5 text-amber-100/70">This is not final net profit. Recipe-based ingredient cost of goods sold, stock consumption valuation, and tax adjustment for discounts are not yet reconciled. Purchases are reported separately to avoid counting inventory purchases as both an asset and an expense.</p>
    </div>;
  };
  const qr = (): ReactNode => <div className="grid gap-4 xl:grid-cols-[1fr_320px]"><section className={`${panel} p-5`}>{heading('Digital menu','Customer QR menu','Customer-facing menu preview using the current product list.') }<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.slice(0,6).map(product=><article key={product.id} className="overflow-hidden rounded-xl border border-white/[.07] bg-[#191e24]"><img src={product.image} alt={product.name} className="h-28 w-full object-cover"/><div className="p-3"><div className="text-sm font-medium text-white">{product.name}</div><div className="mt-1 text-sm text-[#e7b943]">{currency(product.price)}</div></div></article>)}</div></section><section className={`${panel} p-5`}>{heading('Table ordering','QR preview','Live QR generation requires a public hosted menu URL.') }<div className="mt-5 grid aspect-square place-items-center rounded-2xl border border-dashed border-white/15 bg-white p-5 text-center text-sm text-slate-500"><div><Grid2X2 className="mx-auto mb-2 text-slate-700" size={58}/>QR placeholder<br/><span className="text-xs">Not scannable in demo mode</span></div></div></section></div>;
  const addCategory = async () => {
    const name = window.prompt('New category name');
    if (!name?.trim()) return;
    const normalizedName=name.trim();
    if(menuCategories.some(item=>item.name.toLowerCase()===normalizedName.toLowerCase())){flash('This category already exists.');return;}
    let categoryRecord = {id:`local-${Date.now()}`,name:normalizedName};
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/categories`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({name:normalizedName})});
        const result = await response.json();
        if(!response.ok || !result.category) throw new Error(result.error || 'Category could not be saved.');
        categoryRecord = result.category;
      } catch(error) { flash(error instanceof Error ? error.message : 'Category was not saved.'); return; }
    }
    setMenuCategories(current=>[...current,categoryRecord].sort((a,b)=>a.name.localeCompare(b.name)));
    flash(apiConnected?'Category saved to PostgreSQL.':'Category added locally.');
  };
  const renameCategory = async (item:{id:string;name:string}) => {
    const name=window.prompt('Category name',item.name);
    if(!name?.trim() || name.trim()===item.name)return;
    const normalizedName=name.trim();
    if(menuCategories.some(category=>category.id!==item.id&&category.name.toLowerCase()===normalizedName.toLowerCase())){flash('This category already exists.');return;}
    if(apiConnected && apiToken) {
      try {
        const response=await fetch(`${apiBase.replace(/\/$/, '')}/api/categories/${encodeURIComponent(item.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({name:name.trim()})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'Category could not be updated.');
      } catch(error){flash(error instanceof Error?error.message:'Category update failed.');return;}
    }
    setMenuCategories(current=>current.map(category=>category.id===item.id?{...category,name:normalizedName}:category));
    setProducts(current=>current.map(product=>product.category===item.name?{...product,category:normalizedName as Product['category']}:product));
    if(category===item.name)setCategory(normalizedName);
    flash('Category updated.');
  };
  const deleteCategory = async (item:{id:string;name:string}) => {
    if(products.some(product=>product.category===item.name)){flash('Move or deactivate products in this category before deleting it.');return;}
    if(!window.confirm(`Delete category "${item.name}"?`))return;
    if(apiConnected && apiToken) {
      try {
        const response=await fetch(`${apiBase.replace(/\/$/, '')}/api/categories/${encodeURIComponent(item.id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${apiToken}`}});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'Category could not be deleted.');
      } catch(error){flash(error instanceof Error?error.message:'Category delete failed.');return;}
    }
    setMenuCategories(current=>current.filter(category=>category.id!==item.id));
    if(category===item.name)setCategory('All');
    flash('Category deleted.');
  };
  const addMenuProduct = async () => {
    const name=window.prompt('Product name');
    if(!name?.trim())return;
    const priceInput=window.prompt('Selling price (SAR)','0');
    if(priceInput===null)return;
    const price=Number(priceInput);
    if(!priceInput.trim()||!Number.isFinite(price)||price<0){flash('Enter a valid product price.');return;}
    if(!menuCategories.length){flash('Create a category before adding a product.');return;}
    const categoryInput=window.prompt(`Category: ${menuCategories.map(item=>item.name).join(', ')}`,menuCategories[0].name);
    if(categoryInput===null)return;
    const selected=menuCategories.find(item=>item.name.toLowerCase()===categoryInput.trim().toLowerCase());
    if(!selected){flash('Choose an existing category from the list.');return;}
    const categoryName=selected.name;
    const image=window.prompt('Product image URL (optional)','')||'';
    const sku=(`MENU-${Date.now()}`).slice(-40);
    let product:Product={id:`product-${Date.now()}`,name:name.trim(),category:categoryName.trim() as Product['category'],price,image,popularity:0,recipe:[]};
    if(apiConnected && apiToken) {
      try {
        const response=await fetch(`${apiBase.replace(/\/$/, '')}/api/products`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({sku,name:name.trim(),description:'',categoryId:selected?.id||null,price,imageUrl:image})});
        const result=await response.json();
        if(!response.ok||!result.product)throw new Error(result.error||'Product could not be saved.');
        product={...product,id:result.product.id};
      } catch(error){flash(error instanceof Error?error.message:'Product was not saved.');return;}
    }
    setProducts(current=>[product,...current]);
    flash(apiConnected?'Product saved to PostgreSQL.':'Product added locally.');
  };
  const editMenuProduct = async (product:Product) => {
    const name=window.prompt('Product name',product.name);
    if(!name?.trim())return;
    const priceInput=window.prompt('Selling price (SAR)',String(product.price));
    if(priceInput===null)return;
    const price=Number(priceInput);
    if(!priceInput.trim()||!Number.isFinite(price)||price<0){flash('Enter a valid product price.');return;}
    const categoryInput=window.prompt(`Category: ${menuCategories.map(item=>item.name).join(', ')}`,product.category);
    if(categoryInput===null)return;
    const selected=menuCategories.find(item=>item.name.toLowerCase()===categoryInput.trim().toLowerCase());
    if(!selected){flash('Choose an existing category from the list.');return;}
    const categoryName=selected.name;
    const imageInput=window.prompt('Product image URL',product.image);
    if(imageInput===null)return;
    const image=imageInput.trim();
    if(apiConnected && apiToken) {
      try {
        const response=await fetch(`${apiBase.replace(/\/$/, '')}/api/products/${encodeURIComponent(product.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({name:name.trim(),price,categoryId:selected?.id||null,imageUrl:image})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'Product could not be updated.');
      } catch(error){flash(error instanceof Error?error.message:'Product update failed.');return;}
    }
    setProducts(current=>current.map(item=>item.id===product.id?{...item,name:name.trim(),price,category:categoryName.trim() as Product['category'],image}:item));
    flash('Product updated.');
  };
  const deactivateMenuProduct = async (product:Product) => {
    if(!window.confirm(`Deactivate "${product.name}"? It will be removed from new orders but retained in sales history.`))return;
    if(apiConnected && apiToken) {
      try {
        const response=await fetch(`${apiBase.replace(/\/$/, '')}/api/products/${encodeURIComponent(product.id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${apiToken}`}});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'Product could not be deactivated.');
      } catch(error){flash(error instanceof Error?error.message:'Product deactivate failed.');return;}
    }
    setProducts(current=>current.filter(item=>item.id!==product.id));
    setInactiveMenuProducts(current=>[product,...current.filter(item=>item.id!==product.id)]);
    setCart(current=>current.filter(item=>item.productId!==product.id));
    flash('Product deactivated.');
  };
  const reactivateMenuProduct = async (product:Product) => {
    if(apiConnected && apiToken) {
      try {
        const response=await fetch(`${apiBase.replace(/\/$/, '')}/api/products/${encodeURIComponent(product.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({active:true})});
        const result=await response.json();
        if(!response.ok||!result.product)throw new Error(result.error||'Product could not be reactivated.');
      } catch(error){flash(error instanceof Error?error.message:'Product reactivation failed.');return;}
    }
    setInactiveMenuProducts(current=>current.filter(item=>item.id!==product.id));
    setProducts(current=>[product,...current.filter(item=>item.id!==product.id)]);
    flash('Product reactivated.');
  };
  const editProductRecipe = async (product: Product) => {
    if (!apiConnected || !apiToken) { flash('Connect the live POS database before editing recipes.'); return; }
    if (!inventory.length) { flash('Add inventory ingredients before creating a recipe.'); return; }
    const options = inventory.map((item,index)=>`${index+1}. ${item.name} (${item.unit})`).join('\n');
    const selected = Number(window.prompt(`Select ingredient to add or update for ${product.name}:\n${options}\nEnter 0 to clear this recipe.`, '1'));
    if (!Number.isInteger(selected) || selected<0 || selected>inventory.length) { flash('Select a valid ingredient number.'); return; }
    let recipe = [...product.recipe];
    if (selected===0) recipe=[];
    else {
      const ingredient=inventory[selected-1];
      const current=recipe.find(item=>item.ingredientId===ingredient.id);
      const quantityInput=window.prompt(`Quantity of ${ingredient.unit} used per ${product.name}. Enter 0 to remove this ingredient.`,String(current?.qty??1));
      if(quantityInput===null)return;
      const quantity=Number(quantityInput);
      if(!Number.isFinite(quantity)||quantity<0||quantity>100000){flash('Enter a valid recipe quantity.');return;}
      recipe=recipe.filter(item=>item.ingredientId!==ingredient.id);
      if(quantity>0)recipe.push({ingredientId:ingredient.id,name:ingredient.name,qty:quantity,unit:ingredient.unit});
    }
    try {
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/products/${encodeURIComponent(product.id)}/recipe`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({items:recipe.map(item=>({ingredientId:item.ingredientId,quantity:item.qty}))})});
      const result=await response.json();
      if(!response.ok||!Array.isArray(result.recipe))throw new Error(result.error||'Recipe could not be saved.');
      const saved=result.recipe.map((item:{ingredientId:string;name:string;qty:string|number;unit:string})=>({ingredientId:item.ingredientId,name:item.name,qty:Number(item.qty),unit:item.unit}));
      setProducts(current=>current.map(item=>item.id===product.id?{...item,recipe:saved}:item));
      flash(`Recipe saved for ${product.name}.`);
    } catch(error) { flash(error instanceof Error?error.message:'Recipe save failed.'); }
  };
  const recipesView = (): ReactNode => {
    const recipeStats = products.map(product => {
      const ingredients = product.recipe.map(recipeItem => {
        const stockItem = inventory.find(item => item.id === recipeItem.ingredientId);
        const unitCost = stockItem?.cost ?? 0;
        const lineCost = recipeItem.qty * unitCost;
        const maxPortions = stockItem?.trackStock && recipeItem.qty > 0 ? Math.floor(stockItem.stock / recipeItem.qty) : null;
        return { ...recipeItem, stockItem, unitCost, lineCost, maxPortions };
      });
      const knownCost = ingredients.filter(item => item.stockItem).reduce((sum, item) => sum + item.lineCost, 0);
      const hasMissingCost = ingredients.some(item => !item.stockItem);
      const trackedLimits = ingredients.filter(item => item.maxPortions !== null).map(item => item.maxPortions as number);
      const maxServings = trackedLimits.length ? Math.min(...trackedLimits) : null;
      return { product, ingredients, knownCost, hasMissingCost, maxServings, margin: product.price - knownCost };
    });
    const configured = recipeStats.filter(item => item.ingredients.length > 0);
    const totalKnownCost = configured.reduce((sum, item) => sum + item.knownCost, 0);
    const missingMappings = recipeStats.reduce((sum, item) => sum + item.ingredients.filter(ingredient => !ingredient.stockItem).length, 0);
    const unavailable = recipeStats.filter(item => item.maxServings === 0).length;
    return <section className={`${panel} p-5`}>
      <div className="mb-5">{heading('Kitchen operations','Recipes & ingredients','Set ingredient quantities per menu item, estimate recipe cost from recorded unit costs, and check stock-supported portions.')}</div>
      {!apiConnected&&<p className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs text-amber-100/80">Connect the live backend to manage database recipes. Demo recipe costs are indicative only and do not change live stock.</p>}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[{label:'Configured recipes',value:String(configured.length)},{label:'Missing ingredient links',value:String(missingMappings)},{label:'Products currently out of tracked stock',value:String(unavailable)}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{card.value}</div></div>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{recipeStats.map(({product,ingredients,knownCost,hasMissingCost,maxServings,margin})=><article key={product.id} className="rounded-2xl border border-white/[.07] bg-[#191e24] p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.category} · Selling price {currency(product.price)}</p></div><span className="rounded-full bg-[#e7b943]/10 px-2 py-1 text-[10px] text-[#e7b943]">{ingredients.length} ingredients</span></div>
        <div className="mt-4 space-y-2">{ingredients.length?ingredients.map(item=><div key={item.ingredientId} className="flex items-start justify-between gap-3 border-b border-white/[.05] pb-2 text-xs"><div className="min-w-0"><div className="text-slate-200">{item.name}</div><div className="mt-1 text-slate-500">{item.qty} {item.unit} · {item.stockItem?(item.stockItem.trackStock?`On hand: ${item.stockItem.stock} ${item.stockItem.unit}`:'Unlimited stock'):'Inventory item not linked'}</div></div><div className="shrink-0 text-right"><div className="text-slate-300">{item.stockItem?currency(item.lineCost):'—'}</div><div className="mt-1 text-slate-500">per recipe</div></div></div>):<p className="text-xs text-slate-500">No recipe configured. Stock will not be deducted for this product.</p>}</div>
        {ingredients.length>0&&<div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/[.035] p-3"><div><div className="text-[10px] text-slate-500">Known ingredient cost</div><div className="mt-1 text-sm font-semibold text-white">{currency(knownCost)}{hasMissingCost?' + unknown':''}</div></div><div><div className="text-[10px] text-slate-500">Estimated margin</div><div className={`mt-1 text-sm font-semibold ${margin>=0?'text-emerald-300':'text-rose-300'}`}>{hasMissingCost?'Incomplete':currency(margin)}</div></div><div><div className="text-[10px] text-slate-500">Tracked portions available</div><div className={`mt-1 text-sm font-semibold ${maxServings===0?'text-rose-300':'text-white'}`}>{maxServings===null?'Not limited':maxServings.toLocaleString('en-SA')}</div></div><div><div className="text-[10px] text-slate-500">Recipe cost basis</div><div className="mt-1 text-xs text-slate-300">Current inventory unit cost</div></div></div>}
        <button onClick={()=>void editProductRecipe(product)} disabled={!apiConnected} className="mt-4 w-full rounded-lg border border-[#e7b943]/30 px-3 py-2 text-xs font-semibold text-[#e7b943] disabled:opacity-40">Manage recipe</button>
      </article>)}</div>
      {!products.length&&<p className="py-10 text-center text-sm text-slate-500">Add active menu products before defining recipes.</p>}
      <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-5 text-amber-100/70">Cost and margin are estimates using current ingredient unit costs, not historical batch costs. Missing ingredient links are excluded from the known cost. Stock availability is calculated from tracked ingredients only; checkout remains the final stock validation.</p>
    </section>;
  };
  const menuView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Restaurant setup','Menu management','Create and maintain active menu products and selling prices.')}<button onClick={addMenuProduct} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={14} className="mr-1 inline"/>Add product</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.map(product=><article key={product.id} className="rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div className="flex items-start gap-3"><img src={product.image||'https://placehold.co/96x72?text=Menu'} alt={product.name} className="h-16 w-20 rounded-lg object-cover"/><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-white">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.category}</p><p className="mt-1 text-sm font-semibold text-[#e7b943]">{currency(product.price)}</p></div></div><div className="mt-4 flex gap-2"><button onClick={()=>editMenuProduct(product)} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Edit</button><button onClick={()=>deactivateMenuProduct(product)} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300">Deactivate</button></div></article>)}</div>
    {!products.length&&<p className="py-10 text-center text-sm text-slate-500">No active menu products.</p>}
    <div className="mt-7 border-t border-white/10 pt-5"><h3 className="mb-3 text-sm font-semibold text-slate-300">Inactive products ({inactiveMenuProducts.length})</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{inactiveMenuProducts.map(product=><article key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-[#191e24] p-3 opacity-75"><div className="min-w-0"><div className="truncate text-sm text-white">{product.name}</div><div className="mt-1 text-xs text-slate-500">{product.category} · {currency(product.price)}</div></div><button onClick={()=>reactivateMenuProduct(product)} className="shrink-0 rounded-lg border border-emerald-400/20 px-3 py-2 text-xs text-emerald-300">Reactivate</button></article>)}</div>
      {!inactiveMenuProducts.length&&<p className="text-xs text-slate-500">No inactive products.</p>}
    </div>
  </section>;
  const categoriesView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Restaurant setup','Menu categories','Organize products into clear categories for the POS menu.')}<button onClick={addCategory} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]"><Plus size={14} className="mr-1 inline"/>Add category</button></div>
    <div className="space-y-2">{menuCategories.map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-[#191e24] p-3"><div><div className="text-sm font-medium text-white">{item.name}</div><div className="mt-1 text-xs text-slate-500">{products.filter(product=>product.category===item.name).length} active products</div></div><div className="flex gap-2"><button onClick={()=>renameCategory(item)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Rename</button><button onClick={()=>deleteCategory(item)} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300">Delete</button></div></div>)}</div>
  </section>;
  const moduleMessages: Record<string,string> = { tables:'Manage table labels, seating capacity and branch-scoped occupancy status.', reservations:'Schedule guests, record party size and contact details, and track booked, seated, completed or cancelled reservations.', menu:'Create, edit, deactivate and reactivate products. Inactive products remain available for restoration.', categories:'Create, rename and delete categories. Categories with active products cannot be deleted.', recipes:'Manage recipes, estimate per-item ingredient cost and margin from current inventory unit costs, and check tracked stock capacity.', purchases:'Record goods received, add quantities to inventory and track supplier credit locally.', delivery:'Assign Home Delivery orders to branch delivery staff and track pickup and delivery status.', expenses:'Record shop operating expenses, payment method and expense date; review daily and monthly totals.', employees:'Manage employee profiles, monthly salaries and shift details in local POS storage.', attendance:'Update daily employee attendance status in local POS storage.', payroll:'Create monthly payroll, track salary advances, and record full or partial Cash/Mada salary payments.', reports:'Dashboard includes actual order totals and item sales; date filtering/export reports need completion.', profit:'Reliable profit & loss requires recorded COGS, purchases, expenses and salaries; not yet implemented.',  discounts:'Coupon codes and discount authorization need completion.', roles:'Authentication and enforceable role permissions need a secure backend.', settings:'Restaurant and branch settings need completion.' };
  const selectedLabel = moduleGroups.flatMap(group=>group.items).find(item=>item.id===view)?.label || 'Dashboard';
  const placeholder = (): ReactNode => <section className={`${panel} p-6 md:p-8`}><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7b943]/10 text-[#e7b943]"><Activity size={21}/></div><div className="mt-5">{heading('Module status',selectedLabel,'This module is listed for the complete product scope.')}</div><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">{moduleMessages[view] || 'This module is planned but is not part of the current working demo.'}</p><div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-xs leading-5 text-amber-100/70">This screen is intentionally marked as incomplete—no demo action or placeholder value is presented as a completed workflow.</div><button onClick={()=>setView('dashboard')} className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-white/20">Back to dashboard</button></section>;
  const content: Record<string,()=>ReactNode> = { dashboard, pos, orders:ordersView, kitchen, delivery:deliveryView, tables:tablesView, reservations:reservationsView, menu:menuView, categories:categoriesView, inventory:inventoryView, recipes:recipesView, suppliers:suppliersView, purchases:purchasesView, customers:customersView, employees:employeesView, attendance:attendanceView, payroll:payrollView, expenses:expensesView, accounting, reports:reportsView, profit:profitView, qr, settings:apiSettings };
  const activeContent = content[view] ? content[view]() : placeholder();

  return <div className={`${light?'theme-light':''} min-h-screen bg-[#0e1114] text-slate-100`}><div className="flex min-h-screen"><aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/[.06] bg-[#111519] transition-transform lg:static lg:translate-x-0 ${mobileNav?'translate-x-0':'-translate-x-full'}`}><div className="flex h-[76px] items-center gap-3 border-b border-white/[.06] px-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#f0ca69] to-[#b37a18] font-serif text-xl font-black text-[#201707]">M</div><div><div className="font-serif text-lg font-bold tracking-wide text-white">Musafir</div><div className="text-[9px] uppercase tracking-[.28em] text-[#cba84c]">Fast Food</div></div><button onClick={()=>setMobileNav(false)} className="ml-auto text-slate-500 lg:hidden"><X size={19}/></button></div><div className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e7b943] text-sm font-bold text-[#211908]">A</div><div className="min-w-0"><div className="text-sm font-medium text-white">Admin</div><div className="text-[11px] text-slate-500">Restaurant owner</div></div><span className="ml-auto h-2 w-2 rounded-full bg-emerald-400"/></div><nav className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-5">{moduleGroups.map(group=><div key={group.title}><div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.2em] text-slate-600">{group.title}</div><div className="space-y-1">{group.items.filter(item=>!(apiConnected&&apiRole==='accountant'&&item.id==='attendance')).map(item=><button key={item.id} onClick={()=>{setView(item.id);setMobileNav(false);}} className={`nav-item ${view===item.id?'nav-active':''}`}><item.icon size={16} strokeWidth={1.8}/><span className="flex-1 text-left">{item.label}</span>{item.id==='pos'&&cart.length>0&&<span className="rounded-full bg-[#e7b943] px-1.5 py-0.5 text-[10px] font-bold text-black">{cart.reduce((n,i)=>n+i.qty,0)}</span>}</button>)}</div></div>)}</nav><div className="border-t border-white/[.06] p-3"><div className="rounded-xl bg-gradient-to-r from-[#211d13] to-[#17191a] p-3"><div className="text-xs font-medium text-[#ead18b]">Good Food • Good Mood</div><div className="mt-1 text-[10px] text-slate-500">Premium service, made simple.</div></div><button onClick={()=>flash('Sign out requires authentication, which is not yet configured.')} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-white/[.04] hover:text-slate-300"><LogOut size={15}/>Sign out</button></div></aside>
    {mobileNav&&<button aria-label="Close navigation" onClick={()=>setMobileNav(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden"/>}<div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[.06] bg-[#101417]/90 px-4 backdrop-blur-xl md:px-7"><div className="flex items-center gap-3"><button onClick={()=>setMobileNav(true)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"><Menu size={20}/></button><div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span>Musafir</span><span>/</span><span className="text-slate-200">{selectedLabel}</span></div><div className="sm:hidden text-sm font-medium text-white">{selectedLabel}</div></div><div className="flex items-center gap-2 md:gap-4"><div className="hidden items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2 text-xs text-slate-500 md:flex"><Search size={14}/><span>Search menu items…</span><kbd className="ml-6 rounded border border-white/10 px-1.5 py-0.5 text-[10px]">⌘ K</kbd></div><button onClick={()=>flash(lowStock.length?`${lowStock.length} inventory item(s) are at or below reorder level.`:'No new alerts.')} className="relative rounded-lg p-2 text-slate-400 hover:bg-white/5"><Bell size={18}/>{lowStock.length>0&&<span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400"/>}</button><button onClick={()=>setLight(value=>!value)} className="rounded-lg border border-white/[.08] px-2.5 py-1.5 text-[11px] text-slate-400">{light?'Light':'Dark'}</button><div className="hidden items-center gap-2 border-l border-white/[.08] pl-3 sm:flex"><div className="text-right"><div className="text-xs font-medium text-slate-200">Admin</div><div className="text-[10px] text-slate-500">Owner</div></div><ChevronDown size={14} className="text-slate-500"/></div></div></header><main className="mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-7">{activeContent}<footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/[.05] pt-4 text-[10px] text-slate-600"><span>Musafir Fast Food · Restaurant operations</span><span>Good Food • Good Mood</span></footer></main></div></div>{toast&&<div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-[#e7b943]/20 bg-[#1a1e21] px-4 py-3 text-sm text-slate-200 shadow-2xl">{toast}</div>}</div>;
}

export default App;
