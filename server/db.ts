import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import {
  categories as defaultCategories,
  demoAttendance,
  demoAuditLogs,
  demoCoupons,
  demoCustomers,
  demoEmployees,
  demoExpenses,
  demoInventory,
  demoOrders,
  demoPayments,
  demoPayroll,
  demoProducts,
  demoPurchases,
  demoReservations,
  demoSettings,
  demoStockMovements,
  demoSuppliers,
  demoTables
} from '../src/data/demoData.js';

const dbPath = resolve(process.cwd(), process.env.SQLITE_PATH || 'data/pos.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function inTransaction<T>(work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      restaurant_name TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      branch_code TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT '৳',
      tax_rate REAL NOT NULL DEFAULT 5,
      receipt_footer TEXT NOT NULL DEFAULT '',
      public_menu_url TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','manager','cashier','kitchen','inventory','accountant','delivery')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      image TEXT NOT NULL DEFAULT '',
      popularity INTEGER NOT NULL DEFAULT 80,
      active INTEGER NOT NULL DEFAULT 1,
      recipe_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      stock REAL NOT NULL DEFAULT 0,
      reorder_level REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      supplier TEXT NOT NULL DEFAULT '',
      expiry TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('sale','purchase','adjustment','waste')),
      quantity_delta REAL NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      due REAL NOT NULL DEFAULT 0,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      favorite_items_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS dining_tables (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      zone TEXT NOT NULL DEFAULT 'Main Hall',
      status TEXT NOT NULL DEFAULT 'Available',
      current_guests INTEGER NOT NULL DEFAULT 0,
      current_order_id TEXT
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      guests INTEGER NOT NULL DEFAULT 2,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      table_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Confirmed',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      due REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      due REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'received',
      created_at TEXT NOT NULL,
      items_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      table_id TEXT,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      items_json TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      coupon_code TEXT,
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      due REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      kitchen_note TEXT,
      delivery_address TEXT,
      delivery_phone TEXT,
      rider_name TEXT,
      delivery_status TEXT,
      delivery_fee REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      shift TEXT NOT NULL,
      status TEXT NOT NULL,
      salary REAL NOT NULL DEFAULT 0,
      advance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      role TEXT NOT NULL,
      shift TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      check_in TEXT NOT NULL DEFAULT '-',
      check_out TEXT NOT NULL DEFAULT '-',
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      role TEXT NOT NULL,
      month TEXT NOT NULL,
      base_salary REAL NOT NULL DEFAULT 0,
      advance_deducted REAL NOT NULL DEFAULT 0,
      bonus REAL NOT NULL DEFAULT 0,
      net_pay REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pending',
      paid_at TEXT
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('percent','flat')),
      value REAL NOT NULL DEFAULT 0,
      min_order REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      direction TEXT NOT NULL CHECK(direction IN ('in','out')),
      category TEXT NOT NULL,
      reference_id TEXT NOT NULL DEFAULT '',
      party_name TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'Admin',
      time TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export function bootstrapProductionAdmin(): { bootstrapped: boolean; reason?: string } {
  initSchema();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const restaurantName = process.env.BOOTSTRAP_RESTAURANT_NAME?.trim() || 'Musafir Fast Food';
  const branchName = process.env.BOOTSTRAP_BRANCH_NAME?.trim() || 'Main Branch';
  const branchCode = process.env.BOOTSTRAP_BRANCH_CODE?.trim().toUpperCase() || 'MAIN-01';

  if (!email || !password) {
    return {
      bootstrapped: false,
      reason: 'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are not set'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address');
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain 12–128 characters');
  }

  return inTransaction(() => {
    // Ensure organization / restaurant settings exist with bootstrap custom names if specified
    const existingSettings = db.prepare('SELECT id FROM settings WHERE id = 1').get();
    if (!existingSettings) {
      db.prepare(`
        INSERT INTO settings (
          id, restaurant_name, branch_name, branch_code, phone, address, currency, tax_rate, receipt_footer, public_menu_url
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        restaurantName,
        branchName,
        branchCode,
        '+880 1711-000000',
        'Main Street, City Center',
        '৳',
        5,
        'Thank you for dining with us!',
        ''
      );
    } else if (process.env.BOOTSTRAP_RESTAURANT_NAME || process.env.BOOTSTRAP_BRANCH_NAME || process.env.BOOTSTRAP_BRANCH_CODE) {
      db.prepare(`
        UPDATE settings SET
          restaurant_name = COALESCE(?, restaurant_name),
          branch_name = COALESCE(?, branch_name),
          branch_code = COALESCE(?, branch_code)
        WHERE id = 1
      `).run(
        process.env.BOOTSTRAP_RESTAURANT_NAME?.trim() || null,
        process.env.BOOTSTRAP_BRANCH_NAME?.trim() || null,
        process.env.BOOTSTRAP_BRANCH_CODE?.trim().toUpperCase() || null
      );
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
    if (existingUser) {
      return {
        bootstrapped: false,
        reason: `Admin user ${email} already exists; password was not changed`
      };
    }

    const hash = bcrypt.hashSync(password, 12);
    const userId = `u-owner-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, active, created_at)
      VALUES (?, ?, ?, ?, 'owner', 1, ?)
    `).run(userId, email, hash, 'Restaurant Owner', now);

    return { bootstrapped: true };
  });
}

export function ensureSeeded(): void {
  initSchema();

  if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    bootstrapProductionAdmin();
  }

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number };
  if (countRow.count > 0) return;

  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Musafir@2026!';
  const hash = bcrypt.hashSync(adminPass, 10);

  inTransaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO settings (
        id, restaurant_name, branch_name, branch_code, phone, address, currency, tax_rate, receipt_footer, public_menu_url
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      demoSettings.restaurantName,
      demoSettings.branchName,
      demoSettings.branchCode,
      demoSettings.phone,
      demoSettings.address,
      demoSettings.currency,
      demoSettings.taxRate,
      demoSettings.receiptFooter,
      demoSettings.publicMenuUrl
    );

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, display_name, role, active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    const now = new Date().toISOString();
    insertUser.run('u-owner', (process.env.SEED_ADMIN_EMAIL || 'admin@musafir.local').toLowerCase(), hash, 'Mohammad Palash (Owner)', 'owner', now);
    insertUser.run('u-manager', 'manager@musafir.local', hash, 'Nusrat Jahan (Manager)', 'manager', now);
    insertUser.run('u-cashier', 'cashier@musafir.local', hash, 'Sabbir Ahmed (Cashier)', 'cashier', now);
    insertUser.run('u-kitchen', 'kitchen@musafir.local', hash, 'Rafiq Islam (Head Chef)', 'kitchen', now);
    insertUser.run('u-inventory', 'inventory@musafir.local', hash, 'Mita Akter (Inventory)', 'inventory', now);
    insertUser.run('u-accountant', 'accounts@musafir.local', hash, 'Tariq Hasan (Accountant)', 'accountant', now);

    const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
    defaultCategories.forEach((name, index) => {
      insertCategory.run(`cat-${index + 1}`, name, index + 1);
    });

    const insertProduct = db.prepare(`
      INSERT OR REPLACE INTO products (id, sku, name, category, price, image, popularity, active, recipe_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of demoProducts) {
      insertProduct.run(
        p.id,
        p.sku || p.id.toUpperCase(),
        p.name,
        p.category,
        p.price,
        p.image,
        p.popularity,
        p.active === false ? 0 : 1,
        JSON.stringify(p.recipe)
      );
    }

    const insertIngredient = db.prepare(`
      INSERT OR REPLACE INTO ingredients (id, sku, name, category, unit, stock, reorder_level, cost, supplier, expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const i of demoInventory) {
      insertIngredient.run(
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

    const insertMovement = db.prepare(`
      INSERT OR REPLACE INTO stock_movements (id, ingredient_id, ingredient_name, movement_type, quantity_delta, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of demoStockMovements) {
      insertMovement.run(m.id, m.ingredientId, m.ingredientName, m.movementType, m.quantityDelta, m.note, m.createdAt);
    }

    const insertCustomer = db.prepare(`
      INSERT OR REPLACE INTO customers (id, name, phone, address, due, loyalty_points, favorite_items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of demoCustomers) {
      insertCustomer.run(c.id, c.name, c.phone, c.address, c.due, c.loyaltyPoints, JSON.stringify(c.favoriteItems));
    }

    const insertTable = db.prepare(`
      INSERT OR REPLACE INTO dining_tables (id, number, name, capacity, zone, status, current_guests, current_order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of demoTables) {
      insertTable.run(t.id, t.number, t.name, t.capacity, t.zone, t.status, t.currentGuests, t.currentOrderId || null);
    }

    const insertReservation = db.prepare(`
      INSERT OR REPLACE INTO reservations (id, customer_name, phone, guests, date, time, table_id, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of demoReservations) {
      insertReservation.run(r.id, r.customerName, r.phone, r.guests, r.date, r.time, r.tableId, r.status, r.notes);
    }

    const insertSupplier = db.prepare(`
      INSERT OR REPLACE INTO suppliers (id, name, phone, category, due)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const s of demoSuppliers) {
      insertSupplier.run(s.id, s.name, s.phone, s.category, s.due);
    }

    const insertPurchase = db.prepare(`
      INSERT OR REPLACE INTO purchases (id, invoice_number, supplier_id, supplier_name, total, paid, due, status, created_at, items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const pur of demoPurchases) {
      insertPurchase.run(
        pur.id,
        pur.invoiceNumber,
        pur.supplierId,
        pur.supplierName,
        pur.total,
        pur.paid,
        pur.due,
        pur.status,
        pur.createdAt,
        JSON.stringify(pur.items)
      );
    }

    const insertOrder = db.prepare(`
      INSERT OR REPLACE INTO orders (
        id, number, type, status, table_id, customer_id, customer_name, created_at, items_json,
        subtotal, tax, discount, coupon_code, total, paid, due, payment_method, kitchen_note,
        delivery_address, delivery_phone, rider_name, delivery_status, delivery_fee
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const o of demoOrders) {
      insertOrder.run(
        o.id,
        o.number,
        o.type,
        o.status,
        o.tableId || null,
        o.customerId || null,
        o.customerName,
        o.createdAt,
        JSON.stringify(o.items),
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

    const insertExpense = db.prepare(`
      INSERT OR REPLACE INTO expenses (id, title, category, amount, method, date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of demoExpenses) {
      insertExpense.run(e.id, e.title, e.category, e.amount, e.method, e.date, e.note);
    }

    const insertEmployee = db.prepare(`
      INSERT OR REPLACE INTO employees (id, name, role, phone, shift, status, salary, advance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const emp of demoEmployees) {
      insertEmployee.run(emp.id, emp.name, emp.role, emp.phone || '', emp.shift, emp.status, emp.salary, emp.advance);
    }

    const insertAttendance = db.prepare(`
      INSERT OR REPLACE INTO attendance (id, employee_id, employee_name, role, shift, date, status, check_in, check_out, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const att of demoAttendance) {
      insertAttendance.run(
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

    const insertPayroll = db.prepare(`
      INSERT OR REPLACE INTO payroll (id, employee_id, employee_name, role, month, base_salary, advance_deducted, bonus, net_pay, status, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const pr of demoPayroll) {
      insertPayroll.run(
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

    const insertCoupon = db.prepare(`
      INSERT OR REPLACE INTO coupons (id, code, description, type, value, min_order, active, used_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const cpn of demoCoupons) {
      insertCoupon.run(cpn.id, cpn.code, cpn.description, cpn.type, cpn.value, cpn.minOrder, cpn.active ? 1 : 0, cpn.usedCount);
    }

    const insertPayment = db.prepare(`
      INSERT OR REPLACE INTO payments (id, direction, category, reference_id, party_name, amount, method, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const pmt of demoPayments) {
      insertPayment.run(
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

    const insertLog = db.prepare(`
      INSERT OR REPLACE INTO audit_logs (id, title, detail, actor, time, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const l of demoAuditLogs) {
      insertLog.run(l.id, l.title, l.detail, l.actor || 'Admin', l.time, now);
    }
  });
}
