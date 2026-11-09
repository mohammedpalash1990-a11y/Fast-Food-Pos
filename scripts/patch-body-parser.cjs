const fs = require('node:fs');

const entry = require.resolve('body-parser');
let source = fs.readFileSync(entry, 'utf8');
const exportsToStub = ['json', 'raw', 'text', 'urlencoded'];
let changed = false;

for (const name of exportsToStub) {
  // body-parser 1.x and 2.x expose these factories from different relative paths.
  const original = new RegExp(\`exports\\.\${name}\\s*=\\s*require\\(['"]\\.\\/(?:lib\\/)?types\\/\${name}['"]\\)\`);
  const replacement = \`exports.\${name} = function \${name} () { return function \${name}Middleware (req, res, next) { next() } }\`;
  if (original.test(source)) {
    source = source.replace(original, replacement);
    changed = true;
  } else if (!source.includes(\`exports.\${name} = function \${name} ()\`)) {
    throw new Error(\`Unsupported body-parser export layout for "\${name}" at \${entry}; refusing an unsafe patch.\`);
  }
}

if (changed) fs.writeFileSync(entry, source);
console.log('Cloudflare-compatible body-parser exports installed; API JSON parsing uses the application parser.');
