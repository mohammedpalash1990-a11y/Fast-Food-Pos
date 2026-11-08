import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../../src/App.tsx', import.meta.url));
const cssPath = fileURLToPath(new URL('../../src/index.css', import.meta.url));
const app = readFileSync(appPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');

test('menu search is available on desktop and mobile and focuses the menu input', () => {
  // JSX event expressions can contain `>`; use a cross-line match for the input attributes.
  assert.match(app, /onClick=\{focusMenuSearch\}[^>]*md:flex/);
  assert.match(app, /onClick=\{focusMenuSearch\}[^>]*md:hidden/);
  assert.ok(app.includes('ref={menuSearchRef}'), 'menu search input must expose its focus ref');
  assert.ok(app.includes('placeholder="Search menu..."'), 'menu search input must remain identifiable');
  assert.match(app, /event\.key\.toLowerCase\(\) !== 'k'/);
  assert.match(app, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(app, /menuSearchRef\.current\?\.focus\(\)/);
});

test('theme studio exposes all five presets and custom appearance modes', () => {
  for (const preset of ['Arabian Royal', 'Midnight Executive', 'Obsidian Luxe', 'Burgundy Signature', 'Modern Ivory']) {
    assert.ok(app.includes(preset), `missing theme preset: ${preset}`);
  }
  assert.match(app, /\['Both','Light','Dark'\]/);
  assert.match(app, /type="color"/);
  assert.match(app, /Live preview/);
});

test('theme apply and reset persist the actual Modern Ivory default', () => {
  assert.match(app, /save\('musafir-theme-config',draftThemeConfig\)/);
  assert.match(app, /save\('musafir-theme-light',draftLight\)/);
  assert.match(app, /Default Modern Ivory theme restored\./);
  assert.doesNotMatch(app, /Default Arabian Royal theme restored\./);
});

test('global theme tokens and responsive POS theme rules remain present', () => {
  assert.ok(app.includes('className={`theme-shell'));
  assert.match(css, /\.theme-shell\.theme-light/);
  assert.match(css, /var\(--theme-surface\)/);
  assert.match(css, /var\(--theme-accent\)/);
});
