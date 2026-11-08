import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { z } from 'zod';
import { pool, inTransaction } from './db.js';
import { registerHrRoutes } from './hr.js';
import { registerReportRoutes } from './reports.js';

type Role = 'owner'|'manager'|'cashier'|'kitchen'|'inventory'|'accountant'|'delivery';
type AuthUser = { id:string; organizationId:string; branchId:string; email:string; displayName:string; role:Role };
type AuthedRequest = Request & { user?:AuthUser };
const app=express();
app.set('trust proxy',1);
app.use(helmet()); app.use(cors({origin:(process.env.CORS_ORIGIN||'http://localhost:5173').split(',').map(s=>s.trim()),credentials:true})); app.use(express.json({limit:'1mb'}));
const authLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false});
// The customer QR menu is public: it is rate limited per IP so a single client
// cannot hammer the branch menu, and it never exposes anything beyond the menu.
const publicMenuLimiter=rateLimit({windowMs:60*1000,limit:120,standardHeaders:true,legacyHeaders:false});
const secret=process.env.JWT_SECRET; if(!secret||secret.length<32) throw new Error('JWT_SECRET must be set to at least 32 characters');
const schema={login:z.object({email:z.string().email().max(254),password:z.string().min(1).max(128)}),category:z.object({name:z.string().trim().min(1).max(80)}),product:z.object({sku:z.string().trim().min(1).max(40),name:z.string().trim().min(1).max(120),description:z.string().trim().max(1000).default(''),categoryId:z.string().uuid().nullable().optional(),price:z.number().min(0).max(1000000),imageUrl:z.string().trim().max(2000).default(''),active:z.boolean().optional()}),customer:z.object({name:z.string().trim().min(1).max(120),phone:z.string().trim().max(40).default(''),address:z.string().trim().max(300).default('')}),supplier:z.object({name:z.string().trim().min(1).max(120),phone:z.string().trim().max(40).default(''),category:z.string().trim().max(80).default('')}),inventory:z.object({name:z.string().trim().min(1).max(120),sku:z.string().trim().min(1).max(40),category:z.string().max(80),unit:z.string().min(1).max(24),stock:z.number().min(0).default(0),trackStock:z.boolean().optional(),reorderLevel:z.number().min(0).default(0),unitCost:z.number().min(0).default(0),supplierId:z.string().uuid().optional().nullable(),expiresOn:z.string().optional().nullable()}),purchase:z.object({supplierId:z.string().uuid(),invoiceNumber:z.string().trim().min(1).max(80),paid:z.number().min(0),paymentMethod:z.enum(['Cash','Mada']).default('Cash'),items:z.array(z.object({ingredientId:z.string().uuid(),quantity:z.number().positive(),unitCost:z.number().min(0)})).min(1)}),payment:z.object({amount:z.number().positive(),method:z.enum(['Cash','Mada']),note:z.string().max(500).optional()}),expense:z.object({category:z.string().trim().min(1).max(80),description:z.string().trim().min(1).max(300),amount:z.number().positive().max(10000000),paymentMethod:z.enum(['Cash','Mada']),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}),reservation:z.object({guestName:z.string().trim().min(1).max(120),phone:z.string().trim().max(40).default(''),partySize:z.number().int().min(1).max(30),reservedFor:z.string().datetime(),notes:z.string().trim().max(500).default('')}),table:z.object({tableNumber:z.string().trim().min(1).max(24),seats:z.number().int().min(1).max(30).default(2),notes:z.string().trim().max(300).default('')}),delivery:z.object({driverId:z.string().uuid(),address:z.string().trim().max(500).default(''),note:z.string().trim().max(500).default('')}),order:z.object({orderType:z.enum(['Dine-in','Takeaway','Pickup','Home Delivery']),tableId:z.string().uuid().optional().nullable(),customerId:z.string().uuid().optional().nullable(),paymentMethod:z.enum(['Cash','Mada']).default('Cash'),discount:z.number().min(0).default(0),taxRate:z.number().min(0).max(1).default(.15),notes:z.string().max(1000).optional(),couponCode:z.string().trim().max(40).optional(),items:z.array(z.object({productId:z.string().uuid(),quantity:z.number().int().positive().max(99)})).min(1),payments:z.array(z.object({method:z.enum(['Cash','Mada']),amount:z.number().positive().max(10000000)})).min(1).max(2).optional()})};
const allow=(...roles:Role[])=> (req:AuthedRequest,res:Response,next:NextFunction)=>{if(!req.user)return res.status(401).json({error:'Authentication required'}); if(!roles.includes(req.user.role))return res.status(403).json({error:'Insufficient permission'}); next();};
const authenticate=async(req:AuthedRequest,res:Response,next:NextFunction)=>{try{const token=req.headers.authorization?.replace(/^Bearer\s+/i,''); if(!token)return res.status(401).json({error:'Authentication required'}); const claims=jwt.verify(token,secret!) as jwt.JwtPayload; const result=await pool.query('SELECT id,organization_id,branch_id,email,display_name,role FROM users WHERE id=$1 AND active=true',[claims.sub]); if(!result.rowCount)return res.status(401).json({error:'Session is no longer valid'}); const row=result.rows[0]; req.user={id:row.id,organizationId:row.organization_id,branchId:row.branch_id,email:row.email,displayName:row.display_name,role:row.role}; next();}catch{return res.status(401).json({error:'Invalid or expired session'});}};
const asyncRoute=(fn:(req:AuthedRequest,res:Response)=>Promise<unknown>)=>(req:AuthedRequest,res:Response,next:NextFunction)=>{void fn(req,res).catch(next);};
const audit=async(client:import('pg').PoolClient,user:AuthUser,action:string,entity:string,id:string|null,details:unknown={})=>client.query('INSERT INTO audit_logs(organization_id,branch_id,user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6,$7)',[user.organizationId,user.branchId,user.id,action,entity,id,JSON.stringify(details)]);
app.get('/api/tables',authenticate,allow('owner','manager','cashier','kitchen','delivery'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const rows=await pool.query(`SELECT id,table_number,seats,status,notes,created_at,updated_at FROM restaurant_tables WHERE organization_id=$1 AND branch_id=$2 ORDER BY table_number`,[req.user!.organizationId,req.user!.branchId]);
  res.json({tables:rows.rows});
}));
app.post('/api/tables',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const parsed=schema.table.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid table details',details:parsed.error.flatten()});
  const d=parsed.data;
  const table=await inTransaction(async client=>{
    const inserted=await client.query(`INSERT INTO restaurant_tables(organization_id,branch_id,table_number,seats,notes,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(branch_id,table_number) DO NOTHING RETURNING id,table_number,seats,status,notes,created_at,updated_at`,[req.user!.organizationId,req.user!.branchId,d.tableNumber,d.seats,d.notes,req.user!.id]);
    if(!inserted.rowCount)throw Object.assign(new Error('A table with this number already exists in this branch'),{status:409});
    await audit(client,req.user!,'table.created','restaurant_table',inserted.rows[0].id,d);return inserted.rows[0];
  });
  res.status(201).json({table});
}));
app.patch('/api/tables/:id',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const parsed=z.object({status:z.enum(['Available','Occupied','Reserved','Cleaning','Out of Service']),notes:z.string().trim().max(300).optional()}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid table update',details:parsed.error.flatten()});
  const table=await inTransaction(async client=>{
    const updated=await client.query(`UPDATE restaurant_tables SET status=$1,notes=COALESCE($2,notes),updated_at=now() WHERE id=$3 AND organization_id=$4 AND branch_id=$5 RETURNING id,table_number,seats,status,notes,created_at,updated_at`,[parsed.data.status,parsed.data.notes??null,String(req.params.id),req.user!.organizationId,req.user!.branchId]);
    if(!updated.rowCount)throw Object.assign(new Error('Table not found'),{status:404});
    await audit(client,req.user!,'table.status_updated','restaurant_table',updated.rows[0].id,parsed.data);return updated.rows[0];
  });
  res.json({table});
}));
app.get('/api/reservations',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const rows=await pool.query(`SELECT id,guest_name,phone,party_size,reserved_for,status,notes,created_at FROM reservations WHERE organization_id=$1 AND branch_id=$2 ORDER BY reserved_for DESC LIMIT 500`,[req.user!.organizationId,req.user!.branchId]);
  res.json({reservations:rows.rows});
}));
app.post('/api/reservations',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const parsed=schema.reservation.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid reservation details',details:parsed.error.flatten()});
  const d=parsed.data;if(new Date(d.reservedFor).getTime()<Date.now()-60000)return res.status(400).json({error:'Reservation time must be in the future'});
  const reservation=await inTransaction(async client=>{
    const inserted=await client.query(`INSERT INTO reservations(organization_id,branch_id,guest_name,phone,party_size,reserved_for,notes,created_by) VALUES($1,$2,$3,$4,$5,$6::timestamptz,$7,$8) RETURNING id,guest_name,phone,party_size,reserved_for,status,notes,created_at`,[req.user!.organizationId,req.user!.branchId,d.guestName,d.phone,d.partySize,d.reservedFor,d.notes,req.user!.id]);
    await audit(client,req.user!,'reservation.created','reservation',inserted.rows[0].id,d);return inserted.rows[0];
  });res.status(201).json({reservation});
}));
app.patch('/api/reservations/:id',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const parsed=z.object({status:z.enum(['Booked','Seated','Completed','Cancelled','No-show'])}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid reservation status'});
  const reservation=await inTransaction(async client=>{
    const updated=await client.query(`UPDATE reservations SET status=$1,updated_at=now() WHERE id=$2 AND organization_id=$3 AND branch_id=$4 RETURNING id,status`,[parsed.data.status,String(req.params.id),req.user!.organizationId,req.user!.branchId]);
    if(!updated.rowCount)throw Object.assign(new Error('Reservation not found'),{status:404});
    await audit(client,req.user!,'reservation.status_updated','reservation',updated.rows[0].id,parsed.data);return updated.rows[0];
  });res.json({reservation});
}));
app.get('/api/health',asyncRoute(async(_req,res)=>{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'});}));
app.post('/api/auth/login',authLimiter,asyncRoute(async(req,res)=>{const parsed=schema.login.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a valid email and password'});const result=await pool.query('SELECT id,organization_id,branch_id,email,display_name,role,password_hash FROM users WHERE email=$1 AND active=true',[parsed.data.email.toLowerCase()]);const user=result.rows[0];if(!user||!await bcrypt.compare(parsed.data.password,user.password_hash))return res.status(401).json({error:'Email or password is incorrect'});const token=jwt.sign({sub:user.id},secret!,{expiresIn:'8h',issuer:'musafir-pos'});res.json({token,user:{id:user.id,email:user.email,displayName:user.display_name,role:user.role,organizationId:user.organization_id,branchId:user.branch_id}});}));
app.get('/api/auth/me',authenticate,asyncRoute(async(req:AuthedRequest,res)=>res.json({user:req.user})));

const staffRoleSchema=z.enum(['owner','manager','cashier','kitchen','inventory','accountant','delivery']);
app.get('/api/users',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{
  const rows=await pool.query(`SELECT id,email,display_name AS "displayName",role,active,created_at AS "createdAt"
    FROM users WHERE organization_id=$1 AND branch_id=$2 ORDER BY created_at,email`,
    [req.user!.organizationId,req.user!.branchId]);
  res.json({users:rows.rows});
}));
app.post('/api/users',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({email:z.string().email().max(254),displayName:z.string().trim().min(2).max(100),password:z.string().min(12).max(128),role:staffRoleSchema}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter a valid email, name, password (at least 12 characters), and role'});
  const d=parsed.data;
  if(d.role==='owner'&&req.user!.role!=='owner')return res.status(403).json({error:'Only an owner can assign the owner role'});
  const passwordHash=await bcrypt.hash(d.password,12);
  const user=await inTransaction(async client=>{
    const inserted=await client.query(`INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(organization_id,email) DO NOTHING
      RETURNING id,email,display_name AS "displayName",role,active,created_at AS "createdAt"`,
      [req.user!.organizationId,req.user!.branchId,d.email.toLowerCase(),passwordHash,d.displayName,d.role]);
    if(!inserted.rowCount)throw Object.assign(new Error('An account with this email already exists'),{status:409});
    await audit(client,req.user!,'user.created','user',inserted.rows[0].id,{email:inserted.rows[0].email,role:d.role});
    return inserted.rows[0];
  });
  res.status(201).json({user});
}));
app.patch('/api/users/:id',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({role:staffRoleSchema.optional(),active:z.boolean().optional(),displayName:z.string().trim().min(2).max(100).optional(),password:z.string().min(12).max(128).optional()}).strict().refine(value=>Object.keys(value).length>0).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Provide a valid role, active status, display name or new password'});
  const d=parsed.data,userId=String(req.params.id);
  if(userId===req.user!.id&&d.active===false)return res.status(400).json({error:'You cannot deactivate your own account'});
  if(d.role==='owner'&&req.user!.role!=='owner')return res.status(403).json({error:'Only an owner can assign the owner role'});
  const passwordHash=d.password?await bcrypt.hash(d.password,12):null;
  const user=await inTransaction(async client=>{
    const owners=await client.query("SELECT id FROM users WHERE organization_id=$1 AND branch_id=$2 AND role='owner' AND active=true ORDER BY id FOR UPDATE",[req.user!.organizationId,req.user!.branchId]);
    const locked=await client.query('SELECT id,role,active FROM users WHERE id=$1 AND organization_id=$2 AND branch_id=$3 FOR UPDATE',[userId,req.user!.organizationId,req.user!.branchId]);
    if(!locked.rowCount)throw Object.assign(new Error('User not found'),{status:404});
    if(locked.rows[0].role==='owner'&&req.user!.role!=='owner')throw Object.assign(new Error('Only an owner can modify another owner'),{status:403});
    if(locked.rows[0].role==='owner'&&(d.role&&d.role!=='owner'||d.active===false)){
      if(owners.rowCount<=1)throw Object.assign(new Error('The last active owner cannot be demoted or deactivated'),{status:409});
    }
    const updated=await client.query(`UPDATE users SET
      role=COALESCE($1,role),active=COALESCE($2,active),display_name=COALESCE($3,display_name),
      password_hash=COALESCE($4,password_hash)
      WHERE id=$5 AND organization_id=$6 AND branch_id=$7
      RETURNING id,email,display_name AS "displayName",role,active,created_at AS "createdAt"`,
      [d.role??null,d.active??null,d.displayName??null,passwordHash,userId,req.user!.organizationId,req.user!.branchId]);
    await audit(client,req.user!,'user.updated','user',userId,{role:d.role,active:d.active,displayName:d.displayName,passwordChanged:Boolean(passwordHash)});
    return updated.rows[0];
  });
  res.json({user});
}));

const menuQuery=z.object({branchId:z.string().uuid()});
// Public customer menu (no authentication). Only active products of the branch's
// own organization are exposed; the payload is identical for the POS login
// bootstrap and the customer QR page.
app.get('/api/menu',publicMenuLimiter,asyncRoute(async(req,res)=>{
  const parsed=menuQuery.safeParse({branchId:String(req.query.branchId||'')});
  if(!parsed.success)return res.status(400).json({error:'A valid branchId is required'});
  const branch=await pool.query('SELECT b.id,b.name,b.code,b.organization_id,o.name AS organization_name FROM branches b JOIN organizations o ON o.id=b.organization_id WHERE b.id=$1',[parsed.data.branchId]);
  if(!branch.rowCount)return res.status(404).json({error:'Branch not found'});
  const result=await pool.query(`SELECT p.id,p.name,p.sku,p.price,p.image_url,p.description,c.name AS category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.organization_id=$1 AND p.active=true ORDER BY c.name,p.name`,[branch.rows[0].organization_id]);
  const categories=Array.from(new Set(result.rows.map(row=>row.category).filter((value):value is string=>Boolean(value)))).sort((left,right)=>left.localeCompare(right));
  res.set('Cache-Control','public, max-age=60');
  res.json({branch:{id:branch.rows[0].id,name:branch.rows[0].name,code:branch.rows[0].code,organizationName:branch.rows[0].organization_name},products:result.rows,categories,productCount:result.rows.length,generatedAt:new Date().toISOString()});
}));
app.get('/api/customers',authenticate,allow('owner','manager','cashier','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{
  const rows=await pool.query(`SELECT c.id,c.name,c.phone,c.address,c.loyalty_points AS "loyaltyPoints",
    COUNT(o.id) FILTER (WHERE o.status<>'Cancelled')::int AS "orderCount",
    COALESCE(SUM(o.total) FILTER (WHERE o.status<>'Cancelled'),0)::numeric(12,2) AS "lifetimeSpend",
    MAX(o.created_at) FILTER (WHERE o.status<>'Cancelled') AS "lastOrderAt"
    FROM customers c LEFT JOIN orders o ON o.customer_id=c.id AND o.organization_id=c.organization_id
    WHERE c.organization_id=$1 GROUP BY c.id ORDER BY c.name`,[req.user!.organizationId]);
  res.json({customers:rows.rows});
}));
app.post('/api/customers',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=schema.customer.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid customer data',details:parsed.error.flatten()});
  const d=parsed.data;
  const customer=await inTransaction(async client=>{
    const row=await client.query('INSERT INTO customers(organization_id,name,phone,address) VALUES($1,$2,$3,$4) RETURNING id,name,phone,address,loyalty_points AS "loyaltyPoints"',[req.user!.organizationId,d.name,d.phone,d.address]);
    await audit(client,req.user!,'customer.created','customer',row.rows[0].id,d);
    return row.rows[0];
  });
  res.status(201).json({customer});
}));
app.patch('/api/customers/:id',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=schema.customer.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid customer data',details:parsed.error.flatten()});
  const d=parsed.data;
  const customer=await inTransaction(async client=>{
    const updated=await client.query('UPDATE customers SET name=$1,phone=$2,address=$3 WHERE id=$4 AND organization_id=$5 RETURNING id,name,phone,address,loyalty_points AS "loyaltyPoints"',[d.name,d.phone,d.address,String(req.params.id),req.user!.organizationId]);
    if(!updated.rowCount)throw Object.assign(new Error('Customer not found'),{status:404});
    await audit(client,req.user!,'customer.updated','customer',updated.rows[0].id,d);
    return updated.rows[0];
  });
  res.json({customer});
}));
app.get('/api/categories',authenticate,asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query('SELECT c.id,c.name,COUNT(p.id)::int AS product_count FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.active=true WHERE c.organization_id=$1 GROUP BY c.id ORDER BY c.name',[req.user!.organizationId]);res.json({categories:rows.rows});}));
app.post('/api/categories',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.category.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a category name'});const result=await inTransaction(async client=>{const exists=await client.query('SELECT id FROM categories WHERE organization_id=$1 AND lower(name)=lower($2)',[req.user!.organizationId,parsed.data.name]);if(exists.rowCount)throw Object.assign(new Error('Category already exists'),{status:409});const inserted=await client.query('INSERT INTO categories(organization_id,name) VALUES($1,$2) RETURNING id,name',[req.user!.organizationId,parsed.data.name]);await audit(client,req.user!,'category.created','category',inserted.rows[0].id,parsed.data);return inserted.rows[0];});res.status(201).json({category:result});}));
app.patch('/api/categories/:id',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.category.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a category name'});const result=await inTransaction(async client=>{const duplicate=await client.query('SELECT id FROM categories WHERE organization_id=$1 AND lower(name)=lower($2) AND id<>$3',[req.user!.organizationId,parsed.data.name,String(req.params.id)]);if(duplicate.rowCount)throw Object.assign(new Error('Category already exists'),{status:409});const updated=await client.query('UPDATE categories SET name=$1 WHERE id=$2 AND organization_id=$3 RETURNING id,name',[parsed.data.name,String(req.params.id),req.user!.organizationId]);if(!updated.rowCount)throw Object.assign(new Error('Category not found'),{status:404});await audit(client,req.user!,'category.updated','category',updated.rows[0].id,parsed.data);return updated.rows[0];});res.json({category:result});}));
app.delete('/api/categories/:id',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{const result=await inTransaction(async client=>{const category=await client.query('SELECT id,name FROM categories WHERE id=$1 AND organization_id=$2 FOR UPDATE',[String(req.params.id),req.user!.organizationId]);if(!category.rowCount)throw Object.assign(new Error('Category not found'),{status:404});const used=await client.query('SELECT COUNT(*)::int AS count FROM products WHERE category_id=$1 AND active=true',[String(req.params.id)]);if(Number(used.rows[0].count)>0)throw Object.assign(new Error('Move or deactivate products in this category before deleting it.'),{status:409});await client.query('DELETE FROM categories WHERE id=$1 AND organization_id=$2',[String(req.params.id),req.user!.organizationId]);await audit(client,req.user!,'category.deleted','category',String(req.params.id),category.rows[0]);return category.rows[0];});res.json({success:true,category:result});}));
app.get('/api/products',authenticate,asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query(`SELECT p.id,p.sku,p.name,p.description,p.price,p.image_url AS "imageUrl",p.active,p.category_id AS "categoryId",c.name AS category,
  COALESCE((SELECT json_agg(json_build_object('ingredientId',r.ingredient_id,'name',i.name,'qty',r.quantity,'unit',i.unit) ORDER BY i.name) FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id WHERE r.product_id=p.id AND i.branch_id=$2),'[]'::json) AS recipe
  FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.organization_id=$1 ORDER BY p.active DESC,c.name,p.name`,[req.user!.organizationId,req.user!.branchId]);res.json({products:rows.rows});}));
const recipeInput=z.object({items:z.array(z.object({ingredientId:z.string().uuid(),quantity:z.number().positive().max(100000)})).max(200).superRefine((items,ctx)=>{const ids=items.map(item=>item.ingredientId);if(new Set(ids).size!==ids.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'An ingredient can appear only once in a recipe'});})});
app.put('/api/products/:id/recipe',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=recipeInput.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid recipe',details:parsed.error.flatten()});
  const saved=await inTransaction(async client=>{
    const product=await client.query('SELECT id,name FROM products WHERE id=$1 AND organization_id=$2 FOR UPDATE',[String(req.params.id),req.user!.organizationId]);
    if(!product.rowCount)throw Object.assign(new Error('Product not found'),{status:404});
    const ids=parsed.data.items.map(item=>item.ingredientId);
    if(ids.length){const ingredients=await client.query('SELECT id FROM ingredients WHERE id=ANY($1::uuid[]) AND organization_id=$2 AND branch_id=$3',[ids,req.user!.organizationId,req.user!.branchId]);if(ingredients.rowCount!==ids.length)throw Object.assign(new Error('One or more ingredients do not belong to this branch'),{status:400});}
    await client.query('DELETE FROM recipes r USING ingredients i WHERE r.ingredient_id=i.id AND r.product_id=$1 AND i.branch_id=$2',[String(req.params.id),req.user!.branchId]);
    for(const item of parsed.data.items)await client.query('INSERT INTO recipes(product_id,ingredient_id,quantity) VALUES($1,$2,$3)',[String(req.params.id),item.ingredientId,item.quantity]);
    await audit(client,req.user!,'product.recipe_updated','product',String(req.params.id),{productName:product.rows[0].name,ingredientCount:ids.length});
    const result=await client.query(`SELECT r.ingredient_id AS "ingredientId",i.name,r.quantity AS qty,i.unit FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id WHERE r.product_id=$1 AND i.branch_id=$2 ORDER BY i.name`,[String(req.params.id),req.user!.branchId]);
    return result.rows;
  });
  res.json({recipe:saved});
}));
app.post('/api/products',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.product.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid product details',details:parsed.error.flatten()});const d=parsed.data;const result=await inTransaction(async client=>{if(d.categoryId){const category=await client.query('SELECT id FROM categories WHERE id=$1 AND organization_id=$2',[d.categoryId,req.user!.organizationId]);if(!category.rowCount)throw Object.assign(new Error('Category not found'),{status:404});}const inserted=await client.query('INSERT INTO products(organization_id,category_id,sku,name,description,price,image_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,sku,name,description,price,image_url AS "imageUrl",active,category_id AS "categoryId"',[req.user!.organizationId,d.categoryId||null,d.sku,d.name,d.description,d.price,d.imageUrl]);await audit(client,req.user!,'product.created','product',inserted.rows[0].id,d);return inserted.rows[0];});res.status(201).json({product:result});}));
app.patch('/api/products/:id',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.product.partial().safeParse(req.body);if(!parsed.success||!Object.keys(parsed.data||{}).length)return res.status(400).json({error:'Invalid product details'});const d=parsed.data;const result=await inTransaction(async client=>{const current=await client.query('SELECT id FROM products WHERE id=$1 AND organization_id=$2 FOR UPDATE',[String(req.params.id),req.user!.organizationId]);if(!current.rowCount)throw Object.assign(new Error('Product not found'),{status:404});if(d.categoryId){const category=await client.query('SELECT id FROM categories WHERE id=$1 AND organization_id=$2',[d.categoryId,req.user!.organizationId]);if(!category.rowCount)throw Object.assign(new Error('Category not found'),{status:404});}const updated=await client.query('UPDATE products SET sku=COALESCE($3,sku),name=COALESCE($4,name),description=COALESCE($5,description),price=COALESCE($6,price),image_url=COALESCE($7,image_url),category_id=CASE WHEN $8 THEN $9::uuid ELSE category_id END,active=COALESCE($10,active) WHERE id=$1 AND organization_id=$2 RETURNING id,sku,name,description,price,image_url AS "imageUrl",active,category_id AS "categoryId"',[String(req.params.id),req.user!.organizationId,d.sku,d.name,d.description,d.price,d.imageUrl,d.categoryId!==undefined,d.categoryId??null,(req.body as {active?:boolean}).active]);await audit(client,req.user!,'product.updated','product',updated.rows[0].id,d);return updated.rows[0];});res.json({product:result});}));
app.delete('/api/products/:id',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{const result=await inTransaction(async client=>{const updated=await client.query('UPDATE products SET active=false WHERE id=$1 AND organization_id=$2 AND active=true RETURNING id,name',[String(req.params.id),req.user!.organizationId]);if(!updated.rowCount)throw Object.assign(new Error('Active product not found'),{status:404});await audit(client,req.user!,'product.deactivated','product',updated.rows[0].id,updated.rows[0]);return updated.rows[0];});res.json({success:true,product:result});}));
app.get('/api/menu/qr',publicMenuLimiter,asyncRoute(async(req,res)=>{
  const parsed=menuQuery.safeParse({branchId:String(req.query.branchId||'')});
  if(!parsed.success)return res.status(400).json({error:'A valid branchId is required'});
  const branch=await pool.query('SELECT id,code FROM branches WHERE id=$1',[parsed.data.branchId]);
  if(!branch.rowCount)return res.status(404).json({error:'Branch not found'});
  const base=(process.env.PUBLIC_MENU_BASE_URL||`${req.protocol}://${req.get('host')}/menu`).replace(/\/$/,'');
  const params=new URLSearchParams({branch:branch.rows[0].id});
  const table=String(req.query.table||'').trim().slice(0,24);
  if(table)params.set('table',table);
  const png=await QRCode.toBuffer(`${base}?${params.toString()}`,{type:'png',width:512,margin:2,errorCorrectionLevel:'M',color:{dark:'#161616',light:'#ffffff'}});
  res.type('png').set('Cache-Control','no-store').send(png);
}));
app.get('/api/inventory',authenticate,asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query('SELECT i.id,i.sku,i.name,i.category,i.unit,i.stock,i.track_stock AS "trackStock",i.reorder_level AS "reorderLevel",i.unit_cost AS "unitCost",i.expires_on AS "expiresOn",s.name AS supplier FROM ingredients i LEFT JOIN suppliers s ON s.id=i.supplier_id WHERE i.branch_id=$1 ORDER BY i.name',[req.user!.branchId]);res.json({items:rows.rows});}));
app.get('/api/inventory/:id/movements',authenticate,allow('owner','manager','inventory','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query(`SELECT sm.id,sm.movement_type AS type,sm.quantity_delta AS quantity,sm.note,sm.created_at AS "createdAt",u.display_name AS "createdBy" FROM stock_movements sm LEFT JOIN users u ON u.id=sm.created_by JOIN ingredients i ON i.id=sm.ingredient_id WHERE sm.ingredient_id=$1 AND sm.branch_id=$2 ORDER BY sm.created_at DESC LIMIT 100`,[String(req.params.id),req.user!.branchId]);res.json({movements:rows.rows});}));
app.post('/api/inventory/:id/adjust',authenticate,allow('owner','manager','inventory'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=z.object({quantity:z.number().positive().max(100000),note:z.string().trim().max(300).optional()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a valid positive stock quantity'});const item=await inTransaction(async client=>{const updated=await client.query('UPDATE ingredients SET stock=stock+$1,track_stock=true,updated_at=now() WHERE id=$2 AND branch_id=$3 RETURNING id,sku,name,category,unit,stock,track_stock AS "trackStock",reorder_level AS "reorderLevel",unit_cost AS "unitCost",expires_on AS "expiresOn"',[parsed.data.quantity,String(req.params.id),req.user!.branchId]);if(!updated.rowCount)throw Object.assign(new Error('Ingredient not found in this branch'),{status:404});await client.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,note,created_by) VALUES($1,$2,'adjustment',$3,$4,$5)",[req.user!.branchId,String(req.params.id),parsed.data.quantity,parsed.data.note||'Stock received',req.user!.id]);await audit(client,req.user!,'ingredient.stock_received','ingredient',String(req.params.id),{quantity:parsed.data.quantity,note:parsed.data.note||''});return updated.rows[0];});res.json({item});}));
app.post('/api/inventory',authenticate,allow('owner','manager','inventory'),asyncRoute(async(req:AuthedRequest,res)=>{const input=schema.inventory.safeParse(req.body);if(!input.success)return res.status(400).json({error:'Invalid ingredient data',details:input.error.flatten()});const d=input.data;const inserted=await inTransaction(async client=>{const r=await client.query('INSERT INTO ingredients(organization_id,branch_id,sku,name,category,unit,stock,track_stock,reorder_level,unit_cost,supplier_id,expires_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[req.user!.organizationId,req.user!.branchId,d.sku,d.name,d.category,d.unit,d.stock,d.trackStock??(d.stock>0),d.reorderLevel,d.unitCost,d.supplierId||null,d.expiresOn||null]);if(d.stock>0)await client.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,note,created_by) VALUES($1,$2,'adjustment',$3,$4,$5)",[req.user!.branchId,r.rows[0].id,d.stock,'Opening stock',req.user!.id]);await audit(client,req.user!,'ingredient.created','ingredient',r.rows[0].id,d);return r.rows[0];});res.status(201).json({item:inserted});}));
app.patch('/api/inventory/:id',authenticate,allow('owner','manager','inventory'),asyncRoute(async(req:AuthedRequest,res)=>{const input=schema.inventory.partial().safeParse(req.body);if(!input.success)return res.status(400).json({error:'Invalid ingredient data'});const d=input.data;const result=await inTransaction(async client=>{const current=await client.query('SELECT stock FROM ingredients WHERE id=$1 AND branch_id=$2 FOR UPDATE',[String(req.params.id),req.user!.branchId]);if(!current.rowCount)throw Object.assign(new Error('Ingredient not found'),{status:404});const updated=await client.query(`UPDATE ingredients SET name=COALESCE($3,name),sku=COALESCE($4,sku),category=COALESCE($5,category),unit=COALESCE($6,unit),stock=COALESCE($7,stock),track_stock=CASE WHEN $7::numeric IS NOT NULL THEN true ELSE track_stock END,reorder_level=COALESCE($8,reorder_level),unit_cost=COALESCE($9,unit_cost),supplier_id=COALESCE($10,supplier_id),expires_on=COALESCE($11,expires_on),updated_at=now() WHERE id=$1 AND branch_id=$2 RETURNING *`,[String(req.params.id),req.user!.branchId,d.name,d.sku,d.category,d.unit,d.stock,d.reorderLevel,d.unitCost,d.supplierId,d.expiresOn]);if(d.stock!==undefined){const delta=d.stock-Number(current.rows[0].stock);if(delta!==0)await client.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,note,created_by) VALUES($1,$2,'adjustment',$3,$4,$5)",[req.user!.branchId,String(req.params.id),delta,'Manual inventory correction',req.user!.id]);}await audit(client,req.user!,'ingredient.updated','ingredient',String(req.params.id),d);return updated.rows[0];});res.json({item:result});}));
app.get('/api/purchases',authenticate,asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query(`SELECT p.id,p.invoice_number,p.created_at,s.id AS supplier_id,s.name AS supplier_name,pi.ingredient_id,i.name AS item_name,i.unit,pi.quantity,pi.unit_cost,p.total,p.paid,COALESCE((SELECT method FROM payments pay WHERE pay.supplier_id=p.supplier_id AND pay.direction='out' AND pay.note LIKE 'Initial payment for invoice %' AND pay.created_at>=p.created_at-interval '1 minute' ORDER BY pay.created_at LIMIT 1),'Cash') AS payment_method FROM purchases p JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN LATERAL (SELECT ingredient_id,quantity,unit_cost FROM purchase_items WHERE purchase_id=p.id ORDER BY id LIMIT 1) pi ON true LEFT JOIN ingredients i ON i.id=pi.ingredient_id WHERE p.organization_id=$1 AND p.branch_id=$2 AND p.status='received' ORDER BY p.created_at DESC LIMIT 500`,[req.user!.organizationId,req.user!.branchId]);res.json({purchases:rows.rows});}));
app.post('/api/purchases/:id/reverse',authenticate,allow('owner','manager','inventory','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const purchaseId=String(req.params.id);const result=await inTransaction(async client=>{const purchase=await client.query("SELECT id,supplier_id,total,paid,invoice_number FROM purchases WHERE id=$1 AND organization_id=$2 AND branch_id=$3 AND status='received' FOR UPDATE",[purchaseId,req.user!.organizationId,req.user!.branchId]);if(!purchase.rowCount)throw Object.assign(new Error('Purchase not found or already reversed'),{status:404});const items=await client.query('SELECT pi.ingredient_id,pi.quantity,i.name,i.stock FROM purchase_items pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.purchase_id=$1 FOR UPDATE OF i',[purchaseId]);for(const item of items.rows){if(Number(item.stock)<Number(item.quantity))throw Object.assign(new Error(`Cannot reverse: insufficient current stock for ${item.name}`),{status:409});}const paid=Number(purchase.rows[0].paid);let refund:unknown[]=[];if(paid>0){const allocations=await client.query("SELECT a.payment_id,a.amount,p.method FROM purchase_payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.purchase_id=$1 AND p.direction='out' ORDER BY p.created_at FOR UPDATE OF p",[purchaseId]);const allocated=allocations.rows.reduce((sum,row)=>sum+Number(row.amount),0);if(Math.abs(allocated-paid)>0.005)throw Object.assign(new Error('Cannot reverse this purchase automatically: payment allocation history is incomplete. Reconcile the supplier ledger first.'),{status:409});for(const allocation of allocations.rows){const refundResult=await client.query("INSERT INTO payments(organization_id,branch_id,supplier_id,amount,method,direction,note,created_by) VALUES($1,$2,$3,$4,$5,'in',$6,$7) RETURNING id,amount,method",[req.user!.organizationId,req.user!.branchId,purchase.rows[0].supplier_id,allocation.amount,allocation.method,`Refund for reversed purchase ${purchase.rows[0].invoice_number}`,req.user!.id]);refund.push(refundResult.rows[0]);}}for(const item of items.rows){await client.query('UPDATE ingredients SET stock=stock-$1,updated_at=now() WHERE id=$2 AND branch_id=$3',[item.quantity,item.ingredient_id,req.user!.branchId]);await client.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,reference_id,note,created_by) VALUES($1,$2,'purchase',$3,$4,$5,$6)",[req.user!.branchId,-Number(item.quantity),purchaseId,`Reversal of purchase ${purchase.rows[0].invoice_number}`,req.user!.id]);}await client.query("UPDATE purchases SET status='cancelled' WHERE id=$1",[purchaseId]);const refreshed=await client.query('SELECT i.id,i.name,i.category,i.unit,i.stock,i.track_stock AS "trackStock",i.reorder_level AS "reorderLevel",i.unit_cost AS "unitCost",i.expires_on AS "expiresOn",s.name AS supplier FROM ingredients i LEFT JOIN suppliers s ON s.id=i.supplier_id WHERE i.id=ANY($1::uuid[]) AND i.branch_id=$2',[items.rows.map(item=>item.ingredient_id),req.user!.branchId]);const supplier=await client.query("SELECT s.id,s.name,s.phone,s.category,COALESCE((SELECT SUM(p.total-p.paid) FROM purchases p WHERE p.supplier_id=s.id AND p.status='received'),0) AS payable FROM suppliers s WHERE s.id=$1 AND s.organization_id=$2",[purchase.rows[0].supplier_id,req.user!.organizationId]);await audit(client,req.user!,'purchase.reversed','purchase',purchaseId,{invoiceNumber:purchase.rows[0].invoice_number,refundAmount:paid,refundPayments:refund.length,items:items.rows.length});return {id:purchaseId,refund,inventory:refreshed.rows,supplier:supplier.rows[0]};});res.json({success:true,...result});}));
app.post('/api/suppliers',authenticate,allow('owner','manager','inventory','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=schema.supplier.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid supplier',details:parsed.error.flatten()});
  const d=parsed.data;
  const supplier=await inTransaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.user!.organizationId+':supplier:'+d.name.toLowerCase()+':'+d.phone]);
    const duplicate=await client.query("SELECT id FROM suppliers WHERE organization_id=$1 AND lower(name)=lower($2) AND COALESCE(phone,'')=$3 LIMIT 1",[req.user!.organizationId,d.name,d.phone]);
    if(duplicate.rowCount)throw Object.assign(new Error('A supplier with this name and phone already exists'),{status:409});
    const result=await client.query('INSERT INTO suppliers(organization_id,name,phone,category) VALUES($1,$2,$3,$4) RETURNING id,name,phone,category,0::numeric AS payable',[req.user!.organizationId,d.name,d.phone,d.category]);
    await audit(client,req.user!,'supplier.created','supplier',result.rows[0].id,{name:d.name,category:d.category});
    return result.rows[0];
  });
  res.status(201).json({supplier});
}));
app.patch('/api/suppliers/:id',authenticate,allow('owner','manager','inventory','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({name:z.string().trim().min(1).max(120).optional(),phone:z.string().trim().max(40).optional(),category:z.string().trim().max(80).optional()}).refine(value=>Object.keys(value).length>0).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid supplier update',details:parsed.error.flatten()});
  const d=parsed.data;
  const supplier=await inTransaction(async client=>{
    const current=await client.query('SELECT id,name,phone,category FROM suppliers WHERE id=$1 AND organization_id=$2 FOR UPDATE',[String(req.params.id),req.user!.organizationId]);
    if(!current.rowCount)throw Object.assign(new Error('Supplier not found'),{status:404});
    const name=d.name??current.rows[0].name, phone=d.phone??current.rows[0].phone??'';
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.user!.organizationId+':supplier:'+name.toLowerCase()+':'+phone]);
    const duplicate=await client.query("SELECT id FROM suppliers WHERE organization_id=$1 AND id<>$2 AND lower(name)=lower($3) AND COALESCE(phone,'')=$4 LIMIT 1",[req.user!.organizationId,String(req.params.id),name,phone]);
    if(duplicate.rowCount)throw Object.assign(new Error('A supplier with this name and phone already exists'),{status:409});
    const updated=await client.query(`UPDATE suppliers SET name=$3,phone=$4,category=$5 WHERE id=$1 AND organization_id=$2 RETURNING id,name,phone,category`,[String(req.params.id),req.user!.organizationId,name,phone,d.category??current.rows[0].category]);
    const balance=await client.query("SELECT COALESCE(SUM(total-paid),0) AS payable FROM purchases WHERE supplier_id=$1 AND organization_id=$2 AND status='received'",[String(req.params.id),req.user!.organizationId]);
    const result={...updated.rows[0],payable:balance.rows[0].payable};
    await audit(client,req.user!,'supplier.updated','supplier',String(req.params.id),{name,phone,category:result.category});
    return result;
  });
  res.json({supplier});
}));
app.get('/api/suppliers',authenticate,asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query(`SELECT s.id,s.name,s.phone,s.category,COALESCE((SELECT SUM(p.total-p.paid) FROM purchases p WHERE p.supplier_id=s.id AND p.organization_id=s.organization_id AND p.status='received'),0) AS payable FROM suppliers s WHERE s.organization_id=$1 ORDER BY s.name`,[req.user!.organizationId]);res.json({suppliers:rows.rows});}));
app.post('/api/purchases',authenticate,allow('owner','manager','inventory','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.purchase.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid purchase',details:parsed.error.flatten()});const d=parsed.data;const total=d.items.reduce((sum,item)=>sum+item.quantity*item.unitCost,0);if(d.paid>total)return res.status(400).json({error:'Paid amount cannot exceed purchase total'});const purchase=await inTransaction(async client=>{const supplier=await client.query('SELECT id FROM suppliers WHERE id=$1 AND organization_id=$2',[d.supplierId,req.user!.organizationId]);if(!supplier.rowCount)throw Object.assign(new Error('Supplier not found'),{status:404});const p=await client.query('INSERT INTO purchases(organization_id,branch_id,supplier_id,invoice_number,total,paid,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[req.user!.organizationId,req.user!.branchId,d.supplierId,d.invoiceNumber,total,d.paid,req.user!.id]);for(const item of d.items){const ing=await client.query('UPDATE ingredients SET stock=stock+$1,track_stock=true,unit_cost=$2,updated_at=now() WHERE id=$3 AND branch_id=$4 RETURNING id',[item.quantity,item.unitCost,item.ingredientId,req.user!.branchId]);if(!ing.rowCount)throw Object.assign(new Error('Ingredient not found in this branch'),{status:404});await client.query('INSERT INTO purchase_items(purchase_id,ingredient_id,quantity,unit_cost,line_total) VALUES($1,$2,$3,$4,$5)',[p.rows[0].id,item.ingredientId,item.quantity,item.unitCost,item.quantity*item.unitCost]);await client.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,reference_id,created_by) VALUES($1,$2,'purchase',$3,$4,$5)",[req.user!.branchId,item.ingredientId,item.quantity,p.rows[0].id,req.user!.id]);}if(d.paid>0){const payment=await client.query("INSERT INTO payments(organization_id,branch_id,supplier_id,amount,method,direction,note,created_by) VALUES($1,$2,$3,$4,$5,'out',$6,$7) RETURNING id",[req.user!.organizationId,req.user!.branchId,d.supplierId,d.paid,d.paymentMethod,`Initial payment for invoice ${d.invoiceNumber}`,req.user!.id]);await client.query('INSERT INTO purchase_payment_allocations(payment_id,purchase_id,amount) VALUES($1,$2,$3)',[payment.rows[0].id,p.rows[0].id,d.paid]);}await audit(client,req.user!,'purchase.received','purchase',p.rows[0].id,{invoiceNumber:d.invoiceNumber,total,paid:d.paid});return p.rows[0];});res.status(201).json({purchase});}));
app.post('/api/suppliers/:id/payments',authenticate,allow('owner','manager','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.payment.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid payment'});const supplier=await pool.query('SELECT id FROM suppliers WHERE id=$1 AND organization_id=$2',[String(req.params.id),req.user!.organizationId]);if(!supplier.rowCount)return res.status(404).json({error:'Supplier not found'});const balance=await pool.query("SELECT COALESCE(SUM(total-paid),0) AS due FROM purchases WHERE supplier_id=$1 AND organization_id=$2 AND status='received'",[String(req.params.id),req.user!.organizationId]);if(parsed.data.amount>Number(balance.rows[0].due))return res.status(400).json({error:'Payment exceeds supplier balance'});const payment=await inTransaction(async client=>{let remaining=parsed.data.amount;const allocations:{purchaseId:string;amount:number}[]=[];const invoices=await client.query("SELECT id,total,paid FROM purchases WHERE supplier_id=$1 AND organization_id=$2 AND status='received' AND paid<total ORDER BY created_at,id FOR UPDATE",[String(req.params.id),req.user!.organizationId]);const lockedBalance=invoices.rows.reduce((sum,invoice)=>sum+Number(invoice.total)-Number(invoice.paid),0);if(parsed.data.amount>lockedBalance)throw Object.assign(new Error('Payment exceeds supplier balance'),{status:400});for(const invoice of invoices.rows){if(remaining<=0)break;const due=Number(invoice.total)-Number(invoice.paid);const amount=Math.min(remaining,due);await client.query('UPDATE purchases SET paid=paid+$1 WHERE id=$2 AND organization_id=$3',[amount,invoice.id,req.user!.organizationId]);allocations.push({purchaseId:String(invoice.id),amount});remaining-=amount;}const r=await client.query("INSERT INTO payments(organization_id,branch_id,supplier_id,amount,method,direction,note,created_by) VALUES($1,$2,$3,$4,$5,'out',$6,$7) RETURNING *",[req.user!.organizationId,req.user!.branchId,String(req.params.id),parsed.data.amount,parsed.data.method,parsed.data.note||'',req.user!.id]);for(const allocation of allocations)await client.query('INSERT INTO purchase_payment_allocations(payment_id,purchase_id,amount) VALUES($1,$2,$3)',[r.rows[0].id,allocation.purchaseId,allocation.amount]);await audit(client,req.user!,'supplier.payment','payment',r.rows[0].id,{amount:parsed.data.amount,invoiceAllocations:allocations.length});return r.rows[0];});res.status(201).json({payment});}));
app.get('/api/settings',authenticate,allow('owner','manager','cashier','kitchen'),asyncRoute(async(req:AuthedRequest,res)=>{const result=await pool.query('SELECT kitchen_acceptance_required AS "kitchenAcceptanceRequired" FROM branch_settings WHERE branch_id=$1',[req.user!.branchId]);res.json({settings:{kitchenAcceptanceRequired:result.rows[0]?.kitchenAcceptanceRequired??false}});}));
app.patch('/api/settings',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=z.object({kitchenAcceptanceRequired:z.boolean()}).strict().safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid branch settings'});const result=await pool.query('INSERT INTO branch_settings(branch_id,kitchen_acceptance_required,updated_at) VALUES($1,$2,now()) ON CONFLICT(branch_id) DO UPDATE SET kitchen_acceptance_required=EXCLUDED.kitchen_acceptance_required,updated_at=now() RETURNING kitchen_acceptance_required AS "kitchenAcceptanceRequired"',[req.user!.branchId,parsed.data.kitchenAcceptanceRequired]);res.json({settings:result.rows[0]});}));
app.get('/api/orders',authenticate,allow('owner','manager','cashier','kitchen','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{
  const limit=Math.min(Math.max(Number(req.query.limit)||100,1),250);
  const rows=await pool.query(`SELECT o.id,o.order_number,o.order_type,o.status,o.subtotal,o.tax,o.discount,o.total,o.notes,o.created_at,
    t.table_number,
    COALESCE(c.name,'Walk-in Guest') AS customer_name,
    GREATEST(0,COALESCE((SELECT SUM(CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END) FROM payments p WHERE p.order_id=o.id),0)) AS paid,
    COALESCE((SELECT p.method FROM payments p WHERE p.order_id=o.id AND p.direction='in' ORDER BY p.created_at DESC LIMIT 1),'Cash') AS payment_method,
    COALESCE((SELECT json_agg(json_build_object('method',p.method,'amount',p.amount) ORDER BY p.method,p.created_at,p.id) FROM payments p WHERE p.order_id=o.id AND p.direction='in'),'[]'::json) AS payment_breakdown,
    COALESCE((SELECT json_agg(json_build_object('id',oi.id,'productId',oi.product_id,'name',oi.product_name,'qty',oi.quantity,'unitPrice',oi.unit_price,'lineTotal',oi.line_total) ORDER BY oi.id) FROM order_items oi WHERE oi.order_id=o.id),'[]'::json) AS items
    FROM orders o LEFT JOIN customers c ON c.id=o.customer_id
    LEFT JOIN restaurant_tables t ON t.id=o.table_id AND t.branch_id=o.branch_id
    WHERE o.branch_id=$1
    ORDER BY o.created_at DESC LIMIT $2`,[req.user!.branchId,limit]);
  res.json({orders:rows.rows});
}));
app.patch('/api/orders/:id/status',authenticate,allow('owner','manager','cashier','kitchen'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({status:z.enum(['Pending','Accepted','Preparing','Ready','Completed','Cancelled'])}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid order status'});
  const result=await inTransaction(async client=>{
    const current=await client.query('SELECT id,order_number,status,table_id FROM orders WHERE id=$1 AND branch_id=$2 AND organization_id=$3 FOR UPDATE',[String(req.params.id),req.user!.branchId,req.user!.organizationId]);
    if(!current.rowCount)throw Object.assign(new Error('Order not found in this branch'),{status:404});
    const previousStatus=String(current.rows[0].status);
    let refundTotal=0;
    if(previousStatus==='Cancelled'&&parsed.data.status!=='Cancelled')throw Object.assign(new Error('A cancelled order cannot be reopened. Create a new order instead.'),{status:409});
    if(previousStatus!=='Cancelled'&&parsed.data.status==='Cancelled'){
      const movements=await client.query("SELECT ingredient_id,SUM(-quantity_delta) AS quantity FROM stock_movements WHERE reference_id=$1 AND movement_type='sale' AND branch_id=$2 GROUP BY ingredient_id",[String(req.params.id),req.user!.branchId]);
      for(const movement of movements.rows){
        const quantity=Number(movement.quantity);
        if(quantity>0){
          await client.query('UPDATE ingredients SET stock=stock+$1,updated_at=now() WHERE id=$2 AND branch_id=$3',[quantity,movement.ingredient_id,req.user!.branchId]);
          await client.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,reference_id,note,created_by) VALUES($1,$2,'adjustment',$3,$4,$5,$6)",[req.user!.branchId,movement.ingredient_id,quantity,String(req.params.id),`Cancelled order #${current.rows[0].order_number} stock returned`,req.user!.id]);
        }
      }
      const refundable=await client.query("SELECT method,SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) AS balance FROM payments WHERE order_id=$1 GROUP BY method HAVING SUM(CASE WHEN direction='in' THEN amount ELSE -amount END)>0 ORDER BY method",[String(req.params.id)]);
      for(const payment of refundable.rows){
        const refund=Number(payment.balance);
        if(refund<=0)continue;
        await client.query("INSERT INTO payments(organization_id,branch_id,order_id,amount,method,direction,note,created_by) VALUES($1,$2,$3,$4,$5,'out',$6,$7)",[req.user!.organizationId,req.user!.branchId,String(req.params.id),refund,payment.method,`Refund for cancelled order #${current.rows[0].order_number}`,req.user!.id]);
        refundTotal+=refund;
      }
    }
    const updated=await client.query('UPDATE orders SET status=$1 WHERE id=$2 AND branch_id=$3 RETURNING id,order_number,status,created_at',[parsed.data.status,String(req.params.id),req.user!.branchId]);if(current.rows[0].table_id&&['Completed','Cancelled'].includes(parsed.data.status))await client.query("UPDATE restaurant_tables SET status='Available',updated_at=now() WHERE id=$1 AND branch_id=$2",[current.rows[0].table_id,req.user!.branchId]);
    await audit(client,req.user!,'order.status_changed','order',String(req.params.id),{from:previousStatus,to:parsed.data.status,stockRestored:previousStatus!=='Cancelled'&&parsed.data.status==='Cancelled',refundTotal:previousStatus!=='Cancelled'&&parsed.data.status==='Cancelled'?refundTotal:0});
    return updated.rows[0];
  });
  res.json({order:result});
}));

const couponCodeSchema=z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
app.get('/api/coupons',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{
  const rows=await pool.query('SELECT id,code,discount_type AS "discountType",discount_value AS "discountValue",minimum_order_amount AS "minimumOrderAmount",maximum_discount AS "maximumDiscount",starts_at AS "startsAt",expires_at AS "expiresAt",usage_limit AS "usageLimit",usage_count AS "usageCount",active FROM coupons WHERE organization_id=$1 AND branch_id=$2 ORDER BY created_at DESC',[req.user!.organizationId,req.user!.branchId]);
  res.json({coupons:rows.rows});
}));
app.post('/api/coupons',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({code:couponCodeSchema,discountType:z.enum(['percent','fixed']),discountValue:z.number().positive().max(1000000),minimumOrderAmount:z.number().min(0).default(0),maximumDiscount:z.number().positive().nullable().optional(),startsAt:z.string().datetime().optional(),expiresAt:z.string().datetime().nullable().optional(),usageLimit:z.number().int().positive().nullable().optional()}).strict().superRefine((d,ctx)=>{if(d.discountType==='percent'&&d.discountValue>100)ctx.addIssue({code:z.ZodIssueCode.custom,path:['discountValue'],message:'Percentage cannot exceed 100'});const effectiveStart=d.startsAt?new Date(d.startsAt):new Date();if(d.expiresAt&&new Date(d.expiresAt)<=effectiveStart)ctx.addIssue({code:z.ZodIssueCode.custom,path:['expiresAt'],message:'Expiry must be after the start date'});}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid coupon',details:parsed.error.flatten()});
  const d=parsed.data,code=d.code.toUpperCase();
  try{
    const saved=await pool.query('INSERT INTO coupons(organization_id,branch_id,code,discount_type,discount_value,minimum_order_amount,maximum_discount,starts_at,expires_at,usage_limit,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()),$9,$10,$11) RETURNING id,code,discount_type AS "discountType",discount_value AS "discountValue",minimum_order_amount AS "minimumOrderAmount",maximum_discount AS "maximumDiscount",starts_at AS "startsAt",expires_at AS "expiresAt",usage_limit AS "usageLimit",usage_count AS "usageCount",active',[req.user!.organizationId,req.user!.branchId,code,d.discountType,d.discountValue,d.minimumOrderAmount,d.maximumDiscount??null,d.startsAt??null,d.expiresAt??null,d.usageLimit??null,req.user!.id]);
    await pool.query('INSERT INTO audit_logs(organization_id,branch_id,user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6,$7)',[req.user!.organizationId,req.user!.branchId,req.user!.id,'coupon.created','coupon',saved.rows[0].id,{code,discountType:d.discountType,discountValue:d.discountValue}]);
    res.status(201).json({coupon:saved.rows[0]});
  }catch(error){if((error as {code?:string}).code==='23505')return res.status(409).json({error:'A coupon with this code already exists in this branch'});throw error;}
}));
app.patch('/api/coupons/:id',authenticate,allow('owner','manager'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({active:z.boolean()}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid coupon update'});
  const saved=await pool.query('UPDATE coupons SET active=$1,updated_at=now() WHERE id=$2 AND organization_id=$3 AND branch_id=$4 RETURNING id,code,discount_type AS "discountType",discount_value AS "discountValue",minimum_order_amount AS "minimumOrderAmount",maximum_discount AS "maximumDiscount",starts_at AS "startsAt",expires_at AS "expiresAt",usage_limit AS "usageLimit",usage_count AS "usageCount",active',[parsed.data.active,String(req.params.id),req.user!.organizationId,req.user!.branchId]);
  if(!saved.rowCount)return res.status(404).json({error:'Coupon not found in this branch'});
  await pool.query('INSERT INTO audit_logs(organization_id,branch_id,user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6,$7)',[req.user!.organizationId,req.user!.branchId,req.user!.id,'coupon.status_changed','coupon',saved.rows[0].id,{active:parsed.data.active}]);
  res.json({coupon:saved.rows[0]});
}));
app.post('/api/coupons/validate',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({code:couponCodeSchema,subtotal:z.number().min(0).max(10000000)}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter a valid coupon code and order subtotal'});
  const code=parsed.data.code.toUpperCase();
  const result=await pool.query('SELECT * FROM coupons WHERE organization_id=$1 AND branch_id=$2 AND code=$3 AND active=true',[req.user!.organizationId,req.user!.branchId,code]);
  if(!result.rowCount)return res.status(404).json({error:'Coupon is not valid for this branch'});
  const coupon=result.rows[0],now=Date.now();
  if(new Date(coupon.starts_at).getTime()>now)return res.status(400).json({error:'Coupon is not active yet'});
  if(coupon.expires_at&&new Date(coupon.expires_at).getTime()<=now)return res.status(400).json({error:'Coupon has expired'});
  if(coupon.usage_limit!==null&&Number(coupon.usage_count)>=Number(coupon.usage_limit))return res.status(400).json({error:'Coupon usage limit has been reached'});
  if(parsed.data.subtotal<Number(coupon.minimum_order_amount))return res.status(400).json({error:'Minimum order subtotal is SAR '+Number(coupon.minimum_order_amount).toFixed(2)});
  let discount=coupon.discount_type==='percent'?parsed.data.subtotal*Number(coupon.discount_value)/100:Number(coupon.discount_value);
  if(coupon.maximum_discount!==null)discount=Math.min(discount,Number(coupon.maximum_discount));
  discount=Number(Math.min(discount,parsed.data.subtotal).toFixed(2));
  res.json({coupon:{id:coupon.id,code:coupon.code,discountType:coupon.discount_type,discountValue:Number(coupon.discount_value)},discount});
}));

app.post('/api/orders',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.order.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid order',details:parsed.error.flatten()});const d=parsed.data;const idempotencyKey=String(req.header('Idempotency-Key')||'').trim();if(idempotencyKey&&!/^[a-zA-Z0-9._:-]{8,64}$/.test(idempotencyKey))return res.status(400).json({error:'Invalid idempotency key'});const requestHash=createHash('sha256').update(JSON.stringify(d)).digest('hex');if(d.orderType==='Dine-in'&&!d.tableId)return res.status(400).json({error:'Select a restaurant table for dine-in orders'});if(d.tableId&&d.orderType!=='Dine-in')return res.status(400).json({error:'A restaurant table can only be assigned to a dine-in order'});const order=await inTransaction(async client=>{await client.query('SELECT id FROM branches WHERE id=$1 AND organization_id=$2 FOR UPDATE',[req.user!.branchId,req.user!.organizationId]);if(idempotencyKey){const previous=await client.query('SELECT * FROM orders WHERE branch_id=$1 AND idempotency_key=$2',[req.user!.branchId,idempotencyKey]);if(previous.rowCount){if(previous.rows[0].request_hash!==requestHash)throw Object.assign(new Error('This checkout key was already used for a different order'),{status:409});return previous.rows[0];}}const products=await client.query('SELECT id,name,price FROM products WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[])',[req.user!.organizationId,d.items.map(i=>i.productId)]);const productById=new Map(products.rows.map(row=>[String(row.id),row]));const missing=d.items.find(line=>!productById.has(line.productId));if(missing)throw Object.assign(new Error('Product is unavailable'),{status:400});if(d.customerId){const customer=await client.query('SELECT id FROM customers WHERE id=$1 AND organization_id=$2',[d.customerId,req.user!.organizationId]);if(!customer.rowCount)throw Object.assign(new Error('Customer is not available in this organization'),{status:400});}if(d.tableId){const table=await client.query("SELECT id,status FROM restaurant_tables WHERE id=$1 AND organization_id=$2 AND branch_id=$3 FOR UPDATE",[d.tableId,req.user!.organizationId,req.user!.branchId]);if(!table.rowCount)throw Object.assign(new Error('Selected table was not found in this branch'),{status:404});if(!['Available','Reserved'].includes(String(table.rows[0].status)))throw Object.assign(new Error('Selected table is not available'),{status:409});}const recipeRows=await client.query('SELECT r.product_id,r.ingredient_id,r.quantity,i.name AS ingredient_name,i.stock FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id WHERE r.product_id=ANY($1::uuid[]) AND i.branch_id=$2 AND i.track_stock=true FOR UPDATE OF i',[d.items.map(i=>i.productId),req.user!.branchId]);const byProduct=new Map<string,typeof recipeRows.rows>();for(const row of recipeRows.rows){const key=String(row.product_id);byProduct.set(key,[...(byProduct.get(key)||[]),row]);}let subtotal=0;const cooked=d.items.map(line=>{const product=productById.get(line.productId)!;const recipe=byProduct.get(line.productId)||[];subtotal+=Number(product.price)*line.quantity;return {line,recipe,product};});const requirements=new Map<string,{name:string;qty:number;stock:number}>();for(const {line,recipe} of cooked)for(const ing of recipe){const key=String(ing.ingredient_id);const prior=requirements.get(key);requirements.set(key,{name:ing.ingredient_name,qty:(prior?.qty||0)+Number(ing.quantity)*line.quantity,stock:Number(ing.stock)});}for(const [id,need] of requirements)if(need.qty>need.stock)throw Object.assign(new Error(`Insufficient stock: ${need.name}`),{status:409});if(d.discount>0 && !['owner','manager'].includes(req.user!.role))throw Object.assign(new Error('Only an owner or manager can authorize order discounts'),{status:403});if(d.couponCode&&d.discount>0)throw Object.assign(new Error('A coupon cannot be combined with a manual discount'),{status:400});subtotal=Number(subtotal.toFixed(2));const tax=Number((subtotal*d.taxRate).toFixed(2));const couponCode=d.couponCode?.trim().toUpperCase()||'';let couponRecord:any=null;let couponDiscount=0;if(couponCode){const found=await client.query('SELECT * FROM coupons WHERE organization_id=$1 AND branch_id=$2 AND code=$3 AND active=true FOR UPDATE',[req.user!.organizationId,req.user!.branchId,couponCode]);if(!found.rowCount)throw Object.assign(new Error('Coupon is not valid for this branch'),{status:400});couponRecord=found.rows[0];const now=Date.now();if(new Date(couponRecord.starts_at).getTime()>now)throw Object.assign(new Error('Coupon is not active yet'),{status:400});if(couponRecord.expires_at&&new Date(couponRecord.expires_at).getTime()<=now)throw Object.assign(new Error('Coupon has expired'),{status:400});if(couponRecord.usage_limit!==null&&Number(couponRecord.usage_count)>=Number(couponRecord.usage_limit))throw Object.assign(new Error('Coupon usage limit has been reached'),{status:400});if(subtotal<Number(couponRecord.minimum_order_amount))throw Object.assign(new Error('Order subtotal does not meet the coupon minimum'),{status:400});couponDiscount=couponRecord.discount_type==='percent'?subtotal*Number(couponRecord.discount_value)/100:Number(couponRecord.discount_value);if(couponRecord.maximum_discount!==null)couponDiscount=Math.min(couponDiscount,Number(couponRecord.maximum_discount));couponDiscount=Number(Math.min(couponDiscount,subtotal).toFixed(2));}const discount=Number((couponCode?couponDiscount:Math.min(d.discount,subtotal+tax)).toFixed(2));const total=Number(Math.max(0,subtotal+tax-discount).toFixed(2));const branchSettings=await client.query('SELECT kitchen_acceptance_required FROM branch_settings WHERE branch_id=$1',[req.user!.branchId]);const initialStatus=branchSettings.rows[0]?.kitchen_acceptance_required?'Pending':'Completed';const numberResult=await client.query('SELECT COALESCE(MAX(order_number),1000)+1 AS next FROM orders WHERE branch_id=$1',[req.user!.branchId]);const created=await client.query("INSERT INTO orders(organization_id,branch_id,customer_id,table_id,order_number,order_type,subtotal,tax,discount,total,coupon_code,status,notes,created_by,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *",[req.user!.organizationId,req.user!.branchId,d.customerId||null,d.tableId||null,numberResult.rows[0].next,d.orderType,subtotal,tax,discount,total,couponCode||null,initialStatus,d.notes||'',req.user!.id,idempotencyKey||null,idempotencyKey?requestHash:null]);if(d.tableId)await client.query("UPDATE restaurant_tables SET status='Occupied',updated_at=now() WHERE id=$1 AND branch_id=$2",[d.tableId,req.user!.branchId]);for(const {line,recipe,product} of cooked){await client.query('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6)',[created.rows[0].id,product.id,product.name,line.quantity,product.price,Number(product.price)*line.quantity]);for(const ing of recipe){const used=Number(ing.quantity)*line.quantity;await client.query('UPDATE ingredients SET stock=stock-$1,updated_at=now() WHERE id=$2 AND branch_id=$3 AND track_stock=true',[used,ing.ingredient_id,req.user!.branchId]);await client.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,reference_id,note,created_by) VALUES($1,$2,'sale',$3,$4,$5,$6)",[req.user!.branchId,ing.ingredient_id,-used,created.rows[0].id,`Order #${numberResult.rows[0].next}`,req.user!.id]);}}const paymentEntries=d.payments?.length?d.payments:[{method:d.paymentMethod,amount:total}];const paymentTotal=paymentEntries.reduce((sum,payment)=>sum+payment.amount,0);if(paymentTotal>total+0.005)throw Object.assign(new Error('Payment total cannot exceed the order total'),{status:400});for(const payment of paymentEntries)await client.query("INSERT INTO payments(organization_id,branch_id,order_id,customer_id,amount,method,direction,note,created_by) VALUES($1,$2,$3,$4,$5,$6,'in',$7,$8)",[req.user!.organizationId,req.user!.branchId,created.rows[0].id,d.customerId||null,payment.amount,payment.method,'Order payment',req.user!.id]);if(couponRecord)await client.query('UPDATE coupons SET usage_count=usage_count+1,updated_at=now() WHERE id=$1',[couponRecord.id]);await audit(client,req.user!,'order.created','order',created.rows[0].id,{orderNumber:numberResult.rows[0].next,total,paid:paymentTotal,payments:paymentEntries,initialStatus,couponCode:couponCode||null,discount});return created.rows[0];});res.status(201).json({order});}));
app.get('/api/payables',authenticate,allow('owner','manager','inventory','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query("SELECT s.id,s.name,s.phone,COALESCE(SUM(p.total-p.paid),0) AS due FROM suppliers s JOIN purchases p ON p.supplier_id=s.id AND p.branch_id=$1 AND p.status='received' WHERE s.organization_id=$2 GROUP BY s.id HAVING SUM(p.total-p.paid)>0 ORDER BY due DESC",[req.user!.branchId,req.user!.organizationId]);res.json({payables:rows.rows});}));
app.get('/api/expenses',authenticate,allow('owner','manager','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const rows=await pool.query(`SELECT id,category,description,amount,payment_method AS "paymentMethod",expense_date::text AS date,created_at AS "createdAt" FROM expenses WHERE organization_id=$1 AND branch_id=$2 ORDER BY expense_date DESC,created_at DESC LIMIT 1000`,[req.user!.organizationId,req.user!.branchId]);res.json({expenses:rows.rows});}));
app.post('/api/expenses',authenticate,allow('owner','manager','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const parsed=schema.expense.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid expense',details:parsed.error.flatten()});const d=parsed.data;const result=await inTransaction(async client=>{const inserted=await client.query(`INSERT INTO expenses(organization_id,branch_id,category,description,amount,payment_method,expense_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7::date,$8) RETURNING id,category,description,amount,payment_method AS "paymentMethod",expense_date::text AS date,created_at AS "createdAt"`,[req.user!.organizationId,req.user!.branchId,d.category,d.description,d.amount,d.paymentMethod,d.date,req.user!.id]);await audit(client,req.user!,'expense.created','expense',inserted.rows[0].id,d);return inserted.rows[0];});res.status(201).json({expense:result});}));
app.delete('/api/expenses/:id',authenticate,allow('owner','manager','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{const result=await inTransaction(async client=>{const deleted=await client.query('DELETE FROM expenses WHERE id=$1 AND organization_id=$2 AND branch_id=$3 RETURNING id,category,description,amount',[String(req.params.id),req.user!.organizationId,req.user!.branchId]);if(!deleted.rowCount)throw Object.assign(new Error('Expense not found'),{status:404});await audit(client,req.user!,'expense.deleted','expense',deleted.rows[0].id,deleted.rows[0]);return deleted.rows[0];});res.json({success:true,expense:result});}));

const reportDate=z.string().refine(value=>{const date=new Date(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;},'Use a real date in YYYY-MM-DD format');
app.get('/api/reports/summary',authenticate,allow('owner','manager','accountant'),asyncRoute(async(req:AuthedRequest,res)=>{
  const parsed=z.object({from:reportDate,to:reportDate}).refine(v=>v.from<=v.to).safeParse({from:req.query.from,to:req.query.to});
  if(!parsed.success)return res.status(400).json({error:'Provide a valid date range (from/to: YYYY-MM-DD)'});
  const {from,to}=parsed.data;
  const scope=[req.user!.organizationId,req.user!.branchId,from,to];
  const [sales,byMethod,byType,daily,expenses,purchases,purchasePayments,payroll]=await Promise.all([
    pool.query(`SELECT COUNT(*) FILTER(WHERE status<>'Cancelled')::int AS orders,
      COALESCE(SUM(total) FILTER(WHERE status<>'Cancelled'),0) AS revenue,
      COALESCE(SUM(subtotal) FILTER(WHERE status<>'Cancelled'),0) AS subtotal,
      COALESCE(SUM(tax) FILTER(WHERE status<>'Cancelled'),0) AS tax,
      COALESCE(SUM(discount) FILTER(WHERE status<>'Cancelled'),0) AS discounts
      FROM orders WHERE organization_id=$1 AND branch_id=$2 AND created_at >= $3::date AND created_at < ($4::date + interval '1 day')`,scope),
    pool.query(`SELECT p.method,COALESCE(SUM(CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END),0) AS amount
      FROM payments p JOIN orders o ON o.id=p.order_id AND o.organization_id=$1 AND o.branch_id=$2 AND o.status<>'Cancelled'
      WHERE p.organization_id=$1 AND p.branch_id=$2 AND p.order_id IS NOT NULL AND p.created_at >= $3::date AND p.created_at < ($4::date + interval '1 day') GROUP BY p.method ORDER BY p.method`,scope),
    pool.query(`SELECT order_type AS type,COUNT(*)::int AS orders,COALESCE(SUM(total),0) AS revenue
      FROM orders WHERE organization_id=$1 AND branch_id=$2 AND status<>'Cancelled' AND created_at >= $3::date AND created_at < ($4::date + interval '1 day') GROUP BY order_type ORDER BY order_type`,scope),
    pool.query(`SELECT created_at::date::text AS date,COUNT(*) FILTER(WHERE status<>'Cancelled')::int AS orders,
      COALESCE(SUM(total) FILTER(WHERE status<>'Cancelled'),0) AS revenue
      FROM orders WHERE organization_id=$1 AND branch_id=$2 AND created_at >= $3::date AND created_at < ($4::date + interval '1 day') GROUP BY created_at::date ORDER BY created_at::date`,scope),
    pool.query(`SELECT category,COALESCE(SUM(amount),0) AS amount FROM expenses
      WHERE organization_id=$1 AND branch_id=$2 AND expense_date BETWEEN $3::date AND $4::date GROUP BY category ORDER BY category`,scope),
    pool.query(`SELECT COUNT(*)::int AS invoices,COALESCE(SUM(total),0) AS total,COALESCE(SUM(paid),0) AS paid,
      COALESCE(SUM(total-paid),0) AS outstanding FROM purchases
      WHERE organization_id=$1 AND branch_id=$2 AND status='received' AND created_at >= $3::date AND created_at < ($4::date + interval '1 day')`,scope),
    pool.query(`SELECT COALESCE(SUM(amount),0) AS paid FROM payments
      WHERE organization_id=$1 AND branch_id=$2 AND supplier_id IS NOT NULL AND direction='out'
      AND created_at >= $3::date AND created_at < ($4::date + interval '1 day')`,scope),
    pool.query(`SELECT COALESCE(SUM(pp.amount),0) AS paid FROM payroll_payments pp
      WHERE pp.organization_id=$1 AND pp.branch_id=$2 AND pp.payment_date BETWEEN $3::date AND $4::date`,scope)
  ]);
  const summary=sales.rows[0];
  const expenseTotal=expenses.rows.reduce((sum,row)=>sum+Number(row.amount),0);
  const purchase=purchases.rows[0];
  const purchasePaidOutflow=Number(purchasePayments.rows[0].paid);
  const payrollPaid=Number(payroll.rows[0].paid);
  const revenue=Number(summary.revenue);
  const operatingOutflow=expenseTotal+purchasePaidOutflow+payrollPaid;
  res.json({period:{from,to},sales:{...summary,averageOrderValue:Number(summary.orders)?revenue/Number(summary.orders):0,byPaymentMethod:byMethod.rows,byOrderType:byType.rows,daily:daily.rows},expenses:{total:expenseTotal,byCategory:expenses.rows},purchases:purchase,payroll:{paid:payrollPaid},purchasePayments:{paid:purchasePaidOutflow},operatingOutflow,netAfterRecordedOutflows:revenue-operatingOutflow});
}));
app.get('/api/deliveries',authenticate,allow('owner','manager','cashier','delivery'),asyncRoute(async(req:AuthedRequest,res)=>{
  const [rows,drivers]=await Promise.all([
    pool.query(`SELECT d.id,d.order_id,o.order_number,o.status AS order_status,o.total,o.created_at AS order_created_at,
      COALESCE(c.name,'Walk-in Guest') AS customer_name,COALESCE(c.phone,'') AS customer_phone,
      d.delivery_address,d.delivery_note,d.status,d.assigned_driver_id,
      COALESCE(u.display_name,'Unassigned') AS driver_name,d.assigned_at,d.picked_up_at,d.delivered_at,d.updated_at
      FROM deliveries d JOIN orders o ON o.id=d.order_id LEFT JOIN customers c ON c.id=o.customer_id
      LEFT JOIN users u ON u.id=d.assigned_driver_id
      WHERE d.organization_id=$1 AND d.branch_id=$2 AND ($3::text<>'delivery' OR d.assigned_driver_id=$4)
      ORDER BY d.created_at DESC LIMIT 250`,[req.user!.organizationId,req.user!.branchId,req.user!.role,req.user!.id]),
    pool.query(`SELECT id,display_name FROM users WHERE organization_id=$1 AND branch_id=$2 AND role='delivery' AND active=true ORDER BY display_name`,[req.user!.organizationId,req.user!.branchId])
  ]);
  res.json({deliveries:rows.rows,drivers:drivers.rows});
}));
app.post('/api/deliveries/:orderId/assign',authenticate,allow('owner','manager','cashier'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const parsed=schema.delivery.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid delivery assignment',details:parsed.error.flatten()});
  const d=parsed.data;
  const delivery=await inTransaction(async client=>{
    const order=await client.query(`SELECT id,order_number,status FROM orders WHERE id=$1 AND organization_id=$2 AND branch_id=$3 AND order_type='Home Delivery' FOR UPDATE`,[String(req.params.orderId),req.user!.organizationId,req.user!.branchId]);
    if(!order.rowCount)throw Object.assign(new Error('Home delivery order not found in this branch'),{status:404});
    if(order.rows[0].status==='Cancelled'||order.rows[0].status==='Completed')throw Object.assign(new Error('Cancelled or completed orders cannot be dispatched'),{status:409});
    const driver=await client.query(`SELECT id FROM users WHERE id=$1 AND organization_id=$2 AND branch_id=$3 AND role='delivery' AND active=true`,[d.driverId,req.user!.organizationId,req.user!.branchId]);
    if(!driver.rowCount)throw Object.assign(new Error('Choose an active delivery user from this branch'),{status:400});
    const saved=await client.query(`INSERT INTO deliveries(organization_id,branch_id,order_id,assigned_driver_id,status,delivery_address,delivery_note,assigned_at)
      VALUES($1,$2,$3,$4,'Assigned',$5,$6,now())
      ON CONFLICT(order_id) DO UPDATE SET assigned_driver_id=EXCLUDED.assigned_driver_id,status='Assigned',delivery_address=EXCLUDED.delivery_address,delivery_note=EXCLUDED.delivery_note,assigned_at=now(),updated_at=now()
      RETURNING id,order_id,assigned_driver_id,status,delivery_address,delivery_note,assigned_at,picked_up_at,delivered_at,updated_at`,[req.user!.organizationId,req.user!.branchId,order.rows[0].id,d.driverId,d.address,d.note]);
    await audit(client,req.user!,'delivery.assigned','delivery',saved.rows[0].id,{orderNumber:order.rows[0].order_number,driverId:d.driverId});
    return saved.rows[0];
  });
  res.status(200).json({delivery});
}));
app.patch('/api/deliveries/:id/status',authenticate,allow('owner','manager','cashier','delivery'),asyncRoute(async(req:AuthedRequest,res:Response)=>{
  const parsed=z.object({status:z.enum(['Picked Up','Delivered','Failed'])}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid delivery status'});
  const delivery=await inTransaction(async client=>{
    const current=await client.query(`SELECT d.id,d.status,d.assigned_driver_id,o.order_id FROM deliveries d JOIN (SELECT id AS order_id,status FROM orders) o ON o.order_id=d.order_id
      WHERE d.id=$1 AND d.organization_id=$2 AND d.branch_id=$3 FOR UPDATE OF d`,[String(req.params.id),req.user!.organizationId,req.user!.branchId]);
    if(!current.rowCount)throw Object.assign(new Error('Delivery not found in this branch'),{status:404});
    if(req.user!.role==='delivery'&&current.rows[0].assigned_driver_id!==req.user!.id)throw Object.assign(new Error('You can only update deliveries assigned to you'),{status:403});
    const previous=String(current.rows[0].status),next=parsed.data.status;
    const allowed:Record<string,string[]>={Pending:['Picked Up','Failed'],Assigned:['Picked Up','Failed'],'Picked Up':['Delivered','Failed'],Delivered:[],Failed:['Picked Up']};
    if(!allowed[previous]?.includes(next))throw Object.assign(new Error('This delivery status transition is not allowed'),{status:409});
    const saved=await client.query(`UPDATE deliveries SET status=$1,picked_up_at=CASE WHEN $1='Picked Up' THEN now() ELSE picked_up_at END,delivered_at=CASE WHEN $1='Delivered' THEN now() ELSE delivered_at END,updated_at=now() WHERE id=$2 RETURNING id,order_id,assigned_driver_id,status,delivery_address,delivery_note,assigned_at,picked_up_at,delivered_at,updated_at`,[next,String(req.params.id)]);
    if(next==='Delivered')await client.query(`UPDATE orders SET status='Completed' WHERE id=$1 AND branch_id=$2 AND status NOT IN ('Cancelled','Completed')`,[saved.rows[0].order_id,req.user!.branchId]);
    await audit(client,req.user!,'delivery.status_updated','delivery',saved.rows[0].id,{from:previous,to:next});
    return saved.rows[0];
  });
  res.json({delivery});
}));
registerHrRoutes(app,{pool,inTransaction,authenticate,allow,asyncRoute,audit});
registerReportRoutes(app,{pool,authenticate,allow,asyncRoute});
const frontendDist=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
app.use(express.static(frontendDist,{index:false}));
app.get('/menu',(req,res,next)=>res.sendFile(resolve(frontendDist,'menu.html'),error=>{if(error)next(error);}));
app.use((error:Error&{status?:number},_req:Request,res:Response,_next:NextFunction)=>{console.error(error);res.status(error.status||500).json({error:error.status?error.message:'Internal server error'});});
const port=Number(process.env.PORT||3001);app.listen(port,()=>console.log(`Musafir API listening on ${port}`));
