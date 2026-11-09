const fs = require('node:fs');

const entry = require.resolve('body-parser');
let source = fs.readFileSync(entry, 'utf8');
const exportsToStub = ['json', 'raw', 'text', 'urlencoded'];
let changed = false;

for (const name of exportsToStub) {
  const original = new RegExp(`exports\\.${name} = require\\(['"]\\./types/${name}['"]\\)`);
  const replacement = `exports.${name} = function ${name} () { return function ${name}Middleware (req, res, next) { next() } }`;
  if (original.test(source)) {
    source = source.replace(original, replacement);
    changed = true;
  } else if (!source.includes(`exports.${name} = function ${name} ()`)) {
    throw new Error(`Could not safely patch body-parser export: ${name}`);
  }
}

if (changed) fs.writeFileSync(entry, source);
console.log('Cloudflare-compatible body-parser exports installed; API JSON parsing uses the application parser.');
