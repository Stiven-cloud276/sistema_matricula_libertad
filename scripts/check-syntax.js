const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let total = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status) { process.stderr.write(result.stderr); process.exitCode = 1; } total++; }
  }
}
for (const dir of ['src', 'public/js', 'scripts', 'tests']) walk(path.join(__dirname, '..', dir));
const result = spawnSync(process.execPath, ['--check', path.join(__dirname, '../server.js')], { encoding: 'utf8' });
if (result.status) { process.stderr.write(result.stderr); process.exitCode = 1; }
console.log(`Sintaxis revisada en ${total + 1} archivos JavaScript.`);
