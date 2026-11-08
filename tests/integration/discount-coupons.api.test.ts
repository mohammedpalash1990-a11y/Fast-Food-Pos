// Discount coupon API and checkout redemption integration tests.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const API=(process.env.API_URL||'http://localhost:3001').replace(/\/$/,'');
const db=new Pool({connectionString:process.env.DATABASE_URL,max:3});
const suffix=randomUUID().slice(0,8);
const ids:Record<string,string>={};
let token='';

async function call(method:string,path:string,body?:unknown,auth=token){
  const response=await fetch(API+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:body===undefined?undefined:JSON.stringify(body)});
  let parsed:any=null;try{parsed=await response.json();}catch{/* empty */}
  return {status:response.status,body:parsed};
}

before(async()=>{
  for(let attempt=0;attempt<40;attempt++){
    try{const health=await fetch(API+'/api/health');if(health.ok)break;}catch{/* API starting */}
    await new Promise(resolve=>setTimeout(resolve,1000));
    if(attempt===39)throw new Error('API did not become healthy');
  }
  ids.org=(await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id',['Coupon IT '+suffix,'coupon-it-'+suffix])).rows[0].id;
  ids.branch=(await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id',[ids.org,'Coupon Branch','CP-'+suffix])).rows[0].id;
  ids.user=(await db.query('INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[ids.org,ids.branch,'coupon-'+suffix+'@it.local',await bcrypt.hash('Coupon-Integration-Pass-1',4),'Coupon Owner','owner'])).rows[0].id;
  ids.category=(await db.query('INSERT INTO categories(organization_id,name) VALUES($1,$2) RETURNING id',[ids.org,'Coupon Test']).rows[0].id;
  ids.product=(await db.query('INSERT INTO products(organization_id,category_id,sku,name,price) VALUES($1,$2,$3,$4,$5) RETURNING id',[ids.org,ids.category,'CP-'+suffix,'Coupon Test Meal',20])).rows[0].id;
  token=jwt.sign({sub:ids.user},process.env.JWT_SECRET!,{expiresIn:'8h',issuer:'musafir-pos'});
});

after(async()=>{
  if(ids.org){
    await db.query('DELETE FROM payments WHERE organization_id=$1',[ids.org]);
    await db.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE organization_id=$1)',[ids.org]);
    await db.query('DELETE FROM orders WHERE organization_id=$1',[ids.org]);
    await db.query('DELETE FROM discount_coupons WHERE organization_id=$1',[ids.org]);
    await db.query('DELETE FROM audit_logs WHERE organization_id=$1',[ids.org]);
    await db.query('DELETE FROM products WHERE organization_id=$1',[ids.org]);
    await db.query('DELETE FROM users WHERE organization_id=$1',[ids.org]);
    await db.query('DELETE FROM categories WHERE organization_id=$1',[ids.org]);
    await db.query('DELETE FROM branches WHERE id=$1',[ids.branch]);
    await db.query('DELETE FROM organizations WHERE id=$1',[ids.org]);
  }
  await db.end();
});

test('coupon creation, preview, checkout redemption and usage limits are enforced atomically',async()=>{
  const created=await call('POST','/api/discounts',{code:'SAVE10',discountType:'percentage',discountValue:10,minSubtotal:15,usageLimit:1,maxDiscount:3});
  assert.equal(created.status,201,JSON.stringify(created.body));
  ids.coupon=created.body.coupon.id;
  const duplicate=await call('POST','/api/discounts',{code:'save10',discountType:'percentage',discountValue:10});
  assert.equal(duplicate.status,409);

  const preview=await call('POST','/api/discounts/preview',{code:'save10',items:[{productId:ids.product,quantity:1}]});
  assert.equal(preview.status,200,JSON.stringify(preview.body));
  assert.equal(Number(preview.body.subtotal),20);
  assert.equal(Number(preview.body.discount),2);
  assert.equal(Number(preview.body.total),21);

  const tooSmall=await call('POST','/api/discounts/preview',{code:'SAVE10',items:[{productId:ids.product,quantity:1}]});
  assert.equal(tooSmall.status,200);
  assert.equal(Number(tooSmall.body.discount),2);

  const stacked=await call('POST','/api/orders',{orderType:'Takeaway',paymentMethod:'Cash',taxRate:.15,discount:1,couponCode:'SAVE10',items:[{productId:ids.product,quantity:1}]});
  assert.equal(stacked.status,400);
  const beforeUse=await db.query('SELECT used_count FROM discount_coupons WHERE id=$1',[ids.coupon]);
  assert.equal(beforeUse.rows[0].used_count,0);

  const order=await call('POST','/api/orders',{orderType:'Takeaway',paymentMethod:'Mada',taxRate:.15,discount:0,couponCode:'SAVE10',items:[{productId:ids.product,quantity:1}]});
  assert.equal(order.status,201,JSON.stringify(order.body));
  assert.equal(Number(order.body.order.total),21);
  const saved=await db.query('SELECT coupon_id,coupon_code,discount,total FROM orders WHERE id=$1',[order.body.order.id]);
  assert.equal(saved.rows[0].coupon_id,ids.coupon);
  assert.equal(saved.rows[0].coupon_code,'SAVE10');
  assert.equal(Number(saved.rows[0].discount),2);
  const used=await db.query('SELECT used_count FROM discount_coupons WHERE id=$1',[ids.coupon]);
  assert.equal(used.rows[0].used_count,1);

  const exhausted=await call('POST','/api/discounts/preview',{code:'SAVE10',items:[{productId:ids.product,quantity:1}]});
  assert.equal(exhausted.status,404);
  const replay=await call('POST','/api/orders',{orderType:'Takeaway',paymentMethod:'Cash',taxRate:.15,couponCode:'SAVE10',items:[{productId:ids.product,quantity:1}]});
  assert.equal(replay.status,400);
});

test('coupon administration is restricted to owner and manager roles',async()=>{
  const cashier=(await db.query('INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[ids.org,ids.branch,'cashier-'+suffix+'@it.local',await bcrypt.hash('Cashier-Integration-Pass-1',4),'Coupon Cashier','cashier'])).rows[0].id;
  const cashierToken=jwt.sign({sub:cashier},process.env.JWT_SECRET!,{expiresIn:'8h',issuer:'musafir-pos'});
  const create=await call('POST','/api/discounts',{code:'CASHIER',discountType:'fixed',discountValue:2},cashierToken);
  assert.equal(create.status,403);
  const list=await call('GET','/api/discounts',undefined,cashierToken);
  assert.equal(list.status,403);
  const preview=await call('POST','/api/discounts/preview',{code:'SAVE10',items:[{productId:ids.product,quantity:1}]},cashierToken);
  assert.equal(preview.status,404);
});
