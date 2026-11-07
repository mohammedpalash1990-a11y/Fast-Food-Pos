import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNetCents, hasAtMostTwoDecimals, isDateNotInFuture, isValidIsoDate,
  isValidPeriod, payrollStatus, toCents, centsToDecimal
} from '../../server/payroll-math.js';

test('SAR amounts convert to integer halalas without floating point drift', () => {
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents('1234.56'), 123456);
  assert.equal(centsToDecimal(5), '0.05');
  assert.equal(centsToDecimal(123450), '1234.50');
});

test('money accepts no more than two decimal places', () => {
  assert.equal(hasAtMostTwoDecimals(10.25), true);
  assert.equal(hasAtMostTwoDecimals(0.1 + 0.2), true);
  assert.equal(hasAtMostTwoDecimals(10.255), false);
  assert.equal(hasAtMostTwoDecimals(Number.POSITIVE_INFINITY), false);
});

test('net salary subtracts both advance and other deductions', () => {
  assert.equal(computeNetCents(3000, 200, 300, 100), 280000);
  assert.equal(computeNetCents(1000, 0, 0, 0), 100000);
});

test('payroll status is derived from exact integer balances', () => {
  assert.equal(payrollStatus(280000, 0), 'Unpaid');
  assert.equal(payrollStatus(280000, 100000), 'Part-paid');
  assert.equal(payrollStatus(280000, 280000), 'Paid');
  assert.equal(payrollStatus(0, 0), 'Paid');
});

test('date and payroll-period validation rejects impossible calendar values', () => {
  assert.equal(isValidIsoDate('2024-02-29'), true);
  assert.equal(isValidIsoDate('2026-02-31'), false);
  assert.equal(isValidIsoDate('2026-13-01'), false);
  assert.equal(isValidPeriod('2026-11'), true);
  assert.equal(isValidPeriod('2026-13'), false);
});

test('attendance/payment date validation allows one day of timezone slack', () => {
  const now = new Date('2026-11-07T10:00:00Z');
  assert.equal(isDateNotInFuture('2026-11-08', now), true);
  assert.equal(isDateNotInFuture('2026-11-09', now), false);
  assert.equal(isDateNotInFuture('2026-02-31', now), false);
});
