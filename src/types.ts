export type CategoryName = 'Burgers' | 'Pizza' | 'Sandwiches' | 'Fried Chicken' | 'French Fries' | 'Chicken Nuggets' | 'Pasta' | 'Snacks' | 'Drinks' | 'Desserts' | 'Combo Meals';
export type OrderType = 'Dine-in' | 'Takeaway' | 'Pickup' | 'Home Delivery';
export type OrderStatus = 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Mada';
export interface OrderPayment { method: PaymentMethod; amount: number; }

export interface IngredientUsage {
  ingredientId: string;
  name: string;
  qty: number;
  unit: string;
}

export interface Product {
  id: string;
  name: string;
  category: CategoryName;
  price: number;
  image: string;
  popularity: number;
  recipe: IngredientUsage[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  trackStock: boolean;
  unit: string;
  reorderLevel: number;
  cost: number;
  supplier: string;
  expiry: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  loyaltyPoints: number;
  orderCount?: number;
  lifetimeSpend?: number;
  lastOrderAt?: string;
  favoriteItems: string[];
}

export interface OrderItem {
  productId: string;
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  note?: string;
}

export interface Order {
  id: string;
  number: string;
  type: OrderType;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: OrderPayment[];
  channel?: 'pos' | 'qr';
  customerPhone?: string;
  deliveryAddress?: string;
  kitchenNote?: string;
  tableNumber?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  shift: string;
  status: 'Present' | 'Absent' | 'On Leave';
  salary: number;
  advance: number;
  active?: boolean;
}

export interface LogEntry {
  id: string;
  title: string;
  detail: string;
  time: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  category: string;
  due: number;
}

export interface CartItem {
  productId: string;
  id: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}
