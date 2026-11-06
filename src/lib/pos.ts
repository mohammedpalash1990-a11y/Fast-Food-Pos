import type {
  CartItem,
  Coupon,
  InventoryItem,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  StockMovement
} from '../types';
import { uid } from './format';

export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

export const orderTypeOptions = ['Dine-in', 'Takeaway', 'Pickup', 'Home Delivery'] as const;

export interface Totals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  couponCode?: string;
  couponLabel?: string;
  couponError?: string;
}

export function computeTotals(
  items: { price: number; qty: number }[],
  taxRate: number,
  manualDiscountPct = 0,
  coupon?: Coupon | null,
  deliveryFee = 0
): Totals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  let discount = (subtotal * Math.max(0, Math.min(100, manualDiscountPct))) / 100;
  let couponCode: string | undefined;
  let couponLabel: string | undefined;
  let couponError: string | undefined;

  if (coupon) {
    if (!coupon.active) {
      couponError = `${coupon.code} is no longer active.`;
    } else if (subtotal < coupon.minOrder) {
      couponError = `Minimum order for ${coupon.code} is ${coupon.minOrder}.`;
    } else {
      const couponValue = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
      discount += Math.min(couponValue, subtotal - discount);
      couponCode = coupon.code;
      couponLabel =
        coupon.type === 'percent' ? `${coupon.code} · ${coupon.value}% off` : `${coupon.code} · flat ${coupon.value} off`;
    }
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax = (taxable * Math.max(0, taxRate)) / 100;
  const total = Math.max(0, taxable + tax + Math.max(0, deliveryFee));

  return {
    subtotal,
    tax: Number(tax.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2)),
    couponCode,
    couponLabel,
    couponError
  };
}

export function nextOrderNumber(orders: Order[]): string {
  const numeric = orders
    .map(order => Number(String(order.number).replace(/\D/g, '')))
    .filter(value => Number.isFinite(value) && value > 0);
  const max = numeric.length ? Math.max(...numeric) : 1000;
  return String(max + 1);
}

export interface StockResult {
  inventory: InventoryItem[];
  movements: StockMovement[];
  shortfalls: string[];
}

export function deductStock(inventory: InventoryItem[], products: Product[], items: OrderItem[] | CartItem[]): StockResult {
  const shortfalls: string[] = [];
  const deductions = new Map<string, number>();

  items.forEach(item => {
    const product = products.find(entry => entry.id === item.productId);
    if (!product) return;
    product.recipe.forEach(usage => {
      deductions.set(usage.ingredientId, (deductions.get(usage.ingredientId) || 0) + usage.qty * item.qty);
    });
  });

  const movements: StockMovement[] = [];
  const stamp = new Date().toISOString();

  const inventoryNext = inventory.map(entry => {
    const amount = deductions.get(entry.id);
    if (!amount) return entry;
    if (entry.stock < amount) shortfalls.push(`${entry.name} (need ${amount} ${entry.unit}, have ${entry.stock})`);
    movements.push({
      id: uid('sm'),
      ingredientId: entry.id,
      ingredientName: entry.name,
      movementType: 'sale',
      quantityDelta: -Number(amount.toFixed(2)),
      note: 'Recipe deduction on order completion',
      createdAt: stamp
    });
    return { ...entry, stock: Number(Math.max(0, entry.stock - amount).toFixed(2)) };
  });

  return { inventory: inventoryNext, movements, shortfalls };
}

export function stockHealth(item: InventoryItem): 'out' | 'low' | 'ok' {
  if (item.stock <= 0) return 'out';
  if (item.stock <= item.reorderLevel) return 'low';
  return 'ok';
}

export function projectedStock(products: Product[], inventory: InventoryItem[], productId: string): number | null {
  const product = products.find(entry => entry.id === productId);
  if (!product || product.recipe.length === 0) return null;
  const ratios = product.recipe.map(usage => {
    const item = inventory.find(entry => entry.id === usage.ingredientId);
    if (!item || usage.qty <= 0) return 0;
    return Math.floor(item.stock / usage.qty);
  });
  return Math.min(...ratios);
}

export function orderStats(orders: Order[]) {
  const valid = orders.filter(order => order.status !== 'Cancelled');
  const revenue = valid.reduce((sum, order) => sum + order.total, 0);
  const collected = valid.reduce((sum, order) => sum + order.paid, 0);
  const due = valid.reduce((sum, order) => sum + order.due, 0);
  const count = valid.length;
  return { revenue, collected, due, count, average: count ? revenue / count : 0 };
}

export function statusFlow(status: OrderStatus): OrderStatus | null {
  const flow: Record<string, OrderStatus | null> = {
    Pending: 'Accepted',
    Accepted: 'Preparing',
    Preparing: 'Ready',
    Ready: 'Completed',
    Completed: null,
    Cancelled: null
  };
  return flow[status] ?? null;
}

export function isToday(iso: string): boolean {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

export function lastDays(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

export function cogsForOrder(order: Order, products: Product[], inventory: InventoryItem[]): number {
  return order.items.reduce((sum, item) => {
    const product = products.find(entry => entry.id === item.productId);
    if (!product) return sum;
    const unitCost = product.recipe.reduce((cost, usage) => {
      const ingredient = inventory.find(entry => entry.id === usage.ingredientId);
      return cost + (ingredient ? ingredient.cost * usage.qty : 0);
    }, 0);
    return sum + unitCost * item.qty;
  }, 0);
}

export const rolePermissions: { role: string; label: string; scopes: string[] }[] = [
  {
    role: 'owner',
    label: 'Owner',
    scopes: [
      'dashboard','pos','orders','kitchen','tables','reservations','customers','menu','categories','inventory','recipes','suppliers','purchases','delivery','expenses','employees','attendance','payroll','accounting','reports','profit','dues','discounts','qr','settings','roles'
    ]
  },
  {
    role: 'manager',
    label: 'Manager',
    scopes: [
      'dashboard','pos','orders','kitchen','tables','reservations','customers','menu','categories','inventory','recipes','suppliers','purchases','delivery','expenses','employees','attendance','payroll','accounting','reports','profit','dues','discounts','qr'
    ]
  },
  {
    role: 'cashier',
    label: 'Cashier',
    scopes: ['dashboard', 'pos', 'orders', 'kitchen', 'tables', 'customers', 'dues', 'discounts', 'qr']
  },
  {
    role: 'kitchen',
    label: 'Kitchen',
    scopes: ['dashboard', 'kitchen', 'orders', 'recipes', 'inventory']
  },
  {
    role: 'inventory',
    label: 'Inventory',
    scopes: ['dashboard', 'inventory', 'recipes', 'suppliers', 'purchases', 'menu', 'categories']
  },
  {
    role: 'accountant',
    label: 'Accountant',
    scopes: ['dashboard', 'accounting', 'expenses', 'payroll', 'reports', 'profit', 'dues', 'orders', 'purchases']
  },
  {
    role: 'delivery',
    label: 'Delivery',
    scopes: ['dashboard', 'delivery', 'orders', 'customers']
  }
];
