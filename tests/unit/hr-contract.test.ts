import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hrSchemas } from '../../server/hr.js';

const uuid='11111111-1111-4111-8111-111111111111';

test('employee and attendance inputs are validated',()=>{
  assert.deepEqual(hrSchemas.employeeCreate.parse({name:' Ali ',salary:2500.5}),{name:'Ali',role:'Staff',shift:'Morning',salary:2500.5});
  assert.equal(hrSchemas.employeeCreate.safeParse({name:'Ali',salary:-1}).success,false);
  assert.equal(hrSchemas.employeeUpdate.safeParse({}).success,false);
  assert.equal(hrSchemas.attendance.safeParse({employeeId:uuid,status:'Present',date:'2026-02-30'}).success,false);
  assert.equal(hrSchemas.attendance.safeParse({employeeId:uuid,status:'Late'}).success,false);
});

test('payroll accepts legacy deduction input and explicit other deduction',()=>{
  assert.equal(hrSchemas.payrollCreate.safeParse({employeeId:uuid,period:'2026-11',deduction:10}).success,true);
  assert.equal(hrSchemas.payrollCreate.safeParse({employeeId:uuid,period:'2026-11',otherDeduction:10,deductionNote:'Penalty'}).success,true);
  assert.equal(hrSchemas.payrollCreate.safeParse({employeeId:uuid,period:'2026-13'}).success,false);
  assert.equal(hrSchemas.payrollCreate.safeParse({employeeId:uuid,period:'2026-11',otherDeduction:-1}).success,false);
});

test('salary payment accepts Cash and Mada only',()=>{
  assert.equal(hrSchemas.payment.safeParse({amount:10,method:'Cash'}).success,true);
  assert.equal(hrSchemas.payment.safeParse({amount:10,method:'Mada'}).success,true);
  assert.equal(hrSchemas.payment.safeParse({amount:10,method:'Card'}).success,false);
  assert.equal(hrSchemas.payment.safeParse({amount:0,method:'Cash'}).success,false);
});

test('HR routes require authentication, role checks and branch scoping',()=>{
  const source=readFileSync(new URL('../../server/hr.ts',import.meta.url),'utf8');
  const routes=source.split('\n').filter(line=>/app\.(get|post|patch|delete)\('\/api\//.test(line));
  assert.ok(routes.length>=10);
  for(const line of routes) assert.match(line,/guard\(/);
  assert.match(source,/organization_id/);
  assert.match(source,/branch_id/);
});
