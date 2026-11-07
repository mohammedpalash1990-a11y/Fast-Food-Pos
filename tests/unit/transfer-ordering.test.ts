import test from 'node:test';
import assert from 'node:assert/strict';
import { orderTablesByForeignKeys, PREFERRED_TABLE_ORDER } from '../../server/transfer/ordering.js';

const names = (result: { order: string[] }) => result.order.join(',');

test('a referenced table is always written before the table that references it', () => {
  const { order, cycles } = orderTablesByForeignKeys(
    ['orders', 'order_items', 'products', 'organizations'],
    [
      { table: 'orders', references: 'organizations' },
      { table: 'order_items', references: 'orders' },
      { table: 'order_items', references: 'products' }
    ]
  );
  assert.deepEqual(cycles, []);
  const index = (name: string) => order.indexOf(name);
  assert.ok(index('organizations') < index('orders'));
  assert.ok(index('orders') < index('order_items'));
  assert.ok(index('products') < index('order_items'));
});

test('derived ordering adapts to a new foreign key without code changes', () => {
  // orders.table_id -> restaurant_tables did not exist in the old hard-coded list.
  const { order } = orderTablesByForeignKeys(
    ['orders', 'restaurant_tables', 'organizations'],
    [
      { table: 'orders', references: 'organizations' },
      { table: 'orders', references: 'restaurant_tables' }
    ],
    PREFERRED_TABLE_ORDER
  );
  assert.ok(order.indexOf('restaurant_tables') < order.indexOf('orders'));
});

test('the preferred order breaks ties so runs are reproducible', () => {
  const edges = [{ table: 'payments', references: 'organizations' }];
  const first = orderTablesByForeignKeys(['payments', 'organizations', 'audit_logs'], edges, PREFERRED_TABLE_ORDER);
  const second = orderTablesByForeignKeys(['audit_logs', 'organizations', 'payments'], edges, PREFERRED_TABLE_ORDER);
  assert.equal(names(first), names(second));
  assert.equal(names(first), 'organizations,payments,audit_logs');
});

test('an unresolvable cycle is reported instead of producing an unsafe order', () => {
  const { order, cycles } = orderTablesByForeignKeys(
    ['a', 'b', 'c'],
    [
      { table: 'a', references: 'b' },
      { table: 'b', references: 'a' }
    ]
  );
  assert.deepEqual(order, ['c']);
  assert.deepEqual(cycles, [['a', 'b']]);
});

test('foreign keys pointing outside the transfer set are ignored', () => {
  const { order, cycles } = orderTablesByForeignKeys(
    ['orders'],
    [{ table: 'orders', references: 'organizations' }]
  );
  assert.deepEqual(order, ['orders']);
  assert.deepEqual(cycles, []);
});
