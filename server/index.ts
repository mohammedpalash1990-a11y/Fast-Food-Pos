import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { db, ensureSeeded, inTransaction } from './db.js';
import type {
  AttendanceRecord,
  AuthUser,
  Coupon,
  Customer,
  DiningTable,
  Employee,
  Expense,
  InventoryItem,
  LogEntry,
  Order,
  PaymentEntry,
  PayrollRecord,
  Product,
  Purchase,
  Reservation,
  RestaurantSettings,
  Role,
  StockMovement,
  Supplier
} from '../src/types.js';

if (process.env.NODE_ENV !== 'test' && !process.env.TEST_MODE) {
  ensureSeeded();
}

type AuthedRequest = Request & { user?: AuthUser };

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false
});

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters');
}
const secret: string = rawSecret;

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in required' });
    const claims = jwt.verify(token, secret) as jwt.JwtPayload;
    const row = db.prepare('SELECT id, email, display_name, role FROM users WHERE id = ? AND active = 1').get(String(claims.sub)) as Record<string, unknown> | undefined;
    if (!row) return res.status(401).json({ error: 'Session is no longer valid' });
    req.user = {
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
      role: row.role as Role
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function appendAuditLog(title: string, detail: string, actor = 'Admin'): void {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO audit_logs (id, title, detail, actor, time, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title, detail, actor, time, now);
}

function readAllState() {
  const settingsRow = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
  const settings: RestaurantSettings = settingsRow
    ? {
        restaurantName: String(settingsRow.restaurant_name),
        branchName: String(settingsRow.branch_name),
        branchCode: String(settingsRow.branch_code),
        phone: String(settingsRow.phone),
        address: String(settingsRow.address),
        currency: String(settingsRow.currency),
        taxRate: Number(settingsRow.tax_rate),
        receiptFooter: String(settingsRow.receipt_footer),
        publicMenuUrl: String(settingsRow.public_menu_url)
      }
    : {
        restaurantName: 'Musafir Fast Food',
        branchName: 'Main Branch',
        branchCode: 'KSA-01',
        phone: '+966 50 000 0000',
        address: 'King Fahd Road, Riyadh',
        currency: 'SAR',
        taxRate: 15,
        receiptFooter: 'Thank you for dining with Musafir Fast Food!',
        publicMenuUrl: 'https://musafir-pos.local/menu'
      };

  const categoryRows = db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all() as Record<string, unknown>[];
  const categories = categoryRows.map(r => String(r.name));

  const productRows = db.prepare('SELECT * FROM products ORDER BY popularity DESC, name').all() as Record<string, unknown>[];
  const products: Product[] = productRows.map(r => ({
    id: String(r.id),
    sku: String(r.sku),
    name: String(r.name),
    category: String(r.category),
    price: Number(r.price),
    image: String(r.image),
    popularity: Number(r.popularity),
    active: Number(r.active) === 1,
    recipe: JSON.parse(String(r.recipe_json || '[]'))
  }));

  const inventoryRows = db.prepare('SELECT * FROM ingredients ORDER BY name').all() as Record<string, unknown>[];
  const inventory: InventoryItem[] = inventoryRows.map(r => ({
    id: String(r.id),
    sku: String(r.sku),
    name: String(r.name),
    category: String(r.category),
    unit: String(r.unit),
    stock: Number(r.stock),
    reorderLevel: Number(r.reorder_level),
    cost: Number(r.cost),
    supplier: String(r.supplier),
    expiry: String(r.expiry)
  }));

  const movementRows = db.prepare('SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 200').all() as Record<string, unknown>[];
  const stockMovements: StockMovement[] = movementRows.map(r => ({
    id: String(r.id),
    ingredientId: String(r.ingredient_id),
    ingredientName: String(r.ingredient_name),
    movementType: r.movement_type as StockMovement['movementType'],
    quantityDelta: Number(r.quantity_delta),
    note: String(r.note),
    createdAt: String(r.created_at)
  }));

  const customerRows = db.prepare('SELECT * FROM customers ORDER BY name').all() as Record<string, unknown>[];
  const customers: Customer[] = customerRows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    address: String(r.address),
    due: Number(r.due),
    loyaltyPoints: Number(r.loyalty_points),
    favoriteItems: JSON.parse(String(r.favorite_items_json || '[]'))
  }));

  const tableRows = db.prepare('SELECT * FROM dining_tables ORDER BY number').all() as Record<string, unknown>[];
  const tables: DiningTable[] = tableRows.map(r => ({
    id: String(r.id),
    number: String(r.number),
    name: String(r.name),
    capacity: Number(r.capacity),
    zone: r.zone as DiningTable['zone'],
    status: r.status as DiningTable['status'],
    currentGuests: Number(r.current_guests),
    currentOrderId: r.current_order_id ? String(r.current_order_id) : undefined
  }));

  const reservationRows = db.prepare('SELECT * FROM reservations ORDER BY date DESC, time ASC').all() as Record<string, unknown>[];
  const reservations: Reservation[] = reservationRows.map(r => ({
    id: String(r.id),
    customerName: String(r.customer_name),
    phone: String(r.phone),
    guests: Number(r.guests),
    date: String(r.date),
    time: String(r.time),
    tableId: String(r.table_id),
    status: r.status as Reservation['status'],
    notes: String(r.notes)
  }));

  const supplierRows = db.prepare('SELECT * FROM suppliers ORDER BY name').all() as Record<string, unknown>[];
  const suppliers: Supplier[] = supplierRows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    category: String(r.category),
    due: Number(r.due)
  }));

  const purchaseRows = db.prepare('SELECT * FROM purchases ORDER BY created_at DESC').all() as Record<string, unknown>[];
  const purchases: Purchase[] = purchaseRows.map(r => ({
    id: String(r.id),
    invoiceNumber: String(r.invoice_number),
    supplierId: String(r.supplier_id),
    supplierName: String(r.supplier_name),
    total: Number(r.total),
    paid: Number(r.paid),
    due: Number(r.due),
    status: r.status as Purchase['status'],
    createdAt: String(r.created_at),
    items: JSON.parse(String(r.items_json || '[]'))
  }));

  const orderRows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<string, unknown>[];
  const orders: Order[] = orderRows.map(r => ({
    id: String(r.id),
    number: String(r.number),
    type: r.type as Order['type'],
    status: r.status as Order['status'],
    tableId: r.table_id ? String(r.table_id) : undefined,
    customerId: r.customer_id ? String(r.customer_id) : undefined,
    customerName: String(r.customer_name),
    createdAt: String(r.created_at),
    items: JSON.parse(String(r.items_json || '[]')),
    subtotal: Number(r.subtotal),
    tax: Number(r.tax),
    discount: Number(r.discount),
    couponCode: r.coupon_code ? String(r.coupon_code) : undefined,
    total: Number(r.total),
    paid: Number(r.paid),
    due: Number(r.due),
    paymentMethod: r.payment_method as Order['paymentMethod'],
    kitchenNote: r.kitchen_note ? String(r.kitchen_note) : undefined,
    deliveryAddress: r.delivery_address ? String(r.delivery_address) : undefined,
    deliveryPhone: r.delivery_phone ? String(r.delivery_phone) : undefined,
    riderName: r.rider_name ? String(r.rider_name) : undefined,
    deliveryStatus: r.delivery_status ? (r.delivery_status as Order['deliveryStatus']) : undefined,
    deliveryFee: r.delivery_fee ? Number(r.delivery_fee) : 0
  }));

  const expenseRows = db.prepare('SELECT * FROM expenses ORDER BY date DESC').all() as Record<string, unknown>[];
  const expenses: Expense[] = expenseRows.map(r => ({
    id: String(r.id),
    title: String(r.title),
    category: r.category as Expense['category'],
    amount: Number(r.amount),
    method: r.method as Expense['method'],
    date: String(r.date),
    note: String(r.note)
  }));

  const employeeRows = db.prepare('SELECT * FROM employees ORDER BY name').all() as Record<string, unknown>[];
  const employees: Employee[] = employeeRows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    role: String(r.role),
    phone: String(r.phone || ''),
    shift: r.shift as Employee['shift'],
    status: r.status as Employee['status'],
    salary: Number(r.salary),
    advance: Number(r.advance)
  }));

  const attendanceRows = db.prepare('SELECT * FROM attendance ORDER BY date DESC, employee_name ASC').all() as Record<string, unknown>[];
  const attendance: AttendanceRecord[] = attendanceRows.map(r => ({
    id: String(r.id),
    employeeId: String(r.employee_id),
    employeeName: String(r.employee_name),
    role: String(r.role),
    shift: String(r.shift),
    date: String(r.date),
    status: r.status as AttendanceRecord['status'],
    checkIn: String(r.check_in),
    checkOut: String(r.check_out),
    note: String(r.note)
  }));

  const payrollRows = db.prepare('SELECT * FROM payroll ORDER BY month DESC, employee_name ASC').all() as Record<string, unknown>[];
  const payroll: PayrollRecord[] = payrollRows.map(r => ({
    id: String(r.id),
    employeeId: String(r.employee_id),
    employeeName: String(r.employee_name),
    role: String(r.role),
    month: String(r.month),
    baseSalary: Number(r.base_salary),
    advanceDeducted: Number(r.advance_deducted),
    bonus: Number(r.bonus),
    netPay: Number(r.net_pay),
    status: r.status as PayrollRecord['status'],
    paidAt: r.paid_at ? String(r.paid_at) : undefined
  }));

  const couponRows = db.prepare('SELECT * FROM coupons ORDER BY code').all() as Record<string, unknown>[];
  const coupons: Coupon[] = couponRows.map(r => ({
    id: String(r.id),
    code: String(r.code),
    description: String(r.description),
    type: r.type as Coupon['type'],
    value: Number(r.value),
    minOrder: Number(r.min_order),
    active: Number(r.active) === 1,
    usedCount: Number(r.used_count)
  }));

  const paymentRows = db.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT 300').all() as Record<string, unknown>[];
  const payments: PaymentEntry[] = paymentRows.map(r => ({
    id: String(r.id),
    direction: r.direction as PaymentEntry['direction'],
    category: r.category as PaymentEntry['category'],
    referenceId: String(r.reference_id),
    partyName: String(r.party_name),
    amount: Number(r.amount),
    method: r.method as PaymentEntry['method'],
    note: String(r.note),
    createdAt: String(r.created_at)
  }));

  const logRows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all() as Record<string, unknown>[];
  const logs: LogEntry[] = logRows.map(r => ({
    id: String(r.id),
    title: String(r.title),
    detail: String(r.detail),
    actor: String(r.actor),
    time: String(r.time)
  }));

  const userRows = db.prepare('SELECT id, email, display_name, role, active FROM users ORDER BY display_name').all() as Record<string, unknown>[];
  const users: AuthUser[] = userRows.map(r => ({
    id: String(r.id),
    email: String(r.email),
    displayName: String(r.display_name),
    role: r.role as Role
  }));

  return {
    settings,
    categories,
    products,
    inventory,
    stockMovements,
    customers,
    tables,
    reservations,
    suppliers,
    purchases,
    orders,
    expenses,
    employees,
    attendance,
    payroll,
    coupons,
    payments,
    logs,
    users
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: 'connected', engine: 'sqlite' });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Enter a valid email and password' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as Record<string, unknown> | undefined;
    if (!user || !(await bcrypt.compare(password, String(user.password_hash)))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }
    const authUser: AuthUser = {
      id: String(user.id),
      email: String(user.email),
      displayName: String(user.display_name),
      role: user.role as Role
    };
    const token = jwt.sign({ sub: authUser.id, role: authUser.role }, secret, { expiresIn: '12h', issuer: 'musafir-pos' });
    appendAuditLog('User signed in', `${authUser.displayName} (${authUser.role}) logged in.`, authUser.displayName);
    res.json({ token, user: authUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/api/auth/me', (req: AuthedRequest, res) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const claims = jwt.verify(token, secret) as jwt.JwtPayload;
    const row = db.prepare('SELECT id, email, display_name, role FROM users WHERE id = ? AND active = 1').get(String(claims.sub)) as Record<string, unknown> | undefined;
    if (!row) return res.status(401).json({ error: 'Session is no longer valid' });
    res.json({
      user: {
        id: String(row.id),
        email: String(row.email),
        displayName: String(row.display_name),
        role: row.role as Role
      }
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

app.get('/api/bootstrap', (_req, res) => {
  res.json(readAllState());
});

app.get('/api/settings', requireAuth, (req: AuthedRequest, res) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owners can view restaurant and branch settings' });
  }
  const state = readAllState();
  res.json({ settings: state.settings });
});

app.put('/api/settings', requireAuth, (req: AuthedRequest, res) => {
  try {
    if (!req.user || req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can update restaurant and branch settings' });
    }
    const body = req.body || {};
    const restaurantName = String(body.restaurantName || '').trim();
    const branchName = String(body.branchName || '').trim();
    const branchCode = String(body.branchCode || '').trim().toUpperCase();
    const phone = String(body.phone || '').trim();
    const address = String(body.address || '').trim();
    const currency = String(body.currency || 'SAR').trim();
    const taxRate = Math.max(0, Math.min(50, Number(body.taxRate) || 0));
    const receiptFooter = String(body.receiptFooter || '').trim();
    const publicMenuUrl = String(body.publicMenuUrl || '').trim();

    if (!restaurantName || !branchName) {
      return res.status(400).json({ error: 'Restaurant name and branch name are required' });
    }

    inTransaction(() => {
      db.prepare(`
        INSERT OR REPLACE INTO settings (
          id, restaurant_name, branch_name, branch_code, phone, address, currency, tax_rate, receipt_footer, public_menu_url
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        restaurantName,
        branchName,
        branchCode,
        phone,
        address,
        currency,
        taxRate,
        receiptFooter,
        publicMenuUrl
      );
      appendAuditLog('Settings updated', `${restaurantName} · ${branchName} (${branchCode})`, req.user?.displayName || 'Owner');
    });

    const updated = readAllState().settings;
    res.json({ settings: updated });
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.post('/api/sync', requireAuth, (req: AuthedRequest, res) => {
  try {
    const body = req.body || {};
    inTransaction(() => {
      if (body.settings) {
        const s: RestaurantSettings = body.settings;
        db.prepare(`
          INSERT OR REPLACE INTO settings (
            id, restaurant_name, branch_name, branch_code, phone, address, currency, tax_rate, receipt_footer, public_menu_url
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          s.restaurantName,
          s.branchName,
          s.branchCode,
          s.phone,
          s.address,
          s.currency,
          s.taxRate,
          s.receiptFooter,
          s.publicMenuUrl
        );
      }

      if (Array.isArray(body.categories)) {
        db.exec('DELETE FROM categories');
        const stmt = db.prepare('INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
        body.categories.forEach((name: string, index: number) => {
          stmt.run(`cat-${index + 1}`, name, index + 1);
        });
      }

      if (Array.isArray(body.products)) {
        db.exec('DELETE FROM products');
        const stmt = db.prepare(`
          INSERT INTO products (id, sku, name, category, price, image, popularity, active, recipe_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of body.products as Product[]) {
          stmt.run(
            p.id,
            p.sku || p.id.toUpperCase(),
            p.name,
            p.category,
            p.price,
            p.image,
            p.popularity || 80,
            p.active === false ? 0 : 1,
            JSON.stringify(p.recipe || [])
          );
        }
      }

      if (Array.isArray(body.inventory)) {
        db.exec('DELETE FROM ingredients');
        const stmt = db.prepare(`
          INSERT INTO ingredients (id, sku, name, category, unit, stock, reorder_level, cost, supplier, expiry)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const i of body.inventory as InventoryItem[]) {
          stmt.run(
            i.id,
            i.sku || i.id.toUpperCase(),
            i.name,
            i.category,
            i.unit,
            i.stock,
            i.reorderLevel,
            i.cost,
            i.supplier,
            i.expiry
          );
        }
      }

      if (Array.isArray(body.stockMovements)) {
        db.exec('DELETE FROM stock_movements');
        const stmt = db.prepare(`
          INSERT INTO stock_movements (id, ingredient_id, ingredient_name, movement_type, quantity_delta, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const m of body.stockMovements as StockMovement[]) {
          stmt.run(m.id, m.ingredientId, m.ingredientName, m.movementType, m.quantityDelta, m.note, m.createdAt);
        }
      }

      if (Array.isArray(body.customers)) {
        db.exec('DELETE FROM customers');
        const stmt = db.prepare(`
          INSERT INTO customers (id, name, phone, address, due, loyalty_points, favorite_items_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of body.customers as Customer[]) {
          stmt.run(c.id, c.name, c.phone, c.address, c.due, c.loyaltyPoints, JSON.stringify(c.favoriteItems || []));
        }
      }

      if (Array.isArray(body.tables)) {
        db.exec('DELETE FROM dining_tables');
        const stmt = db.prepare(`
          INSERT INTO dining_tables (id, number, name, capacity, zone, status, current_guests, current_order_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of body.tables as DiningTable[]) {
          stmt.run(t.id, t.number, t.name, t.capacity, t.zone, t.status, t.currentGuests, t.currentOrderId || null);
        }
      }

      if (Array.isArray(body.reservations)) {
        db.exec('DELETE FROM reservations');
        const stmt = db.prepare(`
          INSERT INTO reservations (id, customer_name, phone, guests, date, time, table_id, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of body.reservations as Reservation[]) {
          stmt.run(r.id, r.customerName, r.phone, r.guests, r.date, r.time, r.tableId, r.status, r.notes);
        }
      }

      if (Array.isArray(body.suppliers)) {
        db.exec('DELETE FROM suppliers');
        const stmt = db.prepare(`
          INSERT INTO suppliers (id, name, phone, category, due)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const s of body.suppliers as Supplier[]) {
          stmt.run(s.id, s.name, s.phone, s.category, s.due);
        }
      }

      if (Array.isArray(body.purchases)) {
        db.exec('DELETE FROM purchases');
        const stmt = db.prepare(`
          INSERT INTO purchases (id, invoice_number, supplier_id, supplier_name, total, paid, due, status, created_at, items_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const pur of body.purchases as Purchase[]) {
          stmt.run(
            pur.id,
            pur.invoiceNumber,
            pur.supplierId,
            pur.supplierName,
            pur.total,
            pur.paid,
            pur.due,
            pur.status,
            pur.createdAt,
            JSON.stringify(pur.items || [])
          );
        }
      }

      if (Array.isArray(body.orders)) {
        db.exec('DELETE FROM orders');
        const stmt = db.prepare(`
          INSERT INTO orders (
            id, number, type, status, table_id, customer_id, customer_name, created_at, items_json,
            subtotal, tax, discount, coupon_code, total, paid, due, payment_method, kitchen_note,
            delivery_address, delivery_phone, rider_name, delivery_status, delivery_fee
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const o of body.orders as Order[]) {
          stmt.run(
            o.id,
            o.number,
            o.type,
            o.status,
            o.tableId || null,
            o.customerId || null,
            o.customerName,
            o.createdAt,
            JSON.stringify(o.items || []),
            o.subtotal,
            o.tax,
            o.discount,
            o.couponCode || null,
            o.total,
            o.paid,
            o.due,
            o.paymentMethod,
            o.kitchenNote || null,
            o.deliveryAddress || null,
            o.deliveryPhone || null,
            o.riderName || null,
            o.deliveryStatus || null,
            o.deliveryFee || 0
          );
        }
      }

      if (Array.isArray(body.expenses)) {
        db.exec('DELETE FROM expenses');
        const stmt = db.prepare(`
          INSERT INTO expenses (id, title, category, amount, method, date, note)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of body.expenses as Expense[]) {
          stmt.run(e.id, e.title, e.category, e.amount, e.method, e.date, e.note);
        }
      }

      if (Array.isArray(body.employees)) {
        db.exec('DELETE FROM employees');
        const stmt = db.prepare(`
          INSERT INTO employees (id, name, role, phone, shift, status, salary, advance)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const emp of body.employees as Employee[]) {
          stmt.run(emp.id, emp.name, emp.role, emp.phone || '', emp.shift, emp.status, emp.salary, emp.advance);
        }
      }

      if (Array.isArray(body.attendance)) {
        db.exec('DELETE FROM attendance');
        const stmt = db.prepare(`
          INSERT INTO attendance (id, employee_id, employee_name, role, shift, date, status, check_in, check_out, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const att of body.attendance as AttendanceRecord[]) {
          stmt.run(
            att.id,
            att.employeeId,
            att.employeeName,
            att.role,
            att.shift,
            att.date,
            att.status,
            att.checkIn,
            att.checkOut,
            att.note
          );
        }
      }

      if (Array.isArray(body.payroll)) {
        db.exec('DELETE FROM payroll');
        const stmt = db.prepare(`
          INSERT INTO payroll (id, employee_id, employee_name, role, month, base_salary, advance_deducted, bonus, net_pay, status, paid_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const pr of body.payroll as PayrollRecord[]) {
          stmt.run(
            pr.id,
            pr.employeeId,
            pr.employeeName,
            pr.role,
            pr.month,
            pr.baseSalary,
            pr.advanceDeducted,
            pr.bonus,
            pr.netPay,
            pr.status,
            pr.paidAt || null
          );
        }
      }

      if (Array.isArray(body.coupons)) {
        db.exec('DELETE FROM coupons');
        const stmt = db.prepare(`
          INSERT INTO coupons (id, code, description, type, value, min_order, active, used_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const cpn of body.coupons as Coupon[]) {
          stmt.run(cpn.id, cpn.code, cpn.description, cpn.type, cpn.value, cpn.minOrder, cpn.active ? 1 : 0, cpn.usedCount);
        }
      }

      if (Array.isArray(body.payments)) {
        db.exec('DELETE FROM payments');
        const stmt = db.prepare(`
          INSERT INTO payments (id, direction, category, reference_id, party_name, amount, method, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const pmt of body.payments as PaymentEntry[]) {
          stmt.run(
            pmt.id,
            pmt.direction,
            pmt.category,
            pmt.referenceId,
            pmt.partyName,
            pmt.amount,
            pmt.method,
            pmt.note,
            pmt.createdAt
          );
        }
      }

      if (Array.isArray(body.logs)) {
        db.exec('DELETE FROM audit_logs');
        const stmt = db.prepare(`
          INSERT INTO audit_logs (id, title, detail, actor, time, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const now = new Date().toISOString();
        for (const l of body.logs as LogEntry[]) {
          stmt.run(l.id, l.title, l.detail, l.actor || 'Admin', l.time, now);
        }
      }
    });
    res.json({ status: 'synced' });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Failed to sync state to database' });
  }
});

app.post('/api/users', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!req.user || !['owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only owners and managers can create staff accounts' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const displayName = String(req.body?.displayName || '').trim();
    const role = String(req.body?.role || 'cashier');
    const password = String(req.body?.password || '');
    const validRoles: Role[] = ['owner', 'manager', 'cashier', 'kitchen', 'inventory', 'accountant', 'delivery'];
    if (!email || !displayName) return res.status(400).json({ error: 'Email and display name are required' });
    if (!validRoles.includes(role as Role)) return res.status(400).json({ error: 'Unknown role' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) return res.status(409).json({ error: 'That email already has an account' });

    const id = `u-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash(password, 10);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(id, email, hash, displayName, role, new Date().toISOString());
    appendAuditLog('Staff account created', `${displayName} · ${role}`, req.user.displayName);

    res.status(201).json({
      user: { id, email, displayName, role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create the staff account' });
  }
});

app.get('/api/menu', (_req, res) => {
  const state = readAllState();
  res.json({
    restaurant: state.settings,
    categories: state.categories,
    products: state.products.filter(p => p.active !== false)
  });
});

app.get('/api/menu/qr', async (req, res) => {
  try {
    const state = readAllState();
    const table = String(req.query.table || 'T-01');
    const branch = String(req.query.branch || state.settings.branchCode || 'KSA-01');
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const configured = String(req.query.baseUrl || state.settings.publicMenuUrl || '').replace(/\/$/, '');
    const base = configured && !configured.includes('musafir-pos.local') ? configured : `${requestOrigin}/menu`;
    const url = `${base}?branch=${encodeURIComponent(branch)}&table=${encodeURIComponent(table)}`;
    const png = await QRCode.toBuffer(url, {
      type: 'png',
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#14191f', light: '#ffffff' }
    });
    res.type('png').set('Cache-Control', 'no-store').send(png);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/api/inventory', (_req, res) => {
  const state = readAllState();
  res.json({ items: state.inventory, movements: state.stockMovements });
});

app.get('/api/suppliers', (_req, res) => {
  const state = readAllState();
  res.json({ suppliers: state.suppliers });
});

app.get('/api/receivables', (_req, res) => {
  const state = readAllState();
  res.json({ receivables: state.customers.filter(c => c.due > 0) });
});

app.get('/api/payables', (_req, res) => {
  const state = readAllState();
  res.json({ payables: state.suppliers.filter(s => s.due > 0) });
});

app.use((error: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
});

export { app };

const port = Number(process.env.PORT || 3001);
if (process.env.NODE_ENV !== 'test' && !process.env.TEST_MODE) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Musafir POS SQLite API listening on http://0.0.0.0:${port}`);
  });
}
