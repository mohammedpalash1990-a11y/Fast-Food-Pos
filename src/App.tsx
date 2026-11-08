import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Bike, BookOpen, Boxes, BriefcaseBusiness, CalendarDays, ChefHat, ChevronDown, CircleDollarSign, ClipboardList, Grid2X2, LayoutDashboard, LogOut, Menu, Moon, Package, Plus, Printer, Search, Settings, ShoppingBag, ShoppingCart, Sparkles, Sun, Table2, Users, Wallet, X } from 'lucide-react';
import { categories, demoAuditLogs, demoCustomers, demoEmployees, demoInventory, demoOrders, demoProducts, demoSuppliers } from './data/demoData';
import { type CartItem, type Customer, type Employee, type InventoryItem, type Order, type OrderStatus, type PaymentMethod, type Product, type Supplier } from './types';
import { fetchProfitAndLoss, fetchSalesReport, type ProfitAndLossReport, type SalesReport } from './api/reports';
import { buildMenuShareUrl } from './menu/menu-model';

const currency = (amount: number) => `SAR ${amount.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const localDate = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const safeRead = <T,>(key: string, initial: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial; } catch { return initial; }
};
const save = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled or full; app remains usable for this session. */ } };
const readSession = (key: string) => { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } };
const saveSession = (key: string, value: string) => { try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch { /* Session storage may be unavailable; login remains usable until reload. */ } };
const moduleGroups = [
  { title: 'Workspace', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'pos', label: 'POS / Billing', icon: ShoppingCart }, { id: 'orders', label: 'Orders', icon: ClipboardList }, { id: 'tables', label: 'Tables Management', icon: Table2 }, { id: 'reservations', label: 'Reservations', icon: CalendarDays }] },
  { title: 'Restaurant', items: [{ id: 'customers', label: 'Customers', icon: Users }, { id: 'menu', label: 'Menu Management', icon: BookOpen }, { id: 'categories', label: 'Categories', icon: Grid2X2 }, { id: 'inventory', label: 'Inventory', icon: Boxes }, { id: 'recipes', label: 'Recipes & Ingredients', icon: Package }, { id: 'suppliers', label: 'Suppliers', icon: BriefcaseBusiness }, { id: 'purchases', label: 'Purchase Management', icon: ShoppingBag }, { id: 'delivery', label: 'Delivery Management', icon: Bike }] },
  { title: 'Finance & team', items: [{ id: 'expenses', label: 'Expenses', icon: Wallet }, { id: 'employees', label: 'Employee Management', icon: Users }, { id: 'attendance', label: 'Attendance', icon: CalendarDays }, { id: 'payroll', label: 'Salary & Payroll', icon: CircleDollarSign }, { id: 'accounting', label: 'Accounting', icon: BarChart3 }, { id: 'reports', label: 'Sales Reports', icon: BarChart3 }, { id: 'profit', label: 'Profit & Loss', icon: Activity },  { id: 'discounts', label: 'Discounts & Coupons', icon: Sparkles }] },
  { title: 'Channels & setup', items: [{ id: 'qr', label: 'QR Menu', icon: Grid2X2 }, { id: 'settings', label: 'Settings', icon: Settings }, { id: 'roles', label: 'User Roles & Permissions', icon: Users }] }
];
type ThemePresetName = 'Arabian Royal' | 'Midnight Executive' | 'Obsidian Luxe' | 'Burgundy Signature' | 'Modern Ivory';
type ThemeConfig = { preset: ThemePresetName; appearance: 'Both' | 'Light' | 'Dark'; customColors: { accent: string; background: string; surface: string; sidebar: string } };
const themePresets: Record<ThemePresetName, { accent: string; background: string; surface: string; sidebar: string; text: string; muted: string; border: string }> = {
  'Arabian Royal': { accent:'#C6A66B', background:'#102B25', surface:'#1D3A31', sidebar:'#0B211B', text:'#F4F0E7', muted:'#A7B6AC', border:'#365448' },
  'Midnight Executive': { accent:'#C9A45C', background:'#101B35', surface:'#1C2A49', sidebar:'#0A142A', text:'#EEF1F8', muted:'#AAB5CA', border:'#344362' },
  'Obsidian Luxe': { accent:'#B98252', background:'#171717', surface:'#252525', sidebar:'#101010', text:'#F1ECE5', muted:'#B5ACA1', border:'#45403B' },
  'Burgundy Signature': { accent:'#C5A06B', background:'#401D29', surface:'#552A38', sidebar:'#2C121B', text:'#F5EFE8', muted:'#C7B3B6', border:'#704653' },
  'Modern Ivory': { accent:'#B89B68', background:'#F4F1E9', surface:'#FFFFFF', sidebar:'#26332C', text:'#26332C', muted:'#68766E', border:'#DED8CA' }
};
const defaultThemeConfig: ThemeConfig = { preset:'Modern Ivory', appearance:'Light', customColors:{ accent:'#B89B68', background:'#F4F1E9', surface:'#FFFFFF', sidebar:'#18362B' } };
const getThemeStyle = (config: ThemeConfig, light: boolean): CSSProperties => {
  const preset = themePresets[config.preset] || themePresets['Arabian Royal'];
  return {
    '--theme-accent': config.customColors.accent || preset.accent,
    '--theme-bg': light ? '#F4F0E7' : (config.customColors.background || preset.background),
    '--theme-surface': light ? '#FFFFFF' : (config.customColors.surface || preset.surface),
    '--theme-sidebar': light ? preset.sidebar : (config.customColors.sidebar || preset.sidebar),
    '--theme-header': light ? preset.sidebar : (config.customColors.sidebar || preset.sidebar),
    '--theme-text': light ? '#26332C' : preset.text,
    '--theme-muted': light ? '#68766E' : preset.muted,
    '--theme-border': light ? '#DED8CA' : preset.border,
    '--theme-accent-contrast': '#17130B'
  } as CSSProperties;
};


type ReservationRecord = { id:string; guestName:string; phone:string; partySize:number; reservedFor:string; status:'Booked'|'Seated'|'Completed'|'Cancelled'|'No-show'; notes:string; createdAt:string };
type TableRecord = { id:string; tableNumber:string; seats:number; status:'Available'|'Occupied'|'Reserved'|'Cleaning'|'Out of Service'; notes:string; createdAt:string; updatedAt:string };
type DeliveryRecord = { id:string; order_id:string; order_number:number|string; order_status:string; total:string|number; order_created_at:string; customer_name:string; customer_phone:string; delivery_address:string; delivery_note:string; status:'Pending'|'Assigned'|'Picked Up'|'Delivered'|'Failed'; assigned_driver_id:string|null; driver_name:string; assigned_at:string|null; picked_up_at:string|null; delivered_at:string|null; updated_at:string };
type DeliveryDriver = { id:string; display_name:string };
type ExpenseRecord = { id: string; date: string; category: string; description: string; amount: number; paymentMethod: PaymentMethod; createdAt: string };
type PurchaseRecord = { id: string; date: string; supplierId: string; supplierName: string; inventoryId: string; itemName: string; quantity: number; unit: string; unitCost: number; total: number; paid: number; paymentStatus: 'Paid' | 'Part-paid' | 'Credit'; paymentMethod?: PaymentMethod; createdAt: string };
type PayrollPayment = { id: string; amount: number; paymentMethod: PaymentMethod; date: string; createdAt: string };
type PayrollRecord = { id: string; employeeId: string; employeeName: string; period: string; baseSalary: number; bonus: number; deduction: number; otherDeduction?: number; deductionNote?: string; advanceDeduction: number; netSalary: number; payments: PayrollPayment[]; createdAt: string };

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
  const [attendanceDate, setAttendanceDate] = useState(() => localDate());
  const [attendanceRows, setAttendanceRows] = useState<{employeeId:string;name:string;role:string;shift:string;status:Employee['status'] }[]>([]);
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
  const [splitPayment, setSplitPayment] = useState(false);
  const [cashPaymentAmount, setCashPaymentAmount] = useState('10');
  const [branchName, setBranchName] = useState(() => safeRead('musafir-branch-name', 'Musafir Fast Food'));
  const [receiptFooter, setReceiptFooter] = useState(() => safeRead('musafir-receipt-footer', 'Thank you for visiting Musafir!'));
  const [discount, setDiscount] = useState('0');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{code:string;discount:number;discountType:string;discountValue:number}|null>(null);
  const [coupons, setCoupons] = useState<Array<{id:string;code:string;discountType:'percent'|'fixed';discountValue:number|string;minimumOrderAmount:number|string;maximumDiscount:number|string|null;expiresAt:string|null;usageLimit:number|null;usageCount:number;active:boolean}>>([]);
  const [couponBusy, setCouponBusy] = useState(false);
  const [managedUsers, setManagedUsers] = useState<Array<{id:string;email:string;displayName:string;role:string;active:boolean;createdAt:string}>>([]);
  const [roleCatalog, setRoleCatalog] = useState<Array<{role:string;label:string;permissions:string[]}>>([]);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => safeRead('musafir-theme-config', defaultThemeConfig));
  const [draftThemeConfig, setDraftThemeConfig] = useState<ThemeConfig>(() => safeRead('musafir-theme-config', defaultThemeConfig));
  const [light, setLight] = useState<boolean>(() => safeRead('musafir-theme-light', false));
  const [draftLight, setDraftLight] = useState<boolean>(() => safeRead('musafir-theme-light', false));
  const [apiBase, setApiBase] = useState(() => safeRead('musafir-api-base', import.meta.env.VITE_API_URL || ''));
  const [apiEmail, setApiEmail] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [apiToken, setApiToken] = useState(() => readSession('musafir-api-token'));
  const [apiBranchId, setApiBranchId] = useState(() => readSession('musafir-api-branch'));
  const [apiRole, setApiRole] = useState(() => readSession('musafir-api-role'));
  const [apiConnected, setApiConnected] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const orderSubmissionLock = useRef(false);
  const orderIdempotencyKey = useRef(readSession('musafir-order-idempotency-key'));
  const orderIdempotencyPayload = useRef(readSession('musafir-order-idempotency-payload'));
  const [apiMessage, setApiMessage] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  // Server-verified reporting figures (B2). Kept separate from the instant local
  // totals so the POS never blocks on a network round trip.
  const [serverSales, setServerSales] = useState<SalesReport | null>(null);
  const [serverSalesError, setServerSalesError] = useState('');
  const [serverPnl, setServerPnl] = useState<ProfitAndLossReport | null>(null);
  const [serverPnlError, setServerPnlError] = useState('');
  const backupInputRef = useRef<HTMLInputElement>(null);
  const menuSearchRef = useRef<HTMLInputElement>(null);

  const hrRole = apiConnected ? apiRole : 'owner';
  const canManageHr = ['owner', 'manager'].includes(hrRole);
  const canViewPayroll = ['owner', 'manager', 'accountant'].includes(hrRole);

  useEffect(() => { save('musafir-theme-config', themeConfig); }, [themeConfig]);
  useEffect(() => { save('musafir-theme-light', light); }, [light]);
  useEffect(() => { if (!apiConnected) save('musafir-products', products); }, [products, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-menu-categories', menuCategories); }, [menuCategories, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-inactive-products', inactiveMenuProducts); }, [inactiveMenuProducts, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-inventory', inventory); }, [inventory, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-customers', customers); }, [customers, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-orders', orders); }, [orders, apiConnected]);
  useEffect(() => { save('musafir-cart', cart); }, [cart]);
  useEffect(() => { if (!apiConnected) save('musafir-employees', employees); }, [employees, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-suppliers', suppliers); }, [suppliers, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-expenses', expenses); }, [expenses, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-purchases', purchases); }, [purchases, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-payroll', payroll); }, [payroll, apiConnected]);
  useEffect(() => { if (!apiConnected) return; try { localStorage.removeItem('musafir-employees'); localStorage.removeItem('musafir-payroll'); } catch { /* Storage may be unavailable. */ } }, [apiConnected]);
  useEffect(() => {
    if (!apiConnected || !apiToken || view !== 'attendance' || !canManageHr) return;
    let active = true;
    fetch(`${apiBase.replace(/\/$/, '')}/api/attendance?date=${encodeURIComponent(attendanceDate)}`, { headers: { Authorization: `Bearer ${apiToken}` } })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Attendance could not be loaded'); return data; })
      .then(data => { if (active && Array.isArray(data.attendance)) setAttendanceRows(data.attendance.map((row: {employeeId:string;name:string;role:string;shift:string;status:Employee['status']|null}) => ({...row,status:row.status || 'Not marked'}))); })
      .catch(error => { if (active) flash(error instanceof Error ? error.message : 'Attendance could not be loaded.'); });
    return () => { active = false; };
  }, [apiConnected, apiToken, apiBase, view, attendanceDate, canManageHr]);
  useEffect(() => {
    if(!apiConnected||!apiToken||!apiBase)return;
    let active=true;
    fetch(apiBase.replace(/\/$/,'')+'/api/settings',{headers:{Authorization:'Bearer '+apiToken}})
      .then(async response=>{const result=await response.json();if(!response.ok||!result.settings)throw new Error(result.error||'Branch settings could not be loaded.');return result.settings;})
      .then(settings=>{if(active){setBranchName(settings.branchName||'Musafir Fast Food');setReceiptFooter(settings.receiptFooter||'Thank you for visiting Musafir!');}})
      .catch(error=>{if(active)flash(error instanceof Error?error.message:'Branch settings could not be loaded.');});
    return ()=>{active=false;};
  },[apiConnected,apiToken,apiBase]);
  const saveBranchConfiguration = async () => {
    const name=branchName.trim(),footer=receiptFooter.trim();
    if(name.length<2||name.length>100||footer.length>200){flash('Branch name must be 2–100 characters and receipt footer 0–200 characters.');return;}
    if(apiConnected&&apiToken){
      try{
        const response=await fetch(apiBase.replace(/\/$/,'')+'/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiToken},body:JSON.stringify({branchName:name,receiptFooter:footer})});
        const result=await response.json();
        if(!response.ok||!result.settings)throw new Error(result.error||'Branch configuration could not be saved.');
        setBranchName(result.settings.branchName);
        setReceiptFooter(result.settings.receiptFooter);
      }catch(error){flash(error instanceof Error?error.message:'Branch configuration could not be saved.');return;}
    }else{
      setBranchName(name);setReceiptFooter(footer);
    }
    flash('Branch settings saved.');
  };

  useEffect(() => { save('musafir-audit', logs); }, [logs]);
  useEffect(() => { if (!apiConnected) save('musafir-reservations', reservations); }, [reservations, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-restaurant-tables', restaurantTables); }, [restaurantTables, apiConnected]);

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
        const [ordersResponse, inventoryResponse, expensesResponse, purchasesResponse, suppliersResponse, employeesResponse, payrollResponse, reservationsResponse, tablesResponse, deliveriesResponse, categoriesResponse, productsResponse, customersResponse] = await Promise.all([
          fetch(`${apiBase.replace(/\/$/, '')}/api/orders?limit=150`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/inventory`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/expenses`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/purchases`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/suppliers`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/employees?date=${localDate()}&includeInactive=true`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/payroll`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/reservations`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/tables`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/deliveries`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/categories`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/products`, { headers }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/customers`, { headers })
        ]);
        if (!ordersResponse.ok || !inventoryResponse.ok) return;
        const [orderData, inventoryData] = await Promise.all([ordersResponse.json(), inventoryResponse.json()]);
        if (!active || !Array.isArray(orderData.orders) || !Array.isArray(inventoryData.items)) return;
        if (categoriesResponse.ok) {
          const categoryData = await categoriesResponse.json();
          if (active && Array.isArray(categoryData.categories)) setMenuCategories(categoryData.categories);
        }
        if (productsResponse.ok) {
          const productData = await productsResponse.json();
          if (active && Array.isArray(productData.products)) {
            const mappedProducts = productData.products.map((item: {id:string;name:string;category?:string;price:string|number;imageUrl?:string;image_url?:string;active:boolean;recipe?:Array<{ingredientId:string;name:string;qty:string|number;unit:string}>}) => ({
              id:item.id,name:item.name,category:(item.category||'Snacks') as Product['category'],price:Number(item.price),
              image:item.imageUrl||item.image_url||'',popularity:0,recipe:(item.recipe||[]).map(ingredient=>({ingredientId:ingredient.ingredientId,name:ingredient.name,qty:Number(ingredient.qty),unit:ingredient.unit}))
            }));
            setProducts(mappedProducts.filter((_:Product,index:number)=>productData.products[index].active));
            setInactiveMenuProducts(mappedProducts.filter((_:Product,index:number)=>!productData.products[index].active));
          }
        }
        if (customersResponse.ok) {
          const customerData = await customersResponse.json();
          if (active && Array.isArray(customerData.customers)) setCustomers(customerData.customers.map((customer: {id:string;name:string;phone?:string;address?:string;loyaltyPoints?:number|string;orderCount?:number|string;lifetimeSpend?:number|string;lastOrderAt?:string|null})=>({id:customer.id,name:customer.name,phone:customer.phone||'',address:customer.address||'',loyaltyPoints:Number(customer.loyaltyPoints||0),orderCount:Number(customer.orderCount||0),lifetimeSpend:Number(customer.lifetimeSpend||0),lastOrderAt:customer.lastOrderAt||undefined,favoriteItems:[]})));
        }
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
            id:string;name:string;role:string;shift:string;status:'Present'|'Absent'|'On Leave'|'Not marked';salary:string|number;advance:string|number;active?:boolean;
          }) => ({id:item.id,name:item.name,role:item.role,shift:item.shift,status:item.status,salary:Number(item.salary),advance:Number(item.advance),active:item.active!==false})));
        }
        if (payrollResponse.ok) {
          const payrollData = await payrollResponse.json();
          if (active && Array.isArray(payrollData.payroll)) setPayroll(payrollData.payroll.map((item: {
            id:string;employeeId:string;employeeName:string;period:string;baseSalary:string|number;bonus:string|number;deduction?:string|number;otherDeduction?:string|number;deductionNote?:string;
            advanceDeduction:string|number;netSalary:string|number;createdAt:string;
            payments:Array<{id:string;amount:string|number;paymentMethod:'Cash'|'Mada';date:string;createdAt:string}>;
          }) => ({
            id:item.id,employeeId:item.employeeId,employeeName:item.employeeName,period:item.period,
            baseSalary:Number(item.baseSalary),bonus:Number(item.bonus),deduction:Number(item.otherDeduction??item.deduction??0),otherDeduction:Number(item.otherDeduction??item.deduction??0),deductionNote:item.deductionNote||'',advanceDeduction:Number(item.advanceDeduction),
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
          created_at: string; customer_name: string; customer_phone?: string | null; customer_address?: string | null; channel?: string; table_number?: string | null; subtotal: string | number; tax: string | number;
          discount: string | number; total: string | number; paid: string | number;
          payment_method: string; payment_breakdown?: Array<{method:PaymentMethod;amount:string|number}>; notes?: string;
          items: Array<{ id: string; productId: string | null; name: string; qty: number; unitPrice: string | number }>;
        }) => ({
          id: saved.id,
          number: String(saved.order_number),
          type: saved.order_type,
          status: saved.status as OrderStatus,
          createdAt: saved.created_at,
          customerName: saved.customer_name,
          customerPhone: saved.customer_phone || undefined,
          deliveryAddress: saved.customer_address || undefined,
          channel: saved.channel === 'qr' ? 'qr' : 'pos',
          tableNumber: saved.table_number || undefined,
          subtotal: Number(saved.subtotal),
          tax: Number(saved.tax),
          discount: Number(saved.discount),
          total: Number(saved.total),
          paid: Number(saved.paid),
          paymentMethod: saved.payment_method === 'Mada' ? 'Mada' : 'Cash',
          paymentBreakdown: (saved.payment_breakdown || []).map(payment => ({method:payment.method === 'Mada' ? 'Mada' : 'Cash',amount:Number(payment.amount)})),
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
  // Server-verified reporting figures (B2). Only owners, managers and accountants
  // may read financial reports; a rejection is shown instead of silently falling
  // back to local numbers.
  useEffect(() => {
    const canReadReports = Boolean(apiConnected && apiToken && apiBase) && ['owner', 'manager', 'accountant'].includes(apiRole);
    if (!canReadReports || (view !== 'reports' && view !== 'profit')) {
      if (!canReadReports) {
        setServerSales(null); setServerSalesError('');
        setServerPnl(null); setServerPnlError('');
      }
      return;
    }
    const controller = new AbortController();
    const options = { apiBase, token: apiToken, range: reportRange, signal: controller.signal };
    const describe = (error: unknown) => (error instanceof Error ? error.message : 'The reporting service is unavailable.');
    const aborted = (error: unknown) => (error as { name?: string })?.name === 'AbortError';
    if (view === 'reports') {
      fetchSalesReport(options)
        .then(report => { setServerSales(report); setServerSalesError(''); })
        .catch(error => { if (!aborted(error)) { setServerSales(null); setServerSalesError(describe(error)); } });
    } else {
      fetchProfitAndLoss(options)
        .then(report => { setServerPnl(report); setServerPnlError(''); })
        .catch(error => { if (!aborted(error)) { setServerPnl(null); setServerPnlError(describe(error)); } });
    }
    return () => controller.abort();
  }, [apiBase, apiToken, apiConnected, apiRole, view, reportRange]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const focusMenuSearch = () => {
    setView('pos');
    window.setTimeout(() => menuSearchRef.current?.focus(), 0);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      setView('pos');
      window.setTimeout(() => menuSearchRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);


  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = Number((subtotal * 0.15).toFixed(2));
  const manualDiscountAmount = Number(((subtotal + tax) * Math.max(0, Math.min(100, Number(discount) || 0)) / 100).toFixed(2));
  const discountAmount = appliedCoupon ? appliedCoupon.discount : manualDiscountAmount;
  const total = Number(Math.max(0, subtotal + tax - discountAmount).toFixed(2));
  const paid = total;
  const splitCashAmount = Number((Number(cashPaymentAmount) || 0).toFixed(2));
  const splitMadaAmount = Number(Math.max(0, total - splitCashAmount).toFixed(2));
  const appliedCouponCode = appliedCoupon?.code || '';
  useEffect(() => {
    if(!appliedCouponCode||!apiConnected||!apiToken||subtotal<=0)return;
    let active=true;
    fetch(`${apiBase.replace(/\/$/,'')}/api/coupons/validate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({code:appliedCouponCode,subtotal})})
      .then(async response=>{const result=await response.json();if(!response.ok||!result.coupon)throw new Error(result.error||'Coupon is no longer valid.');return result;})
      .then(result=>{if(active)setAppliedCoupon(current=>current?.code===appliedCouponCode?{...current,discount:Number(result.discount)}:current);})
      .catch(error=>{if(active){setAppliedCoupon(null);setCouponInput('');setToast(error instanceof Error?error.message:'Coupon could not be refreshed.');}});
    return ()=>{active=false;};
  },[appliedCouponCode,subtotal,apiConnected,apiToken,apiBase]);
  useEffect(() => { if (!apiConnected) save('musafir-branch-name', branchName); }, [branchName, apiConnected]);
  useEffect(() => { if (!apiConnected) save('musafir-receipt-footer', receiptFooter); }, [receiptFooter, apiConnected]);
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
  const clearCart = () => { orderIdempotencyKey.current = ''; orderIdempotencyPayload.current = ''; saveSession('musafir-order-idempotency-key',''); saveSession('musafir-order-idempotency-payload',''); setCart([]); setDiscount('0'); setCouponInput(''); setAppliedCoupon(null); setNote(''); setSelectedCustomerId(''); setSelectedTableId(''); setSplitPayment(false); setCashPaymentAmount('10'); };
  const printOrder = (order: Order) => {
    const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[char] || char));
    const popup = window.open('', '_blank', 'width=520,height=720');
    if (!popup) { flash('Allow pop-ups to open the receipt.'); return; }
    const rows = order.items.map(item => `<tr><td>${item.qty} × ${escapeHtml(item.name)}</td><td>${currency(item.unitPrice * item.qty)}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Receipt #${escapeHtml(order.number)}</title><style>body{font:14px Arial,sans-serif;color:#182d25;margin:0;padding:24px;background:#f4f1e9}.receipt{max-width:420px;margin:auto;background:#fff;padding:26px;border:1px solid #e3ddcf;border-radius:16px}.brand{text-align:center;color:#145044;font-size:22px;font-weight:800}.muted{text-align:center;color:#78837d;font-size:12px;margin:5px 0 18px}.meta{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #eee}table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:9px 0;border-bottom:1px solid #eee}td:last-child{text-align:right;white-space:nowrap}.total{display:flex;justify-content:space-between;border-top:2px solid #145044;padding-top:12px;font-size:19px;font-weight:800}.thanks{text-align:center;color:#78837d;margin-top:20px;font-size:12px}.actions{display:flex;gap:10px;margin:18px auto;max-width:420px}.actions button{flex:1;padding:12px;border:0;border-radius:9px;background:#145044;color:white;font-weight:700;cursor:pointer}.actions button:last-child{background:#e9e5d9;color:#24352d}@media print{body{padding:0;background:white}.receipt{border:0;border-radius:0}.actions{display:none}}</style></head><body><main class=\"receipt\"><div class=\"brand\">${escapeHtml(branchName)}</div><div class=\"muted\">Thank you for your order</div><div class=\"meta\"><span>Order #${escapeHtml(order.number)}</span><span>${new Date(order.createdAt).toLocaleString()}</span></div><div class=\"meta\"><span>${escapeHtml(order.type)}</span><span>${escapeHtml(order.customerName)}</span></div><table>${rows}</table><div class=\"total\"><span>Total paid</span><span>${currency(order.total)}</span></div><div class=\"thanks\">${escapeHtml(receiptFooter)} · شكراً لزيارتكم</div></main><div class=\"actions\"><button onclick=\"window.print()\">Print receipt</button><button onclick=\"window.close()\">Close</button></div></body></html>`);
    popup.document.close();
  };
  const placeOrder = async () => {
    if (orderSubmissionLock.current) return;
    if (!cart.length) { flash('Add at least one menu item first.'); return; }
    if (orderType==='Dine-in' && apiConnected && (!selectedTableId || !restaurantTables.some(table=>table.id===selectedTableId&&['Available','Reserved'].includes(table.status)))) { flash('Select an available restaurant table for this dine-in order.'); return; }
    if (splitPayment && (!Number.isFinite(splitCashAmount) || splitCashAmount <= 0 || splitCashAmount >= total)) { flash('For split payment, enter a Cash amount greater than zero and less than the order total.'); return; }
    const paymentBreakdown = splitPayment ? [{ method: 'Cash' as PaymentMethod, amount: Number(splitCashAmount.toFixed(2)) }, { method: 'Mada' as PaymentMethod, amount: Number(splitMadaAmount.toFixed(2)) }] : [{ method: payMethod, amount: Number(total.toFixed(2)) }];
    const orderPayload = { orderType, tableId: orderType==='Dine-in' ? selectedTableId || null : null, customerId: selectedCustomerId || null, paymentMethod: splitPayment ? 'Mada' as PaymentMethod : payMethod, payments: paymentBreakdown, discount: appliedCoupon ? 0 : discountAmount, couponCode: appliedCoupon?.code, taxRate: 0.15, notes: note, items: cart.map(item => ({ productId: item.productId, quantity: item.qty })) };
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
          status: 'Completed',
          createdAt: saved.created_at || new Date().toISOString(),
          customerName: customers.find(customer => customer.id === selectedCustomerId)?.name || 'Walk-in Guest',
          tableNumber: restaurantTables.find(table=>table.id===selectedTableId)?.tableNumber,
          items: cart.map(item => ({ id: item.id, productId: item.productId, name: item.name, qty: item.qty, unitPrice: item.price, note: note || undefined })),
          subtotal: Number(saved.subtotal),
          tax: Number(saved.tax),
          discount: Number(saved.discount),
          total: serverTotal,
          paid: paymentBreakdown.reduce((sum, payment) => sum + payment.amount, 0),
          paymentMethod: paymentBreakdown[paymentBreakdown.length - 1].method,
          paymentBreakdown,
          kitchenNote: note || undefined
        };
        setOrders(current => [order, ...current]);
        setLogs(current => [{ id: `log-${Date.now()}`, title: 'Server sale completed', detail: `Order #${order.number} · ${currency(serverTotal)} · ${paymentBreakdown.map(payment=>`${payment.method} ${currency(payment.amount)}`).join(' + ')}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
        clearCart(); setView('pos'); setCompletedOrder(order);
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
    const order: Order = { id: `o-${number}`, number, type: orderType, status: 'Completed', createdAt: new Date().toISOString(), customerName: customers.find(customer => customer.id === selectedCustomerId)?.name || 'Walk-in Guest', tableNumber: restaurantTables.find(table=>table.id===selectedTableId)?.tableNumber, items: cart.map(item => ({ id: item.id, productId: item.productId, name: item.name, qty: item.qty, unitPrice: item.price, note: note || undefined })), subtotal, tax, discount: discountAmount, total, paid: total, paymentMethod: paymentBreakdown[paymentBreakdown.length - 1].method, paymentBreakdown, kitchenNote: note || undefined };
    setInventory(current => current.map(item => {
      const amount = deductions.get(item.name.trim().toLowerCase()) || 0;
      return amount && item.trackStock ? { ...item, stock: item.stock - amount } : item;
    }));
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const stockLogs = inventory.flatMap(item => {
      const amount = deductions.get(item.name.trim().toLowerCase()) || 0;
      return amount && item.trackStock ? [{ id: `consume-${number}-${item.id}`, title: 'Stock consumed', detail: `Order #{number} · ${item.name} · -${amount} ${item.unit}`, time }] : [];
    });
    setOrders(current => [order, ...current]);
    if(selectedTableId)setRestaurantTables(current=>current.map(table=>table.id===selectedTableId?{...table,status:'Occupied' as TableRecord['status']}:table));
    setLogs(current => [
      { id: `log-${Date.now()}`, title: 'Sale completed', detail: `Order #{number} · ${currency(total)} · ${paymentBreakdown.map(payment=>`${payment.method} ${currency(payment.amount)}`).join(' + ')}`, time },
      ...stockLogs,
      ...current
    ]);
    clearCart(); setView('pos'); setCompletedOrder(order);
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
      const [menuResponse, categoryResponse, productsResponse, ordersResponse, inventoryResponse, suppliersResponse, purchasesResponse, customersResponse, settingsResponse] = await Promise.all([
        fetch(`${base}/api/menu?branchId=${encodeURIComponent(branchId)}`),
        fetch(`${base}/api/categories`, { headers: authHeaders }),
        fetch(`${base}/api/products`, { headers: authHeaders }),
        fetch(`${base}/api/orders?limit=150`, { headers: authHeaders }),
        fetch(`${base}/api/inventory`, { headers: authHeaders }),
        fetch(`${base}/api/suppliers`, { headers: authHeaders }),
        fetch(`${base}/api/purchases`, { headers: authHeaders }),
        fetch(`${base}/api/customers`, { headers: authHeaders }),
        fetch(`${base}/api/settings`, { headers: authHeaders })
      ]);
      const [menu, categoryData, productData, orderData, inventoryData, supplierData, purchaseData, customerData, settingsData] = await Promise.all([menuResponse.json(), categoryResponse.json(), productsResponse.json(), ordersResponse.json(), inventoryResponse.json(), suppliersResponse.json(), purchasesResponse.json(), customersResponse.json(), settingsResponse.json()]);
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
      setOrders(orderData.orders.map((saved: { id:string; order_number:number|string; order_type:Order['type']; status:string; created_at:string; customer_name:string; subtotal:string|number; tax:string|number; discount:string|number; total:string|number; paid:string|number; payment_method:string; payment_breakdown?:Array<{method:PaymentMethod;amount:string|number}>; notes?:string; items:Array<{id:string;productId:string|null;name:string;qty:number;unitPrice:string|number}> }) => ({
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
        paymentBreakdown: (saved.payment_breakdown || []).map(payment => ({method:payment.method === 'Mada' ? 'Mada' : 'Cash',amount:Number(payment.amount)})),
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


  const themeStudio = (): ReactNode => {
    const colorLabels: Array<{key:keyof ThemeConfig['customColors'];label:string}> = [
      {key:'accent',label:'Accent / gold'}, {key:'background',label:'Workspace background'}, {key:'surface',label:'Cards & panels'}, {key:'sidebar',label:'Sidebar & topbar'}
    ];
    const updateThemeColor = (key:keyof ThemeConfig['customColors'], value:string) => setDraftThemeConfig(current=>({...current,customColors:{...current.customColors,[key]:value}}));
    return <section className={panel + " p-5 md:p-7"}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.2em]" style={{color:'var(--theme-accent)'}}>Appearance & identity</p><h2 className="mt-1 text-lg font-semibold text-white">Theme Studio</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Choose a global visual identity, preview it live, and save it for this device. Theme preferences never modify sales, tax, payment or database records.</p></div>
        <span className="rounded-full border px-3 py-1 text-[10px]" style={{borderColor:'var(--theme-border)',color:'var(--theme-muted)'}}>International UI · Saudi settings preserved</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(themePresets) as ThemePresetName[]).map(name=>{
          const palette=themePresets[name]; const selected=draftThemeConfig.preset===name;
          return <button key={name} type="button" onClick={()=>setDraftThemeConfig(current=>({...current,preset:name,customColors:{accent:palette.accent,background:palette.background,surface:palette.surface,sidebar:palette.sidebar}}))} aria-pressed={selected} className="rounded-2xl border p-3 text-left transition" style={{borderColor:selected?'var(--theme-accent)':'var(--theme-border)',background:selected?'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface))':'var(--theme-surface)'}}>
            <div className="mb-3 flex h-12 overflow-hidden rounded-xl"><span className="flex-1" style={{background:palette.sidebar}}/><span className="flex-1" style={{background:palette.background}}/><span className="flex-1" style={{background:palette.surface}}/><span className="w-7" style={{background:palette.accent}}/></div>
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold" style={{color:'var(--theme-text)'}}>{name}</span>{selected&&<span className="text-[10px] font-semibold" style={{color:'var(--theme-accent)'}}>Selected</span>}</div>
            <div className="mt-1 text-[10px]" style={{color:'var(--theme-muted)'}}>{name==='Arabian Royal'?'Forest green · champagne gold':name==='Midnight Executive'?'Midnight navy · royal gold':name==='Obsidian Luxe'?'Charcoal · copper':name==='Burgundy Signature'?'Burgundy · rose gold':'Ivory · sage · muted gold'}</div>
          </button>;
        })}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
        <div className="rounded-2xl border p-4" style={{borderColor:'var(--theme-border)',background:'var(--theme-surface)'}}>
          <h3 className="mb-3 text-sm font-semibold" style={{color:'var(--theme-text)'}}>Custom color controls</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {colorLabels.map(item=><label key={item.key} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{borderColor:'var(--theme-border)'}}>
              <span className="text-xs" style={{color:'var(--theme-muted)'}}>{item.label}</span>
              <span className="flex items-center gap-2"><code className="text-[10px]" style={{color:'var(--theme-text)'}}>{draftThemeConfig.customColors[item.key]}</code><input aria-label={item.label} type="color" value={draftThemeConfig.customColors[item.key]} onChange={event=>updateThemeColor(item.key,event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"/></span>
            </label>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs" style={{color:'var(--theme-muted)'}}>Appearance</span>
            {(['Both','Light','Dark'] as const).map(mode=><button key={mode} type="button" onClick={()=>{setDraftThemeConfig(current=>({...current,appearance:mode}));if(mode==='Light')setDraftLight(true);if(mode==='Dark')setDraftLight(false);}} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:draftThemeConfig.appearance===mode?'var(--theme-accent)':'var(--theme-border)',color:draftThemeConfig.appearance===mode?'var(--theme-accent)':'var(--theme-muted)'}}>{mode==='Both'?'Light + Dark':mode}</button>)}
          </div>
        </div>
        <div className="rounded-2xl border p-4" style={{borderColor:'var(--theme-border)',background:'var(--theme-surface)'}}>
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold" style={{color:'var(--theme-text)'}}>Live preview</h3><span className="text-[10px]" style={{color:'var(--theme-muted)'}}>{draftLight?'Light mode':'Dark mode'}</span></div>
          <div className="overflow-hidden rounded-xl border" style={{borderColor:'var(--theme-border)',background:draftLight?'#F4F0E7':themePresets[draftThemeConfig.preset].background}}>
            <div className="flex items-center justify-between px-3 py-3" style={{background:draftThemeConfig.customColors.sidebar,color:'#fff'}}><span className="text-xs font-semibold">MUSAFIR · POS</span><span className="text-[10px]">Dashboard　 Orders　 Settings</span></div>
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="rounded-lg p-3" style={{background:draftLight?'#fff':draftThemeConfig.customColors.surface,color:draftLight?'#26332C':'#F4F0E7'}}><div className="text-[9px] opacity-70">TODAY'S SALES</div><div className="mt-1 text-lg font-semibold">SAR 8,420</div></div>
              <div className="rounded-lg p-3" style={{background:draftLight?'#fff':draftThemeConfig.customColors.surface,color:draftLight?'#26332C':'#F4F0E7'}}><div className="text-[9px] opacity-70">ORDERS</div><div className="mt-1 text-lg font-semibold">128</div></div>
              <div className="col-span-2 flex items-center justify-between rounded-lg p-3" style={{background:draftLight?'#fff':draftThemeConfig.customColors.surface,color:draftLight?'#26332C':'#F4F0E7'}}><span className="text-xs">Primary action</span><span className="rounded-lg px-3 py-2 text-[10px] font-semibold" style={{background:draftThemeConfig.customColors.accent,color:'#17130B'}}>Complete order</span></div>
            </div>
          </div>
          <p className="mt-2 text-[10px]" style={{color:'var(--theme-muted)'}}>Preview uses sample figures only; no business data is changed.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={()=>{setDraftThemeConfig(defaultThemeConfig);setDraftLight(false);}} className="rounded-xl border px-4 py-2.5 text-xs" style={{borderColor:'var(--theme-border)',color:'var(--theme-muted)'}}>Reset draft</button>
        <button type="button" onClick={()=>{setThemeConfig(draftThemeConfig);setLight(draftLight);save('musafir-theme-config',draftThemeConfig);save('musafir-theme-light',draftLight);flash('Theme preferences saved on this device.');}} className="rounded-xl px-4 py-2.5 text-xs font-semibold" style={{background:'var(--theme-accent)',color:'var(--theme-accent-contrast)'}}>Apply theme</button>
        <button type="button" onClick={()=>{setThemeConfig(defaultThemeConfig);setDraftThemeConfig(defaultThemeConfig);setLight(false);setDraftLight(false);save('musafir-theme-config',defaultThemeConfig);save('musafir-theme-light',false);flash('Default Arabian Royal theme restored.');}} className="rounded-xl border px-4 py-2.5 text-xs" style={{borderColor:'var(--theme-border)',color:'var(--theme-muted)'}}>Reset all</button>
      </div>
    </section>;
  };

  const apiSettings = (): ReactNode => <div className="space-y-4">
  {themeStudio()}
  <section className="rounded-2xl border border-white/[.07] bg-[#171c21] max-w-2xl p-5 md:p-7">
    <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#caa348]">Branch configuration</p><h2 className="mt-1 text-lg font-semibold text-white">Restaurant identity & receipt</h2><p className="mt-1 text-xs text-slate-400">Save branch details to the live database and keep Saudi checkout defaults consistent.</p></div>
    <label className="mb-1 block text-xs text-slate-400">Branch display name</label><input value={branchName} onChange={event=>setBranchName(event.target.value)} maxLength={100} disabled={apiConnected&&!["owner","manager"].includes(apiRole)} className="field mb-3 w-full disabled:opacity-50"/>
    <label className="mb-1 block text-xs text-slate-400">Receipt footer</label><textarea value={receiptFooter} onChange={event=>setReceiptFooter(event.target.value)} maxLength={200} rows={2} disabled={apiConnected&&!["owner","manager"].includes(apiRole)} className="field mb-3 w-full resize-none disabled:opacity-50"/>
    <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/[.025] p-3 text-center"><div><div className="text-[10px] text-slate-500">Currency</div><div className="mt-1 text-sm font-semibold text-white">SAR</div></div><div><div className="text-[10px] text-slate-500">VAT</div><div className="mt-1 text-sm font-semibold text-white">15%</div></div><div><div className="text-[10px] text-slate-500">Payments</div><div className="mt-1 text-xs font-semibold text-white">Cash · Mada</div></div></div>
    <button onClick={()=>void saveBranchConfiguration()} disabled={apiConnected&&!['owner','manager'].includes(apiRole)} className="rounded-xl bg-[#e7b943] px-4 py-2.5 text-sm font-semibold text-[#17130b] disabled:opacity-40">Save branch settings</button>
    <p className="mt-3 text-[11px] text-slate-500">{apiConnected?'Branch identity and receipt footer are stored in PostgreSQL.':'Saved on this device until the backend is connected.'}</p>
  </section><section className={`${panel} max-w-2xl p-5 md:p-7`}>
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
  const collectQrOrderPayment = async (order: Order, method: PaymentMethod) => {
    const amount = Number(Math.max(0, order.total - order.paid).toFixed(2));
    if (amount <= 0) { flash('This order is already paid.'); return; }
    if (!apiToken || !apiConnected) { flash('Connect the POS database before collecting QR order payments.'); return; }
    try {
      const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const response = await fetch(base + '/api/orders/' + encodeURIComponent(order.id) + '/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiToken },
        body: JSON.stringify({ amount, method, note: 'QR order balance collected at POS' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payment could not be recorded.');
      setOrders(current => current.map(item => item.id === order.id ? {
        ...item,
        paid: Number(result.paid),
        paymentMethod: method,
        paymentBreakdown: [...(item.paymentBreakdown || []), { method, amount }]
      } : item));
      flash('Collected ' + currency(amount) + ' by ' + method + '.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not collect QR order payment.');
    }
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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[{label:'Sales today',value:currency(salesToday),icon:CircleDollarSign,sub:`${todayOrders.length} paid orders`},{label:'Orders today',value:String(todayOrders.length),icon:ClipboardList,sub:`${orders.filter(o=>o.status!=='Completed'&&o.number!=='HOLD').length} in progress`},{label:'Customers',value:String(customers.length),icon:Users,sub:'Saved customer profiles'},{label:'Low stock',value:String(lowStock.length),icon:Boxes,sub:lowStock.length?'Restock recommended':'Stock levels healthy'}].map((card,index)=><div key={card.label} className={`${panel} p-4`}><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{card.label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${index===3&&lowStock.length?'bg-rose-400/10 text-rose-300':'bg-[#e6b23d]/10 text-[#e7b943]'}`}><card.icon size={17}/></span></div><div className="mt-4 text-2xl font-semibold text-white">{card.value}</div><div className="mt-1 text-xs text-slate-500">{card.sub}</div></div>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <section className={`${panel} p-5`}><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-white">Sales activity</h2><p className="mt-1 text-xs text-slate-500">Actual order totals · last 7 days</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">SAR</span></div><div className="flex h-44 items-end gap-3 border-b border-l border-white/[.07] px-3 pb-0">{week.map(item=><div key={item.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div title={currency(item.amount)} className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-[#a9791e] to-[#f0c85c] transition-all" style={{height:`${item.amount ? Math.max(8,item.amount/maxWeek*78):3}%`}}/><span className="mb-2 text-[10px] text-slate-500">{item.day}</span></div>)}</div></section>
      <section className={`${panel} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Best sellers</h2><p className="mt-1 text-xs text-slate-500">Based on recorded order items</p></div><button onClick={()=>setView('reports')} className="text-xs text-[#e7b943] hover:text-white">View report</button></div>{topProducts.length?<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{topProducts.map((item,index)=><div key={item.name} className="min-w-0 rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e7b943]/10 text-[10px] font-semibold text-[#e7b943]">0{index+1}</span><span className="text-[10px] text-slate-500">{item.qty} sold</span></div><div className="mt-2 truncate text-xs font-medium text-slate-200">{item.name}</div></div>)}</div>:<p className="py-8 text-center text-sm text-slate-500">Sales data will appear here after orders are placed.</p>}</section>
    </div>
    <div className="grid gap-4 xl:grid-cols-2"><section className={`${panel} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Recent orders</h2><p className="mt-1 text-xs text-slate-500">Latest sales and held checks</p></div><button onClick={()=>setView('orders')} className="text-xs text-[#e7b943]">All orders →</button></div><div className="grid grid-cols-2 gap-2">{orders.slice(0,4).map(order=><div key={order.id} className="min-w-0 rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-200">{order.number==='HOLD'?'Held order':`#${order.number}`}</span><span className="shrink-0 text-[10px] text-[#d9b752]">{order.number==='HOLD'?'Hold':order.status}</span></div><div className="mt-2 truncate text-[11px] text-slate-400">{order.customerName}</div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-500">{order.type}</span><span className="text-xs font-semibold text-white">{currency(order.total)}</span></div></div>)}</div></section><section className={`${panel} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Stock watch</h2><p className="mt-1 text-xs text-slate-500">Items at or below reorder point</p></div><button onClick={()=>setView('inventory')} className="text-xs text-[#e7b943]">Inventory →</button></div>{lowStock.length?<div className="grid grid-cols-2 gap-2">{lowStock.slice(0,4).map(item=><div key={item.id} className="min-w-0 rounded-xl border border-rose-400/10 bg-rose-400/[.035] p-3"><div className="truncate text-xs font-medium text-slate-200">{item.name}</div><div className="mt-2 flex items-center justify-between gap-1"><span className="truncate text-[10px] text-slate-500">Reorder {item.reorderLevel}</span><span className="shrink-0 rounded-md bg-rose-400/10 px-2 py-1 text-[10px] text-rose-300">{item.stock} {item.unit}</span></div></div>)}</div>:<p className="py-8 text-center text-sm text-slate-500">No low-stock items.</p>}</section></div>
  </div>;

  const pos = (): ReactNode => <div className="musafir-pos grid gap-4 2xl:grid-cols-[minmax(0,1.12fr)_minmax(330px,.9fr)_minmax(290px,.82fr)] xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="musafir-surface rounded-2xl border p-4 md:p-5"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div>{heading('Front counter','Create an order','Choose items, then review and pay at the checkout.')}</div><div className="flex gap-1 rounded-xl bg-black/20 p-1">{(['Dine-in','Takeaway','Pickup','Home Delivery'] as Order['type'][]).map(type=><button key={type} onClick={()=>setOrderType(type)} className={`rounded-lg px-2.5 py-2 text-[11px] transition ${orderType===type?'bg-[#e7b943] font-semibold text-[#17130b]':'text-slate-400 hover:text-white'}`}>{type}</button>)}</div></div><div className="mb-4 flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input ref={menuSearchRef} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search menu..." className="field w-full pl-9"/></div><button onClick={()=>setCategory('All')} className="rounded-xl border border-white/10 px-3 text-xs text-slate-300">Reset</button></div><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{['All',...menuCategories.map(item=>item.name)].map(item=><button key={item} onClick={()=>setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${category===item?'bg-[#e7b943] font-semibold text-[#17130b]':'border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'}`}>{item}</button>)}</div><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{filteredProducts.map(product=><button key={product.id} onClick={()=>addToCart(product)} className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e2ddcf] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#145044]/40 hover:shadow-md"><div className="relative aspect-[4/3] w-full overflow-hidden bg-[#22272c]"><img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/><span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-[#e7b943] text-[#17130b] shadow-lg"><Plus size={15}/></span></div><div className="flex min-h-[76px] w-full flex-col p-2.5"><div className="line-clamp-2 min-h-8 text-xs font-semibold leading-4 text-[#18382f]">{product.name}</div><div className="mt-auto flex items-center justify-between gap-1 pt-2"><span className="truncate text-[11px] font-bold text-[#145044]">{currency(product.price)}</span><span className="max-w-[45%] truncate text-[9px] text-[#78837d]">{product.category}</span></div></div></button>)}</div>{!filteredProducts.length&&<div className="py-16 text-center text-sm text-slate-500">No menu items match this search.</div>}</section>
    <aside className="musafir-surface flex flex-col rounded-2xl border p-4 md:p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#caa348]">Checkout</p><h2 className="mt-1 text-lg font-semibold text-white">Current order <span className="text-sm text-slate-500">({cart.reduce((n,item)=>n+item.qty,0)})</span></h2></div><button onClick={clearCart} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/5 hover:text-rose-300">Clear</button></div><div className="mt-4 max-h-[34vh] min-h-24 flex-1 space-y-2 overflow-y-auto">{cart.length?cart.map(item=><div key={item.productId} className="flex items-center gap-3 rounded-xl bg-white/[.035] p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-white">{item.name}</div><div className="mt-1 text-xs text-slate-500">{currency(item.price)} each</div></div><div className="flex items-center gap-2"><button aria-label={`Decrease ${item.name}`} onClick={()=>setCart(current=>current.map(entry=>entry.productId===item.productId?{...entry,qty:entry.qty-1}:entry).filter(entry=>entry.qty>0))} className="qty-btn">−</button><span className="w-4 text-center text-xs text-white">{item.qty}</span><button aria-label={`Increase ${item.name}`} onClick={()=>setCart(current=>current.map(entry=>entry.productId===item.productId?{...entry,qty:entry.qty+1}:entry))} className="qty-btn">+</button></div><div className="w-16 text-right text-xs font-semibold text-white">{currency(item.price*item.qty)}</div></div>):<div className="grid h-full min-h-28 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-slate-600">Your order is empty</div>}</div><label className="mt-3 block text-xs text-slate-400">Restaurant table</label><select aria-label="Restaurant table" value={selectedTableId} onChange={event=>setSelectedTableId(event.target.value)} disabled={orderType!=='Dine-in'} className="field mt-1 w-full disabled:opacity-40"><option value="">No table selected</option>{restaurantTables.filter(table=>['Available','Reserved'].includes(table.status)).map(table=><option key={table.id} value={table.id}>Table {table.tableNumber} · {table.seats} seats · {table.status}</option>)}</select>{orderType==='Dine-in'&&apiConnected&&!restaurantTables.length&&<p className="mt-1 text-[11px] text-amber-200/70">Add restaurant tables before taking a dine-in order.</p>}<label className="mt-3 block text-xs text-slate-400">Customer (optional)</label><select aria-label="Select customer" value={selectedCustomerId} onChange={event=>setSelectedCustomerId(event.target.value)} className="field mt-1 w-full"><option value="">Walk-in Guest</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}{customer.phone?` · ${customer.phone}`:''}</option>)}</select><label className="mt-3 text-xs text-slate-400">Order note</label><textarea value={note} onChange={event=>setNote(event.target.value)} rows={2} placeholder="Allergies, no onions, extra sauce…" className="field mt-1 resize-none"/><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setSplitPayment(false)} className={`rounded-lg border py-2 text-xs ${!splitPayment?'border-[#dfb248]/50 bg-[#dfb248]/10 text-[#f0d27c]':'border-white/10 text-slate-400'}`}>Single payment</button><button onClick={()=>setSplitPayment(true)} className={`rounded-lg border py-2 text-xs ${splitPayment?'border-[#dfb248]/50 bg-[#dfb248]/10 text-[#f0d27c]':'border-white/10 text-slate-400'}`}>Split Cash + Mada</button></div>{splitPayment?<div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3"><label className="text-xs text-slate-400">Cash amount (SAR)</label><input aria-label="Cash payment amount" type="number" min="0.01" max={Math.max(0,total-0.01)} step="0.01" value={cashPaymentAmount} onChange={event=>setCashPaymentAmount(event.target.value)} className="field mt-1 w-full"/><div className="mt-2 flex justify-between text-xs text-slate-400"><span>Cash</span><span>{currency(Math.max(0,splitCashAmount))}</span></div><div className="mt-1 flex justify-between text-xs text-slate-400"><span>Mada remaining</span><span>{currency(splitMadaAmount)}</span></div><div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs font-semibold text-white"><span>Total payment</span><span>{currency(Math.max(0,splitCashAmount)+splitMadaAmount)}</span></div></div>:<div className="mt-3 grid grid-cols-2 gap-2">{(['Cash','Mada'] as PaymentMethod[]).map(method=><button key={method} onClick={()=>setPayMethod(method)} className={`rounded-lg border py-2 text-xs ${payMethod===method?'border-[#dfb248]/50 bg-[#dfb248]/10 text-[#f0d27c]':'border-white/10 text-slate-400'}`}>{method}</button>)}</div>}<div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3"><label className="text-xs text-slate-400">Coupon code</label><div className="mt-2 flex gap-2"><input aria-label="Coupon code" value={couponInput} onChange={event=>setCouponInput(event.target.value.toUpperCase())} placeholder="Enter coupon code" className="field min-w-0 flex-1" disabled={!apiConnected||couponBusy}/><button onClick={()=>void applyCoupon()} disabled={!apiConnected||couponBusy||!couponInput.trim()||!subtotal} className="rounded-lg bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b] disabled:opacity-40">{couponBusy?'Checking…':'Apply'}</button></div>{appliedCoupon&&<div className="mt-2 flex items-center justify-between text-xs"><span className="text-emerald-300">{appliedCoupon.code} applied · −{currency(appliedCoupon.discount)}</span><button onClick={()=>{setAppliedCoupon(null);setCouponInput('');}} className="text-rose-300">Remove</button></div>}{!apiConnected&&<p className="mt-2 text-[10px] text-slate-500">Connect the live POS database to validate coupon codes.</p>}</div><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Manual discount (%)</span><input aria-label="Discount percent" type="number" min="0" max="100" value={discount} disabled={Boolean(appliedCoupon)||(apiConnected && apiRole !== "owner" && apiRole !== "manager")} onChange={event=>{setAppliedCoupon(null);setCouponInput('');setDiscount(String(Math.max(0,Math.min(100,Number(event.target.value)||0))));}} className="field w-20 py-1.5 text-right disabled:cursor-not-allowed disabled:opacity-40"/></div>{apiConnected && apiRole !== "owner" && apiRole !== "manager" && <p className="mt-2 text-[11px] text-amber-200/70">Discounts require owner or manager authorization.</p>}<div className="mt-3 space-y-2 border-t border-white/[.07] pt-3 text-sm"><div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{currency(subtotal)}</span></div><div className="flex justify-between text-slate-400"><span>VAT (15%)</span><span>{currency(tax)}</span></div><div className="flex justify-between text-slate-400"><span>Discount</span><span>−{currency(discountAmount)}</span></div><div className="flex justify-between pt-1 text-lg font-semibold text-white"><span>Total</span><span className="text-[#efc75e]">{currency(total)}</span></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={holdOrder} disabled={!cart.length} className="rounded-xl border border-white/10 py-2.5 text-xs text-slate-300 disabled:opacity-40">Hold order</button><button onClick={()=>window.print()} disabled={!cart.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs text-slate-300 disabled:opacity-40"><Printer size={14}/> Print</button><button onClick={placeOrder} disabled={!cart.length || isSubmittingOrder} className="col-span-2 rounded-xl bg-[#e7b943] py-3 text-sm font-bold text-[#17130b] transition hover:bg-[#f4ca60] disabled:cursor-not-allowed disabled:opacity-40">{isSubmittingOrder ? 'Saving order…' : `Complete order · ${currency(total)}`}</button></div></aside>

  </div>;

  const ordersView = (): ReactNode => <section className={`${panel} p-5`}><div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Sales history','Orders','Every confirmed sale stays here. Open any receipt and print only when needed.')}</div><div className="space-y-3">{orders.map(order=><article key={order.id} className="rounded-2xl border border-white/[.07] bg-[#191e24] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold text-white">{order.number==='HOLD'?'Held check':`Order #${order.number}`} <span className="ml-2 text-xs font-normal text-slate-400">{order.customerName}</span></div><div className="mt-1 text-xs text-slate-500">{order.type}{order.tableNumber?` · Table ${order.tableNumber}`:''} · {new Date(order.createdAt).toLocaleString()}</div></div><div className="flex items-center gap-2"><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">{order.number==='HOLD'?'On hold':'Saved'}</span>{order.number==='HOLD'&&<button onClick={()=>resumeOrder(order)} className="rounded-lg bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">Resume</button>}<button onClick={()=>printOrder(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-[#e7b943]/40"><Printer size={13}/> Print</button></div></div><div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-white/[.06] pt-3 text-xs text-slate-400"><span>{order.items.map(item=>`${item.qty}× ${item.name}`).join(' · ')}</span><span className="font-semibold text-[#e7b943]">{currency(order.total)} · Paid {currency(order.paid)}{order.paymentBreakdown?.length ? ` · ${order.paymentBreakdown.map(payment=>`${payment.method} ${currency(payment.amount)}`).join(' + ')}` : ''}</span></div></article>)}</div>{!orders.length&&<p className="py-12 text-center text-slate-500">No completed orders yet.</p>}</section>;

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
        <div className="space-y-2">{homeOrders.map(order=>{const delivery=deliveries.find(item=>item.order_id===order.id);return <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div><div className="font-semibold text-white">Order #${order.number} · {order.customerName}</div><div className="mt-1 text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()} · {currency(order.total)} · {delivery?delivery.driver_name:'Not assigned'}</div>{delivery?.delivery_address&&<div className="mt-1 text-xs text-slate-500">{delivery.delivery_address}</div>}</div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/[.06] px-2.5 py-1 text-xs text-slate-300">{delivery?.status||'Awaiting dispatch'}</span>{!delivery||['Failed','Delivered'].includes(delivery.status)?<button onClick={()=>assignDelivery(order)} className="rounded-lg bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">{delivery?'Reassign':'Assign driver'}</button>:delivery.status==='Assigned'?<button onClick={()=>updateDeliveryStatus(delivery,'Picked Up')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Mark picked up</button>:delivery.status==='Picked Up'?<button onClick={()=>updateDeliveryStatus(delivery,'Delivered')} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs text-emerald-300">Mark delivered</button>:null}</div></article>;})}{!homeOrders.length&&<p className="py-10 text-center text-sm text-slate-500">No home delivery orders found.</p>}</div>
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
  const updateAttendance = async (employee: Employee, date = localDate()) => {
    const statuses: Employee['status'][] = ['Present', 'Absent', 'On Leave'];
    const next = statuses[(statuses.indexOf(employee.status) + 1) % statuses.length];
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/attendance`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({employeeId:employee.id,date,status:next}) });
        const result = await response.json();
        if (!response.ok || !result.attendance) throw new Error(result.error || 'Attendance was not saved.');
      } catch(error) { flash(error instanceof Error ? error.message : 'Attendance was not saved.'); return; }
    }
    if (date === localDate()) setEmployees(current => current.map(item => item.id === employee.id ? { ...item, status: next } : item));
    if (date === attendanceDate) setAttendanceRows(current => current.map(item => item.employeeId === employee.id ? { ...item, status: next } : item));
    setLogs(current => [{ id: `attendance-${Date.now()}`, title: 'Attendance updated', detail: `${employee.name} · ${next}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
  };
  const changeEmployeeActive = async (employee: Employee, active: boolean) => {
    const action = active ? 'reactivate' : 'deactivate';
    if (!active && !window.confirm('Deactivate ' + employee.name + '? Attendance and payroll history will be kept.')) return;
    if (apiConnected && apiToken) {
      try {
        const url = apiBase.replace(/\/$/, '') + '/api/employees/' + encodeURIComponent(employee.id) + '/' + action;
        const response = await fetch(url, { method:'POST', headers:{Authorization:'Bearer ' + apiToken} });
        const result = await response.json();
        if (!response.ok || !result.employee) throw new Error(result.error || 'Employee status could not be updated.');
      } catch(error) { flash(error instanceof Error ? error.message : 'Employee status could not be updated.'); return; }
    }
    setEmployees(current => current.map(item => item.id === employee.id ? { ...item, active } : item));
    flash(active ? employee.name + ' reactivated.' : employee.name + ' deactivated.');
  };
  const employeesView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5 flex items-end justify-between gap-3">{heading('Team operations','Employee management','Maintain staff profiles, shifts and attendance status.') }{canManageHr&&<button onClick={addEmployee} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">Add employee</button>}</div>
    <div className="mb-4 grid grid-cols-3 gap-2">{[{label:'Present',count:employees.filter(item=>item.status==='Present').length},{label:'Absent',count:employees.filter(item=>item.status==='Absent').length},{label:'On leave',count:employees.filter(item=>item.status==='On Leave').length}].map(item=><div key={item.label} className="rounded-xl bg-white/[.035] p-3"><div className="text-xs text-slate-400">{item.label}</div><div className="mt-1 text-xl font-semibold text-white">{item.count}</div></div>)}</div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{employees.map(employee=><article key={employee.id} className="rounded-2xl border border-white/[.07] bg-[#191e24] p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{employee.name}</h3><p className="mt-1 text-xs text-slate-400">{employee.role} · {employee.shift}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${employee.status==='Present'?'bg-emerald-400/10 text-emerald-300':employee.status==='Absent'?'bg-rose-400/10 text-rose-300':'bg-amber-400/10 text-amber-200'}`}>{employee.active===false?'Inactive':employee.status}</span></div><div className="mt-4 border-t border-white/[.06] pt-3 text-sm"><div className="flex justify-between text-slate-400"><span>Monthly salary</span><strong className="text-white">{currency(employee.salary)}</strong></div><div className="mt-2 flex justify-between text-slate-400"><span>Advance recorded</span><strong className="text-white">{currency(employee.advance)}</strong></div></div>{canManageHr&&<div className="mt-4 flex flex-wrap gap-2">{employee.active===false?<button onClick={()=>changeEmployeeActive(employee,true)} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs text-emerald-300">Reactivate</button>:<><button onClick={()=>editEmployee(employee)} className="flex-1 rounded-lg border border-white/10 px-2 py-2 text-xs text-slate-300">Edit profile</button><button onClick={()=>updateAttendance(employee)} className="flex-1 rounded-lg border border-[#e7b943]/30 px-2 py-2 text-xs text-[#e7b943]">Update attendance</button><button onClick={()=>changeEmployeeActive(employee,false)} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-300">Deactivate</button></>}</div>}</article>)}</div>
  </section>;
  const attendanceView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Daily operations','Staff attendance',apiConnected?'Choose a date and record one status per employee.':'Cycle each employee through Present, Absent and On Leave.')}{apiConnected&&<input type="date" value={attendanceDate} max={localDate()} onChange={event=>{if(event.target.value)setAttendanceDate(event.target.value);}} className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-slate-200"/>}</div>
    <div className="space-y-2">{(apiConnected?attendanceRows:employees.filter(employee=>employee.active!==false).map(employee=>({employeeId:employee.id,name:employee.name,role:employee.role,shift:employee.shift,status:employee.status}))).map(row=>{const employee=employees.find(item=>item.id===row.employeeId);return <div key={row.employeeId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[.035] p-3"><div><div className="text-sm font-medium text-white">{row.name}</div><div className="mt-1 text-xs text-slate-500">{row.role} · {row.shift}</div></div><div className="flex items-center gap-2"><span className="text-xs text-slate-400">{row.status}</span>{canManageHr&&employee&&<button onClick={()=>updateAttendance({...employee,status:row.status},attendanceDate)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200">Change status</button>}</div></div>;})}</div>
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
    const activeEmployees = employees.filter(employee => employee.active !== false);
    if (!activeEmployees.length) { flash('Add an active employee before creating payroll.'); return; }
    const period = window.prompt('Payroll month (YYYY-MM)', localDate().slice(0, 7)) || '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) { flash('Enter a valid payroll month in YYYY-MM format.'); return; }
    const employeeOptions = activeEmployees.map((employee, index) => `${index + 1}. ${employee.name} · ${currency(employee.salary)}`).join('\n');
    const choice = Number(window.prompt(`Select employee:\n${employeeOptions}`, '1'));
    if (!Number.isInteger(choice) || choice < 1 || choice > activeEmployees.length) { flash('Select a valid employee.'); return; }
    const employee = activeEmployees[choice - 1];
    if (payroll.some(item => item.employeeId === employee.id && item.period === period)) { flash('Payroll already exists for this employee and month.'); return; }
    const bonus = Number(window.prompt('Bonus (SAR)', '0'));
    if (!Number.isFinite(bonus) || bonus < 0) { flash('Enter a valid bonus amount.'); return; }
    const deduction = Number(window.prompt('Other deduction (SAR)', '0'));
    if (!Number.isFinite(deduction) || deduction < 0 || deduction > employee.salary + bonus) { flash('Enter a valid deduction amount.'); return; }
    const advanceDeduction = Number(window.prompt(`Outstanding advance: ${currency(employee.advance)}. Deduct how much?`, String(Math.min(employee.advance, employee.salary + bonus - deduction))));
    if (!Number.isFinite(advanceDeduction) || advanceDeduction < 0 || advanceDeduction > employee.advance || deduction + advanceDeduction > employee.salary + bonus) { flash('Total deductions exceed the available salary.'); return; }
    const deductionNote = deduction > 0 ? (window.prompt('Deduction reason (optional)', '') || '').trim() : '';
    const netSalary = employee.salary + bonus - deduction - advanceDeduction;
    const record: PayrollRecord = { id: `payroll-${employee.id}-${period}`, employeeId: employee.id, employeeName: employee.name, period, baseSalary: employee.salary, bonus, deduction, otherDeduction: deduction, deductionNote, advanceDeduction, netSalary, payments: [], createdAt: new Date().toISOString() };
    if (apiConnected && apiToken) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/payroll`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`}, body:JSON.stringify({employeeId:employee.id,period,bonus,otherDeduction:deduction,deductionNote,advanceDeduction}) });
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
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Finance & team','Salary & payroll','Create monthly salary records, track advances and record Cash or Mada payments. Connected mode stores team and payroll records in PostgreSQL.')}{canManageHr&&<button onClick={createPayroll} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b]">Create payroll</button>}</div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:'This month payroll',value:monthRecords.reduce((sum,item)=>sum+item.netSalary,0)},{label:'Salary paid',value:totalPaid},{label:'Salary outstanding',value:totalDue}].map(card=><div key={card.label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{currency(card.value)}</div></div>)}</div>
        <div className="mb-5 space-y-2">{employees.filter(employee=>employee.active!==false).map(employee=><div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[.035] p-3"><div><div className="text-sm font-medium text-white">{employee.name}</div><div className="mt-1 text-xs text-slate-500">Monthly salary {currency(employee.salary)} · Advance outstanding {currency(employee.advance)}</div></div>{canManageHr&&<button onClick={()=>recordSalaryAdvance(employee)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Record advance</button>}</div>)}</div>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Month</th><th className="pb-3">Employee</th><th className="pb-3 text-right">Net salary</th><th className="pb-3 text-right">Paid</th><th className="pb-3 text-right">Remaining</th><th className="pb-3">Status</th><th className="pb-3"/></tr></thead><tbody>{payroll.slice().sort((a,b)=>b.period.localeCompare(a.period)||a.employeeName.localeCompare(b.employeeName)).map(record=>{const paidAmount=record.payments.reduce((sum,payment)=>sum+payment.amount,0);const remaining=Math.max(0,record.netSalary-paidAmount);return <tr key={record.id} className="border-t border-white/[.06]"><td className="py-3 text-slate-400">{record.period}</td><td className="py-3 font-medium text-white">{record.employeeName}<div className="mt-1 text-[10px] text-slate-500">Base {currency(record.baseSalary)} · Bonus {currency(record.bonus)} · Other deduction {currency(record.deduction)}{record.deductionNote ? ` (${record.deductionNote})` : ''} · Advance deduction {currency(record.advanceDeduction)}</div></td><td className="py-3 text-right text-white">{currency(record.netSalary)}</td><td className="py-3 text-right text-emerald-300">{currency(paidAmount)}</td><td className="py-3 text-right text-amber-200">{currency(remaining)}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[10px] ${remaining===0?'bg-emerald-400/10 text-emerald-300':paidAmount>0?'bg-amber-400/10 text-amber-200':'bg-white/[.06] text-slate-400'}`}>{remaining===0?'Paid':paidAmount>0?'Part-paid':'Unpaid'}</span></td><td className="py-3 text-right">{remaining>0&&<button onClick={()=>recordPayrollPayment(record)} className="rounded-lg border border-[#e7b943]/30 px-2.5 py-1.5 text-xs text-[#e7b943]">Pay salary</button>}</td></tr>})}</tbody></table>{!payroll.length&&<p className="py-10 text-center text-sm text-slate-500">No payroll records. Create a monthly payroll to begin.</p>}</div>
        <div className="space-y-3 sm:hidden">{payroll.slice().sort((a,b)=>b.period.localeCompare(a.period)||a.employeeName.localeCompare(b.employeeName)).map(record=>{const paidAmount=record.payments.reduce((sum,payment)=>sum+payment.amount,0);const remaining=Math.max(0,record.netSalary-paidAmount);return <article key={record.id} className="rounded-xl border border-white/[.08] bg-white/[.025] p-3"><div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold text-white">{record.employeeName}</div><div className="mt-1 text-[11px] text-slate-400">{record.period}</div></div><span className={remaining===0?'rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300':paidAmount>0?'rounded-full bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200':'rounded-full bg-white/[.06] px-2 py-1 text-[10px] text-slate-400'}>{remaining===0?'Paid':paidAmount>0?'Part-paid':'Unpaid'}</span></div><div className="mt-3 grid grid-cols-3 gap-2"><div><div className="text-[10px] text-slate-500">Net salary</div><div className="mt-1 text-xs font-semibold text-white">{currency(record.netSalary)}</div></div><div><div className="text-[10px] text-slate-500">Paid</div><div className="mt-1 text-xs font-semibold text-emerald-300">{currency(paidAmount)}</div></div><div><div className="text-[10px] text-slate-500">Remaining</div><div className="mt-1 text-xs font-semibold text-amber-200">{currency(remaining)}</div></div></div>{remaining>0&&canManageHr&&<button onClick={()=>recordPayrollPayment(record)} className="mt-3 w-full rounded-lg border border-[#e7b943]/30 px-3 py-2 text-xs font-medium text-[#e7b943]">Pay salary</button>}</article>;})}{!payroll.length&&<p className="py-8 text-center text-sm text-slate-500">No payroll records yet.</p>}</div>
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
    const periodOrders = orders.filter(order=>order.number!=='HOLD'&&String(order.status)!=='Cancelled'&&localDate(new Date(order.createdAt))>=startDate);
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
    const validOrders = orders.filter(order => order.number !== 'HOLD' && String(order.status) !== 'Cancelled' && localDate(new Date(order.createdAt)) >= start);
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
      {apiConnected && (
        <section className={`${panel} p-5`}>
          {heading('Live branch database','Server-verified sales', serverSales ? `Computed by PostgreSQL for ${serverSales.range.label} in Asia/Riyadh. Cancelled orders are excluded.` : 'Reading verified totals from the branch database…')}
          {serverSales ? <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[{label:'Recorded revenue',value:currency(serverSales.totals.revenue)},{label:'Orders',value:String(serverSales.totals.orders)},{label:'Average order value',value:currency(serverSales.totals.averageOrderValue)},{label:'Recorded VAT',value:currency(serverSales.totals.tax)}].map(card=><div key={card.label} className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.04] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{card.value}</div></div>)}
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {[{label:'Cash received',value:currency(serverSales.tenders.Cash)},{label:'Mada received',value:currency(serverSales.tenders.Mada)},{label:'Cancelled orders excluded',value:String(serverSales.excluded.cancelledOrders)}].map(row=><div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.035] px-3 py-2 text-slate-400"><span>{row.label}</span><strong className="text-white">{row.value}</strong></div>)}
            </div>
            <p className="mt-3 text-xs text-slate-500">{serverSales.topProducts[0] ? <>Best seller in this period: <strong className="text-slate-300">{serverSales.topProducts[0].name}</strong> ({serverSales.topProducts[0].quantity} sold).</> : 'No item sales recorded for this period.'} Server totals are read-only and never modify branch data.</p>
          </> : <p className={`mt-3 text-xs ${serverSalesError ? 'text-rose-300' : 'text-slate-500'}`}>{serverSalesError || 'Waiting for the branch database…'}</p>}
        </section>
      )}
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
    const periodOrders = orders.filter(order=>order.number!=='HOLD' && String(order.status)!=='Cancelled' && localDate(new Date(order.createdAt))>=start);
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
      {apiConnected && (
        <section className={`${panel} p-5`}>
          {heading('Live branch database','Server-verified profit & loss', serverPnl ? `Recipe-valued cost of goods sold is included for ${serverPnl.range.label}.` : 'Reading verified totals from the branch database…')}
          {serverPnl ? <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[{label:'Net sales (excl. VAT)',value:currency(serverPnl.revenue.netSales)},{label:'Cost of goods sold',value:currency(serverPnl.cogs)},{label:`Gross profit (${serverPnl.grossMargin.toFixed(1)}%)`,value:currency(serverPnl.grossProfit)},{label:`Operating result (${serverPnl.operatingMargin.toFixed(1)}%)`,value:currency(serverPnl.operatingResult)}].map(card=><div key={card.label} className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.04] p-4"><div className="text-xs text-slate-400">{card.label}</div><div className="mt-2 text-xl font-semibold text-white">{card.value}</div></div>)}
            </div>
            <div className="mt-4 space-y-3 text-sm">{[{label:'Sales including VAT',value:serverPnl.revenue.grossSales},{label:'Less recorded VAT',value:-serverPnl.revenue.vat},{label:'Less cost of goods sold',value:-serverPnl.cogs},{label:'Less operating expenses',value:-serverPnl.operating.expenses},{label:'Less salary payments',value:-serverPnl.operating.payrollPaid},{label:'Purchases received (memo, not an expense)',value:serverPnl.purchases.value},{label:'Stock written off',value:serverPnl.waste}].map(row=><div key={row.label} className="flex justify-between border-b border-white/[.06] pb-3 text-slate-400"><span>{row.label}</span><strong className={row.value<0?'text-rose-300':'text-white'}>{row.value<0?'−':''}{currency(Math.abs(row.value))}</strong></div>)}</div>
            <p className="mt-3 text-xs text-slate-500">{serverPnl.records.expenseRecords} expense records, {serverPnl.records.payrollPaymentRecords} payroll payments and {serverPnl.records.purchaseRecords} purchase records are included in this period.</p>
          </> : <p className={`mt-3 text-xs ${serverPnlError ? 'text-rose-300' : 'text-slate-500'}`}>{serverPnlError || 'Waiting for the branch database…'}</p>}
        </section>
      )}
      <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-xs leading-5 text-amber-100/70">These local figures are not final net profit: they do not include recipe-based cost of goods sold. Connect a branch to read the server-verified profit &amp; loss above, which values cost of goods sold from recorded stock movements. Purchases are reported separately to avoid counting inventory purchases as both an asset and an expense.</p>
    </div>;
  };
  const customerMenuBaseUrl = window.location.origin + '/menu';
  const customerMenuUrl = apiBranchId ? buildMenuShareUrl(window.location.origin, apiBranchId) : '';
  const qr = (): ReactNode => <div className="grid gap-4 xl:grid-cols-[1fr_320px]"><section className={`${panel} p-5`}>{heading('Digital menu','Customer QR menu','Customer-facing menu preview using the current product list.') }<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.slice(0,6).map(product=><article key={product.id} className="overflow-hidden rounded-xl border border-white/[.07] bg-[#191e24]"><img src={product.image} alt={product.name} className="h-28 w-full object-cover"/><div className="p-3"><div className="text-sm font-medium text-white">{product.name}</div><div className="mt-1 text-sm text-[#e7b943]">{currency(product.price)}</div></div></article>)}</div></section><section className={`${panel} p-5`}>{heading('Table ordering','QR preview', apiConnected && apiBranchId ? 'Scannable: it opens this branch menu on the customer phone.' : 'Live QR generation requires a hosted menu URL and a connected branch.') }{(apiConnected && apiBranchId) ? <div className="mt-5 space-y-3"><div className="grid place-items-center rounded-2xl bg-white p-4"><img src={`${apiBase.replace(/\/$/, '')}/api/menu/qr?branchId=${encodeURIComponent(apiBranchId)}&baseUrl=${encodeURIComponent(customerMenuBaseUrl)}`} alt="QR code that opens the customer menu" className="h-52 w-52"/></div><a href={customerMenuUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-[#e7b943]/40 px-3 py-2 text-center text-xs font-semibold text-[#e7b943] hover:bg-[#e7b943]/10">Open customer menu</a><p className="break-all text-[11px] leading-5 text-slate-500">{customerMenuUrl}</p></div> : <div className="mt-5 grid aspect-square place-items-center rounded-2xl border border-dashed border-white/15 bg-white p-5 text-center text-sm text-slate-500"><div><Grid2X2 className="mx-auto mb-2 text-slate-700" size={58}/>QR placeholder<br/><span className="text-xs">Not scannable in demo mode</span></div></div>}</section></div>;
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

  const applyCoupon = async () => {
    if(!apiConnected||!apiToken){flash('Connect the live POS database to apply a coupon.');return;}
    if(!couponInput.trim()||subtotal<=0)return;
    setCouponBusy(true);
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/coupons/validate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({code:couponInput.trim(),subtotal})});
      const result=await response.json();
      if(!response.ok||!result.coupon)throw new Error(result.error||'Coupon could not be validated.');
      setAppliedCoupon({code:result.coupon.code,discount:Number(result.discount),discountType:result.coupon.discountType,discountValue:Number(result.coupon.discountValue)});
      setDiscount('0');
      flash(`Coupon ${result.coupon.code} applied.`);
    }catch(error){setAppliedCoupon(null);flash(error instanceof Error?error.message:'Coupon validation failed.');}
    finally{setCouponBusy(false);}
  };
  const refreshCoupons = async () => {
    if(!apiConnected||!apiToken)return;
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/coupons`,{headers:{Authorization:`Bearer ${apiToken}`}});
      const result=await response.json();
      if(!response.ok||!Array.isArray(result.coupons))throw new Error(result.error||'Coupons could not be loaded.');
      setCoupons(result.coupons);
    }catch(error){flash(error instanceof Error?error.message:'Coupons could not be loaded.');}
  };
  const createCoupon = async () => {
    if(!apiConnected||!apiToken){flash('Connect the live POS database before creating coupons.');return;}
    const code=window.prompt('Coupon code (letters, numbers, dash or underscore)');
    if(!code?.trim())return;
    const discountTypeInput=window.prompt('Discount type: percent or fixed','percent');
    if(discountTypeInput===null)return;
    const discountType=discountTypeInput.trim().toLowerCase();
    if(discountType!=='percent'&&discountType!=='fixed'){flash('Choose percent or fixed.');return;}
    const discountValue=Number(window.prompt(discountType==='percent'?'Discount percentage (1–100)':'Fixed discount amount (SAR)','10'));
    if(!Number.isFinite(discountValue)||discountValue<=0||(discountType==='percent'&&discountValue>100)){flash('Enter a valid discount value.');return;}
    const minimumOrderAmount=Number(window.prompt('Minimum order subtotal (SAR)','0'));
    if(!Number.isFinite(minimumOrderAmount)||minimumOrderAmount<0){flash('Enter a valid minimum order amount.');return;}
    const expiry=window.prompt('Expiry date (YYYY-MM-DD), leave blank for no expiry','');
    if(expiry===null)return;
    if(expiry.trim()&&!/^\d{4}-\d{2}-\d{2}$/.test(expiry.trim())){flash('Enter expiry as YYYY-MM-DD.');return;}
    const usageInput=window.prompt('Maximum uses, leave blank for unlimited','');
    if(usageInput===null)return;
    const usageLimit=usageInput.trim()?Number(usageInput):null;
    if(usageLimit!==null&&(!Number.isInteger(usageLimit)||usageLimit<=0)){flash('Enter a positive whole-number usage limit.');return;}
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/coupons`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({code:code.trim(),discountType,discountValue,minimumOrderAmount,expiresAt:expiry.trim()?new Date(expiry.trim()+'T23:59:59.999Z').toISOString():null,usageLimit})});
      const result=await response.json();
      if(!response.ok||!result.coupon)throw new Error(result.error||'Coupon could not be created.');
      await refreshCoupons();
      flash(`Coupon ${result.coupon.code} created.`);
    }catch(error){flash(error instanceof Error?error.message:'Coupon creation failed.');}
  };
  const toggleCoupon = async (coupon:typeof coupons[number]) => {
    if(!apiConnected||!apiToken)return;
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/coupons/${encodeURIComponent(coupon.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({active:!coupon.active})});
      const result=await response.json();
      if(!response.ok||!result.coupon)throw new Error(result.error||'Coupon status could not be updated.');
      setCoupons(current=>current.map(item=>item.id===coupon.id?{...item,active:result.coupon.active}:item));
      flash(`Coupon ${coupon.code} ${result.coupon.active?'enabled':'disabled'}.`);
    }catch(error){flash(error instanceof Error?error.message:'Coupon update failed.');}
  };
  useEffect(()=>{if(apiConnected&&view==='discounts'&&['owner','manager'].includes(apiRole))void refreshCoupons();},[apiConnected,apiToken,apiBase,apiRole,view]);
  const discountsView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Sales promotions','Discounts & Coupons','Create branch-scoped promo codes with date, minimum-spend and usage limits.')}{<button onClick={()=>void createCoupon()} disabled={!apiConnected||!['owner','manager'].includes(apiRole)} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b] disabled:opacity-40"><Plus size={14} className="mr-1 inline"/>Create coupon</button>}</div>
    {!apiConnected&&<p className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs text-amber-100/80">Connect the live POS backend to manage coupons. Coupon codes are not stored in offline demo mode.</p>}
    {apiConnected&&!['owner','manager'].includes(apiRole)&&<p className="mb-4 text-xs text-amber-200/80">Only owners and managers can create or manage coupons.</p>}
    <div className="space-y-2">{coupons.map(coupon=><article key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-white">{coupon.code}</strong><span className={`rounded-full px-2 py-1 text-[10px] ${coupon.active?'bg-emerald-400/10 text-emerald-300':'bg-slate-400/10 text-slate-400'}`}>{coupon.active?'Active':'Disabled'}</span></div><p className="mt-1 text-xs text-slate-400">{coupon.discountType==='percent'?coupon.discountValue+'% off':currency(Number(coupon.discountValue))+' off'} · Minimum {currency(Number(coupon.minimumOrderAmount))} · Used {coupon.usageCount}{coupon.usageLimit?'/'+coupon.usageLimit:' times'}</p><p className="mt-1 text-[11px] text-slate-500">{coupon.expiresAt?'Expires '+new Date(coupon.expiresAt).toLocaleDateString():'No expiry'}</p></div><button onClick={()=>void toggleCoupon(coupon)} disabled={!apiConnected||!['owner','manager'].includes(apiRole)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">{coupon.active?'Disable':'Enable'}</button></article>)}</div>
    {apiConnected&&!coupons.length&&<p className="py-10 text-center text-sm text-slate-500">No coupons created for this branch.</p>}
  </section>;


  const refreshUsers = async () => {
    if(!apiConnected||!apiToken||!['owner','manager'].includes(apiRole))return;
    try{
      const [usersResponse,rolesResponse]=await Promise.all([
        fetch(`${apiBase.replace(/\/$/,'')}/api/users`,{headers:{Authorization:`Bearer ${apiToken}`}}),
        fetch(`${apiBase.replace(/\/$/,'')}/api/roles/permissions`,{headers:{Authorization:`Bearer ${apiToken}`}})
      ]);
      const [usersData,rolesData]=await Promise.all([usersResponse.json(),rolesResponse.json()]);
      if(!usersResponse.ok||!Array.isArray(usersData.users))throw new Error(usersData.error||'Staff accounts could not be loaded.');
      if(!rolesResponse.ok||!Array.isArray(rolesData.roles))throw new Error(rolesData.error||'Role permissions could not be loaded.');
      setManagedUsers(usersData.users);
      setRoleCatalog(rolesData.roles);
    }catch(error){flash(error instanceof Error?error.message:'User administration could not be loaded.');}
  };
  const createManagedUser = async () => {
    if(!apiConnected||!apiToken||!['owner','manager'].includes(apiRole)){flash('Owner or manager access is required.');return;}
    const displayName=window.prompt('Staff display name');
    if(!displayName?.trim())return;
    const email=window.prompt('Staff email address');
    if(!email?.trim())return;
    const password=window.prompt('Temporary password (minimum 12 characters)');
    if(!password)return;
    if(password.length<12){flash('Use a password with at least 12 characters.');return;}
    const available=apiRole==='owner'?['owner','manager','cashier','kitchen','inventory','accountant','delivery']:['cashier','kitchen','inventory','accountant','delivery'];
    const roleInput=window.prompt('Role: '+available.join(', '),'cashier');
    if(!roleInput)return;
    const role=roleInput.trim().toLowerCase();
    if(!available.includes(role)){flash('Choose a role allowed for your account.');return;}
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/users`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({displayName:displayName.trim(),email:email.trim(),password,role})});
      const result=await response.json();
      if(!response.ok||!result.user)throw new Error(result.error||'Staff account could not be created.');
      await refreshUsers();
      flash(`Staff account created for ${result.user.displayName}.`);
    }catch(error){flash(error instanceof Error?error.message:'Staff account creation failed.');}
  };
  const changeManagedUserRole = async (user:typeof managedUsers[number]) => {
    const available=apiRole==='owner'?['owner','manager','cashier','kitchen','inventory','accountant','delivery']:['cashier','kitchen','inventory','accountant','delivery'];
    const roleInput=window.prompt('Assign role: '+available.join(', '),user.role);
    if(!roleInput)return;
    const role=roleInput.trim().toLowerCase();
    if(!available.includes(role)){flash('Choose a role allowed for your account.');return;}
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/users/${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({role})});
      const result=await response.json();
      if(!response.ok||!result.user)throw new Error(result.error||'Role could not be updated.');
      setManagedUsers(current=>current.map(item=>item.id===user.id?{...item,...result.user}:item));
      flash(`${user.displayName} role updated to ${role}.`);
    }catch(error){flash(error instanceof Error?error.message:'Role update failed.');}
  };
  const toggleManagedUser = async (user:typeof managedUsers[number]) => {
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/users/${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({active:!user.active})});
      const result=await response.json();
      if(!response.ok||!result.user)throw new Error(result.error||'Account status could not be updated.');
      setManagedUsers(current=>current.map(item=>item.id===user.id?{...item,...result.user}:item));
      flash(`${user.displayName} account ${result.user.active?'activated':'deactivated'}.`);
    }catch(error){flash(error instanceof Error?error.message:'Account status update failed.');}
  };
  const resetManagedUserPassword = async (user:typeof managedUsers[number]) => {
    const password=window.prompt('New password for '+user.displayName+' (minimum 12 characters)');
    if(!password)return;
    if(password.length<12){flash('Use a password with at least 12 characters.');return;}
    try{
      const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/users/${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiToken}`},body:JSON.stringify({password})});
      const result=await response.json();
      if(!response.ok||!result.user)throw new Error(result.error||'Password could not be reset.');
      flash(`Password reset for ${user.displayName}.`);
    }catch(error){flash(error instanceof Error?error.message:'Password reset failed.');}
  };
  useEffect(()=>{if(apiConnected&&view==='roles'&&['owner','manager'].includes(apiRole))void refreshUsers();},[apiConnected,apiToken,apiBase,apiRole,view]);
  const rolesView = (): ReactNode => <section className={`${panel} p-5`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">{heading('Access control','User Roles & Permissions','Manage branch staff accounts, role assignments and account status')}{<button onClick={()=>void createManagedUser()} disabled={!apiConnected||!['owner','manager'].includes(apiRole)} className="rounded-xl bg-[#e7b943] px-3 py-2 text-xs font-semibold text-[#17130b] disabled:opacity-40"><Plus size={14} className="mr-1 inline"/>Add staff account</button>}</div>
    {!apiConnected&&<p className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs text-amber-100/80">Connect the live POS backend to manage staff accounts. Demo mode does not create login credentials.</p>}
    {apiConnected&&!['owner','manager'].includes(apiRole)&&<p className="mb-4 text-xs text-amber-200/80">Only owners and managers can manage staff accounts.</p>}
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{roleCatalog.map(role=><article key={role.role} className="rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div className="font-semibold text-white">{role.label}</div><ul className="mt-3 space-y-2">{role.permissions.map(permission=><li key={permission} className="flex gap-2 text-xs leading-5 text-slate-400"><span className="text-[#e7b943]">•</span><span>{permission}</span></li>)}</ul></article>)}</div>
    <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Branch staff accounts</h3><span className="text-xs text-slate-500">{managedUsers.length} accounts</span></div>
    <div className="space-y-2">{managedUsers.map(user=><article key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-[#191e24] p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-white">{user.displayName}</strong><span className={`rounded-full px-2 py-1 text-[10px] ${user.active?'bg-emerald-400/10 text-emerald-300':'bg-slate-400/10 text-slate-400'}`}>{user.active?'Active':'Disabled'}</span></div><p className="mt-1 text-xs text-slate-400">{user.email} · {user.role}</p><p className="mt-1 text-[10px] text-slate-500">Created {new Date(user.createdAt).toLocaleDateString()}</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void changeManagedUserRole(user)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Change role</button><button onClick={()=>void resetManagedUserPassword(user)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Reset password</button><button onClick={()=>void toggleManagedUser(user)} className={`rounded-lg border px-3 py-2 text-xs ${user.active?'border-rose-400/20 text-rose-300':'border-emerald-400/20 text-emerald-300'}`}>{user.active?'Deactivate':'Activate'}</button></div></article>)}</div>
    {apiConnected&&['owner','manager'].includes(apiRole)&&!managedUsers.length&&<p className="py-8 text-center text-sm text-slate-500">No staff accounts are available in this branch yet.</p>}
  </section>;

  const moduleMessages: Record<string,string> = { tables:'Manage table labels, seating capacity and branch-scoped occupancy status.', reservations:'Schedule guests, record party size and contact details, and track booked, seated, completed or cancelled reservations.', menu:'Create, edit, deactivate and reactivate products. Inactive products remain available for restoration.', categories:'Create, rename and delete categories. Categories with active products cannot be deleted.', recipes:'Manage recipes, estimate per-item ingredient cost and margin from current inventory unit costs, and check tracked stock capacity.', purchases:'Record goods received, add quantities to inventory and track supplier credit locally.', delivery:'Assign Home Delivery orders to branch delivery staff and track pickup and delivery status.', expenses:'Record shop operating expenses, payment method and expense date; review daily and monthly totals.', employees:'Manage employee profiles, monthly salaries and shift details in local POS storage.', attendance:'Update daily employee attendance status in local POS storage.', payroll:'Create monthly payroll, track salary advances, and record full or partial Cash/Mada salary payments.', reports:'Local totals are instant; a connected branch also shows server-verified sales, date filtering and CSV export.', profit:'Local totals stay available offline; a connected branch adds server-verified net sales, recipe-valued COGS and operating result.',  discounts:'Manage branch-scoped promo codes, discount rules, expiry dates and redemption limits.', roles:'Manage branch staff login accounts, role assignments, password resets and access status.', settings:'Restaurant and branch settings need completion.' };
  const selectedLabel = moduleGroups.flatMap(group=>group.items).find(item=>item.id===view)?.label || 'Dashboard';
  const placeholder = (): ReactNode => <section className={`${panel} p-6 md:p-8`}><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7b943]/10 text-[#e7b943]"><Activity size={21}/></div><div className="mt-5">{heading('Module status',selectedLabel,'This module is listed for the complete product scope.')}</div><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">{moduleMessages[view] || 'This module is planned but is not part of the current working demo.'}</p><div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-xs leading-5 text-amber-100/70">This screen is intentionally marked as incomplete—no demo action or placeholder value is presented as a completed workflow.</div><button onClick={()=>setView('dashboard')} className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-white/20">Back to dashboard</button></section>;
  const restrictedHrView = (): ReactNode => <section className={`${panel} p-6`}>{heading('Access','Restricted','Your role does not have access to employee, attendance or payroll records.')}</section>;
  const content: Record<string,()=>ReactNode> = { dashboard, pos, orders:ordersView, delivery:deliveryView, tables:tablesView, reservations:reservationsView, menu:menuView, categories:categoriesView, inventory:inventoryView, recipes:recipesView, suppliers:suppliersView, purchases:purchasesView, customers:customersView, employees:canViewPayroll?employeesView:restrictedHrView, attendance:canManageHr?attendanceView:restrictedHrView, payroll:canViewPayroll?payrollView:restrictedHrView, expenses:expensesView, accounting, reports:reportsView, profit:profitView, discounts:discountsView, roles:rolesView, qr, settings:apiSettings };
  const activeContent = content[view] ? content[view]() : placeholder();
  const effectiveTheme = view==='settings' ? draftThemeConfig : themeConfig;
  const effectiveLight = effectiveTheme.appearance==='Light' ? true : effectiveTheme.appearance==='Dark' ? false : (view==='settings' ? draftLight : light);
  const themeStyle = getThemeStyle(effectiveTheme,effectiveLight);

  return <div data-theme-preset={effectiveTheme.preset} data-theme-mode={effectiveLight?'light':'dark'} style={themeStyle} className={`theme-shell ${effectiveLight?'theme-light':''} min-h-screen bg-[#0e1114] text-slate-100`}><div className="flex min-h-screen"><aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/[.06] bg-[#111519] transition-transform lg:static lg:translate-x-0 ${mobileNav?'translate-x-0':'-translate-x-full'}`}><div className="flex h-[76px] items-center gap-3 border-b border-white/[.06] px-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#f0ca69] to-[#b37a18] font-serif text-xl font-black text-[#201707]">M</div><div><div className="font-serif text-lg font-bold tracking-wide text-white">Musafir</div><div className="text-[9px] uppercase tracking-[.28em] text-[#cba84c]">Fast Food</div></div><button onClick={()=>setMobileNav(false)} className="ml-auto text-slate-500 lg:hidden"><X size={19}/></button></div><div className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e7b943] text-sm font-bold text-[#211908]">A</div><div className="min-w-0"><div className="text-sm font-medium text-white">Admin</div><div className="text-[11px] text-slate-500">Restaurant owner</div></div><span className="ml-auto h-2 w-2 rounded-full bg-emerald-400"/></div><nav className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-5">{moduleGroups.map(group=><div key={group.title}><div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.2em] text-slate-600">{group.title}</div><div className="space-y-1">{group.items.map(item=><button key={item.id} onClick={()=>{setView(item.id);setMobileNav(false);}} className={`nav-item ${view===item.id?'nav-active':''}`}><item.icon size={16} strokeWidth={1.8}/><span className="flex-1 text-left">{item.label}</span>{item.id==='pos'&&cart.length>0&&<span className="rounded-full bg-[#e7b943] px-1.5 py-0.5 text-[10px] font-bold text-black">{cart.reduce((n,i)=>n+i.qty,0)}</span>}</button>)}</div></div>)}</nav><div className="border-t border-white/[.06] p-3"><div className="rounded-xl bg-gradient-to-r from-[#211d13] to-[#17191a] p-3"><div className="text-xs font-medium text-[#ead18b]">Good Food • Good Mood</div><div className="mt-1 text-[10px] text-slate-500">Premium service, made simple.</div></div><button onClick={()=>flash('Sign out requires authentication, which is not yet configured.')} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-white/[.04] hover:text-slate-300"><LogOut size={15}/>Sign out</button></div></aside>
    {mobileNav&&<button aria-label="Close navigation" onClick={()=>setMobileNav(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden"/>}<div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[.06] bg-[#101417]/90 px-4 backdrop-blur-xl md:px-7"><div className="flex items-center gap-3"><button onClick={()=>setMobileNav(true)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"><Menu size={20}/></button><div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span>Musafir</span><span>/</span><span className="text-slate-200">{selectedLabel}</span></div><div className="sm:hidden text-sm font-medium text-white">{selectedLabel}</div></div><div className="flex items-center gap-2 md:gap-4"><button type="button" onClick={focusMenuSearch} aria-label="Search menu items" title="Search menu items (Ctrl/⌘ K)" className="hidden items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2 text-xs text-slate-500 transition hover:border-[#e7b943]/30 hover:text-slate-200 md:flex"><Search size={14}/><span>Search menu items…</span><kbd className="ml-6 rounded border border-white/10 px-1.5 py-0.5 text-[10px]">⌘ K</kbd></button><button onClick={()=>flash(lowStock.length?`${lowStock.length} inventory item(s) are at or below reorder level.`:'No new alerts.')} className="relative rounded-lg p-2 text-slate-400 hover:bg-white/5"><Bell size={18}/>{lowStock.length>0&&<span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400"/>}</button><button onClick={()=>{if(effectiveTheme.appearance==='Both'){setLight(value=>!value);setDraftLight(value=>!value);}}} disabled={effectiveTheme.appearance!=='Both'} aria-label={effectiveLight?'Switch to dark theme':'Switch to light theme'} title={effectiveTheme.appearance==='Both'?(effectiveLight?'Switch to dark theme':'Switch to light theme'):'Appearance is fixed in Settings'} className="rounded-lg border border-white/[.08] p-2 text-slate-400 hover:text-[#e7b943] disabled:cursor-not-allowed disabled:opacity-40">{effectiveLight?<Moon size={16}/>:<Sun size={16}/>}</button><div className="hidden items-center gap-2 border-l border-white/[.08] pl-3 sm:flex"><div className="text-right"><div className="text-xs font-medium text-slate-200">Admin</div><div className="text-[10px] text-slate-500">Owner</div></div><ChevronDown size={14} className="text-slate-500"/></div></div></header><main className="mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-7">{activeContent}<footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/[.05] pt-4 text-[10px] text-slate-600"><span>Musafir Fast Food · Restaurant operations</span><span>Good Food • Good Mood</span></footer></main></div></div>{completedOrder&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10251f]/70 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="order-confirmed-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-[#d8c8a2] bg-[#fbf9f2] text-[#1d3029] shadow-2xl"><div className="bg-[#145044] px-6 py-7 text-center text-white"><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-white/30 bg-white/10 text-3xl">✓</div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#e7d5a7]">Musafir Fast Food</p><h2 id="order-confirmed-title" className="mt-2 text-2xl font-bold">Order confirmed</h2><p className="mt-1 text-sm text-white/75">Your order has been completed successfully.</p></div><div className="p-5"><div className="mb-4 flex items-center justify-between border-b border-dashed border-[#d8d1c3] pb-3"><div><p className="text-xs text-[#78837d]">Order number</p><p className="text-lg font-bold">#{completedOrder.number}</p></div><div className="text-right"><p className="text-xs text-[#78837d]">Total paid</p><p className="text-xl font-extrabold text-[#145044]">{currency(completedOrder.total)}</p></div></div><div className="space-y-2">{completedOrder.items.map(item=><div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.qty} × {item.name}</span><strong>{currency(item.qty*item.unitPrice)}</strong></div>)}</div><div className="mt-4 rounded-xl bg-[#f0ede4] px-3 py-2 text-xs text-[#68766e]">{completedOrder.type} · {completedOrder.paymentBreakdown?.map(payment=>payment.method).join(' + ') || completedOrder.paymentMethod}</div><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>printOrder(completedOrder)} className="rounded-xl border border-[#145044] px-3 py-3 text-sm font-bold text-[#145044]"><Printer size={15} className="mr-1 inline"/> Print receipt</button><button onClick={()=>setCompletedOrder(null)} className="rounded-xl bg-[#145044] px-3 py-3 text-sm font-bold text-white">Continue selling</button></div><p className="mt-3 text-center text-[11px] text-[#879188]">You can print now or find this receipt later in Orders.</p></div></section></div>}{toast&&<div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-[#e7b943]/20 bg-[#1a1e21] px-4 py-3 text-sm text-slate-200 shadow-2xl">{toast}</div>}</div>;
}

export default App;
