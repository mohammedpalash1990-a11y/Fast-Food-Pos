import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../../src/App.tsx', import.meta.url));
const cssPath = fileURLToPath(new URL('../../src/index.css', import.meta.url));
const app = readFileSync(appPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');

test('POS workspace renders products, checkout and live orders as three distinct columns', () => {
  assert.match(app, /className="musafir-pos grid gap-4 xl:grid-cols-\[minmax\(0,1\.12fr\)_minmax\(330px,\.9fr\)_minmax\(290px,\.82fr\)\]"/);
  assert.match(app, /heading\('Front counter','Create an order'/);
  assert.match(app, /<h2 className="mt-1 text-lg font-semibold text-white">Current order/);
  assert.match(app, /<h2 className="mt-1 text-lg font-semibold text-white">Live orders<\/h2>/);
});

test('live order queue displays active orders and uses the existing status/payment guard', () => {
  assert.match(app, /orders\.filter\(order=>order\.number!=='HOLD'&&!\['Completed','Cancelled'\]\.includes\(order\.status\)\)/);
  assert.match(app, /updateOrderStatus\(order,nextStatus\)/);
  assert.match(app, /order\.paid\+0\.005>=order\.total/);
  assert.match(app, /No active orders\. New counter and QR orders will appear here\./);
});

test('desktop uses three columns while tablet and mobile remain responsive', () => {
  assert.match(css, /@media \(min-width: 1280px\)[\s\S]*?\.musafir-pos \{ grid-template-columns: minmax\(0, 1\.12fr\) minmax\(330px, \.9fr\) minmax\(290px, \.82fr\)/);
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1279px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
});

test('Modern Ivory uses forest-green sidebar and topbar with warm ivory workspace and gold accents', () => {
  assert.match(app, /preset:'Modern Ivory', appearance:'Light'/);
  assert.match(css, /linear-gradient\(160deg, #19382c 0%, #172f25 56%, #142b22 100%\)/);
  assert.match(css, /linear-gradient\(105deg, #19382c 0%, #142b22 100%\)/);
  assert.match(css, /background: #f4f1e9 !important/);
  assert.match(css, /#b89b68/);
});

test('food image product cards remain in the POS product grid', () => {
  assert.match(app, /<img src=\{product\.image\} alt=\{product\.name\} loading="lazy"/);
  assert.match(app, /filteredProducts\.map\(product=>/);
});
