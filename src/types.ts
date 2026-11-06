export type CategoryName =
  | 'Burgers'
  | 'Pizza'
  | 'Sandwiches'
  | 'Fried Chicken'
  | 'French Fries'
  | 'Chicken Nuggets'
  | 'Pasta'
  | 'Snacks'
  | 'Drinks'
  | 'Desserts'
  | 'Combo Meals'
  | string;

export type OrderType = 'Dine-in' | 'Takeaway' | 'Pickup' | 'Home Delivery';
export type OrderStatus = 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Card' | 'Digital' | 'Bank transfer';
export type Role = 'owner' | 'manager' | 'cashier' | 'kitchen' | 'inventory' | 'accountant' | 'delivery';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface IngredientUsage {
  ingredientId: string;
  name: string;
  qty: number;
  unit: string;
}

export interface Product {
  id: string;
  sku?: string;
  name: string;
  category: CategoryName;
  price: number;
  image: string;
  popularity: number;
  active?: boolean;
  recipe: IngredientUsage[];
}

export interface CategoryItem {
  id: string;
  name: string;
  sortOrder: number;
}

export interface InventoryItem {
  id: string;
  sku?: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  reorderLevel: number;
  cost: number;
  supplier: string;
  expiry: string;
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  movementType: 'sale' | 'purchase' | 'adjustment' | 'waste';
  quantityDelta: number;
  note: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  due: number;
  loyaltyPoints: number;
  favoriteItems: string[];
}

export interface OrderItem {
  id: string;
  productId: string;
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
  tableId?: string;
  customerId?: string;
  createdAt: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  couponCode?: string;
  total: number;
  paid: number;
  due: number;
  paymentMethod: PaymentMethod;
  kitchenNote?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  riderName?: string;
  deliveryStatus?: 'Pending' | 'Assigned' | 'Picked Up' | 'Delivered';
  deliveryFee?: number;
}

export interface DiningTable {
  id: string;
  number: string;
  name: string;
  capacity: number;
  zone: 'Main Hall' | 'Family Zone' | 'Outdoor Patio' | 'VIP Lounge';
  status: 'Available' | 'Occupied' | 'Reserved' | 'Cleaning';
  currentGuests: number;
  currentOrderId?: string;
}

export interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  tableId: string;
  status: 'Confirmed' | 'Seated' | 'Completed' | 'Cancelled';
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  category: string;
  due: number;
}

export interface PurchaseItem {
  ingredientId: string;
  ingredientName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  total: number;
  paid: number;
  due: number;
  status: 'received' | 'cancelled';
  createdAt: string;
  items: PurchaseItem[];
}

export interface Expense {
  id: string;
  title: string;
  category: 'Rent' | 'Utilities' | 'Packaging' | 'Maintenance' | 'Marketing' | 'Ingredients' | 'Misc';
  amount: number;
  method: PaymentMethod;
  date: string;
  note: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone?: string;
  shift: 'Morning' | 'Day' | 'Evening' | 'Night';
  status: 'Present' | 'Absent' | 'On Leave' | 'Late';
  salary: number;
  advance: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  shift: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'On Leave';
  checkIn: string;
  checkOut: string;
  note: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  month: string;
  baseSalary: number;
  advanceDeducted: number;
  bonus: number;
  netPay: number;
  status: 'Pending' | 'Paid';
  paidAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  type: 'percent' | 'flat';
  value: number;
  minOrder: number;
  active: boolean;
  usedCount: number;
}

export interface PaymentEntry {
  id: string;
  direction: 'in' | 'out';
  category: 'Order Sale' | 'Due Collection' | 'Supplier Payment' | 'Expense' | 'Payroll';
  referenceId: string;
  partyName: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  createdAt: string;
}

export interface RestaurantSettings {
  restaurantName: string;
  branchName: string;
  branchCode: string;
  phone: string;
  address: string;
  currency: string;
  taxRate: number;
  receiptFooter: string;
  publicMenuUrl: string;
}

export interface LogEntry {
  id: string;
  title: string;
  detail: string;
  actor?: string;
  time: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}
