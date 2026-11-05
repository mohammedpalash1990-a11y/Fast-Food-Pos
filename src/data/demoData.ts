import { type CategoryName, type InventoryItem, type Product, type Customer, type Order, type Employee, type Supplier } from '../types';

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
  { id: 'p1', name: 'Chicken Burger', category: 'Burgers', price: 180, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', popularity: 96, recipe: [
    { ingredientId:'bun', name:'Burger bun', qty:1, unit:'piece' },
    { ingredientId:'patty', name:'Chicken patty', qty:1, unit:'piece' },
    { ingredientId:'cheese', name:'Cheese', qty:1, unit:'slice' },
    { ingredientId:'lettuce', name:'Lettuce', qty:20, unit:'g' },
    { ingredientId:'sauce', name:'Sauce', qty:15, unit:'g' }
  ] },
  { id: 'p2', name: 'Beef Burger', category: 'Burgers', price: 220, image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80', popularity: 88, recipe: [
    { ingredientId:'bun', name:'Burger bun', qty:1, unit:'piece' },
    { ingredientId:'beef', name:'Beef patty', qty:1, unit:'piece' },
    { ingredientId:'cheese', name:'Cheese', qty:1, unit:'slice' },
    { ingredientId:'lettuce', name:'Lettuce', qty:20, unit:'g' }
  ] },
  { id: 'p3', name: 'Zinger Burger', category: 'Burgers', price: 240, image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=900&q=80', popularity: 93, recipe: [
    { ingredientId:'bun', name:'Burger bun', qty:1, unit:'piece' },
    { ingredientId:'zinger', name:'Zinger fillet', qty:1, unit:'piece' },
    { ingredientId:'cheese', name:'Cheese', qty:1, unit:'slice' },
    { ingredientId:'lettuce', name:'Lettuce', qty:20, unit:'g' }
  ] },
  { id: 'p4', name: 'Regular Pizza', category: 'Pizza', price: 320, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80', popularity: 92, recipe: [
    { ingredientId:'dough', name:'Pizza dough', qty:1, unit:'base' },
    { ingredientId:'sauce', name:'Pizza sauce', qty:40, unit:'g' },
    { ingredientId:'cheese', name:'Cheese', qty:80, unit:'g' },
    { ingredientId:'tomato', name:'Tomato', qty:30, unit:'g' }
  ] },
  { id: 'p5', name: 'Medium Pizza', category: 'Pizza', price: 420, image: 'https://images.unsplash.com/photo-1548365328-9f547fb9587c?auto=format&fit=crop&w=900&q=80', popularity: 90, recipe: [
    { ingredientId:'dough', name:'Pizza dough', qty:1, unit:'base' },
    { ingredientId:'sauce', name:'Pizza sauce', qty:50, unit:'g' },
    { ingredientId:'cheese', name:'Cheese', qty:100, unit:'g' },
    { ingredientId:'tomato', name:'Tomato', qty:40, unit:'g' }
  ] },
  { id: 'p6', name: 'French Fries', category: 'French Fries', price: 120, image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=900&q=80', popularity: 95, recipe: [
    { ingredientId:'potato', name:'Potato', qty:250, unit:'g' },
    { ingredientId:'oil', name:'Cooking oil', qty:20, unit:'ml' },
    { ingredientId:'salt', name:'Salt', qty:5, unit:'g' }
  ] },
  { id: 'p7', name: 'Chicken Nuggets', category: 'Chicken Nuggets', price: 160, image: 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80', popularity: 84, recipe: [
    { ingredientId:'nugget', name:'Chicken nugget', qty:6, unit:'pieces' },
    { ingredientId:'oil', name:'Cooking oil', qty:20, unit:'ml' }
  ] },
  { id: 'p8', name: 'Cold Coffee', category: 'Drinks', price: 120, image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80', popularity: 78, recipe: [
    { ingredientId:'coffee', name:'Coffee mix', qty:80, unit:'ml' },
    { ingredientId:'milk', name:'Milk', qty:100, unit:'ml' },
    { ingredientId:'ice', name:'Ice', qty:40, unit:'g' }
  ] },
  { id: 'p9', name: 'Coca-Cola', category: 'Drinks', price: 80, image: 'https://images.unsplash.com/photo-1622483767028-3f66f2b7420a?auto=format&fit=crop&w=900&q=80', popularity: 65, recipe: [
    { ingredientId:'coke', name:'Coca-Cola', qty:1, unit:'can' }
  ] },
  { id: 'p10', name: 'Chicken Combo', category: 'Combo Meals', price: 350, image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80', popularity: 91, recipe: [
    { ingredientId:'burger', name:'Chicken burger', qty:1, unit:'piece' },
    { ingredientId:'fries', name:'French Fries', qty:1, unit:'portion' },
    { ingredientId:'drink', name:'Soft drink', qty:1, unit:'can' }
  ] }
];

export const demoInventory: InventoryItem[] = [
  { id:'i1', name:'Burger bun', category:'Bakery', stock: 120, unit:'piece', reorderLevel: 30, cost: 18, supplier:'Baker Supply', expiry:'2026-12-10', },
  { id:'i2', name:'Chicken patty', category:'Meat', stock: 86, unit:'piece', reorderLevel: 25, cost: 42, supplier:'Prime Poultry', expiry:'2026-11-12' },
  { id:'i3', name:'Cheese', category:'Dairy', stock: 54, unit:'slice', reorderLevel: 20, cost: 12, supplier:'Fresh Dairy', expiry:'2026-11-15' },
  { id:'i4', name:'Lettuce', category:'Vegetable', stock: 18, unit:'g', reorderLevel: 35, cost: 4, supplier:'Green Valley', expiry:'2026-11-11' },
  { id:'i5', name:'Sauce', category:'Condiments', stock: 67, unit:'g', reorderLevel: 20, cost: 8, supplier:'Sauce Works', expiry:'2026-12-22' },
  { id:'i6', name:'Pizza dough', category:'Bakery', stock: 48, unit:'base', reorderLevel: 20, cost: 55, supplier:'Baker Supply', expiry:'2026-11-10' },
  { id:'i7', name:'Potato', category:'Vegetable', stock: 110, unit:'g', reorderLevel: 40, cost: 8, supplier:'Farm Market', expiry:'2026-11-13' },
  { id:'i8', name:'Cooking oil', category:'Oil', stock: 121, unit:'ml', reorderLevel: 30, cost: 14, supplier:'Apex Oils', expiry:'2026-12-25' },
  { id:'i9', name:'Milk', category:'Dairy', stock: 58, unit:'ml', reorderLevel: 30, cost: 16, supplier:'Fresh Dairy', expiry:'2026-11-09' },
  { id:'i10', name:'Coca-Cola', category:'Beverage', stock: 44, unit:'can', reorderLevel: 15, cost: 22, supplier:'Cold Drinks Ltd', expiry:'2026-12-29' }
];

export const demoCustomers: Customer[] = [
  { id:'c1', name:'Nadia Rahman', phone:'01711223344', address:'Gulshan, Dhaka', due: 0, loyaltyPoints: 420, favoriteItems:['Chicken Burger','Cold Coffee'] },
  { id:'c2', name:'Imran Ali', phone:'01833445566', address:'Dhanmondi, Dhaka', due: 250, loyaltyPoints: 180, favoriteItems:['Zinger Burger','French Fries'] },
  { id:'c3', name:'Farah Khan', phone:'01677889900', address:'Bashundhara, Dhaka', due: 0, loyaltyPoints: 560, favoriteItems:['Medium Pizza','Chicken Combo'] }
];

export const demoOrders: Order[] = [
  {
    id: 'o-1001',
    number: '1001',
    type: 'Dine-in',
    status: 'Preparing',
    createdAt: '2026-11-05T09:10:00',
    customerName: 'Nadia Rahman',
    items: [
      { id:'li1', productId:'p1', name:'Chicken Burger', qty:2, unitPrice:180 },
      { id:'li2', productId:'p6', name:'French Fries', qty:1, unitPrice:120 }
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
    createdAt: '2026-11-05T09:36:00',
    customerName: 'Imran Ali',
    items: [
      { id:'li3', productId:'p5', name:'Medium Pizza', qty:1, unitPrice:420 },
      { id:'li4', productId:'p8', name:'Cold Coffee', qty:2, unitPrice:120 }
    ],
    subtotal: 660,
    tax: 33,
    discount: 10,
    total: 683,
    paid: 400,
    due: 283,
    paymentMethod: 'Card',
    kitchenNote: 'Extra cheese' 
  },
  {
    id: 'o-1003',
    number: '1003',
    type: 'Pickup',
    status: 'Pending',
    createdAt: '2026-11-05T10:08:00',
    customerName: 'Walk-in Guest',
    items: [
      { id:'li5', productId:'p10', name:'Chicken Combo', qty:1, unitPrice:350 }
    ],
    subtotal: 350,
    tax: 17.5,
    discount: 0,
    total: 367.5,
    paid: 0,
    due: 367.5,
    paymentMethod: 'Digital',
    kitchenNote: 'Add spicy sauce' 
  }
];

export const demoEmployees: Employee[] = [
  { id:'e1', name:'Nusrat Jahan', role:'Supervisor', shift:'Morning', status:'Present', salary:42000, advance:3000 },
  { id:'e2', name:'Sabbir Ahmed', role:'Cashier', shift:'Morning', status:'Present', salary:26000, advance:2000 },
  { id:'e3', name:'Rafiq Islam', role:'Kitchen Staff', shift:'Day', status:'Present', salary:29000, advance:1500 },
  { id:'e4', name:'Mita Akter', role:'Inventory Manager', shift:'Evening', status:'On Leave', salary:32000, advance:0 }
];

export const demoSuppliers: Supplier[] = [
  { id:'s1', name:'Baker Supply', phone:'01710000001', category:'Bakery', due: 15000 },
  { id:'s2', name:'Prime Poultry', phone:'01810000002', category:'Meat', due: 9500 },
  { id:'s3', name:'Fresh Dairy', phone:'01910000003', category:'Dairy', due: 6200 }
];

export const demoAuditLogs = [
  { id:'l1', title:'Cash count verified', detail:'Morning shift cash closing matched safe count.', time:'08:15 AM' },
  { id:'l2', title:'Inventory stock review', detail:'Lettuce stock below threshold; restock triggered.', time:'09:45 AM' },
  { id:'l3', title:'Manager authorization', detail:'Negative stock override approved for burger bun batch.', time:'10:20 AM' }
];
