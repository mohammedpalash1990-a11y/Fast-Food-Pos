const fs = require('node:fs');

const entry = require.resolve('body-parser');
let source = fs.readFileSync(entry, 'utf8');
const exportsToStub = ['json', 'raw', 'text', 'urlencoded'];
let changed = false;

for (const name of exportsToStub) {
  // body-parser 1.x uses lazy getters; 2.x exposes direct require assignments.
  const replacement = `exports.${name} = function ${name} () { return function ${name}Middleware (req, res, next) { next() } }`;
  const directExport = new RegExp(`exports\\\\.${name}\\\\s*=\\\\s*require\\\\(['"]\\\\.\\\\/(?:lib\\\\/)?types\\\\/${name}['"]\\\\)`);
  const lazyGetterExport = new RegExp(`Object\\\\.defineProperty\\\\(exports,\\\\s*['"]${name}['"],\\\\s*\\\\{[\\\\s\\\\S]*?get:\\\\s*createParserGetter\\\\(['"]${name}['"]\\\\)[\\\\s\\\\S]*?\\\\}\\\\s*\\\\)`);

  if (directExport.test(source)) {
    source = source.replace(directExport, replacement);
    changed = true;
  } else if (lazyGetterExport.test(source)) {
    source = source.replace(lazyGetterExport, replacement);
    changed = true;
  } else if (!source.includes(`exports.${name} = function ${name} ()`)) {
    throw new Error(`Unsupported body-parser export layout for "${name}" at ${entry}; refusing an unsafe patch.`);
  }
}

if (changed) fs.writeFileSync(entry, source);
console.log('Cloudflare-compatible body-parser exports installed; API JSON parsing uses the application parser.');
