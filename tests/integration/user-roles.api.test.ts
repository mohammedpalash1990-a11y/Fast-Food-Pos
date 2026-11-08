// Branch-scoped user administration and server-enforced role tests.
import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {Pool} from 'pg';

const API=(process.env.API_URL||'http://localhost:3001').replace(/\/$/,'');
const db=new Pool({connectionString:process.env.DATABASE_URL,max:3});
const suffix=randomUUID().slice(0,8);
const ids:Record<string,string>={};
let ownerToken='',managerToken='',cashierToken='';

async function call(method:string,path:string,body?:unknown,token=ownerToken){
 const response=await fetch(API+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body===undefined?undefined:JSON.stringify(body)});
 let parsed:any=null;try{parsed=await response.json();}catch{/* empty */}
 return {status:response.status,body:parsed};
}
async function makeUser(role:string,email:string){
 return (await db.query('INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[ids.org,ids.branch,email,await bcrypt.hash('Role-Test-Password-1',4),role+' Test',role])).rows[0].id;
}
function sign(id:string){return jwt.sign({sub:id},process.env.JWT_SECRET!,{expiresIn:'8h',issuer:'musafir-pos'});}

before(async()=>{
 for(let i=0;i<40;i++){try{const health=await fetch(API+'/api/health');if(health.ok)break;}catch{/* API starting */}await new Promise(resolve=>setTimeout(resolve,1000));if(i===39)throw new Error('API did not become healthy');}
 ids.org=(await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id',['Roles IT '+suffix,'roles-it-'+suffix])).rows[0].id;
 ids.branch=(await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id',[ids.org,'Roles Branch','RL-'+suffix])).rows[0].id;
 ids.owner=await makeUser('owner','owner-'+suffix+'@it.local');
 ids.manager=await makeUser('manager','manager-'+suffix+'@it.local');
 ids.cashier=await makeUser('cashier','cashier-'+suffix+'@it.local');
 ownerToken=sign(ids.owner);managerToken=sign(ids.manager);cashierToken=sign(ids.cashier);
});

after(async()=>{
 if(ids.org){await db.query('DELETE FROM audit_logs WHERE organization_id=$1',[ids.org]);await db.query('DELETE FROM users WHERE organization_id=$1',[ids.org]);await db.query('DELETE FROM branches WHERE id=$1',[ids.branch]);await db.query('DELETE FROM organizations WHERE id=$1',[ids.org]);}
 await db.end();
});

test('owner and manager can list branch staff and create scoped accounts',async()=>{
 const list=await call('GET','/api/users');
 assert.equal(list.status,200);
 assert.equal(list.body.users.length,3);
 const created=await call('POST','/api/users',{email:'new-'+suffix+'@it.local',displayName:'New Cashier',password:'Strong-Temporary-Password-1',role:'cashier'},managerToken);
 assert.equal(created.status,201,JSON.stringify(created.body));
 assert.equal(created.body.user.role,'cashier');
 assert.equal(created.body.user.active,true);
 const duplicate=await call('POST','/api/users',{email:'new-'+suffix+'@it.local',displayName:'Duplicate',password:'Strong-Temporary-Password-1',role:'cashier'});
 assert.equal(duplicate.status,409);
});

test('role assignment, deactivation and owner safeguards are enforced server-side',async()=>{
 const forbiddenPromotion=await call('POST','/api/users',{email:'owner-new-'+suffix+'@it.local',displayName:'New Owner',password:'Strong-Temporary-Password-1',role:'owner'},managerToken);
 assert.equal(forbiddenPromotion.status,403);
 const forbiddenList=await call('GET','/api/users',undefined,cashierToken);
 assert.equal(forbiddenList.status,403);
 const forbiddenRoleChange=await call('PATCH','/api/users/'+ids.cashier,{role:'manager'},cashierToken);
 assert.equal(forbiddenRoleChange.status,403);
 const selfDisable=await call('PATCH','/api/users/'+ids.owner,{active:false});
 assert.equal(selfDisable.status,400);
 const lastOwner=await call('PATCH','/api/users/'+ids.owner,{role:'manager'});
 assert.equal(lastOwner.status,409);
 const promoted=await call('PATCH','/api/users/'+ids.cashier,{role:'inventory'});
 assert.equal(promoted.status,200);
 assert.equal(promoted.body.user.role,'inventory');
 const disabled=await call('PATCH','/api/users/'+ids.cashier,{active:false});
 assert.equal(disabled.status,200);
 assert.equal(disabled.body.user.active,false);
});
