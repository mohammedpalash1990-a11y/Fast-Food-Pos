import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateAdvanceDeduction, centsToDecimal, computeNetCents, hasAtMostTwoDecimals,
  isDateNotInFuture, isValidIsoDate, isValidPeriod, payrollStatus, toCents
} from '../../server/payroll-math.js';

test('money uses integer halalas and rejects invalid precision', () => {
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents('1234.56'), 123456);
  assert.equal(centsToDecimal(5), '0.05');
  assert.equal(hasAtMostTwoDecimals(10.25), true);
  assert.equal(hasAtMostTwoDecimals(10.255), false);
});

test('net salary and payment status are calculated exactly', () => {
  assert.equal(computeNetCents({baseCents:300000,bonusCents:20000,advanceDeductionCents:30000,otherDeductionCents:10000}), 280000);
  assert.equal(payrollStatus(280000,0), 'Unpaid');
  assert.equal(payrollStatus(280000,100000), 'Part-paid');
  assert.equal(payrollStatus(280000,280000), 'Paid');
});

test('advance deductions allocate oldest-first and never exceed outstanding advances', () => {
  const advances=[{id:'old',outstandingCents:20000},{id:'new',outstandingCents:30000}];
  assert.deepEqual(allocateAdvanceDeduction(advances,35000),[{id:'old',takeCents:20000},{id:'new',takeCents:15000}]);
  assert.equal(allocateAdvanceDeduction(advances,50001),null);
});

test('calendar dates and payroll periods reject invalid values', () => {
  assert.equal(isValidIsoDate('2024-02-29'),true);
  assert.equal(isValidIsoDate('2026-02-31'),false);
  assert.equal(isValidPeriod('2026-11'),true);
  assert.equal(isValidPeriod('2026-13'),false);
  const now=new Date('2026-11-07T10:00:00Z');
  assert.equal(isDateNotInFuture('2026-11-08',now),true);
  assert.equal(isDateNotInFuture('2026-11-09',now),false);
});
