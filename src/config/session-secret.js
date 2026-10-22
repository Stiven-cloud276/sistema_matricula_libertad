const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
module.exports = function secret() {
  if (process.env.SESSION_SECRET?.length >= 32) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('Configura SESSION_SECRET (mínimo 32 caracteres) para producción.');
  const dir = path.join(__dirname, '../../.local');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'session-secret');
  try { fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return fs.readFileSync(file, 'utf8');
};
