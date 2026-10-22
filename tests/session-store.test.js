const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const FileStore = require('../src/services/file-session-store');
test('Sesiones: persistencia entre instancias, caducidad y destrucción', async () => {
  const directory = path.resolve(__dirname, '../.local/test-store-' + crypto.randomUUID());
  const store = new FileStore(directory), second = new FileStore(directory);
  const call = (instance, method, ...args) => new Promise((resolve, reject) => instance[method](...args, (error, result) => error ? reject(error) : resolve(result)));
  try {
    await call(store, 'set', 'sesion-de-prueba', { userId: 123, cookie: { expires: new Date(Date.now() + 60000).toISOString() } });
    const data = await call(second, 'get', 'sesion-de-prueba'); assert.equal(data.userId, 123);
    await call(store, 'destroy', 'sesion-de-prueba'); assert.equal(await call(second, 'get', 'sesion-de-prueba'), null);
    await call(store, 'set', 'vencida', { cookie: { expires: new Date(Date.now() - 1000).toISOString() } });
    assert.equal(await call(second, 'get', 'vencida'), null);
    assert.deepEqual(await fs.readdir(directory), []);
  } finally {
    clearInterval(store.timer); clearInterval(second.timer);
    await fs.rmdir(directory);
  }
});
