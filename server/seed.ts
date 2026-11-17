import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
if (process.env.NODE_ENV === 'production') {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const restaurantName = process.env.BOOTSTRAP_RESTAURANT_NAME?.trim() || 'Musafir Fast Food';
  const branchName = process.env.BOOTSTRAP_BRANCH_NAME?.trim() || 'Main Branch';
  const jwtSecret = process.env.JWT_SECRET;
  if (!email || !password) {
    console.log('Production bootstrap skipped: set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first owner account.');
    await pool.end();
    process.exit(0);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be valid and BOOTSTRAP_ADMIN_PASSWORD must contain 12–128 characters.');
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters before production owner bootstrap.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize first-run attempts across processes before checking or creating
    // the organization, branch, and initial owner.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['musafir-production-owner-bootstrap']);
    const slug = 'musafir-production';
    let org = await client.query<{id:string}>('SELECT id FROM organizations WHERE slug=$1 FOR UPDATE', [slug]);
    if (!org.rowCount) org = await client.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', [restaurantName,slug]);
    const organizationId = org.rows[0].id;
    let branch = await client.query<{id:string}>('SELECT id FROM branches WHERE organization_id=$1 ORDER BY created_at LIMIT 1 FOR UPDATE', [organizationId]);
    if (!branch.rowCount) branch = await client.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [organizationId,branchName,'KSA-01']);
    const branchId = branch.rows[0].id;
    const existing = await client.query<{id:string;role:string}>('SELECT id,role FROM users WHERE organization_id=$1 AND lower(email)=lower($2) FOR UPDATE', [organizationId,email]);
    if (existing.rowCount && existing.rows[0].role !== 'owner') {
      throw new Error('The bootstrap email is already assigned to a non-owner account; use a dedicated owner email.');
    }
    if (!existing.rowCount) {
      const hash = await bcrypt.hash(password, 12);
      await client.query("INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,'owner')", [organizationId,branchId,email,hash,'Restaurant Owner']);
      console.log('Production owner account created.');
    } else {
      console.log('Production owner account already exists; password was not changed.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) throw new Error('Set SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 12 characters in .env');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  let org = await client.query<{id:string}>('SELECT id FROM organizations WHERE slug=$1', ['musafir-demo']);
  if (!org.rowCount) org = await client.query<{id:string}>('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['Musafir Fast Food','musafir-demo']);
  const organizationId = org.rows[0].id;
  let branch = await client.query<{id:string}>('SELECT id FROM branches WHERE organization_id=$1 AND code=$2', [organizationId,'KSA-01']);
  if (!branch.rowCount) branch = await client.query<{id:string}>('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [organizationId,'Saudi Main','KSA-01']);
  const branchId = branch.rows[0].id;
  const hash = await bcrypt.hash(password, 12);
  await client.query(`INSERT INTO users(organization_id,email,password_hash,display_name,role,branch_id) VALUES($1,$2,$3,$4,'owner',$5) ON CONFLICT(organization_id,email) DO NOTHING`, [organizationId,email.toLowerCase(),hash,'Restaurant Owner',branchId]);
  const ingredientRows = [
    ['bun','Burger bun','Bakery','piece',120,30,18],['patty','Chicken patty','Meat','piece',86,25,42],['cheese','Cheese','Dairy','g',1200,300,1],['lettuce','Lettuce','Vegetable','g',1800,500,0.2],['sauce','Sauce','Condiments','g',2000,400,0.1],['dough','Pizza dough','Bakery','base',48,20,55],['potato','Potato','Vegetable','g',12000,4000,0.08],['oil','Cooking oil','Oil','ml',12000,3000,0.08],['nugget','Chicken nugget','Meat','piece',300,60,15],['coffee','Coffee mix','Beverage','ml',4000,1000,0.3],['milk','Milk','Dairy','ml',5000,1000,0.12],['ice','Ice','Other','g',5000,1000,0.01],['coke','Coca-Cola','Beverage','can',44,15,22],['beef','Beef patty','Meat','piece',30,8,55],['zinger','Zinger fillet','Meat','piece',35,10,60],['tomato','Tomato','Vegetable','g',3000,500,0.1],['salt','Salt','Condiments','g',3000,500,0.02]
  ] as const;
  for (const [sku,name,category,unit,stock,reorder,cost] of ingredientRows) await client.query('INSERT INTO ingredients(organization_id,branch_id,sku,name,category,unit,stock,reorder_level,unit_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(branch_id,sku) DO NOTHING',[organizationId,branchId,sku,name,category,unit,stock,reorder,cost]);
  const cats = ['Burgers','Pizza','Sandwiches','Fried Chicken','French Fries','Chicken Nuggets','Pasta','Snacks','Drinks','Desserts','Combo Meals'];
  for (const name of cats) await client.query('INSERT INTO categories(organization_id,name) VALUES($1,$2) ON CONFLICT(organization_id,name) DO NOTHING',[organizationId,name]);
  const menu = [
    ['p1','Chicken Burger','Burgers',18,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',[['bun',1],['patty',1],['cheese',20],['lettuce',20],['sauce',15]]],
    ['p2','Beef Burger','Burgers',22,'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80',[['bun',1],['beef',1],['cheese',20],['lettuce',20]]],
    ['p3','Zinger Burger','Burgers',24,'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=900&q=80',[['bun',1],['zinger',1],['cheese',20],['lettuce',20]]],
    ['p4','Regular Pizza','Pizza',32,'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',[['dough',1],['sauce',40],['cheese',80],['tomato',30]]],
    ['p5','Medium Pizza','Pizza',42,'https://images.unsplash.com/photo-1548365328-9f547fb9587c?auto=format&fit=crop&w=900&q=80',[['dough',1],['sauce',50],['cheese',100],['tomato',40]]],
    ['p6','French Fries','French Fries',12,'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=900&q=80',[['potato',250],['oil',20],['salt',5]]],
    ['p7','Chicken Nuggets','Chicken Nuggets',16,'https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80',[['nugget',6],['oil',20]]],
    ['p8','Cold Coffee','Drinks',12,'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80',[['coffee',80],['milk',100],['ice',40]]],
    ['p9','Coca-Cola','Drinks',8,'https://images.unsplash.com/photo-1622483767028-3f66f2b7420a?auto=format&fit=crop&w=900&q=80',[['coke',1]]],
    ['p10','Chicken Combo','Combo Meals',35,'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80',[['bun',1],['patty',1],['potato',250],['oil',20],['coke',1]]]
  ] as const;
  for (const [sku,name,category,price,image,recipe] of menu) {
    const product = await client.query<{id:string}>('INSERT INTO products(organization_id,category_id,sku,name,price,image_url) SELECT $1,id,$2,$3,$4,$5 FROM categories WHERE organization_id=$1 AND name=$6 ON CONFLICT(organization_id,sku) DO UPDATE SET name=EXCLUDED.name RETURNING id',[organizationId,sku,name,price,image,category]);
    for (const [ingredientSku,quantity] of recipe) await client.query('INSERT INTO recipes(product_id,ingredient_id,quantity) SELECT $1,id,$3 FROM ingredients WHERE branch_id=$2 AND sku=$4 ON CONFLICT(product_id,ingredient_id) DO UPDATE SET quantity=EXCLUDED.quantity',[product.rows[0].id,branchId,quantity,ingredientSku]);
  }
  for (const [name,phone,address] of [['Sara Ahmed','+966500000001','Riyadh, Saudi Arabia'],['Omar Hassan','+966500000002','Jeddah, Saudi Arabia'],['Lina Ali','+966500000003','Dammam, Saudi Arabia']]) await client.query('INSERT INTO customers(organization_id,name,phone,address) SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM customers WHERE organization_id=$1 AND name=$2 AND phone=$3) ON CONFLICT DO NOTHING',[organizationId,name,phone,address]);
  for (const [name,phone,category] of [['Saudi Bakery Supply','+966500000101','Bakery'],['Prime Poultry KSA','+966500000102','Meat'],['Fresh Dairy KSA','+966500000103','Dairy']]) await client.query('INSERT INTO suppliers(organization_id,name,phone,category) SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE organization_id=$1 AND name=$2 AND phone=$3) ON CONFLICT DO NOTHING',[organizationId,name,phone,category]);
  await client.query('COMMIT');
  console.log(`Seed complete. Admin: ${email}. Change the seed password after first sign-in.`);
} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
