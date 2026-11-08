// Guards the hand-written theme overrides in src/index.css.
//
// Tailwind arbitrary-value classes such as `bg-[#191e24]`, `border-white/[.07]`
// and `bg-white/[.035]` are ALSO written by hand as selectors in index.css.
// If the `#`, `.` or `:` characters inside those selectors are not escaped
// exactly the way Tailwind escapes them, the browser drops the whole rule,
// which silently breaks the light POS theme and the compact responsive grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cssPath = fileURLToPath(new URL('../../src/index.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

// Selectors that must survive CSS parsing, copied from the Tailwind output
// for the equivalent utilities.
const requiredSelectors = [
  '.musafir-pos .bg-white\\/\\[\\.035\\]',
  '.musafir-pos .bg-\\[\\#191e24\\]',
  '.musafir-pos .border-white\\/\\[\\.07\\]',
  '.musafir-pos .text-\\[\\#e7b943\\]',
  '.musafir-pos > aside .max-h-\\[34vh\\]',
  '.musafir-pos > section .grid.grid-cols-2.sm\\:grid-cols-3'
];

test('hand-written theme selectors use valid CSS escapes', () => {
  for (const selector of requiredSelectors) {
    assert.ok(css.includes(selector), `src/index.css is missing a valid "${selector}" rule`);
  }
});

test('index.css contains no doubled backslash escapes inside class selectors', () => {
  // `\\#` / `\\[` only ever appear when a selector was escaped twice.
  const doubled = css
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.includes('\\\\') && line.includes('{'));
  assert.deepEqual(
    doubled.map(({ number, line }) => `${number}: ${line.trim()}`),
    [],
    'selectors are escaped twice, so browsers and the CSS minifier drop them'
  );
});

test('a literal # or . inside a bracket selector is escaped', () => {
  const unescapedHash = /\.(?:bg|text|border)-\\\[#/;
  const unescapedDot = /\.(?:bg|text|border)-[a-z]+\\\/\\\[\./;
  assert.equal(unescapedHash.test(css), false, 'escape # as \\# inside [ #hex ] selectors');
  assert.equal(unescapedDot.test(css), false, 'escape . as \\. inside [ .opacity ] selectors');
});
