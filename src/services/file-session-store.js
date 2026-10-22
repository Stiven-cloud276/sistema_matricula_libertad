const session = require('express-session');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
class FileSessionStore extends session.Store {
  constructor(directory) {
    super(); this.directory = directory;
    this.ready = fs.mkdir(directory, { recursive: true, mode: 0o700 });
    this.timer = setInterval(() => this.sweep().catch(() => {}), 15 * 60 * 1000);
    this.timer.unref();
  }
  file(sid) { return path.join(this.directory, crypto.createHash('sha256').update(sid).digest('hex') + '.json'); }
  get(sid, cb) {
    this.ready.then(async () => {
      try {
        const data = JSON.parse(await fs.readFile(this.file(sid), 'utf8'));
        if (new Date(data.cookie.expires).getTime() <= Date.now()) { await fs.unlink(this.file(sid)).catch(() => {}); return null; }
        return data;
      } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    }).then(v => cb(null, v), cb);
  }
  set(sid, data, cb = () => {}) {
    this.ready.then(async () => {
      const file = this.file(sid), tmp = `${file}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data), { mode: 0o600 });
      await fs.rename(tmp, file);
    }).then(() => cb(), cb);
  }
  destroy(sid, cb = () => {}) { fs.unlink(this.file(sid)).catch(e => { if (e.code !== 'ENOENT') throw e; }).then(() => cb(), cb); }
  async sweep() {
    await this.ready;
    for (const file of await fs.readdir(this.directory)) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(this.directory, file);
      try { const data = JSON.parse(await fs.readFile(full, 'utf8')); if (new Date(data.cookie.expires).getTime() <= Date.now()) await fs.unlink(full); } catch { /* Concurrent logout. */ }
    }
  }
}
module.exports = FileSessionStore;
