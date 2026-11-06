import {
  type AttendanceRecord,
  type CategoryName,
  type Coupon,
  type Customer,
  type DiningTable,
  type Employee,
  type Expense,
  type InventoryItem,
  type LogEntry,
  type Order,
  type PaymentEntry,
  type PayrollRecord,
  type Product,
  type Purchase,
  type Reservation,
  type RestaurantSettings,
  type StockMovement,
  type Supplier
} from '../types';

export const categories: CategoryName[] = [
  'Burgers',
  'Pizza',
  'Sandwiches',
  'Fried Chicken',
  'French Fries',
  'Chicken Nuggets',
  'Pasta',
  'Snacks',
  'Drinks',
  'Desserts',
  'Combo Meals'
];

export const demoProducts: Product[] = [
  {
    id: 'p1',
    sku: 'BRG-001',
    name: 'Chicken Burger',
    category: 'Burgers',
    price: 180,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
    popularity: 96,
    active: true,
    recipe: [
      { ingredientId: 'i1', name: 'Burger bun', qty: 1, unit: 'piece' },
      { ingredientId: 'i2', name: 'Chicken patty', qty: 1, unit: 'piece' },
      { ingredientId: 'i3', name: 'Cheese', qty: 1, unit: 'slice' },
      { ingredientId: 'i4', name: 'Lettuce', qty: 20, unit: 'g' },
      { ingredientId: 'i5', name: 'Sauce', qty: 15, unit: 'g' }
    ]
  },
  {
    id: 'p2',
    sku: 'BRG-002',
    name: 'Beef Burger',
    category: 'Burgers',
    price: 220,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80',
    popularity: 88,
    active: true,
    recipe: [
      { ingredientId: 'i1', name: 'Burger bun', qty: 1, unit: 'piece' },
      { ingredientId: 'i11', name: 'Beef patty', qty: 1, unit: 'piece' },
      { ingredientId: 'i3', name: 'Cheese', qty: 1, unit: 'slice' },
      { ingredientId: 'i4', name: 'Lettuce', qty: 20, unit: 'g' }
    ]
  },
  {
    id: 'p3',
    sku: 'BRG-003',
    name: 'Zinger Burger',
    category: 'Burgers',
    price: 240,
    image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=900&q=80',
    popularity: 93,
    active: true,
    recipe: [
      { ingredientId: 'i1', name: 'Burger bun', qty: 1, unit: 'piece' },
      { ingredientId: 'i12', name: 'Zinger fillet', qty: 1, unit: 'piece' },
      { ingredientId: 'i3', name: 'Cheese', qty: 1, unit: 'slice' },
      { ingredientId: 'i4', name: 'Lettuce', qty: 20, unit: 'g' }
    ]
  },
  {
    id: 'p4',
    sku: 'PIZ-001',
    name: 'Regular Pizza',
    category: 'Pizza',
    price: 320,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
    popularity: 92,
    active: true,
    recipe: [
      { ingredientId: 'i6', name: 'Pizza dough', qty: 1, unit: 'base' },
      { ingredientId: 'i5', name: 'Sauce', qty: 40, unit: 'g' },
      { ingredientId: 'i3', name: 'Cheese', qty: 3, unit: 'slice' }
    ]
  },
  {
    id: 'p5',
    sku: 'PIZ-002',
    name: 'Medium Pizza',
    category: 'Pizza',
    price: 420,
    image: 'https://images.unsplash.com/photo-1548365328-9f547fb9587c?auto=format&fit=crop&w=900&q=80',
    popularity: 90,
    active: true,
    recipe: [
      { ingredientId: 'i6', name: 'Pizza dough', qty: 1, unit: 'base' },
      { ingredientId: 'i5', name: 'Sauce', qty: 50, unit: 'g' },
      { ingredientId: 'i3', name: 'Cheese', qty: 4, unit: 'slice' }
    ]
  },
  {
    id: 'p6',
    sku: 'FRY-001',
    name: 'French Fries',
    category: 'French Fries',
    price: 120,
    image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=900&q=80',
    popularity: 95,
    active: true,
    recipe: [
      { ingredientId: 'i7', name: 'Potato', qty: 250, unit: 'g' },
      { ingredientId: 'i8', name: 'Cooking oil', qty: 20, unit: 'ml' }
    ]
  },
  {
    id: 'p7',
    sku: 'NUG-001',
    name: 'Chicken Nuggets',
    category: 'Chicken Nuggets',
    price: 160,
    image: 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80',
    popularity: 84,
    active: true,
    recipe: [
      { ingredientId: 'i13', name: 'Chicken nugget', qty: 6, unit: 'piece' },
      { ingredientId: 'i8', name: 'Cooking oil', qty: 20, unit: 'ml' }
    ]
  },
  {
    id: 'p8',
    sku: 'DRK-001',
    name: 'Cold Coffee',
    category: 'Drinks',
    price: 120,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80',
    popularity: 78,
    active: true,
    recipe: [
      { ingredientId: 'i9', name: 'Milk', qty: 100, unit: 'ml' }
    ]
  },
  {
    id: 'p9',
    sku: 'DRK-002',
    name: 'Coca-Cola',
    category: 'Drinks',
    price: 80,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f2b7420a?auto=format&fit=crop&w=900&q=80',
    popularity: 65,
    active: true,
    recipe: [
      { ingredientId: 'i10', name: 'Coca-Cola', qty: 1, unit: 'can' }
    ]
  },
  {
    id: 'p10',
    sku: 'CMB-001',
    name: 'Chicken Combo',
    category: 'Combo Meals',
    price: 350,
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80',
    popularity: 91,
    active: true,
    recipe: [
      { ingredientId: 'i1', name: 'Burger bun', qty: 1, unit: 'piece' },
      { ingredientId: 'i2', name: 'Chicken patty', qty: 1, unit: 'piece' },
      { ingredientId: 'i7', name: 'Potato', qty: 200, unit: 'g' },
      { ingredientId: 'i10', name: 'Coca-Cola', qty: 1, unit: 'can' }
    ]
  },
  {
    id: 'p11',
    sku: 'CHK-001',
    name: 'Crispy Fried Chicken (2 pcs)',
    category: 'Fried Chicken',
    price: 260,
    image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?auto=format&fit=crop&w=900&q=80',
    popularity: 89,
    active: true,
    recipe: [
      { ingredientId: 'i12', name: 'Zinger fillet', qty: 2, unit: 'piece' },
      { ingredientId: 'i8', name: 'Cooking oil', qty: 35, unit: 'ml' }
    ]
  },
  {
    id: 'p12',
    sku: 'SND-001',
    name: 'Smoky Club Sandwich',
    category: 'Sandwiches',
    price: 190,
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80',
    popularity: 82,
    active: true,
    recipe: [
      { ingredientId: 'i2', name: 'Chicken patty', qty: 1, unit: 'piece' },
      { ingredientId: 'i3', name: 'Cheese', qty: 1, unit: 'slice' },
      { ingredientId: 'i4', name: 'Lettuce', qty: 15, unit: 'g' }
    ]
  }
];

export const demoInventory: InventoryItem[] = [
  { id: 'i1', sku: 'ING-BUN', name: 'Burger bun', category: 'Bakery', stock: 120, unit: 'piece', reorderLevel: 30, cost: 18, supplier: 'Baker Supply', expiry: '2026-12-10' },
  { id: 'i2', sku: 'ING-PTY', name: 'Chicken patty', category: 'Meat', stock: 86, unit: 'piece', reorderLevel: 25, cost: 42, supplier: 'Prime Poultry', expiry: '2026-11-12' },
  { id: 'i3', sku: 'ING-CHS', name: 'Cheese', category: 'Dairy', stock: 54, unit: 'slice', reorderLevel: 20, cost: 12, supplier: 'Fresh Dairy', expiry: '2026-11-15' },
  { id: 'i4', sku: 'ING-LTC', name: 'Lettuce', category: 'Vegetable', stock: 320, unit: 'g', reorderLevel: 400, cost: 0.4, supplier: 'Green Valley', expiry: '2026-11-11' },
  { id: 'i5', sku: 'ING-SCE', name: 'Sauce', category: 'Condiments', stock: 670, unit: 'g', reorderLevel: 200, cost: 0.3, supplier: 'Sauce Works', expiry: '2026-12-22' },
  { id: 'i6', sku: 'ING-DGH', name: 'Pizza dough', category: 'Bakery', stock: 48, unit: 'base', reorderLevel: 20, cost: 55, supplier: 'Baker Supply', expiry: '2026-11-10' },
  { id: 'i7', sku: 'ING-PTT', name: 'Potato', category: 'Vegetable', stock: 8500, unit: 'g', reorderLevel: 2000, cost: 0.08, supplier: 'Farm Market', expiry: '2026-11-13' },
  { id: 'i8', sku: 'ING-OIL', name: 'Cooking oil', category: 'Oil', stock: 4500, unit: 'ml', reorderLevel: 1000, cost: 0.18, supplier: 'Apex Oils', expiry: '2026-12-25' },
  { id: 'i9', sku: 'ING-MLK', name: 'Milk', category: 'Dairy', stock: 1800, unit: 'ml', reorderLevel: 500, cost: 0.12, supplier: 'Fresh Dairy', expiry: '2026-11-09' },
  { id: 'i10', sku: 'ING-COK', name: 'Coca-Cola', category: 'Beverage', stock: 44, unit: 'can', reorderLevel: 15, cost: 22, supplier: 'Cold Drinks Ltd', expiry: '2026-12-29' },
  { id: 'i11', sku: 'ING-BEF', name: 'Beef patty', category: 'Meat', stock: 40, unit: 'piece', reorderLevel: 15, cost: 55, supplier: 'Prime Poultry', expiry: '2026-11-18' },
  { id: 'i12', sku: 'ING-ZNG', name: 'Zinger fillet', category: 'Meat', stock: 52, unit: 'piece', reorderLevel: 18, cost: 58, supplier: 'Prime Poultry', expiry: '2026-11-19' },
  { id: 'i13', sku: 'ING-NUG', name: 'Chicken nugget', category: 'Meat', stock: 180, unit: 'piece', reorderLevel: 48, cost: 11, supplier: 'Prime Poultry', expiry: '2026-11-25' }
];

export const demoCustomers: Customer[] = [
  { id: 'c1', name: 'Nadia Rahman', phone: '01711223344', address: 'Gulshan-2, Road 45, Dhaka', due: 0, loyaltyPoints: 420, favoriteItems: ['Chicken Burger', 'Cold Coffee'] },
  { id: 'c2', name: 'Imran Ali', phone: '01833445566', address: 'Dhanmondi 27, House 14, Dhaka', due: 283, loyaltyPoints: 180, favoriteItems: ['Zinger Burger', 'French Fries'] },
  { id: 'c3', name: 'Farah Khan', phone: '01677889900', address: 'Bashundhara R/A, Block C, Dhaka', due: 0, loyaltyPoints: 560, favoriteItems: ['Medium Pizza', 'Chicken Combo'] },
  { id: 'c4', name: 'Tanvir Hossain', phone: '01911224488', address: 'Uttara Sector 7, Dhaka', due: 368, loyaltyPoints: 230, favoriteItems: ['Chicken Combo', 'Beef Burger'] }
];

export const demoOrders: Order[] = [
  {
    id: 'o-1001',
    number: '1001',
    type: 'Dine-in',
    status: 'Preparing',
    tableId: 't2',
    customerId: 'c1',
    createdAt: '2026-11-05T09:10:00',
    customerName: 'Nadia Rahman',
    items: [
      { id: 'li1', productId: 'p1', name: 'Chicken Burger', qty: 2, unitPrice: 180 },
      { id: 'li2', productId: 'p6', name: 'French Fries', qty: 1, unitPrice: 120 }
    ],
    subtotal: 480,
    tax: 24,
    discount: 0,
    total: 504,
    paid: 504,
    due: 0,
    paymentMethod: 'Cash',
    kitchenNote: 'No onions'
  },
  {
    id: 'o-1002',
    number: '1002',
    type: 'Home Delivery',
    status: 'Ready',
    customerId: 'c2',
    createdAt: '2026-11-05T09:36:00',
    customerName: 'Imran Ali',
    items: [
      { id: 'li3', productId: 'p5', name: 'Medium Pizza', qty: 1, unitPrice: 420 },
      { id: 'li4', productId: 'p8', name: 'Cold Coffee', qty: 2, unitPrice: 120 }
    ],
    subtotal: 660,
    tax: 33,
    discount: 10,
    total: 683,
    paid: 400,
    due: 283,
    paymentMethod: 'Card',
    kitchenNote: 'Extra cheese',
    deliveryAddress: 'Dhanmondi 27, House 14, Dhaka',
    deliveryPhone: '01833445566',
    riderName: 'Kamal Rider',
    deliveryStatus: 'Picked Up',
    deliveryFee: 60
  },
  {
    id: 'o-1003',
    number: '1003',
    type: 'Pickup',
    status: 'Pending',
    customerId: 'c4',
    createdAt: '2026-11-05T10:08:00',
    customerName: 'Tanvir Hossain',
    items: [
      { id: 'li5', productId: 'p10', name: 'Chicken Combo', qty: 1, unitPrice: 350 }
    ],
    subtotal: 350,
    tax: 18,
    discount: 0,
    total: 368,
    paid: 0,
    due: 368,
    paymentMethod: 'Digital',
    kitchenNote: 'Add spicy sauce'
  },
  {
    id: 'o-1000',
    number: '1000',
    type: 'Dine-in',
    status: 'Completed',
    tableId: 't1',
    customerId: 'c3',
    createdAt: '2026-11-04T19:20:00',
    customerName: 'Farah Khan',
    items: [
      { id: 'li0a', productId: 'p3', name: 'Zinger Burger', qty: 2, unitPrice: 240 },
      { id: 'li0b', productId: 'p9', name: 'Coca-Cola', qty: 2, unitPrice: 80 }
    ],
    subtotal: 640,
    tax: 32,
    discount: 0,
    total: 672,
    paid: 672,
    due: 0,
    paymentMethod: 'Card'
  }
];

export const demoTables: DiningTable[] = [
  { id: 't1', number: 'T-01', name: 'Window Two-Top', capacity: 2, zone: 'Main Hall', status: 'Available', currentGuests: 0 },
  { id: 't2', number: 'T-02', name: 'Center Booth A', capacity: 4, zone: 'Main Hall', status: 'Occupied', currentGuests: 3, currentOrderId: 'o-1001' },
  { id: 't3', number: 'T-03', name: 'Center Booth B', capacity: 4, zone: 'Main Hall', status: 'Available', currentGuests: 0 },
  { id: 't4', number: 'T-04', name: 'Corner Four-Top', capacity: 4, zone: 'Main Hall', status: 'Cleaning', currentGuests: 0 },
  { id: 't5', number: 'T-05', name: 'Family Table 1', capacity: 6, zone: 'Family Zone', status: 'Reserved', currentGuests: 0 },
  { id: 't6', number: 'T-06', name: 'Family Table 2', capacity: 8, zone: 'Family Zone', status: 'Available', currentGuests: 0 },
  { id: 't7', number: 'T-07', name: 'Patio Bistro 1', capacity: 2, zone: 'Outdoor Patio', status: 'Available', currentGuests: 0 },
  { id: 't8', number: 'T-08', name: 'VIP Lounge Booth', capacity: 6, zone: 'VIP Lounge', status: 'Available', currentGuests: 0 }
];

export const demoReservations: Reservation[] = [
  { id: 'r1', customerName: 'Farah Khan', phone: '01677889900', guests: 5, date: '2026-11-05', time: '19:30', tableId: 't5', status: 'Confirmed', notes: 'Birthday dinner table setup' },
  { id: 'r2', customerName: 'Dr. Mahmud Hasan', phone: '01755667788', guests: 6, date: '2026-11-05', time: '20:30', tableId: 't8', status: 'Confirmed', notes: 'VIP Lounge quiet corner' },
  { id: 'r3', customerName: 'Nadia Rahman', phone: '01711223344', guests: 3, date: '2026-11-05', time: '13:00', tableId: 't2', status: 'Seated', notes: 'Lunch meeting' }
];

export const demoEmployees: Employee[] = [
  { id: 'e1', name: 'Nusrat Jahan', role: 'Supervisor', phone: '01712001100', shift: 'Morning', status: 'Present', salary: 42000, advance: 3000 },
  { id: 'e2', name: 'Sabbir Ahmed', role: 'Cashier', phone: '01812002200', shift: 'Morning', status: 'Present', salary: 26000, advance: 2000 },
  { id: 'e3', name: 'Rafiq Islam', role: 'Head Chef', phone: '01912003300', shift: 'Day', status: 'Present', salary: 35000, advance: 1500 },
  { id: 'e4', name: 'Mita Akter', role: 'Inventory Manager', phone: '01612004400', shift: 'Evening', status: 'On Leave', salary: 32000, advance: 0 },
  { id: 'e5', name: 'Kamal Rider', role: 'Delivery Rider', phone: '01512005500', shift: 'Day', status: 'Present', salary: 20000, advance: 1000 }
];

export const demoAttendance: AttendanceRecord[] = [
  { id: 'att-1', employeeId: 'e1', employeeName: 'Nusrat Jahan', role: 'Supervisor', shift: 'Morning', date: '2026-11-05', status: 'Present', checkIn: '08:02', checkOut: '16:05', note: 'Opened register' },
  { id: 'att-2', employeeId: 'e2', employeeName: 'Sabbir Ahmed', role: 'Cashier', shift: 'Morning', date: '2026-11-05', status: 'Present', checkIn: '08:10', checkOut: '16:00', note: '' },
  { id: 'att-3', employeeId: 'e3', employeeName: 'Rafiq Islam', role: 'Head Chef', shift: 'Day', date: '2026-11-05', status: 'Present', checkIn: '09:00', checkOut: '18:00', note: 'Prep complete' },
  { id: 'att-4', employeeId: 'e4', employeeName: 'Mita Akter', role: 'Inventory Manager', shift: 'Evening', date: '2026-11-05', status: 'On Leave', checkIn: '-', checkOut: '-', note: 'Approved personal leave' },
  { id: 'att-5', employeeId: 'e5', employeeName: 'Kamal Rider', role: 'Delivery Rider', shift: 'Day', date: '2026-11-05', status: 'Present', checkIn: '09:15', checkOut: '-', note: 'Active on delivery route' }
];

export const demoPayroll: PayrollRecord[] = [
  { id: 'pay-1', employeeId: 'e1', employeeName: 'Nusrat Jahan', role: 'Supervisor', month: '2026-11', baseSalary: 42000, advanceDeducted: 3000, bonus: 2000, netPay: 41000, status: 'Pending' },
  { id: 'pay-2', employeeId: 'e2', employeeName: 'Sabbir Ahmed', role: 'Cashier', month: '2026-11', baseSalary: 26000, advanceDeducted: 2000, bonus: 1000, netPay: 25000, status: 'Pending' },
  { id: 'pay-3', employeeId: 'e3', employeeName: 'Rafiq Islam', role: 'Head Chef', month: '2026-11', baseSalary: 35000, advanceDeducted: 1500, bonus: 1500, netPay: 35000, status: 'Paid', paidAt: '2026-11-03' },
  { id: 'pay-4', employeeId: 'e4', employeeName: 'Mita Akter', role: 'Inventory Manager', month: '2026-11', baseSalary: 32000, advanceDeducted: 0, bonus: 0, netPay: 32000, status: 'Pending' },
  { id: 'pay-5', employeeId: 'e5', employeeName: 'Kamal Rider', role: 'Delivery Rider', month: '2026-11', baseSalary: 20000, advanceDeducted: 1000, bonus: 500, netPay: 19500, status: 'Pending' }
];

export const demoSuppliers: Supplier[] = [
  { id: 's1', name: 'Baker Supply', phone: '01710000001', category: 'Bakery', due: 4500 },
  { id: 's2', name: 'Prime Poultry', phone: '01810000002', category: 'Meat', due: 9500 },
  { id: 's3', name: 'Fresh Dairy', phone: '01910000003', category: 'Dairy', due: 3200 },
  { id: 's4', name: 'Apex Oils', phone: '01610000004', category: 'Oil & Condiments', due: 0 }
];

export const demoPurchases: Purchase[] = [
  {
    id: 'pur-1',
    invoiceNumber: 'INV-2026-101',
    supplierId: 's1',
    supplierName: 'Baker Supply',
    total: 12500,
    paid: 8000,
    due: 4500,
    status: 'received',
    createdAt: '2026-11-03T11:20:00',
    items: [
      { ingredientId: 'i1', ingredientName: 'Burger bun', qty: 200, unitCost: 18, lineTotal: 3600 },
      { ingredientId: 'i6', ingredientName: 'Pizza dough', qty: 160, unitCost: 55.625, lineTotal: 8900 }
    ]
  },
  {
    id: 'pur-2',
    invoiceNumber: 'INV-2026-102',
    supplierId: 's2',
    supplierName: 'Prime Poultry',
    total: 19500,
    paid: 10000,
    due: 9500,
    status: 'received',
    createdAt: '2026-11-04T15:10:00',
    items: [
      { ingredientId: 'i2', ingredientName: 'Chicken patty', qty: 250, unitCost: 42, lineTotal: 10500 },
      { ingredientId: 'i12', ingredientName: 'Zinger fillet', qty: 150, unitCost: 60, lineTotal: 9000 }
    ]
  }
];

export const demoExpenses: Expense[] = [
  { id: 'exp-1', title: 'Eco Takeaway Boxes & Kraft Bags', category: 'Packaging', amount: 3400, method: 'Cash', date: '2026-11-03', note: '500 burger boxes + 500 bags' },
  { id: 'exp-2', title: 'Kitchen Hood & Fryer Servicing', category: 'Maintenance', amount: 2200, method: 'Bank transfer', date: '2026-11-04', note: 'Monthly deep clean and safety check' },
  { id: 'exp-3', title: 'Electricity & Gas Utility Advance', category: 'Utilities', amount: 6800, method: 'Digital', date: '2026-11-05', note: 'November utility bill' }
];

export const demoCoupons: Coupon[] = [
  { id: 'cpn-1', code: 'MUSAFIR10', description: '10% off orders above ৳300', type: 'percent', value: 10, minOrder: 300, active: true, usedCount: 18 },
  { id: 'cpn-2', code: 'WELCOME50', description: 'Flat ৳50 off on orders above ৳400', type: 'flat', value: 50, minOrder: 400, active: true, usedCount: 9 },
  { id: 'cpn-3', code: 'COMBO15', description: '15% family weekend discount above ৳800', type: 'percent', value: 15, minOrder: 800, active: true, usedCount: 6 }
];

export const demoPayments: PaymentEntry[] = [
  { id: 'pmt-1', direction: 'in', category: 'Order Sale', referenceId: 'o-1000', partyName: 'Farah Khan', amount: 672, method: 'Card', note: 'Order #1000 full payment', createdAt: '2026-11-04T19:20:00' },
  { id: 'pmt-2', direction: 'in', category: 'Order Sale', referenceId: 'o-1001', partyName: 'Nadia Rahman', amount: 504, method: 'Cash', note: 'Order #1001 full payment', createdAt: '2026-11-05T09:10:00' },
  { id: 'pmt-3', direction: 'in', category: 'Order Sale', referenceId: 'o-1002', partyName: 'Imran Ali', amount: 400, method: 'Card', note: 'Order #1002 partial payment', createdAt: '2026-11-05T09:36:00' },
  { id: 'pmt-4', direction: 'out', category: 'Supplier Payment', referenceId: 'pur-2', partyName: 'Prime Poultry', amount: 10000, method: 'Bank transfer', note: 'Initial payment for INV-2026-102', createdAt: '2026-11-04T15:10:00' },
  { id: 'pmt-5', direction: 'out', category: 'Expense', referenceId: 'exp-3', partyName: 'Electricity & Gas Utility', amount: 6800, method: 'Digital', note: 'November utility bill', createdAt: '2026-11-05T08:40:00' }
];

export const demoStockMovements: StockMovement[] = [
  { id: 'sm-1', ingredientId: 'i2', ingredientName: 'Chicken patty', movementType: 'purchase', quantityDelta: 250, note: 'Invoice INV-2026-102 received', createdAt: '2026-11-04T15:10:00' },
  { id: 'sm-2', ingredientId: 'i1', ingredientName: 'Burger bun', movementType: 'sale', quantityDelta: -2, note: 'Order #1001 recipe deduction', createdAt: '2026-11-05T09:10:00' },
  { id: 'sm-3', ingredientId: 'i4', ingredientName: 'Lettuce', movementType: 'waste', quantityDelta: -12, note: 'Morning trim waste', createdAt: '2026-11-05T08:30:00' }
];

export const demoSettings: RestaurantSettings = {
  restaurantName: 'Musafir Fast Food',
  branchName: 'Dhaka Main Branch',
  branchCode: 'DHK-01',
  phone: '+880 1711-009988',
  address: 'House 24, Road 11, Banani, Dhaka 1213',
  currency: '৳',
  taxRate: 5,
  receiptFooter: 'Thank you for dining with Musafir Fast Food! Good Food • Good Mood.',
  publicMenuUrl: ''
};

export const demoAuditLogs: LogEntry[] = [
  { id: 'l1', title: 'Cash count verified', detail: 'Morning shift cash closing matched safe count.', actor: 'Nusrat Jahan', time: '08:15 AM' },
  { id: 'l2', title: 'Inventory stock review', detail: 'Lettuce stock below threshold; restock alert triggered.', actor: 'System', time: '09:45 AM' },
  { id: 'l3', title: 'Supplier invoice recorded', detail: 'Prime Poultry INV-2026-102 received into cold storage.', actor: 'Mita Akter', time: '10:20 AM' }
];
