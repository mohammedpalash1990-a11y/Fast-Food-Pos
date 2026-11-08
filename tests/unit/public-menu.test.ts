// Pure helpers behind the customer QR menu (B7).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNCATEGORISED, buildMenuSections, buildMenuShareUrl, formatSar, menuApiPath, normaliseMenuPayload, parseMenuQuery
} from '../../src/menu/menu-model.js';

const branchId = '4b0a4b62-6c3e-4f7a-9f52-2f5f8d2b1c11';

test('menu links are read defensively from the query string', () => {
  assert.deepEqual(parseMenuQuery('?branch=' + branchId + '&table=12'), { branchId, table: '12' });
  assert.deepEqual(parseMenuQuery('branch=' + branchId), { branchId, table: null });
  // `branchId` is accepted because the API uses that name.
  assert.deepEqual(parseMenuQuery('?branchId=' + branchId), { branchId, table: null });
  assert.deepEqual(parseMenuQuery(''), { branchId: null, table: null });
  assert.deepEqual(parseMenuQuery('?branch=%20%20&table='), { branchId: null, table: null });
  assert.equal(parseMenuQuery('?table=' + 'x'.repeat(80)).table?.length, 24);
});

test('the public menu is requested over a relative URL', () => {
  assert.equal(menuApiPath(branchId), '/api/menu?branchId=' + branchId);
  assert.equal(menuApiPath('a b'), '/api/menu?branchId=a%20b');
  assert.ok(!menuApiPath(branchId).includes('localhost'));
});

test('share links point at the customer menu page', () => {
  assert.equal(
    buildMenuShareUrl('https://pos.example.com/', branchId, '7'),
    'https://pos.example.com/menu.html?branch=' + branchId + '&table=7'
  );
  assert.equal(buildMenuShareUrl('https://pos.example.com', branchId), 'https://pos.example.com/menu.html?branch=' + branchId);
});

test('prices render as SAR with two decimals and thousand separators', () => {
  assert.equal(formatSar(12), 'SAR 12.00');
  assert.equal(formatSar('7.5'), 'SAR 7.50');
  assert.equal(formatSar(1234.567), 'SAR 1,234.57');
  assert.equal(formatSar(1234567.891), 'SAR 1,234,567.89');
  assert.equal(formatSar(-3), 'SAR 0.00');
  assert.equal(formatSar('not a price'), 'SAR 0.00');
  assert.equal(formatSar(null), 'SAR 0.00');
});

test('menu sections group by category, sort items and keep the fallback last', () => {
  const sections = buildMenuSections([
    { id: '1', name: 'Zinger Burger', price: '18.00', category: 'Burgers' },
    { id: '2', name: 'Beef Burger', price: 22, category: 'Burgers' },
    { id: '3', name: 'Cola', price: '5', category: 'Drinks' },
    { id: '4', name: 'Mystery Box', price: '10', category: '' },
    { name: 'No id', price: 1, category: 'Burgers' },
    { id: '6', price: 1, category: 'Burgers' }
  ]);
  assert.deepEqual(sections.map(section => section.title), ['Burgers', 'Drinks', UNCATEGORISED]);
  assert.deepEqual(sections[0].items.map(item => item.name), ['Beef Burger', 'Zinger Burger']);
  assert.equal(sections[0].items[0].price, 22);
  assert.equal(sections[1].items[0].name, 'Cola');
});

test('a valid public menu payload becomes a renderable view', () => {
  const view = normaliseMenuPayload({
    branch: { id: branchId, name: 'Main Branch', code: 'MAIN', organizationName: 'Musafir Fast Food' },
    products: [
      { id: 'p1', name: 'Beef Burger', price: '22.00', category: 'Burgers', description: 'Charcoal grilled', image_url: 'https://cdn/x.jpg' },
      { id: 'p2', name: 'Cola', price: '5.00', category: 'Drinks' }
    ],
    generatedAt: '2026-11-08T10:00:00.000Z'
  });
  assert.equal(view.branch.name, 'Main Branch');
  assert.equal(view.branch.organizationName, 'Musafir Fast Food');
  assert.equal(view.itemCount, 2);
  assert.deepEqual(view.categories, ['Burgers', 'Drinks']);
  assert.deepEqual(view.sections[0].items[0], {
    id: 'p1', name: 'Beef Burger', price: 22, image: 'https://cdn/x.jpg', description: 'Charcoal grilled', category: 'Burgers'
  });
  assert.equal(view.generatedAt, '2026-11-08T10:00:00.000Z');
});

test('malformed payloads produce a readable error instead of an empty menu', () => {
  assert.throws(() => normaliseMenuPayload(null), /could not be loaded/i);
  assert.throws(() => normaliseMenuPayload({ products: [] }), /menu link is not valid/i);
  assert.throws(() => normaliseMenuPayload({ branch: { id: branchId } }), /could not be loaded/i);
  const view = normaliseMenuPayload({ branch: { id: branchId }, products: [] });
  assert.equal(view.itemCount, 0);
  assert.equal(view.branch.name, 'Musafir Fast Food');
  assert.equal(view.generatedAt, null);
});
