require('dotenv').config({ quiet: true });
const app = require('./src/app');
const pool = require('./src/config/database');
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Sistema de matrículas · http://localhost:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
});
